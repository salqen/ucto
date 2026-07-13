/* účtoERP - server (Express + KV/JSON databáza) */
const express = require('express');
const path = require('path');
const crypto = require('crypto');
const store = require('./store');
const { kontrola } = require('./kontrola');
const rpo = require('./rpo');
const orsr = require('./orsr');

const PORT = process.env.PORT || 3000;

/* ---------- databáza ---------- */
/* dáta jednej firmy (každá firma má vlastný oddelený priestor) */
const DEFAULT_FIRM = {
  settings: {
    company: { name: 'Moja firma s.r.o.', ico: '12345678', dic: '2020123456', icdph: 'SK2020123456', street: 'Hlavná 1', city: 'Bratislava', zip: '811 01', iban: 'SK89 0900 0000 0001 2345 6789', phone: '', email: '' },
    year: new Date().getFullYear()
  },
  partners: [],
  invoices: [],
  cashboxes: [{ id: 1, name: 'Hlavná pokladňa', initial: 0 }],
  cashdocs: [],
  bankaccounts: [{ id: 1, name: 'Podnikateľský účet', iban: 'SK89 0900 0000 0001 2345 6789', initial: 0 }],
  bankmoves: [],
  products: [],
  stockmoves: [],
  orders: [],
  quotes: [],
  deliverynotes: [],
  recurring: [],
  seq: {}
};
const FIRM_KEYS = Object.keys(DEFAULT_FIRM);

function clone(o) { return JSON.parse(JSON.stringify(o)); }

const DEFAULT_DB = {
  firms: [{ id: 1, name: 'Moja firma s.r.o.', ...clone(DEFAULT_FIRM) }],
  users: [],
  sessions: []
};

let root;               /* celé úložisko: { firms, users, sessions } */
let activeFirmId = null; /* firma aktuálnej požiadavky (hlavička X-Firm) */
function curFirm() {
  return root.firms.find(f => f.id === activeFirmId) || root.firms[0];
}
/* db = pohľad na aktívnu firmu; users/sessions/firms sú spoločné */
const db = new Proxy({}, {
  get(_, k) { return FIRM_KEYS.includes(k) ? curFirm()[k] : root[k]; },
  set(_, k, v) { if (FIRM_KEYS.includes(k)) curFirm()[k] = v; else root[k] = v; return true; },
  has(_, k) { return FIRM_KEYS.includes(k) || (root && k in root); }
});

/* migrácia starého (jednofiremného) formátu na firmy */
function migrate(o) {
  if (o && Array.isArray(o.firms)) return o;
  const firm = { id: 1, name: (o && o.settings && o.settings.company && o.settings.company.name) || 'Moja firma' };
  for (const k of FIRM_KEYS) firm[k] = (o && o[k] !== undefined) ? o[k] : clone(DEFAULT_FIRM[k]);
  return { firms: [firm], users: (o && o.users) || [], sessions: (o && o.sessions) || [] };
}

/* úložisko považujeme za "prázdne", ak nemá ani faktúry ani partnerov
   (tak vieme prepísať aj prázdne demo dáta reálnymi zo seed.json) */
