/*
 * server/orsr.js — vyhľadávanie v Obchodnom registri SR (orsr.sk).
 * Port PHP knižnice lubosdz/parser-orsr do Node. ORSR NEMÁ oficiálne API — parsuje sa HTML.
 *
 * Používa sa ako DOPLNOK k RPO (server/rpo.js): navyše vie hľadať firmu podľa
 * mena KONATEĽA / spoločníka (hladaj_osoba.asp), čo RPO nevie.
 *
 * POZOR na etiku (podľa autora knižnice): NEPREŤAŽOVAŤ server ORSR — max ~1 dopyt/min.
 * Preto: min. odstup medzi dopytmi (rate-limit) + in-memory cache (30 dní).
 * Preto sa ORSR v UI spúšťa len na tlačidlo, nie pri každom písmene.
 *
 * URL: /hladaj_subjekt.asp (názov), /hladaj_osoba.asp (osoba), /vypis.asp (detail).
 * Stránky sú v kódovaní windows-1250.
 */

const BASE = 'https://www.orsr.sk';

/* windows-1250 kodek */
const dec1250 = new TextDecoder('windows-1250');
const enc1250 = new Map();
for (let b = 0; b < 256; b++) { const c = dec1250.decode(Uint8Array.of(b)); if (!enc1250.has(c)) enc1250.set(c, b); }
function encQuery(s) {
  return [...String(s || '')].map(ch => {
    const b = enc1250.has(ch) ? enc1250.get(ch) : 63;
    return '%' + b.toString(16).toUpperCase().padStart(2, '0');
  }).join('');
}

/* rate-limit + cache */
let lastFetch = 0;
const MIN_DELAY = Number(process.env.ORSR_MIN_DELAY_MS || 1200);
const TTL = Number(process.env.ORSR_CACHE_TTL_MS || 1000 * 60 * 60 * 24 * 30);
const cache = new Map();
const cget = k => { const e = cache.get(k); return e && (Date.now() - e.t) < TTL ? e.v : null; };
const cset = (k, v) => { cache.set(k, { t: Date.now(), v }); };

async function fetchOrsr(path, { timeout = 8000 } = {}) {
  const wait = MIN_DELAY - (Date.now() - lastFetch);
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  lastFetch = Date.now();
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  try {
    const r = await fetch(BASE + path, { signal: ctrl.signal, headers: { 'User-Agent': 'ucto-erp/orsr (partner lookup)' } });
    if (!r.ok) throw new Error('ORSR HTTP ' + r.status);
    return dec1250.decode(new Uint8Array(await r.arrayBuffer()));
  } finally { clearTimeout(t); }
}

function htmlText(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<\/(tr|div|p|br|table)>/gi, '\n').replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (m, d) => String.fromCharCode(+d))
    .replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, '\n').trim();
}

function extractLinks(html) {
  const out = [], seen = new Set();
  const re = /<a[^>]+href="(vypis\.asp\?ID=(\d+)&(?:amp;)?SID=(\d+)[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html))) {
    const id = Number(m[2]), sid = Number(m[3]);
    const name = htmlText(m[4]).replace(/\s+/g, ' ').trim();
    const key = id + '/' + sid;
    if (name && !seen.has(key)) { seen.add(key); out.push({ id, sid, name }); }
  }
  return out;
}

/* ---------- detail ---------- */
const LABELS = ['Oddiel', 'Vložka číslo', 'Obchodné meno', 'Sídlo', 'IČO', 'Deň zápisu', 'Deň výmazu',
  'Právna forma', 'Predmet činnosti', 'Predmet podnikania', 'Spoločníci', 'Štatutárny orgán',
  'Konanie menom spoločnosti', 'Konanie', 'Základné imanie', 'Ďalšie právne skutočnosti'];

function fieldAfter(text, label, others) {
  const i = text.indexOf(label + ':');
  if (i < 0) return '';
  const start = i + label.length + 1;
  let end = text.length;
  for (const nl of others) { const j = text.indexOf(nl + ':', start); if (j >= 0 && j < end) end = j; }
  return text.slice(start, end).replace(/\s+/g, ' ').trim();
}

function parseAddress(sidlo) {
  const s = String(sidlo || '').replace(/\s+/g, ' ').trim();
  const zipM = s.match(/(\d{3}\s?\d{2})/);
  if (!zipM) return { street: s, zip: '', city: '' };
  const zip = zipM[1].replace(/\s/g, '');
  return { street: s.slice(0, zipM.index).trim().replace(/[,;]$/, ''), zip, city: s.slice(zipM.index + zipM[0].length).trim() };
}

