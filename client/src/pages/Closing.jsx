import React, { useEffect, useState } from 'react';
import { api, eur } from '../api.js';
import { PageHead } from '../components/ui.jsx';

export default function Closing() {
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [d, setD] = useState(null);
  useEffect(() => { api.get('/closing?year=' + year).then(setD); }, [year]);
  const years = [];
  for (let y = new Date().getFullYear(); y >= new Date().getFullYear() - 8; y--) years.push(String(y));
  if (!d) return null;

  const Tbl = ({ title, rows, total }) => (
    <div style={{ flex: 1, minWidth: 320 }}>
      <div className="grid-wrap">
        <table className="grid">
          <thead><tr><th colSpan={2}>{title}</th><th className="num">Suma</th></tr></thead>
          <tbody>
            {rows.map(c => (
              <tr key={c.code} style={{ cursor: 'default' }}>
                <td>{c.name}</td>
                <td style={{ color: '#999', fontSize: 11 }}>{c.tax ? 'ovplyvňuje ZD' : 'neovplyvňuje ZD'}</td>
                <td className="num">{eur(c.sum)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr><td colSpan={2}>Spolu</td><td className="num">{eur(total)}</td></tr></tfoot>
        </table>
      </div>
    </div>
  );

  return (
    <>
      <PageHead title={'Uzávierka ' + d.year} />
      <div className="filter-row">
        <label>Rok</label>
        <select value={year} onChange={e => setYear(e.target.value)}>{years.map(y => <option key={y}>{y}</option>)}</select>
      </div>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
        <Tbl title="Príjmy" rows={d.income} total={d.incomeTotal} />
        <Tbl title="Výdavky" rows={d.expense} total={d.expenseTotal} />
      </div>
      <div className="chart-box">
        <h3>Výsledok hospodárenia {d.year} (jednoduché účtovníctvo)</h3>
        <table className="grid" style={{ maxWidth: 560 }}>
          <tbody>
            <tr style={{ cursor: 'default' }}><td>Zdaniteľné príjmy</td><td className="num">{eur(d.incomeTax)}</td></tr>
            <tr style={{ cursor: 'default' }}><td>Daňové výdavky</td><td className="num">{eur(d.expenseTax)}</td></tr>
            <tr style={{ cursor: 'default' }}>
              <td><b>Základ dane (zisk / strata)</b></td>
              <td className="num"><b style={{ color: d.profit >= 0 ? '#5f9622' : '#c0392b', fontSize: 16 }}>{eur(d.profit)}</b></td>
            </tr>
          </tbody>
        </table>
        <p className="hint" style={{ marginTop: 8 }}>Informatívny výpočet — nenahrádza daňové priznanie ani prácu účtovníka.</p>
      </div>
    </>
  );
}
