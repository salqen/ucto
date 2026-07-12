import React, { useEffect, useState } from 'react';
import { api, eur, dt } from '../api.js';
import { PageHead, useSort, SortTh } from '../components/ui.jsx';

export default function Diary() {
  const [data, setData] = useState({ rows: [], initial: 0 });
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [type, setType] = useState('');
  useEffect(() => { api.get('/diary' + (year ? '?year=' + year : '')).then(setData); }, [year]);

  const filtered = data.rows.filter(r => !type || r.type === type).map(r => ({
    ...r,
    inAmt: r.type === 'P' ? Number(r.amount || 0) : null,
    outAmt: r.type === 'V' ? Number(r.amount || 0) : null
  }));
  const [rows, sort, onSort] = useSort(filtered);
  const inc = rows.filter(r => r.type === 'P').reduce((s, r) => s + Number(r.amount || 0), 0);
  const exp = rows.filter(r => r.type === 'V').reduce((s, r) => s + Number(r.amount || 0), 0);
  const years = [];
  for (let y = new Date().getFullYear(); y >= new Date().getFullYear() - 8; y--) years.push(String(y));

  return (
    <>
      <PageHead title="Peňažný denník" />
      <div className="filter-row">
        <label>Obdobie</label>
        <select value={year} onChange={e => setYear(e.target.value)}>
          <option value="">Všetko</option>
          {years.map(y => <option key={y}>{y}</option>)}
        </select>
        <label>Typ</label>
        <select value={type} onChange={e => setType(e.target.value)}>
          <option value="">Všetko</option>
          <option value="P">Príjmy</option>
          <option value="V">Výdaje</option>
        </select>
        <span style={{ marginLeft: 'auto' }}>
          Príjmy: <b style={{ color: '#5f9622' }}>{eur(inc)}</b> &nbsp;
          Výdaje: <b style={{ color: '#c0392b' }}>{eur(exp)}</b> &nbsp;
          Rozdiel: <b>{eur(inc - exp)}</b>
        </span>
      </div>
      <div className="grid-wrap">
        <table className="grid">
          <thead>
            <tr>
              <SortTh label="Dátum" k="date" type="date" sort={sort} onSort={onSort} />
              <SortTh label="Doklad č." k="number" sort={sort} onSort={onSort} />
              <SortTh label="Zdroj" k="srcName" sort={sort} onSort={onSort} />
              <SortTh label="Partner" k="partnerName" sort={sort} onSort={onSort} />
              <SortTh label="Text" k="text" sort={sort} onSort={onSort} />
              <SortTh label="Druh" k="categoryName" sort={sort} onSort={onSort} />
              <SortTh label="Príjem" k="inAmt" type="num" className="num" sort={sort} onSort={onSort} />
              <SortTh label="Výdaj" k="outAmt" type="num" className="num" sort={sort} onSort={onSort} />
              <SortTh label="Zostatok" k="balance" type="num" className="num" sort={sort} onSort={onSort} />
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} style={{ cursor: 'default' }}>
                <td>{dt(r.date)}</td>
                <td>{r.number}</td>
                <td>{r.srcName}</td>
                <td>{r.partnerName}</td>
                <td>{r.text}</td>
                <td>{r.categoryName}</td>
                <td className="num" style={{ color: '#5f9622' }}>{r.type === 'P' ? eur(r.amount) : ''}</td>
                <td className="num" style={{ color: '#c0392b' }}>{r.type === 'V' ? eur(r.amount) : ''}</td>
                <td className="num">{eur(r.balance)}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={9} style={{ textAlign: 'center', color: '#999' }}>Peňažný denník je prázdny — zapíšte doklad v pokladni alebo banke</td></tr>}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={6}>Spolu (počiatočný stav {eur(data.initial)})</td>
              <td className="num">{eur(inc)}</td>
              <td className="num">{eur(exp)}</td>
              <td className="num">{eur(data.initial + inc - exp)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="grid-foot">{rows.length} zápisov • denník sa tvorí automaticky z pokladničných a bankových dokladov</div>
    </>
  );
}