function looksEmpty(o) {
  if (!o || typeof o !== 'object') return true;
  const d = Array.isArray(o.firms) ? (o.firms[0] || {}) : o;
  const noInv = !Array.isArray(d.invoices) || d.invoices.length === 0;
  const noPart = !Array.isArray(d.partners) || d.partners.length === 0;
  return noInv && noPart;
}
async function ensureDb() {
  const raw = await store.readRaw();
  if (!looksEmpty(raw)) {
    root = migrate(raw);
  } else {
    // prázdne alebo len demo dáta -> naplň reálnymi zo seed.json
    const seed = store.readSeed ? store.readSeed() : null;
    if (seed && typeof seed === 'object' && !looksEmpty(seed)) {
      root = migrate(clone(seed));
    } else {
      root = (raw && typeof raw === 'object') ? migrate(raw) : clone(DEFAULT_DB);
    }
    // zápis môže zlyhať, ak nie je pripojené KV (Vercel má read-only disk) — nespadni, len zaloguj
    try { await store.writeRaw(root); } catch (e) { console.error('Zápis seedu zlyhal (chýba KV / read-only disk):', e.message); }
  }
  if (!Array.isArray(root.users)) root.users = [];
  if (!Array.isArray(root.sessions)) root.sessions = [];
  for (const f of root.firms) for (const k of FIRM_KEYS) if (f[k] === undefined) f[k] = clone(DEFAULT_FIRM[k]);
  /* migrácia oprávnení: firmIds -> členstvá s rolou; bez oprávnení = admin všetkých firiem */
  for (const u of root.users) {
    if (Array.isArray(u.firmIds)) {
      u.firms = u.firmIds.map(id => ({ id, role: 'admin' }));
      delete u.firmIds;
    }
    if (!Array.isArray(u.firms)) u.firms = root.firms.map(f => ({ id: f.id, role: 'admin' }));
  }
}
async function saveDb() {
  await store.writeRaw(root);
}
function nextId(coll) {
  return db[coll].reduce((m, r) => Math.max(m, r.id || 0), 0) + 1;
}
function nextNumber(prefix, date) {
  const d = date ? new Date(date) : new Date();
  const ym = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`;
  const key = `${prefix}${d.getFullYear()}`;
  db.seq[key] = (db.seq[key] || 0) + 1;
  return `${prefix}${ym}${String(db.seq[key]).padStart(4, '0')}`;
}

/* ---------- kategórie peňažného denníka (JÚ) ---------- */
const CATEGORIES = {
  P: [
    { code: 'PT', name: 'Predaj tovaru', tax: true },
    { code: 'PS', name: 'Predaj výrobkov a služieb', tax: true },
    { code: 'OP', name: 'Ostatné príjmy', tax: true },
    { code: 'DPHP', name: 'DPH prijatá', tax: false },
    { code: 'VP', name: 'Vklad podnikateľa', tax: false },
    { code: 'UP', name: 'Úhrada pohľadávky', tax: true }
  ],
  V: [
    { code: 'NM', name: 'Nákup materiálu', tax: true },
    { code: 'NT', name: 'Nákup tovaru', tax: true },
    { code: 'MZ', name: 'Mzdy', tax: true },
    { code: 'PO', name: 'Poistné a odvody', tax: true },
    { code: 'PR', name: 'Prevádzková réžia', tax: true },
    { code: 'OV', name: 'Ostatné výdavky', tax: true },
    { code: 'DPHZ', name: 'DPH zaplatená', tax: false },
    { code: 'OS', name: 'Osobná spotreba', tax: false }
  ]
};
function catName(type, code) {
  const c = (CATEGORIES[type] || []).find(c => c.code === code);
  return c ? c.name : code || '';
}

/* ---------- pomocné ---------- */
function invoiceTotal(inv) {
  return (inv.items || []).reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.price) || 0) * (1 + (Number(it.vat) || 0) / 100), 0);
}
function round2(n) { return Math.round(n * 100) / 100; }

/* ---------- používateľské účty ---------- */
function hashPw(password, salt) {
  return crypto.createHash('sha256').update(salt + ':' + String(password)).digest('hex');
}
function publicUser(u) {
  return u ? { id: u.id, name: u.name, email: u.email, firms: u.firms || [] } : null;
}
/* role: admin (správa firmy a členov), editor (účtovník - práca s dátami), viewer (iba čítanie) */
const ROLES = ['admin', 'editor', 'viewer'];
function firmRole(user, firmId) {
  if (!user) return 'admin'; /* bez účtov = plný prístup */
  const m = (user.firms || []).find(m => m.id === firmId);
  return m ? m.role : null;
}
/* firmy, ku ktorým má používateľ prístup (bez účtov = všetky) */
function userFirms(user) {
  if (!user) return root.firms;
  return root.firms.filter(f => firmRole(user, f.id));
}
function createSession(userId) {
  const token = crypto.randomBytes(24).toString('hex');
  db.sessions.push({ token, userId, created: new Date().toISOString() });
  /* drž max. 50 relácií, nech databáza nerastie donekonečna */
  if (db.sessions.length > 50) db.sessions = db.sessions.slice(-50);
  return token;
}
function sessionUser(req) {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const sess = (db.sessions || []).find(s => s.token === token);
  return sess ? (db.users || []).find(u => u.id === sess.userId) || null : null;
}

/* ---------- app ---------- */
const app = express();
app.use(express.json({ limit: '5mb' }));

/* načítaj databázu pred každou API požiadavkou (KV je zdieľaná medzi inštanciami) */
app.use('/api', async (req, res, next) => {
  try { await ensureDb(); next(); } catch (e) { next(e); }
});

/* výber aktívnej firmy (hlavička X-Firm; bez nej prvá firma) */
app.use('/api', (req, res, next) => {
  activeFirmId = Number(req.headers['x-firm']) || null;
  next();
});

/* ochrana API: ak existujú používatelia, vyžaduje sa prihlásenie */
app.use('/api', (req, res, next) => {
  if (req.path.startsWith('/auth')) return next();
  if (!(db.users || []).length) return next(); /* prvé spustenie bez účtov */
  const user = sessionUser(req);
  if (!user) return res.status(401).json({ error: 'Neprihlásený používateľ' });
  req.user = user;
  /* oprávnenia per firma: požiadavka smie pracovať len s povolenou firmou */
  const allowed = userFirms(user);
  if (!allowed.length) return res.status(403).json({ error: 'Nemáte prístup k žiadnej firme' });
  if (!allowed.some(f => f.id === activeFirmId)) activeFirmId = allowed[0].id;
  req.firmRole = firmRole(user, activeFirmId);
  next();
});

/* vynucovanie rolí pre dátové operácie aktívnej firmy */
app.use('/api', (req, res, next) => {
  if (!req.user) return next();                      /* bez účtov = voľný prístup */
  if (req.method === 'GET') return next();           /* čítanie môže každý člen */
  if (req.path.startsWith('/auth') || req.path.startsWith('/firms')) return next(); /* vlastné kontroly */
  if (req.path === '/settings' && req.firmRole !== 'admin') {
    return res.status(403).json({ error: 'Nastavenia firmy môže meniť len administrátor' });
  }
  if (req.firmRole === 'viewer') {
    return res.status(403).json({ error: 'Máte oprávnenie iba na čítanie' });
  }
  next();
});

/* ---------- autentifikácia ---------- */
app.get('/api/auth/me', (req, res) => {
  res.json({ user: publicUser(sessionUser(req)), required: (db.users || []).length > 0 });
});

app.post('/api/auth/register', async (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password) return res.status(400).json({ error: 'Vyplňte meno, e-mail a heslo' });
  if (String(password).length < 6) return res.status(400).json({ error: 'Heslo musí mať aspoň 6 znakov' });
  const em = String(email).trim().toLowerCase();
  if ((db.users || []).some(u => u.email === em)) return res.status(400).json({ error: 'Účet s týmto e-mailom už existuje' });
  const salt = crypto.randomBytes(8).toString('hex');
  const user = { id: nextId('users'), name: String(name).trim(), email: em, salt, pwHash: hashPw(password, salt), created: new Date().toISOString(), firms: [] };
  const creator = sessionUser(req);
  if (!(db.users || []).length) {
    /* prvý účet v systéme -> administrátor všetkých existujúcich firiem */
    user.firms = root.firms.map(f => ({ id: f.id, role: 'admin' }));
  } else if (creator) {
    /* účet vytvorený prihláseným používateľom -> rola v jeho aktívnej firme (predvolene účtovník) */
    const allowed = userFirms(creator);
    const cur = allowed.find(f => f.id === activeFirmId) || allowed[0];
    const role = ROLES.includes(req.body.role) ? req.body.role : 'editor';
    user.firms = cur ? [{ id: cur.id, role }] : [];
  } else {
    /* verejná registrácia -> nová vlastná firma, administrátor */
    const fid = root.firms.reduce((m, f) => Math.max(m, f.id || 0), 0) + 1;
    const firm = { id: fid, name: 'Firma – ' + user.name, ...clone(DEFAULT_FIRM) };
    firm.settings.company.name = firm.name;
    root.firms.push(firm);
    user.firms = [{ id: fid, role: 'admin' }];
  }
  db.users.push(user);
  const token = createSession(user.id);
  await saveDb();
  res.json({ token, user: publicUser(user) });
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body || {};
  const em = String(email || '').trim().toLowerCase();
  const user = (db.users || []).find(u => u.email === em);
  if (!user || user.pwHash !== hashPw(password, user.salt)) return res.status(401).json({ error: 'Nesprávny e-mail alebo heslo' });
  const token = createSession(user.id);
  await saveDb();
  res.json({ token, user: publicUser(user) });
});

app.post('/api/auth/logout', async (req, res) => {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  db.sessions = (db.sessions || []).filter(s => s.token !== token);
  await saveDb();
  res.json({ ok: true });
});

/* zoznam používateľov (bez hesiel) */
app.get('/api/auth/users', (req, res) => {
  if ((db.users || []).length && !sessionUser(req)) return res.status(401).json({ error: 'Neprihlásený používateľ' });
  res.json((db.users || []).map(publicUser));
});

/* zmazanie používateľa (nie seba samého) */
app.delete('/api/auth/users/:id', async (req, res) => {
  const me = sessionUser(req);
  if (!me) return res.status(401).json({ error: 'Neprihlásený používateľ' });
  const id = Number(req.params.id);
  if (id === me.id) return res.status(400).json({ error: 'Vlastný účet nie je možné zmazať' });
  db.users = db.users.filter(u => u.id !== id);
  db.sessions = (db.sessions || []).filter(s => s.userId !== id);
  await saveDb();
  res.json({ ok: true });
});

/* nastavenia účtu (meno, e-mail, zmena hesla) */
app.put('/api/auth/me', async (req, res) => {
  const user = sessionUser(req);
  if (!user) return res.status(401).json({ error: 'Neprihlásený používateľ' });
  const { name, email, password, oldPassword } = req.body || {};
  if (name) user.name = String(name).trim();
  if (email) {
    const em = String(email).trim().toLowerCase();
    if (db.users.some(u => u.email === em && u.id !== user.id)) return res.status(400).json({ error: 'E-mail už používa iný účet' });
    user.email = em;
  }
  if (password) {
    if (user.pwHash !== hashPw(oldPassword || '', user.salt)) return res.status(400).json({ error: 'Nesprávne pôvodné heslo' });
    if (String(password).length < 6) return res.status(400).json({ error: 'Nové heslo musí mať aspoň 6 znakov' });
    user.salt = crypto.randomBytes(8).toString('hex');
    user.pwHash = hashPw(password, user.salt);
  }
  await saveDb();
  res.json({ user: publicUser(user) });
});

const COLLECTIONS =['partners', 'invoices', 'cashboxes', 'cashdocs', 'bankaccounts', 'bankmoves', 'products', 'stockmoves', 'orders', 'quotes', 'deliverynotes', 'recurring'];
/* položkové doklady (majú items a total ako faktúra) */
const ITEM_DOCS = ['invoices', 'quotes', 'deliverynotes'];

/* číselníky */
app.get('/api/categories', (req, res) => res.json(CATEGORIES));

/* ---------- register firiem (RPO – Štatistický úrad SR) podľa IČO ---------- */
function rpoPickCurrent(items) {
  if (!Array.isArray(items) || !items.length) return null;
  const today = new Date().toISOString().slice(0, 10);
  const active = items.filter(x => !x.validTo || x.validTo >= today);
  const pool = active.length ? active : items;
  return pool.slice().sort((a, b) => String(b.validFrom || '').localeCompare(String(a.validFrom || '')))[0];
}
function rpoMap(entity) {
  if (!entity) return null;
  const name = rpoPickCurrent(entity.fullNames);
  const addr = rpoPickCurrent(entity.addresses);
  const ico = (rpoPickCurrent(entity.identifiers) || (entity.identifiers || [])[0] || {}).value || '';
  const num = addr && (addr.buildingNumber || (addr.regNumber ? String(addr.regNumber) : '')) || '';
  return {
    ico: String(ico).replace(/\D/g, '').padStart(8, '0'),
    name: name ? name.value : '',
    street: addr ? [addr.street, num].filter(Boolean).join(' ').trim() : '',
    city: addr && addr.municipality ? addr.municipality.value : '',
    zip: addr && Array.isArray(addr.postalCodes) && addr.postalCodes[0]
      ? String(addr.postalCodes[0]).replace(/(\d{3})(\d{2})/, '$1 $2') : '',
    country: addr && addr.country ? addr.country.value : 'Slovenská republika',
    dic: '', icdph: ''
  };
}
app.get('/api/ico/:ico', async (req, res) => {
  const ico = String(req.params.ico || '').replace(/\D/g, '');
  if (ico.length < 6 || ico.length > 8) return res.status(400).json({ error: 'Neplatné IČO (6–8 číslic).' });
  try {
    const d = await rpo.byIco(ico);
    if (!d) return res.status(404).json({ error: 'Pre IČO ' + ico + ' sa nič nenašlo.' });
    res.json(d);
  } catch (e) {
    res.status(502).json({ error: 'Chyba spojenia s registrom: ' + e.message });
  }
});

/* overenie IČ DPH cez VIES (Európska komisia) — vráti platnosť + oficiálny názov/adresu.
   Prevzaté z ucto-git/components/ico-lookup (provider vies). */
app.get('/api/vies/:vat', async (req, res) => {
  const raw = String(req.params.vat || '').replace(/\s+/g, '').toUpperCase();
  const m = raw.match(/^([A-Z]{2})?(\d+)$/);
  if (!m) return res.status(400).json({ error: 'Neplatný tvar IČ DPH (napr. SK2020318813).' });
  const country = m[1] || 'SK';
  const number = m[2];
  try {
    const r = await fetch(`https://ec.europa.eu/taxation_customs/vies/rest-api/ms/${country}/vat/${number}`, {
      headers: { Accept: 'application/json', 'User-Agent': 'ucto-erp/ico-lookup' }
    });
    if (!r.ok) return res.status(502).json({ error: 'VIES nedostupný (HTTP ' + r.status + ').' });
    const d = await r.json();
    const valid = !!(d.valid ?? d.isValid ?? false);
    res.json({
      valid,
      icdph: country + number,
      country,
      name: d.name && d.name !== '---' ? d.name : '',
      address: d.address && d.address !== '---' ? d.address : '',
    });
  } catch (e) {
    res.status(502).json({ error: 'Chyba spojenia s VIES: ' + e.message });
  }
});

