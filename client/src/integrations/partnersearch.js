/*
 * integrations/partnersearch.js — inteligentné vyhľadávanie partnerov (lokálne, bez API).
 *
 * - bez diakritiky ("kosice" nájde "Košice", "zilina" nájde "Žilina")
 * - viac slov / tokenov: každé slovo musí sedieť aspoň v jednom poli (AND cez tokeny)
 * - hľadá naprieč poliami: názov, IČO, DIČ, IČ DPH, mesto, ulica, e-mail, telefón
 * - poradie výsledkov podľa relevancie (zhoda na začiatku názvu > v názve > iné pole)
 */

/** Odstráni diakritiku a zjednotí na malé písmená. */
export function normalize(s) {
  return String(s ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // odstráň diakritické znamienka
    .toLowerCase().trim();
}

/** Polia partnera, v ktorých hľadáme (a ich váha pre poradie). */
const FIELDS = [
  { key: 'name', weight: 100 },
  { key: 'ico', weight: 60 },
  { key: 'dic', weight: 55 },
  { key: 'icdph', weight: 55 },
  { key: 'city', weight: 40 },
  { key: 'street', weight: 30 },
  { key: 'email', weight: 25 },
  { key: 'phone', weight: 25 },
];

/** Pripraví normalizovaný index polí partnera. */
function fieldsOf(row) {
  const s = {};
  for (const f of FIELDS) s[f.key] = normalize(row[f.key]);
  // pri IČO/DIČ/IČ DPH hľadáme aj po odstránení nečíslicových znakov a medzier
  s.icoDigits = String(row.ico ?? '').replace(/\D/g, '');
  s.vatDigits = String(row.icdph ?? '').replace(/[^0-9a-z]/gi, '').toLowerCase();
  return s;
}

/**
 * Skóre zhody jedného tokenu voči partnerovi. 0 = token nesedí nikde.
 * Prefixová zhoda dostáva bonus (dôležité pre „našepkávanie").
 */
function tokenScore(fields, token) {
  let best = 0;
  for (const f of FIELDS) {
    const v = fields[f.key];
    if (!v) continue;
    const idx = v.indexOf(token);
    if (idx < 0) continue;
    const atStart = idx === 0;
    const atWord = atStart || v[idx - 1] === ' ';
    const bonus = atStart ? 3 : atWord ? 2 : 1;
    best = Math.max(best, f.weight * bonus);
  }
  // číselné polia: token proti čistým číslam (IČO/DIČ) a IČ DPH
  if (/^[0-9]/.test(token)) {
    if (fields.icoDigits.includes(token)) best = Math.max(best, 70 * (fields.icoDigits.startsWith(token) ? 3 : 1));
    if (fields.vatDigits.includes(token)) best = Math.max(best, 60 * (fields.vatDigits.startsWith(token) ? 3 : 1));
  } else if (fields.vatDigits.includes(token)) {
    best = Math.max(best, 60); // napr. "sk2020"
  }
  return best;
}

/**
 * Inteligentné filtrovanie + zoradenie partnerov podľa dopytu.
 * @param {object[]} rows  partneri
 * @param {string} query   hľadaný výraz (viac slov je AND)
 * @returns {object[]}      zhody zoradené podľa relevancie (pri prázdnom dopyte pôvodné poradie)
 */
export function smartFilter(rows, query) {
  const q = normalize(query);
  if (!q) return rows;
  const tokens = q.split(/\s+/).filter(Boolean);
  const scored = [];
  for (const row of rows) {
    const fields = fieldsOf(row);
    let total = 0, allMatch = true;
    for (const t of tokens) {
      const sc = tokenScore(fields, t);
      if (sc === 0) { allMatch = false; break; }
      total += sc;
    }
    if (allMatch) scored.push({ row, score: total });
  }
  scored.sort((a, b) => b.score - a.score || String(a.row.name || '').localeCompare(String(b.row.name || ''), 'sk'));
  return scored.map(s => s.row);
}

/**
 * Návrhy pre našepkávač (autocomplete) — max N zhôd s krátkym popisom.
 * @returns {{id, label, sub}[]}
 */
export function suggest(rows, query, limit = 8) {
  return smartFilter(rows, query).slice(0, limit).map(r => ({
    id: r.id,
    label: r.name || '(bez názvu)',
    sub: [r.ico && ('IČO ' + r.ico), r.city].filter(Boolean).join(' · '),
  }));
}
