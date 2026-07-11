import React, { useEffect, useState } from 'react';
import { api, eur, dt, today } from '../api.js';
import { PageHead, Modal, Frow } from '../components/ui.jsx';

const STATES = ['nová', 'potvrdená', 'vybavená', 'zrušená'];
const badge = s => s === 'nová' ? 'b-new' : s === 'potvrdená' ? 'b-ok' : s === 'vybavená' ? 'b-done' : 'b-cancel';

export default function Orders() {
  const [rows, setRows] = useState([]);
  const [partners, setPartners] = useState([]);
  const [edit, setEdit] = useState(null);
  const [sel, setSel] = useState(null);
  const load = () => api.get('/orders').then(setRows);
  useEffect(() => { load(); api.get('/partners').then(setPartners); }, []);

  const save = async (e) => {
    e.preventDefault();
    const body = { ...edit, total: Number(edit.total || 0), partnerId: edit.partnerId ? Number(edit.partnerId) : null };
    if (edit.id) await api.put('/orders/' + edit.id, body); else await api.post('/orders', body);
    setEdit(null); load();
  };
  const del = async () => {
    if (!sel || !confirm(`Zmazať objednávku ${sel.number}?`)) return;
    await api.del('/orders/' + sel.id); setSel(null); load();
  };

  return (
    <>
      <PageHead title="Objednávky">
        <button className="btn primary" onClick={() => setEdit({ date: today(), partnerId: '', subject: '', total: 0, state: 'nová', note: '' })}>🛒 Nová objednávka</button>
      </PageHead>
      <div className="toolbar">
        <button className="btn" disabled={!sel} onClick={() => setEdit(sel)}>Detail / úprava</button>
        <button className="btn danger" disabled={!sel} onClick={del}>Zmazať</button>
      </div>
      <div className="grid-wrap">
        <table className="grid">
          <thead><tr><th>Doklad č.</th><th>Dátum</th><th>Partner</th><th>Predmet</th><th className="num">Suma</th><th>Stav</th><th>Poznámka</th></tr></thead>
          <tbody>
            {[...rows].sort((a, b) => (b.date || '').localeCompare(a.date || '')).map(r => (
              <tr key={r.id} style={sel?.id === r.id ? { background: '#d9ecc2' } : {}} onClick={() => setSel(r)} onDoubleClick={() => setEdit(r)}>
                <td>{r.number}</td><td>{dt(r.date)}</td><td>{r.partnerName}</td><td>{r.subject}</td>
                <td className="num">{eur(r.total)}</td>
                <td><span className={'badge ' + badge(r.state)}>{r.state}</span></td>
                <td>{r.note}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={7} style={{ textAlign: 'center', color: '#999' }}>Žiadne objednávky</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="grid-foot">{rows.length} položiek</div>

      {edit && (
        <Modal title={edit.id ? 'Objednávka ' + edit.number : 'Nová objednávka'} onClose={() => setEdit(null)}>
          <form onSubmit={save}>
            <Frow label="Dátum" req><input type="date" value={edit.date} required onChange={e => setEdit(p => ({ ...p, date: e.target.value }))} /></Frow>
            <Frow label="Partner" req>
              <select value={edit.partnerId || ''} required onChange={e => setEdit(p => ({ ...p, partnerId: e.target.value }))}>
                <option value="">Vyberte z možností</option>
                {partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Frow>
            <Frow label="Predmet" req><input value={edit.subject} required onChange={e => setEdit(p => ({ ...p, subject: e.target.value }))} /></Frow>
            <Frow label="Suma (€)"><input type="number" step="0.01" value={edit.total} onChange={e => setEdit(p => ({ ...p, total: e.target.value }))} /></Frow>
            <Frow label="Stav">
              <select value={edit.state} onChange={e => setEdit(p => ({ ...p, state: e.target.value }))}>
                {STATES.map(s => <option key={s}>{s}</option>)}
              </select>
            </Frow>
            <Frow label="Poznámka"><input value={edit.note || ''} onChange={e => setEdit(p => ({ ...p, note: e.target.value }))} /></Frow>
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