/* RPO — vyhľadanie partnera (firmy aj živnostníci) podľa názvu alebo IČO */
app.get('/api/rpo/search', async (req, res) => {
  try { res.json(await rpo.byName(req.query.q || '', 15)); }
  catch (e) { res.status(502).json({ error: 'RPO nedostupný: ' + e.message }); }
});
app.get('/api/rpo/ico/:ico', async (req, res) => {
  try {
    const d = await rpo.byIco(req.params.ico);
    if (!d) return res.status(404).json({ error: 'V RPO sa pre toto IČO nič nenašlo.' });
    res.json(d);
  } catch (e) { res.status(502).json({ error: 'RPO nedostupný: ' + e.message }); }
});

/* ORSR (doplnok k RPO) — hľadá firmu podľa názvu aj podľa mena konateľa/spoločníka */
app.get('/api/orsr/search', async (req, res) => {
  try { res.json(await orsr.searchAll(req.query.q || '')); }
  catch (e) { res.status(502).json({ error: 'ORSR nedostupný: ' + e.message }); }
});
app.get('/api/orsr/detail', async (req, res) => {
  try { res.json(await orsr.detail(req.query.id, req.query.sid)); }
  catch (e) { res.status(502).json({ error: 'ORSR nedostupný: ' + e.message }); }
});

