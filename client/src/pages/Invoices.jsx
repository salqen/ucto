import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, eur, dt, today } from '../api.js';
import { PageHead, Modal, Frow, useSort, SortTh } from '../components/ui.jsx';
import ScanInvoice from '../components/ScanInvoice.jsx';

export default function Invoices({ type }) {
  const nav = useNavigate();
  const [rows, setRows] = useState([]);
  const [year, setYear] = useState('');
  const [filter, setFilter] = useState('');
  const [sel, setSel] = useState(null);
  const [pay, setPay] = useState(null);
  const [scan, setScan] = useState(false);
  const [cashboxes, setCashboxes] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const isOut = type === 'INO';
  const title = isOut ? 'Zoznam vyšlých faktúr' : 'Zoznam došlých faktúr';

  const load = () => api.get('/invoices?type=' + type + (year ? '&year=' + year : '')).then(setRows);
  useEffect(() => { load(); }, [type, year]);
  useEffect(() => {
    api.get('/cashboxes').then(setCashboxes);
    api.get('/bankaccounts').then(setAccounts);
  }, []);

  const filtered = rows.filter(r =>
    !filter || (r.number + ' ' + (r.partnerName || '') + ' ' + (r.vs || '')).toLowerCase().includes(filter.toLowerCase())
  );
  const [shown, sort, onSort] = useSort(filtered);
  const years = [...new Set(rows.map(r => (r.issueDate || '').slice(0, 4)).filter(Boolean))].sort().reverse();

  const doPay = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    await api.post(`/invoices/${pay.id}/pay`, {
      method: f.get('method'), amount: Number(f.get('amount')), date: f.get('date'),
      cashboxId: f.get('cashboxId'), accountId: f.get('accountId')
    });
    setPay(null); load();
  };

  const del = async () => {
    if (!sel) return;
    if (!confirm(`Zmazať faktúru ${sel.number}?`)) return;
    await api.del('/invoices/' + sel.id);
    setSel(null); load();
  };

  return (
    <>
      <PageHead title={title}>
        <button className="btn primary" onClick={() => nav(`/faktury/${type}/nova`)}>🗎 Nová faktúra</button>
        {!isOut && <button className="btn primary" onClick={() => setScan(true)}>📷 Načítať QR / EAN</button>}
      </PageHead>
      <div className="toolbar">
        <button className="btn" disabled={!sel} onClick={() => nav(`/faktury/${type}/${sel.id}`)}>Detail</button>
        <button className="btn" disabled={!sel || sel.paid >= sel.total} onClick={() => setPay(sel)}>Úhrada faktúry</button>
        <button className="btn" disabled={!sel} onClick={() => { nav(`/faktury/${type}/${sel.id}?print=1`); }}>Tlač</button>
        <button className="btn danger" disabled={!sel} onClick={del}>Zmazať</button>
      </div>
      <div className="filter-row">
        <label>Obdobie</label>
        <select value={year} onChange={e => setYear(e.target.value)}>
          <option value="">Všetko</option>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <label>Hľadať</label>
        <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="číslo, partner, VS…" />
      </div>
      <div className="grid-wrap">
        <table className="grid">
          <thead>
            <tr>
              <th>Typ</th>
              <SortTh label="Doklad č." k="number" sort={sort} onSort={onSort} />
              <SortTh label="VS" k="vs" sort={sort} onSort={onSort} />
              <SortTh label="Partner" k="partnerName" sort={sort} onSort={onSort} />
              <SortTh label="Vystavená" k="issueDate" type="date" sort={sort} onSort={onSort} />
              <SortTh label="Splatná" k="dueDate" type="date" sort={sort} onSort={onSort} />
              <SortTh label="Mena" k="currency" sort={sort} onSort={onSort} />
              <SortTh label="Spolu" k="total" type="num" className="num" sort={sort} onSort={onSort} />
              <SortTh label="Uhradené" k="paid" type="num" className="num" sort={sort} onSort={onSort} />
              <th></th>
            </tr>
          </thead>
          <tbody>
            {shown.map(r => {
              const unpaid = (r.total - (r.paid || 0)) > 0.004;
              const overdue = unpaid && r.dueDate && r.dueDate < today();
              return (
                <tr key={r.id}
                  className={sel?.id === r.id ? 'sel' : ''}
                  onClick={() => setSel(r)}
                  onDoubleClick={() => nav(`/faktury/${type}/${r.id}`)}>
                  <td>{isOut ? 'VF' : 'DF'}</td>
                  <td>{r.number}</td>
                  <td>{r.vs}</td>
                  <td>{r.partnerName}</td>
                  <td>{dt(r.issueDate)}</td>
                  <td>{dt(r.dueDate)}</td>
                  <td>{r.currency || 'EUR'}</td>
                  <td className="num">{eur(r.total)}</td>
                  <td className="num">{eur(r.paid)}</td>
                  <td><span className={'dot ' + (!unpaid ? 'green' : overdue ? 'red' : 'orange')}></span></td>
                </tr>
              );
            })}
            {!shown.length && <tr><td colSpan={10} style={{ textAlign: 'center', color: '#999' }}>Žiadne faktúry</td></tr>}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={7}>Spolu</td>
              <td className="num">{eur(shown.reduce((s, r) => s + r.total, 0))}</td>
              <td className="num">{eur(shown.reduce((s, r) => s + (r.paid || 0), 0))}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="grid-foot">{shown.length} položiek • dvojklik = otvoriť detail</div>

      {scan && (
        <ScanInvoice
          onClose={() => setScan(false)}
          onResult={(data) => {
            setScan(false);
            sessionStorage.setItem('scanInvoice', JSON.stringify(data));
            nav('/faktury/INI/nova?scan=1');
          }}
        />
      )}

      {pay && (
        <Modal title={'Úhrada faktúry ' + pay.number} onClose={() => setPay(null)}>
          <form onSubmit={doPay}>
            <Frow label="Spôsob úhrady" req>
              <select name="method" defaultValue="bank">
                <option value="bank">Bankou</option>
                <option value="cash">V hotovosti</option>
              </select>
            </Frow>
            <Frow label="Pokladňa"><select name="cashboxId">{cashboxes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Frow>
            <Frow label="Bankový účet"><select name="accountId">{accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></Frow>
            <Frow label="Dátum úhrady" req><input type="date" name="date" defaultValue={today()} required /></Frow>
            <Frow label="Suma (€)" req>
              <input type="number" step="0.01" name="amount" defaultValue={(pay.total - (pay.paid || 0)).toFixed(2)} required />
            </Frow>
            <div className="form-actions">
              <button className="btn primary" type="submit">💾 Uhradiť</button>
              <button className="btn" type="button" onClick={() => setPay(null)}>Zrušiť</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