function parseDetail(html, id, sid) {
  const text = htmlText(html).replace(/\n/g, ' ');
  const f = (label) => fieldAfter(text, label, LABELS.filter(x => x !== label));
  const name = f('Obchodné meno').replace(/\s*\(.*$/, '').trim();
  const ico = ((f('IČO').match(/[\d ]{6,}/) || [''])[0]).replace(/\D/g, '');
  const addr = parseAddress(f('Sídlo').replace(/\s*\(.*$/, ''));
  const pravnaForma = f('Právna forma').replace(/\s*\(.*$/, '');
  const denZapisu = (f('Deň zápisu').match(/\d{1,2}\.\d{1,2}\.\d{4}/) || [''])[0];
  const oddiel = f('Oddiel').split(/\s/)[0] || '';
  const vlozka = f('Vložka číslo').split(/\s/)[0] || '';
  return {
    id: Number(id), sid: Number(sid),
    name, ico, ...addr, country: 'Slovensko',
    pravnaForma, denZapisu, oddiel, vlozka,
    srcUrl: `${BASE}/vypis.asp?ID=${id}&SID=${sid}&P=0`,
  };
}

/* ---------- vyhľadávanie ---------- */

/** Podľa obchodného mena (firmy). */
async function search(term) {
  term = String(term || '').trim();
  if (term.length < 2) return [];
  const key = 's:' + term.toLowerCase();
  const c = cget(key); if (c) return c;
  const html = await fetchOrsr(`/hladaj_subjekt.asp?OBMENO=${encQuery(term)}&PF=0&R=on`);
  const list = extractLinks(html).slice(0, 20).map(x => ({ ...x, by: 'názov' }));
  cset(key, list);
  return list;
}

/** Podľa mena OSOBY (konateľ / spoločník). q = "Meno Priezvisko" alebo "Priezvisko". */
async function searchPerson(q) {
  q = String(q || '').trim();
  if (q.length < 2) return [];
  const key = 'o:' + q.toLowerCase();
  const c = cget(key); if (c) return c;
  const parts = q.split(/\s+/);
  const priezvisko = parts.length > 1 ? parts[parts.length - 1] : parts[0];
  const meno = parts.length > 1 ? parts.slice(0, -1).join(' ') : '';
  const html = await fetchOrsr(`/hladaj_osoba.asp?PR=${encQuery(priezvisko)}&MENO=${encQuery(meno)}&SID=0&T=f0&R=on`);
  const list = extractLinks(html).slice(0, 20).map(x => ({ ...x, by: 'konateľ' }));
  cset(key, list);
  return list;
}

/** Kombinované: názov firmy + osoba (konateľ). Zlúči a odstráni duplicity. */
async function searchAll(q) {
  const [byName, byPerson] = await Promise.allSettled([search(q), searchPerson(q)]);
  const merged = [];
  const seen = new Set();
  for (const res of [byName, byPerson]) {
    if (res.status !== 'fulfilled') continue;
    for (const it of res.value) {
      const k = it.id + '/' + it.sid;
      if (!seen.has(k)) { seen.add(k); merged.push(it); }
    }
  }
  return merged.slice(0, 25);
}

async function findByIco(ico) {
  ico = String(ico || '').replace(/\D/g, '');
  if (ico.length < 6) return null;
  const key = 'i:' + ico;
  const c = cget(key); if (c) return c;
  const html = await fetchOrsr(`/hladaj_ico.asp?ICO=${ico}&SID=0`);
  const link = extractLinks(html)[0] || null;
  cset(key, link);
  return link;
}

async function detail(id, sid) {
  const key = 'd:' + id + '/' + sid;
  const c = cget(key); if (c) return c;
  const html = await fetchOrsr(`/vypis.asp?ID=${Number(id)}&SID=${Number(sid)}&P=0`);
  const d = parseDetail(html, id, sid);
  cset(key, d);
  return d;
}

async function getByIco(ico) {
  const link = await findByIco(ico);
  if (!link) return null;
  return detail(link.id, link.sid);
}

module.exports = { search, searchPerson, searchAll, findByIco, detail, getByIco, parseDetail, parseAddress, extractLinks, htmlText, encQuery };