/* riziková previerka partnera podľa IČO (RÚZ + RPVS + insolvencia + exekúcie) */
app.get('/api/kontrola/:ico', async (req, res) => {
  try {
    res.json(await kontrola(req.params.ico));
  } catch (e) {
    res.status(e.status || 502).json({ error: e.message });
  }
});

/* firmy (vracia len firmy, na ktoré má používateľ oprávnenie, aj s rolou) */
app.get('/api/firms', (req, res) => {
  const u = req.user || sessionUser(req);
  res.json(userFirms(u).map(f => ({
    id: f.id,
    name: (f.settings && f.settings.company && f.settings.company.name) || f.name,
    role: firmRole(u, f.id) || 'admin'
  })));
});
app.post('/api/firms', async (req, res) => {
  const name = String((req.body && req.body.name) || '').trim();
  if (!name) return res.status(400).json({ error: 'Zadajte názov firmy' });
  const id = root.firms.reduce((m, f) => Math.max(m, f.id || 0), 0) + 1;
  const firm = { id, name, ...clone(DEFAULT_FIRM) };
  firm.settings.company.name = name;
  root.firms.push(firm);
  const u = req.user || sessionUser(req);
  if (u) u.firms = [...(u.firms || []), { id, role: 'admin' }]; /* zakladateľ = administrátor */
  await saveDb();
  res.json({ id, name });
});
app.delete('/api/firms/:id', async (req, res) => {
  const id = Number(req.params.id);
  const u = req.user || sessionUser(req);
  if (root.users.length && firmRole(u, id) !== 'admin') return res.status(403).json({ error: 'Firmu môže zmazať len jej administrátor' });
  if (root.firms.length <= 1) return res.status(400).json({ error: 'Poslednú firmu nie je možné zmazať' });
  root.firms = root.firms.filter(f => f.id !== id);
  for (const usr of root.users) usr.firms = (usr.firms || []).filter(m => m.id !== id);
  await saveDb();
  res.json({ ok: true });
});

