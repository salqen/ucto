import React, { useEffect, useState } from 'react';
import { api, eur } from '../api.js';
import { PageHead } from '../components/ui.jsx';

const M = ['Jan', 'Feb', 'Mar', 'Apr', 'Máj', 'Jún', 'Júl', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec'];

export default function Manager() {
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [d, setD] = useState(null);
  const [dash, setDash] = useState(null);
  useEffect(() => { api.get('/manager?year=' + year).then(setD); }, [year]);
  useEffect(() => { api.get('/dashboard').then(setDash); }, []);
  const years = [];
  for (let y = new Date().getFullYear(); y >= new Date().getFullYear() - 8; y--) years.push(String(y));
  if (!d) return null;

  const max = Math.max(1, ...d.months.map(m => Math.max(m.income, m.expense)));
  const W = 900, H = 260, bw = W / 12;

  return (
    <>
      <PageHead title="Manažérske informácie" />
      <div className="filter-row">
        <label>Rok</label>
        <select value={year} onChange={e => setYear(e.target.value)}>{years.map(y => <option key={y}>{y}</option>)}</select>
      </div>

      {dash && (
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
          {[
            ['Zisk / strata', dash.profit, dash.profit >= 0 ? '#5f9622' : '#c0392b'],
            ['Peniaze spolu', dash.money, '#29a3dc'],
            ['Pohľadávky (dlhujú mi)', dash.oweMe, '#f39200'],
            ['Záväzky (dlhujem)', dash.iOwe, '#c0392b'],
            ['Hodnota zásob', dash.stockValue, '#6a5ae0']
          ].map(([t, v, c]) => (
            <div key={t} className="chart-box" style={{ flex: 1, minWidth: 160, marginBottom: 0 }}>
              <h3 style={{ fontSize: 11 }}>{t}</h3>
              <div style={{ fontSize: 22, fontWeight: 700, color: c }}>{eur(v)}</div>
            </div>
          ))}
        </div>
      )}

      <div className="chart-box">
        <h3>Príjmy a výdaje po mesiacoch {d.year}</h3>
        <svg viewBox={`0 0 ${W} ${H + 30}`} style={{ width: '100%' }}>
          {d.months.map((m, i) => {
            const hi = m.income / max * H, he = m.expense / max * H;
            return (
              <g key={i}>
                <rect x={i * bw + 8} y={H - hi} width={bw / 2 - 10} height={hi} fill="#76b82a" />
                <rect x={i * bw + bw / 2 + 2} y={H - he} width={bw / 2 - 10} height={he} fill="#c0392b" />
                <text x={i * bw + bw / 2} y={H + 16} textAnchor="middle" fontSize="12" fill="var(--muted)">{M[i]}</text>
              </g>
            );
          })}
          <line x1="0" y1={H} x2={W} y2={H} stroke="var(--input-border)" />
        </svg>
        <div className="legend">
          <span><i style={{ background: '#76b82a' }} />Príjmy</span>
          <span><i style={{ background: '#c0392b' }} />Výdaje</span>
        </div>
      </div>

      <div className="grid-wrap">
        <table className="grid">
          <thead><tr><th>Mesiac</th><th className="num">Príjmy</th><th className="num">Výdaje</th><th className="num">Zisk / strata</th></tr></thead>
          <tbody>
            {d.months.map((m, i) => (
              <tr key={i} style={{ cursor: 'default' }}>
                <td>{M[i]}</td>
                <td className="num">{eur(m.income)}</td>
                <td className="num">{eur(m.expense)}</td>
                <td className="num" style={{ color: m.profit >= 0 ? '#5f9622' : '#c0392b' }}>{eur(m.profit)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td>Spolu</td>
              <td className="num">{eur(d.months.reduce((s, m) => s + m.income, 0))}</td>
              <td className="num">{eur(d.months.reduce((s, m) => s + m.expense, 0))}</td>
              <td className="num">{eur(d.months.reduce((s, m) => s + m.profit, 0))}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </>
  );
}
