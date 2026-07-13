import React, { useEffect, useState, useRef } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { api, eur, setToken, getToken, getFirm, setFirm } from './api.js';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Invoices from './pages/Invoices.jsx';
import InvoiceForm from './pages/InvoiceForm.jsx';
import Partners from './pages/Partners.jsx';
import Diary from './pages/Diary.jsx';
import CashBook from './pages/CashBook.jsx';
import Bank from './pages/Bank.jsx';
import Warehouse from './pages/Warehouse.jsx';
import Orders from './pages/Orders.jsx';
import Closing from './pages/Closing.jsx';
import Manager from './pages/Manager.jsx';
import Overview from './pages/Overview.jsx';
import Settings from './pages/Settings.jsx';
import Reminders from './pages/Reminders.jsx';
import Recurring from './pages/Recurring.jsx';
import Documents from './pages/Documents.jsx';
import DocForm from './pages/DocForm.jsx';

function TbMenu({ label, children }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const close = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);
  return (
    <div className="tb-menu" ref={ref}>
      <span className={'tb-item' + (open ? ' active' : '')} onClick={() => setOpen(o => !o)}>{label} ▾</span>
      {open && <div className="tb-drop" onClick={() => setOpen(false)}>{children}</div>}
    </div>
  );
}

export default function App() {
  const loc = useLocation();
  const isDash = loc.pathname === '/';
  const [settings, setSettings] = useState(null);
  const [auth, setAuth] = useState({ loading: true, user: null, required: false });
  const [theme, setTheme] = useState(() => localStorage.getItem('ucto_theme') || 'light');
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('ucto_theme', theme);
  }, [theme]);

  const loadMe = () => api.get('/auth/me')
    .then(r => setAuth({ loading: false, user: r.user, required: r.required }))
    .catch(() => setAuth({ loading: false, user: null, required: false }));

  useEffect(() => {
    loadMe();
    const onAuthRequired = () => setAuth(a => ({ ...a, loading: false, user: null, required: true }));
    window.addEventListener('auth-required', onAuthRequired);
    return () => window.removeEventListener('auth-required', onAuthRequired);
  }, []);

  /* úvodné login menu: do systému sa vstupuje vždy cez prihlásenie / registráciu */
  const authed = !!auth.user;
  useEffect(() => { if (authed) api.get('/settings').then(setSettings).catch(() => {}); }, [loc.pathname, authed]);

  const [docs, setDocs] = useState([]);
  useEffect(() => {
    if (authed) api.get('/dashboard').then(d => setDocs(d.lastDocs || [])).catch(() => {});
  }, [loc.pathname, authed]);

  /* firmy */
  const [firms, setFirms] = useState([]);
  const curFirmId = Number(getFirm()) || (firms[0] && firms[0].id) || null;
  useEffect(() => {
    if (authed) api.get('/firms').then(fs => {
      setFirms(fs);
      /* ak zvolená firma už nie je dostupná (odobraté oprávnenie), prepni na prvú povolenú */
      const cur = Number(getFirm());
      if (fs.length && !fs.some(f => f.id === cur)) setFirm(fs[0].id);
    }).catch(() => {});
  }, [authed, loc.pathname]);
  const selectFirm = (id) => {
    setFirm(id);
    window.location.href = '/'; /* nová firma = nové dáta, začni na úvode */
  };
  const addFirm = async () => {
    const name = window.prompt('Názov novej firmy:');
    if (!name || !name.trim()) return;
    try {
      const f = await api.post('/firms', { name: name.trim() });
      selectFirm(f.id);
    } catch (ex) { alert(ex.message); }
  };

  /* mobilné hamburger menu */
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => { setMenuOpen(false); }, [loc.pathname]);

  const logout = async () => {
    try { await api.post('/auth/logout', {}); } catch {}
    setToken('');
    setAuth(a => ({ ...a, user: null, required: true }));
  };

  return (
    <>
      <div className="topbar no-print">
        <Link to="/" className="logo">účto<span className="leaf"></span></Link>
        <span className="brand-sub">ERP systém</span>
        <span className="version">v.1.0.0</span>
        <div className="spacer" />
        <span className="tb-item" title="Prepnúť svetlú / tmavú tému"
          onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}>
          {theme === 'dark' ? '☀' : '🌙'}
        </span>
        <span className="tb-item hide-mobile">SK</span>
        {authed ? (
          <span className="hide-mobile">
            <TbMenu label={'🏢 ' + (settings?.company?.name || 'Moja firma')}>
              {firms.map(f => (
                <a key={f.id} onClick={() => selectFirm(f.id)} className={f.id === curFirmId ? 'active-firm' : ''}>
                  {f.id === curFirmId ? '✓ ' : ''}{f.name}
                </a>
              ))}
              <a onClick={addFirm}>＋ Pridať firmu</a>
            </TbMenu>
          </span>
        ) : (
          <span className="tb-item hide-mobile">{settings?.company?.name || 'Moja firma'}</span>
        )}
        {auth.user && <span className="tb-item hide-mobile">👤 {auth.user.name}</span>}
        {authed && (
          <span className="hide-mobile">
            <TbMenu label="Posledné otvorené">
              {docs.map((d, i) => (
                <Link key={i} to={'/faktury/' + (d.type === 'INI' ? 'dosle' : 'vysle')}>{d.number}</Link>
              ))}
              {!docs.length && <div className="muted">žiadne doklady</div>}
            </TbMenu>
          </span>
        )}
        {authed && (
          <span className="hide-mobile">
            <TbMenu label="Nastavenia">
              <Link to="/nastavenia">Údaje o firme</Link>
              <Link to="/uzavierka">Uzávierka</Link>
              <Link to="/manazer">Manažérske informácie</Link>
              <Link to="/prehlady">Prehľady</Link>
            </TbMenu>
          </span>
        )}
        {auth.user
          ? <span className="tb-item logout hide-mobile" onClick={logout}>Odhlásenie ⏻</span>
          : (auth.required && <span className="tb-item logout hide-mobile">Prihlásenie</span>)}
        {authed && (
          <span className="tb-item hamburger" onClick={() => setMenuOpen(o => !o)} title="Menu">☰</span>
        )}
      </div>

      {menuOpen && authed && (
        <div className="drawer-back no-print" onClick={() => setMenuOpen(false)}>
          <div className="drawer" onClick={e => e.stopPropagation()}>
            <div className="drawer-head">
              <span>☰ Menu</span>
              <span className="drawer-close" onClick={() => setMenuOpen(false)}>✕</span>
            </div>
            <div className="drawer-sec">Moduly</div>
            <Link to="/">🏠 Úvod</Link>
            <Link to="/faktury/vysle">🗎 Vyšlé faktúry</Link>
            <Link to="/faktury/dosle">🗎 Došlé faktúry</Link>
            <Link to="/ponuky/vysle">📄 Cenové ponuky (vyšlé)</Link>
            <Link to="/ponuky/dosle">📄 Cenové ponuky (došlé)</Link>
            <Link to="/dodacie-listy/vysle">📦 Dodacie listy (vyšlé)</Link>
            <Link to="/dodacie-listy/dosle">📦 Dodacie listy (došlé)</Link>
            <Link to="/pripomienky">🔔 Pripomienky</Link>
            <Link to="/pravidelne">🔁 Pravidelné faktúry</Link>
            <Link to="/partneri">👥 Partneri</Link>
            <Link to="/dennik">📓 Peňažný denník</Link>
            <Link to="/pokladna">💶 Pokladňa</Link>
            <Link to="/banka">🏦 Banka</Link>
            <Link to="/sklad">📦 Sklad</Link>
            <Link to="/objednavky">🛒 Objednávky</Link>
            <div className="drawer-sec">Nastavenia</div>
            <Link to="/nastavenia">Údaje o firme</Link>
            <Link to="/uzavierka">Uzávierka</Link>
            <Link to="/manazer">Manažérske informácie</Link>
            <Link to="/prehlady">Prehľady</Link>
            <div className="drawer-sec">Posledné otvorené</div>
            {docs.map((d, i) => (
              <Link key={i} to={'/faktury/' + (d.type === 'INI' ? 'dosle' : 'vysle')}>{d.number}</Link>
            ))}
            {!docs.length && <div className="drawer-muted">žiadne doklady</div>}
            <div className="drawer-sec">Firma</div>
            {firms.map(f => (
              <a key={f.id} onClick={() => selectFirm(f.id)}>{f.id === curFirmId ? '✓ ' : ''}{f.name}</a>
            ))}
            <a onClick={addFirm}>＋ Pridať firmu</a>
            <div className="drawer-sec"></div>
            <a onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}>
              {theme === 'dark' ? '☀ Svetlá téma' : '🌙 Tmavá téma'}
            </a>
            {auth.user && <a className="drawer-logout" onClick={() => { setMenuOpen(false); logout(); }}>⏻ Odhlásenie ({auth.user.name})</a>}
          </div>
        </div>
      )}
      {auth.loading ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999' }}>Načítavam…</div>
      ) : !authed ? (
        <Login allowRegister onLogin={(user) => { setAuth({ loading: false, user, required: true }); }} />
      ) : isDash ? (
        <Dashboard />
      ) : (
        <div className="layout">
          <div className="content">
            <Routes>
              <Route path="/faktury/vysle" element={<Invoices type="INO" key="INO" />} />
              <Route path="/faktury/dosle" element={<Invoices type="INI" key="INI" />} />
              <Route path="/faktury/:type/nova" element={<InvoiceForm />} />
              <Route path="/faktury/:type/:id" element={<InvoiceForm />} />
              <Route path="/ponuky/vysle" element={<Documents kind="quotes" type="O" key="qO" />} />
              <Route path="/ponuky/dosle" element={<Documents kind="quotes" type="I" key="qI" />} />
              <Route path="/ponuky/:type/nova" element={<DocForm kind="quotes" />} />
              <Route path="/ponuky/:type/:id" element={<DocForm kind="quotes" />} />
              <Route path="/dodacie-listy/vysle" element={<Documents kind="deliverynotes" type="O" key="dO" />} />
              <Route path="/dodacie-listy/dosle" element={<Documents kind="deliverynotes" type="I" key="dI" />} />
              <Route path="/dodacie-listy/:type/nova" element={<DocForm kind="deliverynotes" />} />
              <Route path="/dodacie-listy/:type/:id" element={<DocForm kind="deliverynotes" />} />
              <Route path="/partneri" element={<Partners />} />
              <Route path="/pripomienky" element={<Reminders />} />
              <Route path="/pravidelne" element={<Recurring />} />
              <Route path="/dennik" element={<Diary />} />
              <Route path="/pokladna" element={<CashBook />} />
              <Route path="/banka" element={<Bank />} />
              <Route path="/sklad" element={<Warehouse />} />
              <Route path="/objednavky" element={<Orders />} />
              <Route path="/uzavierka" element={<Closing />} />
              <Route path="/manazer" element={<Manager />} />
              <Route path="/prehlady" element={<Overview />} />
              <Route path="/nastavenia" element={<Settings />} />
            </Routes>
          </div>
        </div>
      )}
      <div className="footer no-print">
        <span>Podmienky použitia</span>
        <span>Ochrana osobných údajov</span>
        <div className="spacer" />
        <span>Obdobie: {settings?.year || new Date().getFullYear()}</span>
      </div>
    </>
  );
}