/* členovia firmy a ich role */
function reqRole(req, firmId) {
  if (!root.users.length) return 'admin'; /* bez účtov = voľný prístup */
  const u = req.user || sessionUser(req);
  return u ? firmRole(u, firmId) : null;
}
function firmAdmins(firmId) {
  return root.users.filter(u => firmRole(u, firmId) === 'admin');
}
app.get('/api/firms/:id/users', (req, res) => {
  const id = Number(req.params.id);
  if (!reqRole(req, id)) return res.status(403).json({ error: 'Nemáte prístup k tejto firme' });
  res.json(root.users.filter(u => firmRole(u, id)).map(u => ({ ...publicUser(u), role: firmRole(u, id) })));
});
app.post('/api/firms/:id/users', async (req, res) => {
  const id = Number(req.params.id);
  if (reqRole(req, id) !== 'admin') return res.status(403).json({ error: 'Členov môže spravovať len administrátor firmy' });
  const em = String((req.body && req.body.email) || '').trim().toLowerCase();
  const role = ROLES.includes(req.body && req.body.role) ? req.body.role : 'editor';
  const u = root.users.find(x => x.email === em);
  if (!u) return res.status(404).json({ error: 'Používateľ s týmto e-mailom neexistuje. Najprv si musí vytvoriť účet.' });
  const m = (u.firms || []).find(m => m.id === id);
  if (m) m.role = role;
  else u.firms = [...(u.firms || []), { id, role }];
  await saveDb();
  res.json({ ...publicUser(u), role });
});
app.put('/api/firms/:id/users/:userId', async (req, res) => {
  const id = Number(req.params.id);
  if (reqRole(req, id) !== 'admin') return res.status(403).json({ error: 'Role môže meniť len administrátor firmy' });
  const role = req.body && req.body.role;
  if (!ROLES.includes(role)) return res.status(400).json({ error: 'Neplatná rola' });
  const u = root.users.find(x => x.id === Number(req.params.userId));
  const m = u && (u.firms || []).find(m => m.id === id);
  if (!m) return res.status(404).json({ error: 'Používateľ nie je členom tejto firmy' });
  if (m.role === 'admin' && role !== 'admin' && firmAdmins(id).length <= 1) {
    return res.status(400).json({ error: 'Firma musí mať aspoň jedného administrátora' });
  }
  m.role = role;
  await saveDb();
  res.json({ ...publicUser(u), role });
});
app.delete('/api/firms/:id/users/:userId', async (req, res) => {
  const id = Number(req.params.id);
  if (reqRole(req, id) !== 'admin') return res.status(403).json({ error: 'Členov môže spravovať len administrátor firmy' });
  const u = root.users.find(x => x.id === Number(req.params.userId));
  if (!u || !firmRole(u, id)) return res.status(404).json({ error: 'Používateľ nie je členom tejto firmy' });
  if (firmRole(u, id) === 'admin' && firmAdmins(id).length <= 1) {
    return res.status(400).json({ error: 'Firma musí mať aspoň jedného administrátora' });
  }
  u.firms = (u.firms || []).filter(m => m.id !== id);
  await saveDb();
  res.json({ ok: true });
});

/* nastavenia */
app.get('/api/settings', (req, res) => res.json(db.settings));
app.put('/api/settings', async (req, res) => {
  db.settings = { ...db.settings, ...req.body };
  await saveDb();
  res.json(db.settings);
});

