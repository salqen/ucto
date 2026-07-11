import React, { useEffect, useState } from 'react';
import { api, eur, dt, today } from '../api.js';
import { PageHead, Modal, Frow } from './ui.jsx';

/*
 Spoločný modul pre Pokladňu a Banku.
 props:
  title       - nadpis stránky
  accColl     - 'cashboxes' | 'bankaccounts'
  docColl     - 'cashdocs' | 'bankmoves'
  accKey      - 'cashboxId' | 'accountId'
  accLabel    - 'Pokladňa' | 'Bankový účet'
  hasIban     - true pre banku
*/
export default function MoneyBook({ title, accColl, docColl, accKey, accLabel, hasIban }) {
  const [accounts, setAccounts] = useState([]);
  const [docs, setDocs] = useState([]);
  const [partners, setPartners] = useState([]);
  const [cats, setCats] = useState({ P: [], V: [] });
  const [accId, setAccId] = useState(null);
  const [edit, setEdit] = useState(null);
  const [accEdit, setAccEdit] = useState(null);
  const [sel, setSel] = useState(null);

  const load = () => {
    api.get('/' + accColl).then(a => {
      setAccounts(a);
      setAccId(prev => prev ?? (a[0] && a[0].id));
    });
    api.get('/' + docColl).then(setDocs);
  };
  useEffect(() => {
    load();
    api.get('/partners').then(setPartners);
    api.get('/categories').then(setCats);
  }, []);

  const acc = accounts.find(a => a.id === accId);
  const accDocs = docs.filter(d => d[accKey] === accId).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  let bal = Number(acc?.initial || 0);
  const rows = accDocs.map(d => { bal += (d.type === 'P' ? 1 : -1) * Number(d.amount || 0); return { ...d, balance: bal }; });

  const saveDoc = async (e) => {
    e.preventDefault();
    const body = { ...edit, [accKey]: accId, amount: Number(edit.amount), partnerId: edit.partnerId ? Number(edit.partnerId) : null };
    if (edit.id) await api.put(`/${docColl}/${edit.id}`, body);
    else await api.post('/' + docColl, body);
    setEdit(null); load();
  };
  const delDoc = async () => {
    if (!sel || !confirm(`Zmazať doklad ${sel.number}?`)) return;
    await api.del(`/${docColl}/${sel.id}`); setSel(null); load();
  };
  const saveAcc = async (e) => {
    e.preventDefault();
    const body = { ...accEdit, initial: Number(accEdit.initial || 0) };
    if (accEdit.id) await api.put(`/${accColl}/${accEdit.id}`, body);
    else {
      const created = await api.post('/' + accColl, body);
      setAccId(created.id);
    }
    setAccEdit(null); load();
  };

  return (
    <>
      <PageHead title={title}>
        <button className="btn primary" disabled={!acc} onClick={() => setEdit({ type: 'P', date: today(), text: '', category: cats.P[0]?.code, amount: '', partnerId: '' })}>+ Príjem</button>
        <button className="btn primary" disabled={!acc} onClick={() => setEdit({ type: 'V', date: today(), text: '', category: cats.V[0]?.code, amount: '', partnerId: '' })}>− Výdaj</button>
      </PageHead>

      <div className="tabs">
        {accounts.map(a => (
          <button key={a.id} className={a.id === accId ? 'active' : ''} onClick={() => { setAccId(a.id); setSel(null); }}>{a.name}</button>
        ))}
        <button onClick={() => setAccEdit({ name: '', iban: '', initial: 0 })}>+ {accLabel}</button>
      </div>

      <div className="toolbar">
        <button className="btn" disabled={!sel} onClick={() => setEdit(sel)}>Detail / úprava</button>
        <button className="btn danger" disabled={!sel} onClick={delDoc}>Zmazať</button>
        <button className="btn" disabled={!acc} onClick={() => setAccEdit(acc)}>Nastavenie: {acc?.name}</button>
        <span style={{ marginLeft: 'auto', alignSelf: 'center' }}>
          Zostatok: <b style={{ color: '#5f9622', fontSize: 15 }}>{eur(rows.length ? rows[rows.length - 1].balance : acc?.initial)}</b>
        </span>
      </div>

      <div className="grid-wrap">
        <table className="grid">
          <thead>
            <tr>
              <th>Doklad č.</th><th>Dátum</th><th>Typ</th><th>Partner</th><th>Text</th><th>Druh</th>
              {hasIban && <th>VS</th>}
              <th className="num">Príjem</th><th className="num">Výdaj</th><th className="num">Zostatok</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} style={sel?.id === r.id ? { background: '#d9ecc2' } : {}}
                onClick={() => setSel(r)} onDoubleClick={() => setEdit(r)}>
                <td>{r.number}</td>
                <td>{dt(r.date)}</td>
                <td>{r.type === 'P' ? 'Príjem' : 'Výdaj'}</td>
                <td>{(partners.find(p => p.id === r.partnerId) || {}).name || ''}</td>
                <td>{r.text}</td>
                <td>{(cats[r.type] || []).find(c => c.code === r.category)?.name || r.category}</td>
                {hasIban && <td>{r.vs || ''}</td>}
                <td className="num" style={{ color: '#5f9622' }}>{r.type === 'P' ? eur(r.amount) : ''}</td>
                <td className="num" style={{ color: '#c0392b' }}>{r.type === 'V' ? eur(r.amount) : ''}</td>
                <td className="num">{eur(r.balance)}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={hasIban ? 10 : 9} style={{ textAlign: 'center', color: '#999' }}>Žiadne doklady</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="grid-foot">{rows.length} dokladov • počiatočný stav {eur(acc?.initial)}</div>

      {edit && (
        <Modal title={edit.id ? 'Doklad ' + edit.number : (edit.type === 'P' ? 'Nový príjmový doklad' : 'Nový výdavkový doklad')} onClose={() => setEdit(null)}>
          <form onSubmit={saveDoc}>
            <Frow label="Typ" req>
              <select value={edit.type} onChange={e => setEdit(p => ({ ...p, type: e.target.value, category: cats[e.target.value][0]?.code }))}>
                <option value="P">Príjem</option><option value="V">Výdaj</option>
              </select>
            </Frow>
            <Frow label="Dátum" req><input type="date" value={edit.date} required onChange={e => setEdit(p => ({ ...p, date: e.target.value }))} /></Frow>
            <Frow label="Partner">
              <select value={edit.partnerId || ''} onChange={e => setEdit(p => ({ ...p, partnerId: e.target.value }))}>
                <option value="">—</option>
                {partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Frow>
            <Frow label="Text" req><input value={edit.text} required onChange={e => setEdit(p => ({ ...p, text: e.target.value }))} /></Frow>
            <Frow label="Druh (stĺpec denníka)" req>
              <select value={edit.category} onChange={e => setEdit(p => ({ ...p, category: e.target.value }))}>
                {(cats[edit.type] || []).map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
              </select>
            </Frow>
            {hasIban && <Frow label="VS"><input value={edit.vs || ''} onChange={e => setEdit(p => ({ ...p, vs: e.target.value }))} /></Frow>}
            <Frow label="Suma (€)" req><input type="number" step="0.01" min="0.01" value={edit.amount} required onChange={e => setEdit(p => ({ ...p, amount: e.target.value }))} /></Frow>
            <div className="form-actions">
              <button className="btn primary" type="submit">💾 Ulož</button>
              <button className="btn" type="button" onClick={() => setEdit(null)}>Zrušiť</button>
            </div>
          </form>
        </Modal>
      )}

      {accEdit && (
        <Modal title={accEdit.id ? accLabel + ': ' + accEdit.name : 'Nová ' + accLabel.toLowerCase()} onClose={() => setAccEdit(null)}>
          <form onSubmit={saveAcc}>
            <Frow label="Názov" req><input value={accEdit.name} required onChange={e => setAccEdit(p => ({ ...p, name: e.target.value }))} /></Frow>
            {hasIban && <Frow label="IBAN"><input value={accEdit.iban || ''} onChange={e => setAccEdit(p => ({ ...p, iban: e.target.value }))} /></Frow>}
            <Frow label="Počiatočný stav (€)"><input type="number" step="0.01" value={accEdit.initial} onChange={e => setAccEdit(p => ({ ...p, initial: e.target.value }))} /></Frow>
            <div className="form-actions">
              <button className="btn primary" type="submit">💾 Ulož</button>
              <button className="btn" type="button" onClick={() => setAccEdit(null)}>Zrušiť</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
