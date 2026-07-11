import React, { useEffect, useState } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { api, eur } from './api.js';
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
import Settings from './pages/Settings.jsx';

function Sidebar() {
  const [docs, setDocs] = useState([]);
  const loc = useLocation();
  useEffect(() => {
    api.get('/dashboard').then(d => setDocs(d.lastDocs || [])).catch(() => {});
  }, [loc.pathname]);
  return (
    <div className="sidebar no-print">
      <h3>Posledné doklady</h3>
      <ul>
        {docs.map((d, i) => <li key={i}>- <Link to={'/faktury/' + (d.type === 'INI' ? 'dosle' : 'vysle')}>{d.number}</Link></li>)}
        {!docs.length && <li className="muted">žiadne doklady</li>}
      </ul>
      <h4><Link to="/nastavenia" style={{ color: 'inherit', textDecoration: 'none' }}>Nastavenia</Link></h4>
      <ul>
        <li><Link to="/nastavenia">Údaje o firme</Link></li>
        <li><Link to="/uzavierka">Uzávierka</Link></li>
        <li><Link to="/manazer">Manažérske informácie</Link></li>
      </ul>
    </div>
  );
}

export default function App() {
  const loc = useLocation();
  const isDash = loc.pathname === '/';
  const [settings, setSettings] = useState(null);
  useEffect(() => { api.get('/settings').then(setSettings).catch(() => {}); }, [loc.pathname]);
  return (
    <>
      <div className="topbar no-print">
        <Link to="/" className="logo">účto<span className="leaf"></span></Link>
        <span className="brand-sub">ERP systém</span>
        <span className="version">v.1.0.0</span>
        <div className="spacer" />
        <span className="tb-item">SK</span>
        <span className="tb-item">{settings?.company?.name || 'Moja firma'}</span>
        <Link to="/nastavenia" className="tb-item">Nastavenia</Link>
        <span className="tb-item logout">Odhlásenie ⏻</span>
      </div>
      {isDash ? (
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
              <Route path="/nastavenia" element={<Settings />} />
            </Routes>
          </div>
          <Sidebar />
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