/* dashboard */
app.get('/api/dashboard', (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const out = db.invoices.filter(i => i.type === 'INO');
  const inc = db.invoices.filter(i => i.type === 'INI');
  const unpaidOut = out.filter(i => round2(i.total - (i.paid || 0)) > 0);
  const overdueOut = unpaidOut.filter(i => i.dueDate && i.dueDate < today);
  const unpaidInc = inc.filter(i => round2(i.total - (i.paid || 0)) > 0);
  const cashBal = db.cashboxes.reduce((s, cb) => s + Number(cb.initial || 0), 0)
    + db.cashdocs.reduce((s, d) => s + (d.type === 'P' ? 1 : -1) * Number(d.amount || 0), 0);
  const bankBal = db.bankaccounts.reduce((s, a) => s + Number(a.initial || 0), 0)
    + db.bankmoves.reduce((s, d) => s + (d.type === 'P' ? 1 : -1) * Number(d.amount || 0), 0);
  const income = db.cashdocs.filter(d => d.type === 'P').reduce((s, d) => s + Number(d.amount || 0), 0)
    + db.bankmoves.filter(d => d.type === 'P').reduce((s, d) => s + Number(d.amount || 0), 0);
  const expense = db.cashdocs.filter(d => d.type === 'V').reduce((s, d) => s + Number(d.amount || 0), 0)
    + db.bankmoves.filter(d => d.type === 'V').reduce((s, d) => s + Number(d.amount || 0), 0);
  const stockValue = stockState().reduce((s, r) => s + r.value, 0);
  const iOwe = round2(unpaidInc.reduce((s, i) => s + (i.total - (i.paid || 0)), 0));
  const oweMe = round2(unpaidOut.reduce((s, i) => s + (i.total - (i.paid || 0)), 0));
  const lastDocs = [...db.invoices].sort((a, b) => (b.issueDate || '').localeCompare(a.issueDate || '')).slice(0, 5)
    .map(i => ({ number: i.number, type: i.type, total: i.total }));
  res.json({
    overdueCount: overdueOut.length,
    overdueSum: round2(overdueOut.reduce((s, i) => s + (i.total - (i.paid || 0)), 0)),
    incomingCount: unpaidInc.length,
    incomingSum: iOwe,
    iOwe, oweMe,
    income: round2(income), expense: round2(expense),
    cashBal: round2(cashBal), bankBal: round2(bankBal),
    stockValue: round2(stockValue),
    profit: round2(income - expense),
    money: round2(cashBal + bankBal),
    lastDocs,
    partnersCount: db.partners.length
  });
});

/* peňažný denník - odvodený z pokladne a banky */
app.get('/api/diary', (req, res) => {
  const year = req.query.year;
  let rows = [];
  for (const d of db.cashdocs) rows.push({ src: 'POK', srcName: (db.cashboxes.find(c => c.id === d.cashboxId) || {}).name || 'Pokladňa', ...d });
  for (const d of db.bankmoves) rows.push({ src: 'BAN', srcName: (db.bankaccounts.find(a => a.id === d.accountId) || {}).name || 'Banka', ...d });
  if (year) rows = rows.filter(r => (r.date || '').startsWith(String(year)));
  rows.sort((a, b) => (a.date || '').localeCompare(b.date || '') || String(a.number).localeCompare(String(b.number)));
  let bal = 0;
  const start = db.cashboxes.reduce((s, c) => s + Number(c.initial || 0), 0) + db.bankaccounts.reduce((s, a) => s + Number(a.initial || 0), 0);
  bal = start;
  rows = rows.map(r => {
    bal += (r.type === 'P' ? 1 : -1) * Number(r.amount || 0);
    return { ...r, categoryName: catName(r.type, r.category), partnerName: (db.partners.find(p => p.id === r.partnerId) || {}).name || '', balance: round2(bal) };
  });
  res.json({ initial: round2(start), rows });
});

/* uzávierka */
app.get('/api/closing', (req, res) => {
  const year = String(req.query.year || db.settings.year);
  const all = [...db.cashdocs, ...db.bankmoves].filter(d => (d.date || '').startsWith(year));
  const sum = list => round2(list.reduce((s, d) => s + Number(d.amount || 0), 0));
  const byCat = {};
  for (const t of ['P', 'V']) {
    byCat[t] = CATEGORIES[t].map(c => ({
      ...c,
      sum: sum(all.filter(d => d.type === t && d.category === c.code))
    }));
    const other = all.filter(d => d.type === t && !CATEGORIES[t].some(c => c.code === d.category));
    if (other.length) byCat[t].push({ code: '??', name: 'Nezaradené', tax: true, sum: sum(other) });
  }
  const incomeTax = byCat.P.filter(c => c.tax).reduce((s, c) => s + c.sum, 0);
  const expenseTax = byCat.V.filter(c => c.tax).reduce((s, c) => s + c.sum, 0);
  res.json({
    year,
    income: byCat.P, expense: byCat.V,
    incomeTotal: sum(all.filter(d => d.type === 'P')),
    expenseTotal: sum(all.filter(d => d.type === 'V')),
    incomeTax: round2(incomeTax), expenseTax: round2(expenseTax),
    profit: round2(incomeTax - expenseTax)
  });
});

