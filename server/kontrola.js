/*
 * server/kontrola.js — riziková previerka partnera podľa IČO.
 *
 * Agreguje viacero verejných registrov (všetko fail-soft — zlyhanie jedného
 * zdroja nezhodí celú previerku):
 *   - RÚZ  (registeruz.sk)      — finančné zdravie: identita, závierky, orientačné výnosy/náklady/výsledok
 *   - RPVS (rpvs.gov.sk)        — je partner v Registri partnerov verejného sektora + počet KÚV
 *   - Insolvencia              — odkaz na register insolvenčných konaní / Obchodný vestník (manuálne)
 *   - Exekúcie (CRE)           — platený Centrálny register exekúcií; automatizované len s API kľúčom
 *
 * Konfigurácia cez env premenné (nepovinné):
 *   RPVS_ODATA_BASE   (default https://rpvs.gov.sk/opendatav2)
 *   RPVS_ODATA_ENTITY (default Partneri)
 *   CRE_API_URL, CRE_API_KEY  — ak sú nastavené, exekúcie sa overia automaticky
 */

const RUZ = 'https://www.registeruz.sk/cruz-public/api';
const RUZ_WEB = 'https://www.registeruz.sk/cruz-public/domain/accountingentity/simplesearch';
const RPVS_BASE = process.env.RPVS_ODATA_BASE || 'https://rpvs.gov.sk/opendatav2';
const RPVS_ENTITY = process.env.RPVS_ODATA_ENTITY || 'Partneri';
const RPVS_WEB = 'https://rpvs.gov.sk/rpvs/Partner/Partner/VyhladavaniePartnera';
const OV_WEB = 'https://obchodnyvestnik.justice.gov.sk/ObchodnyVestnik/Formular/FormulareZverejnene.aspx';
const CRE_WEB = 'https://www.cre.sk';

/* ---------- pomocné ---------- */

function normalizeIco(ico) { return String(ico || '').replace(/\D/g, ''); }
function round2(n) { return Math.round((Number(n) || 0) * 100) / 100; }

