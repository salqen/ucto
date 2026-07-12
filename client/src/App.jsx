import React, { useEffect, useState, useRef } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { api, eur, setToken, getToken } from './api.js';
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

  const authed = !auth.required || !!auth.user;
  useEffect(() => { if (authed) api.get('/settings').then(setSettings).catch(() => {}); }, [loc.pathname, authed]);

  const [docs, setDocs] = useState([]);
  useEffect(() => {
    if (authed) api.get('/dashboard').then(d => setDocs(d.lastDocs || [])).catch(() => {});
  }, [loc.pathname, authed]);

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
        <span className="tb-item">SK</span>
        <span className="tb-item">{settings?.company?.name || 'Moja firma'}</span>
        {auth.user && <span className="tb-item">👤 {auth.user.name}</span>}
        {authed && (
          <TbMenu label="Posledné otvorené">
            {docs.map((d, i) => (
              <Link key={i} to={'/faktury/' + (d.type === 'INI' ? 'dosle' : 'vysle')}>{d.number}</Link>
            ))}
            {!docs.length && <div className="muted">žiadne doklady</div>}
          </TbMenu>
        )}
        {authed && (
          <TbMenu label="Nastavenia">
            <Link to="/nastavenia">Údaje o firme</Link>
            <Link to="/uzavierka">Uzávierka</Link>
            <Link to="/manazer">Manažérske informácie</Link>
            <Link to="/prehlady">Prehľady</Link>
          </TbMenu>
        )}
        {auth.user
          ? <span className="tb-item logout" onClick={logout}>Odhlásenie ⏻</span>
          : (auth.required && <span className="tb-item logout">Prihlásenie</span>)}
      </div>
      {auth.loading ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999' }}>Načítavam…</div>
      ) : !authed ? (
        <Login onLogin={(user) => { setAuth({ loading: false, user, required: true }); }} />
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
              <Route path="/partneri" element={<Partners />} />
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