/* manažérske informácie - mesačné súčty */
app.get('/api/manager', (req, res) => {
  const year = String(req.query.year || db.settings.year);
  const all = [...db.cashdocs, ...db.bankmoves].filter(d => (d.date || '').startsWith(year));
  const months = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, income: 0, expense: 0 }));
  for (const d of all) {
    const m = Number((d.date || '').slice(5, 7));
    if (m >= 1 && m <= 12) months[m - 1][d.type === 'P' ? 'income' : 'expense'] += Number(d.amount || 0);
  }
  months.forEach(m => { m.income = round2(m.income); m.expense = round2(m.expense); m.profit = round2(m.income - m.expense); });
  res.json({ year, months });
});

/* stav zásob */
function stockState() {
  return db.products.map(p => {
    const moves = db.stockmoves.filter(m => m.productId === p.id);
    const inQty = moves.filter(m => m.type === 'P').reduce((s, m) => s + Number(m.qty || 0), 0);
    const outQty = moves.filter(m => m.type === 'V').reduce((s, m) => s + Number(m.qty || 0), 0);
    const inVal = moves.filter(m => m.type === 'P').reduce((s, m) => s + Number(m.qty || 0) * Number(m.price || 0), 0);
    const avg = inQty > 0 ? inVal / inQty : Number(p.price || 0);
    const qty = round2(inQty - outQty);
    return { ...p, qty, avgPrice: round2(avg), value: round2(qty * avg) };
  });
}
app.get('/api/stock', (req, res) => res.json(stockState()));

/* úhrada faktúry -> vytvorí doklad v pokladni alebo banke */
app.post('/api/invoices/:id/pay', async (req, res) => {
  const inv = db.invoices.find(i => i.id === Number(req.params.id));
  if (!inv) return res.status(404).json({ error: 'Faktúra neexistuje' });
  const { method, amount, date, cashboxId, accountId } = req.body; // method: 'cash' | 'bank'
  const amt = round2(Number(amount) || (inv.total - (inv.paid || 0)));
  const isOut = inv.type === 'INO'; // vyšlá faktúra -> príjem
  const docType = isOut ? 'P' : 'V';
  const category = isOut ? 'UP' : 'OV';
  const text = `Úhrada faktúry ${inv.number}`;
  if (method === 'cash') {
    const doc = {
      id: nextId('cashdocs'), cashboxId: Number(cashboxId) || db.cashboxes[0].id, type: docType,
      number: nextNumber(docType === 'P' ? 'PPD' : 'VPD', date), date: date || new Date().toISOString().slice(0, 10),
      partnerId: inv.partnerId, text, category, amount: amt, invoiceId: inv.id
    };
    db.cashdocs.push(doc);
  } else {
    const doc = {
      id: nextId('bankmoves'), accountId: Number(accountId) || db.bankaccounts[0].id, type: docType,
      number: nextNumber('BV', date), date: date || new Date().toISOString().slice(0, 10),
      partnerId: inv.partnerId, text, category, amount: amt, invoiceId: inv.id, vs: inv.vs
    };
    db.bankmoves.push(doc);
  }
  inv.paid = round2((inv.paid || 0) + amt);
  await saveDb();
  res.json(inv);
});

/* import bankového výpisu -> bankové doklady + úhrada spárovaných faktúr */
app.post('/api/bankmoves/import', async (req, res) => {
  const { accountId, moves } = req.body || {};
  const accId = Number(accountId) || (db.bankaccounts[0] && db.bankaccounts[0].id);
  if (!accId) return res.status(400).json({ error: 'Chýba bankový účet' });
  if (!Array.isArray(moves) || !moves.length) return res.status(400).json({ error: 'Žiadne pohyby na import' });
  let created = 0, paired = 0;
  for (const m of moves) {
    const amt = round2(Math.abs(Number(m.amount) || 0));
    if (!(amt > 0)) continue;
    const type = m.type === 'V' ? 'V' : 'P';
    const inv = m.invoiceId ? db.invoices.find(i => i.id === Number(m.invoiceId)) : null;
    const category = m.category || (inv ? (inv.type === 'INO' ? 'UP' : 'OV') : (type === 'P' ? 'OP' : 'OV'));
    const doc = {
      id: nextId('bankmoves'), accountId: accId, type,
      number: nextNumber('BV', m.date), date: m.date || new Date().toISOString().slice(0, 10),
      partnerId: inv ? inv.partnerId : (m.partnerId ? Number(m.partnerId) : null),
      text: m.text || (inv ? `Úhrada faktúry ${inv.number}` : 'Import výpisu'),
      category, amount: amt, vs: m.vs || (inv ? inv.vs : ''),
      invoiceId: inv ? inv.id : undefined
    };
    db.bankmoves.push(doc);
    created++;
    if (inv) { inv.paid = round2((inv.paid || 0) + amt); paired++; }
  }
  await saveDb();
  res.json({ ok: true, created, paired });
});