/** fetch s časovým limitom, vráti JSON alebo hodí chybu. */
async function jget(url, { timeout = 8000 } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  try {
    const r = await fetch(url, {
      signal: ctrl.signal,
      headers: { Accept: 'application/json', 'User-Agent': 'ucto-erp/kontrola' },
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}

/* ---------- RÚZ: finančné zdravie ---------- */

/** Z tabuľky výkazu vytiahne súčtový (posledný nenulový) číselný údaj. */
function tableTotal(tab) {
  const data = (tab && tab.data) || [];
  for (let i = data.length - 1; i >= 0; i--) {
    const n = Number(String(data[i]).replace(',', '.'));
    if (Number.isFinite(n) && n !== 0) return n;
  }
  return 0;
}
function tableNameSk(tab) {
  const n = tab && tab.nazov;
  if (!n) return '';
  return String(typeof n === 'object' ? (n.sk || Object.values(n)[0] || '') : n).toLowerCase();
}

async function ruzCheck(ico) {
  const url = `${RUZ_WEB}?query=${encodeURIComponent(ico)}`;
  const list = await jget(`${RUZ}/uctovne-jednotky?zmenene-od=2000-01-01&max-zaznamov=1&ico=${ico}`);
  const id0 = list && Array.isArray(list.id) ? list.id[0] : null;
  if (!id0) return { ok: true, found: false, url };

  const uj = await jget(`${RUZ}/uctovna-jednotka?id=${id0}`);
  const statements = Array.isArray(uj.idUctovnychZavierok) ? uj.idUctovnychZavierok : [];
  const dissolved = !!uj.datumZrusenia;

  // najnovšia závierka: preskúmaj posledné (najvyššie id) závierky a vyber podľa obdobieDo
  let latest = null;
  const candidates = statements.slice(-4);
  for (const zid of candidates) {
    try {
      const z = await jget(`${RUZ}/uctovna-zavierka?id=${zid}`);
      if (!latest || String(z.obdobieDo || '') > String(latest.obdobieDo || '')) latest = z;
    } catch { /* preskoč */ }
  }

  // orientačné finančné čísla z prvého výkazu najnovšej závierky (ak sú tabuľky Výnosy/Náklady)
  let revenue = null, costs = null, result = null, period = latest ? (latest.obdobieDo || '') : '';
  if (latest && Array.isArray(latest.idUctovnychVykazov) && latest.idUctovnychVykazov[0]) {
    try {
      const vyk = await jget(`${RUZ}/uctovny-vykaz?id=${latest.idUctovnychVykazov[0]}`);
      const tabs = (vyk.obsah && vyk.obsah.tabulky) || [];
      const vyn = tabs.find(t => /výnos|vynos|príjm|prijm/.test(tableNameSk(t)));
      const nak = tabs.find(t => /náklad|naklad|výdav|vydav/.test(tableNameSk(t)));
      if (vyn) revenue = round2(tableTotal(vyn));
      if (nak) costs = round2(tableTotal(nak));
      if (revenue != null && costs != null) result = round2(revenue - costs);
    } catch { /* orientačné čísla nie sú kritické */ }
  }

  const flags = [];
  if (dissolved) flags.push({ level: 'critical', text: `Účtovná jednotka zrušená (${uj.datumZrusenia}).` });
  const nowYear = new Date().getFullYear();
  const lastYear = Number(String(period).slice(0, 4)) || null;
  if (!statements.length) flags.push({ level: 'warning', text: 'Bez zverejnenej účtovnej závierky.' });
  else if (lastYear && lastYear < nowYear - 2) flags.push({ level: 'warning', text: `Posledná závierka je z roku ${lastYear}.` });
  if (result != null && result < 0) flags.push({ level: 'warning', text: `Orientačný výsledok hospodárenia je záporný (${result}).` });

  return {
    ok: true, found: true, url,
    name: uj.nazovUJ || '',
    address: [uj.ulica, uj.psc, uj.mesto].filter(Boolean).join(', '),
    legalForm: uj.pravnaForma || '',
    skNace: uj.skNace || '',
    dissolved, dissolvedOn: uj.datumZrusenia || '',
    statementsCount: statements.length,
    lastPeriod: period,
    revenue, costs, result, // orientačné
    flags,
  };
}

/* ---------- RPVS: partner verejného sektora ---------- */

async function rpvsCheck(ico) {
  const url = RPVS_WEB;
  try {
    const q = `${RPVS_BASE}/${RPVS_ENTITY}?$filter=${encodeURIComponent(`Ico eq '${ico}'`)}&$format=json`;
    const data = await jget(q, { timeout: 8000 });
    const rows = (data && (data.value || data)) || [];
    const arr = Array.isArray(rows) ? rows : [];
    return {
      ok: true, url,
      registered: arr.length > 0,
      count: arr.length,
      note: arr.length ? 'Partner je evidovaný v RPVS.' : 'Partner nie je v RPVS (nedostáva verejné zdroje nad limit).',
    };
  } catch (e) {
    // fail-soft: automatizované overenie zlyhalo → ponúkni manuálny odkaz
    return { ok: false, url, error: e.message, note: 'Automatické overenie RPVS zlyhalo — skontrolujte cez odkaz.' };
  }
}

/* ---------- Insolvencia (register insolvenčných konaní / Obchodný vestník) ---------- */

function insolvencyCheck(ico) {
  // Bezplatné per-IČO JSON API nie je spoľahlivo dostupné → manuálne overenie cez odkaz.
  return {
    ok: true, status: 'manual',
    url: OV_WEB,
    note: 'Insolvenciu/konkurz overte v Obchodnom vestníku (konkurzy a reštrukturalizácie) podľa IČO.',
  };
}

/* ---------- Exekúcie (Centrálny register exekúcií — platený) ---------- */

async function executionsCheck(ico) {
  const base = process.env.CRE_API_URL, key = process.env.CRE_API_KEY;
  if (!base || !key) {
    return {
      ok: true, status: 'requires_key', url: CRE_WEB,
      note: 'Centrálny register exekúcií je platený. Automatické overenie sa zapne po nastavení CRE_API_URL a CRE_API_KEY.',
    };
  }
  try {
    const sep = base.includes('?') ? '&' : '?';
    const data = await jget(`${base}${sep}ico=${ico}`, { timeout: 10000 });
    // očakávaný tvar prispôsobte poskytovateľovi; tolerantné čítanie:
    const count = Number(data.count ?? (Array.isArray(data.items) ? data.items.length : (Array.isArray(data) ? data.length : 0))) || 0;
    return { ok: true, status: count > 0 ? 'found' : 'clear', count, url: CRE_WEB };
  } catch (e) {
    return { ok: false, status: 'error', url: CRE_WEB, error: e.message };
  }
}

/* ---------- skóre rizika ---------- */

function scoreRisk(sources) {
  const flags = [];
  const push = (level, text) => flags.push({ level, text });

  for (const f of (sources.ruz && sources.ruz.flags) || []) push(f.level, 'RÚZ: ' + f.text);
  if (sources.ruz && sources.ruz.found === false) push('info', 'RÚZ: účtovná jednotka sa nenašla.');

  if (sources.executions && sources.executions.status === 'found') {
    push('critical', `Exekúcie: nájdených ${sources.executions.count} záznamov.`);
  } else if (sources.executions && sources.executions.status === 'requires_key') {
    push('info', 'Exekúcie: vyžaduje platený prístup (neoverené).');
  }
  if (sources.insolvency && sources.insolvency.status === 'manual') {
    push('info', 'Insolvencia: overte manuálne v Obchodnom vestníku.');
  } else if (sources.insolvency && sources.insolvency.status === 'found') {
    push('critical', 'Insolvencia: nájdené konkurzné/reštrukturalizačné konanie.');
  }
  if (sources.rpvs && sources.rpvs.registered) push('info', 'RPVS: partner verejného sektora.');

  const levels = flags.map(f => f.level);
  const risk = levels.includes('critical') ? 'critical' : levels.includes('warning') ? 'warning' : 'ok';
  return { risk, flags };
}

/* ---------- agregátor ---------- */

async function kontrola(icoRaw) {
  const ico = normalizeIco(icoRaw);
  if (ico.length < 6 || ico.length > 8) {
    const err = new Error('Neplatné IČO (6–8 číslic).');
    err.status = 400;
    throw err;
  }
  const [ruz, rpvs, executions] = await Promise.all([
    ruzCheck(ico).catch(e => ({ ok: false, error: e.message, url: `${RUZ_WEB}?query=${ico}` })),
    rpvsCheck(ico).catch(e => ({ ok: false, error: e.message, url: RPVS_WEB })),
    executionsCheck(ico).catch(e => ({ ok: false, status: 'error', error: e.message, url: CRE_WEB })),
  ]);
  const insolvency = insolvencyCheck(ico);
  const sources = { ruz, rpvs, insolvency, executions };
  const { risk, flags } = scoreRisk(sources);
  return {
    ico,
    name: (ruz && ruz.name) || '',
    checkedAt: new Date().toISOString().slice(0, 10),
    risk, flags, sources,
  };
}

module.exports = { kontrola, ruzCheck, rpvsCheck, insolvencyCheck, executionsCheck, scoreRisk, tableTotal, tableNameSk };
