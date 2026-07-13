/*
 * server/rpo.js — Register právnických osôb, podnikateľov a OVM (ŠÚSR).
 *
 * Oficiálne verejné JSON API (bez kľúča, licencia CC-BY 4.0). Obsahuje FIRMY aj
 * ŽIVNOSTNÍKOV aj ďalšie subjekty (OZ, nadácie…). Vyhľadáva podľa názvu (fullName)
 * alebo IČO (identifier). RPO NEOBSAHUJE konateľov ani DIČ/IČ DPH.
 *
 * Verzia je konfigurovateľná — default v1 (v2 zatiaľ verejne nevracia dáta,
 * po sprístupnení stačí RPO_API_VERSION=v2, príp. RPO_API_BASE).
 *   RPO_API_VERSION (default 'v1')
 *   RPO_API_BASE    (default 'https://api.statistics.sk/rpo/{version}')
 */

const VERSION = process.env.RPO_API_VERSION || 'v1';
const BASE = process.env.RPO_API_BASE || ('https://api.statistics.sk/rpo/' + VERSION);

async function jget(url, { timeout = 8000 } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json', 'User-Agent': 'ucto-erp/rpo' } });
    if (!r.ok) throw new Error('RPO HTTP ' + r.status);
    return await r.json();
  } finally { clearTimeout(t); }
}

/** Z položiek s platnosťou { validFrom, validTo } vyberie aktuálne platnú. */
function pickCurrent(items, today = new Date().toISOString().slice(0, 10)) {
  if (!Array.isArray(items) || !items.length) return null;
  const active = items.filter(x => !x.validTo || x.validTo >= today);
  const pool = active.length ? active : items;
  return pool.slice().sort((a, b) => String(b.validFrom || '').localeCompare(String(a.validFrom || '')))[0];
}

/** Zmapuje RPO entitu na tvar partnera keepi. */
function mapEntity(e) {
  if (!e) return null;
  const name = pickCurrent(e.fullNames);
  const addr = pickCurrent(e.addresses);
  const idObj = pickCurrent(e.identifiers) || (e.identifiers || [])[0] || null;
  const ico = idObj ? String(idObj.value || '') : '';
  const zipRaw = addr && Array.isArray(addr.postalCodes) && addr.postalCodes[0] ? String(addr.postalCodes[0]) : '';
  const zip = zipRaw.replace(/\s/g, '').replace(/(\d{3})(\d{2})/, '$1 $2');
  const street = addr ? [addr.street, addr.buildingNumber].filter(Boolean).join(' ').trim() : '';
  const src = e.sourceRegister && e.sourceRegister.value && e.sourceRegister.value.value ? e.sourceRegister.value.value : '';
  return {
    id: e.id,
    name: name ? name.value : '',
    ico,
    street,
    city: addr && addr.municipality ? addr.municipality.value : '',
    zip,
    country: addr && addr.country ? addr.country.value : 'Slovenská republika',
    dic: '', icdph: '',            // RPO ich nemá (Finančná správa)
    sourceRegister: src,
  };
}

/** Vyhľadávanie: { fullName, identifier(IČO), onlyActive, limit }. */
async function search({ fullName, identifier, onlyActive = true, limit = 15 } = {}) {
  const qs = new URLSearchParams();
  if (identifier) qs.set('identifier', String(identifier).replace(/\D/g, ''));
  if (fullName) qs.set('fullName', String(fullName).trim());
  if (onlyActive) qs.set('onlyActive', 'true');
  const data = await jget(`${BASE}/search?${qs.toString()}`);
  const results = (data && data.results) || [];
  return results.slice(0, limit).map(mapEntity).filter(x => x && (x.name || x.ico));
}

/** Vyhľadanie podľa názvu (firmy + živnostníci). */
async function byName(q, limit = 15) {
  q = String(q || '').trim();
  if (q.length < 2) return [];
  return search({ fullName: q, limit });
}

/** Detail podľa IČO (max 1). */
async function byIco(ico) {
  ico = String(ico || '').replace(/\D/g, '');
  if (ico.length < 6) return null;
  const list = await search({ identifier: ico, limit: 1, onlyActive: false });
  return list[0] || null;
}

module.exports = { search, byName, byIco, mapEntity, pickCurrent, BASE, VERSION };