/* konverzia cenovej ponuky / dodacieho listu na faktúru (1 klikom) */
app.post('/api/:coll/:id/to-invoice', async (req, res, next) => {
  const { coll } = req.params;
  if (coll !== 'quotes' && coll !== 'deliverynotes') return next();
  const src = db[coll].find(r => r.id === Number(req.params.id));
  if (!src) return res.status(404).json({ error: 'Doklad neexistuje' });
  if (src.invoiceId && db.invoices.some(i => i.id === src.invoiceId)) {
    return res.status(409).json({ error: 'Doklad už má vytvorenú faktúru č. ' + (src.invoiceNumber || src.invoiceId), invoiceId: src.invoiceId });
  }
  const isOut = src.type !== 'I';
  const todayStr = new Date().toISOString().slice(0, 10);
  const inv = {
    id: nextId('invoices'),
    type: isOut ? 'INO' : 'INI',
    number: nextNumber(isOut ? 'VF' : 'DF', todayStr),
    partnerId: src.partnerId || null,
    partnerName: src.partnerName || '',
    currency: src.currency || 'EUR',
    issueDate: todayStr,
    deliveryDate: src.deliveryDate || src.issueDate || todayStr,
    dueDate: new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10),
    ks: src.ks || '0308',
    paymentMethod: src.paymentMethod || 'Prevodný príkaz',
    items: (src.items || []).map(it => ({ ...it })),
    note: (src.note ? src.note + ' · ' : '') + 'Podľa ' + (coll === 'quotes' ? 'cenovej ponuky' : 'dodacieho listu') + ' ' + (src.number || ''),
    paid: 0,
    sourceColl: coll, sourceId: src.id, sourceNumber: src.number,
  };
  inv.vs = String(inv.number || '').replace(/\D/g, '');
  inv.total = round2(invoiceTotal(inv));
  db.invoices.push(inv);
  src.invoiceId = inv.id; src.invoiceNumber = inv.number;
  await saveDb();
  res.json(inv);
});

/* generické CRUD */
app.get('/api/:coll', (req, res, next) => {
  const { coll } = req.params;
  if (!COLLECTIONS.includes(coll)) return next();
  let rows = db[coll];
  if (req.query.type && ITEM_DOCS.includes(coll)) rows = rows.filter(r => r.type === req.query.type);
  if (req.query.year) rows = rows.filter(r => ((r.issueDate || r.date || '')).startsWith(String(req.query.year)));
  /* doplň mená partnerov */
  rows = rows.map(r => ({ ...r, partnerName: r.partnerId ? ((db.partners.find(p => p.id === r.partnerId) || {}).name || '') : r.partnerName }));
  res.json(rows);
});

app.post('/api/:coll', async (req, res, next) => {
  const { coll } = req.params;
  if (!COLLECTIONS.includes(coll)) return next();
  const row = { ...req.body, id: nextId(coll) };
  /* automatické číslovanie */
  if (!row.number) {
    if (coll === 'invoices') row.number = nextNumber(row.type === 'INI' ? 'DF' : 'VF', row.issueDate);
    if (coll === 'cashdocs') row.number = nextNumber(row.type === 'P' ? 'PPD' : 'VPD', row.date);
    if (coll === 'bankmoves') row.number = nextNumber('BV', row.date);
    if (coll === 'stockmoves') row.number = nextNumber(row.type === 'P' ? 'PRI' : 'VYD', row.date);
    if (coll === 'orders') row.number = nextNumber('OBJ', row.date);
    if (coll === 'quotes') row.number = nextNumber(row.type === 'I' ? 'CPP' : 'CP', row.issueDate || row.date);
    if (coll === 'deliverynotes') row.number = nextNumber(row.type === 'I' ? 'DLP' : 'DL', row.issueDate || row.date);
  }
  if (coll === 'invoices') {
    if (!row.vs) row.vs = String(row.number || '').replace(/\D/g, '');
    row.total = round2(invoiceTotal(row));
    row.paid = row.paid || 0;
  }
  if (coll === 'quotes' || coll === 'deliverynotes') row.total = round2(invoiceTotal(row));
  db[coll].push(row);
  await saveDb();
  res.json(row);
});

app.put('/api/:coll/:id', async (req, res, next) => {
  const { coll } = req.params;
  if (!COLLECTIONS.includes(coll)) return next();
  const idx = db[coll].findIndex(r => r.id === Number(req.params.id));
  if (idx < 0) return res.status(404).json({ error: 'Záznam neexistuje' });
  const row = { ...db[coll][idx], ...req.body, id: db[coll][idx].id };
  if (ITEM_DOCS.includes(coll)) row.total = round2(invoiceTotal(row));
  db[coll][idx] = row;
  await saveDb();
  res.json(row);
});

app.delete('/api/:coll/:id', async (req, res, next) => {
  const { coll } = req.params;
  if (!COLLECTIONS.includes(coll)) return next();
  db[coll] = db[coll].filter(r => r.id !== Number(req.params.id));
  await saveDb();
  res.json({ ok: true });
});

/* statický frontend */
const DIST = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(DIST));
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Neznáma API cesta' });
  res.sendFile(path.join(DIST, 'index.html'));
});

/* spracovanie chýb (napr. výpadok KV) */
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: String((err && err.message) || err) });
});

/* lokálne spustenie (na Verceli sa app iba exportuje ako handler) */
if (require.main === module) {
  ensureDb()
    .then(() => app.listen(PORT, () => console.log(`účtoERP beží na http://localhost:${PORT}`)))
    .catch(e => { console.error('Chyba pri štarte:', e); process.exit(1); });
}

module.exports = app;
