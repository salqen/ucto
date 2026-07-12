import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, eur } from '../api.js';

function Tile({ color, to, title, icon, children, menu }) {
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const click = () => { if (menu) setOpen(!open); else nav(to); };
  return (
    <div className={'tile ' + color} onClick={click}>
      <h2>{title}</h2>
      <div className="icon">{icon}</div>
      {children}
      {open && menu && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.75)', padding: '12px 16px' }} onClick={e => e.stopPropagation()}>
          <h2 style={{ marginBottom: 8 }}>{title}</h2>
          {menu.map(m => (
            <div key={m.to + m.label} style={{ padding: '5px 0', borderBottom: '1px solid #444', fontSize: 12, textTransform: 'uppercase' }}
              onClick={() => nav(m.to)}>{m.label}</div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const [d, setD] = useState(null);
  useEffect(() => { api.get('/dashboard').then(setD).catch(() => setD({})); }, []);
  if (!d) return <div className="dash" />;
  return (
    <div className="dash">
      <div className="tiles">
        <Tile color="t-purple" title="Faktúra" icon="🗎" menu={[
          { label: 'Nová faktúra', to: '/faktury/INO/nova' },
          { label: 'Zoznam', to: '/faktury/vysle' },
          { label: 'Objednávky', to: '/objednavky' }
        ]}>
          <div className="kv">Počet neuhradených faktúr po splatnosti</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div className="big">{d.overdueCount ?? 0}</div>
            <div style={{ textAlign: 'right' }}>
              <div className="kv">Neuhradená suma</div>
              <div className="val">{eur(d.overdueSum)}</div>
            </div>
          </div>
        </Tile>
        <Tile color="t-teal" title="Partner" icon="👤" to="/partneri">
          <div className="kv">Dlhujem</div><div className="val">{eur(d.iOwe)}</div>
          <div className="kv">Dlhujú mi</div><div className="val">{eur(d.oweMe)}</div>
        </Tile>
        <Tile color="t-magenta" title="Peňažný denník" icon="📖" to="/dennik">
          <div className="kv">Príjmy</div><div className="val">{eur(d.income)}</div>
          <div className="kv">Výdaje</div><div className="val">{eur(d.expense)}</div>
        </Tile>
        <Tile color="t-pink" title="Pokladňa" icon="💶" to="/pokladna">
          <div className="kv">V pokladniach</div><div className="val">{eur(d.cashBal)}</div>
        </Tile>
        <Tile color="t-blue" title="Banka" icon="💳" to="/banka">
          <div className="kv">Na účtoch</div><div className="val">{eur(d.bankBal)}</div>
        </Tile>
        <Tile color="t-orange" title="Došlá faktúra" icon="🗎" menu={[
          { label: 'Nová došlá faktúra', to: '/faktury/INI/nova' },
          { label: 'Zoznam', to: '/faktury/dosle' }
        ]}>
          <div style={{ display: 'flex', gap: 24 }}>
            <div><div className="kv">Počet</div><div className="val">{d.incomingCount ?? 0}</div></div>
            <div><div className="kv">Neuhradená suma</div><div className="val">{eur(d.incomingSum)}</div></div>
          </div>
        </Tile>
        <Tile color="t-violet" title="Sklady" icon="📦" to="/sklad">
          <div className="kv">Stav zásob celkom</div><div className="val">{eur(d.stockValue)}</div>
        </Tile>
        <Tile color="t-gray" title="Manažérske informácie" icon="📊" menu={[
          { label: 'Prehľady (grafy, bilancia)', to: '/prehlady' },
          { label: 'Manažérske informácie', to: '/manazer' }
        ]}>
          <div style={{ display: 'flex', gap: 24 }}>
            <div><div className="kv">Zisk/strata</div><div className="val">{eur(d.profit)}</div></div>
            <div><div className="kv">Peniaze</div><div className="val">{eur(d.money)}</div></div>
          </div>
        </Tile>
        <Tile color="t-plum" title="Uzávierky" icon="🗓" to="/uzavierka">
          <div className="kv">Ročná uzávierka a prehľady</div>
        </Tile>
        <Tile color="t-gold" title="Posledné doklady" icon="✉" to="/faktury/vysle">
          {(d.lastDocs || []).slice(0, 4).map((x, i) => (
            <div key={i} style={{ fontSize: 11, display: 'flex', justifyContent: 'space-between' }}>
              <b>{x.number}</b><span>{eur(x.total)}</span>
            </div>
          ))}
        </Tile>
        <Tile color="t-green" title="Objednávky" icon="🛒" to="/objednavky">
          <div className="kv">Evidencia objednávok</div>
        </Tile>
      </div>
    </div>
  );
}
