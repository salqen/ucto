import React, { useEffect, useState } from 'react';
import { api, eur, dt, today } from '../api.js';
import { PageHead, Modal, Frow, useSort, SortTh } from '../components/ui.jsx';
import CatSelect from '../components/CatSelect.jsx';

/* zdroj -> kolekcia a kľúč účtu */
const collOf = src => (src === 'BAN' ? 'bankmoves' : 'cashdocs');

export default function Diary() {
  const [data, setData] = useState({ rows: [], initial: 0 });
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [type, setType] = useState('');
  const [partners, setPartners] = useState([]);
  const [cats, setCats] = useState({ P: [], V: [] });
  const [sel, setSel] = useState(null);
  const [edit, setEdit] = useState(null);

  const load = () => api.get('/diary' + (year ? '?year=' + year : '')).then(d => { setData(d); setSel(null); });
  useEffect(() => { load(); }, [year]);
  useEffect(() => {
    api.get('/partners').then(setPartners).catch(() => {});
    api.get('/categories').then(setCats).catch(() => {});
  }, []);

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

  const rowKey = r => r.src + '-' + r.id;
  const isBank = edit?.src === 'BAN';

  const saveDoc = async (e) => {
    e.preventDefault();
    const coll = collOf(edit.src);
    const body = {
      type: edit.type, date: edit.date, number: edit.number,
      text: edit.text, category: edit.category,
      amount: Number(edit.amount),
      partnerId: edit.partnerId ? Number(edit.partnerId) : null
    };
    if (coll === 'bankmoves') { body.accountId = edit.accountId; body.vs = edit.vs || ''; }
    else { body.cashboxId = edit.cashboxId; }
    await api.put(`/${coll}/${edit.id}`, body);
    setEdit(null); load();
  };
  const delDoc = async () => {
    if (!sel || !confirm(`Zmazať doklad ${sel.number}? Odstráni sa aj z pokladne/banky.`)) return;
    await api.del(`/${collOf(sel.src)}/${sel.id}`); setSel(null); load();
  };

  return (
    <>
      <PageHead title="Peňažný denník" />
      <div className="toolbar">
        <button className="btn" disabled={!sel} onClick={() => setEdit(sel)}>Detail / úprava</button>
        <button className="btn danger" disabled={!sel} onClick={delDoc}>Zmazať</button>
        <span style={{ marginLeft: 8, alignSelf: 'center', color: 'var(--muted,#888)', fontSize: 12 }}>
          Doklady vznikajú v pokladni a banke; tu ich možno upraviť či zmazať.
        </span>
      </div>
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
            {rows.map(r => (
              <tr key={rowKey(r)} className={sel && rowKey(sel) === rowKey(r) ? 'sel' : ''}
                onClick={() => setSel(r)} onDoubleClick={() => setEdit(r)}>
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
      <div className="grid-foot">{rows.length} zápisov • dvojklik = úprava dokladu</div>

      {edit && (
        <Modal title={'Doklad ' + edit.number + ' (' + edit.srcName + ')'} onClose={() => setEdit(null)}>
          <form onSubmit={saveDoc}>
            <Frow label="Typ" req>
              <select value={edit.type} onChange={e => setEdit(p => ({ ...p, type: e.target.value, category: (cats[e.target.value] || [])[0]?.code }))}>
                <option value="P">Príjem</option><option value="V">Výdaj</option>
              </select>
            </Frow>
            <Frow label="Dátum" req><input type="date" value={edit.date || today()} required onChange={e => setEdit(p => ({ ...p, date: e.target.value }))} /></Frow>
            <Frow label="Partner">
              <select value={edit.partnerId || ''} onChange={e => setEdit(p => ({ ...p, partnerId: e.target.value }))}>
                <option value="">—</option>
                {partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Frow>
            <Frow label="Text" req><input value={edit.text || ''} required onChange={e => setEdit(p => ({ ...p, text: e.target.value }))} /></Frow>
            <Frow label="Druh (stĺpec denníka)" req>
              <CatSelect cats={cats} type={edit.type} value={edit.category} required
                onChange={v => setEdit(p => ({ ...p, category: v }))} />
            </Frow>
            {isBank && <Frow label="VS"><input value={edit.vs || ''} onChange={e => setEdit(p => ({ ...p, vs: e.target.value }))} /></Frow>}
            <Frow label="Suma (€)" req><input type="number" step="0.01" min="0.01" value={edit.amount} required onChange={e => setEdit(p => ({ ...p, amount: e.target.value }))} /></Frow>
            {edit.invoiceId && <div style={{ color: '#c0392b', fontSize: 12, margin: '4px 0 10px' }}>Pozn.: doklad je úhradou faktúry — zmena sumy neupraví automaticky stav uhradenia faktúry.</div>}
            <div className="form-actions">
              <button className="btn primary" type="submit">💾 Ulož</button>
              <button className="btn" type="button" onClick={() => setEdit(null)}>Zrušiť</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
