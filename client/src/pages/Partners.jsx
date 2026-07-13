import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { PageHead, Modal, Frow, useSort, SortTh } from '../components/ui.jsx';

const empty = { name: '', ico: '', dic: '', icdph: '', street: '', city: '', zip: '', country: 'Slovensko', email: '', phone: '', iban: '' };

export default function Partners() {
  const [rows, setRows] = useState([]);
  const [filter, setFilter] = useState('');
  const [edit, setEdit] = useState(null);
  const [sel, setSel] = useState(null);
  const [icoBusy, setIcoBusy] = useState(false);
  const [icoMsg, setIcoMsg] = useState('');
  const load = () => api.get('/partners').then(setRows);
  useEffect(() => { load(); }, []);

  /* doplnenie údajov partnera z registra firiem (RPO) podľa IČO */
  const lookupIco = async () => {
    const ico = String(edit.ico || '').replace(/\D/g, '');
    if (ico.length < 6) { setIcoMsg('⚠ Zadajte IČO (6–8 číslic).'); return; }
    setIcoBusy(true); setIcoMsg('');
    try {
      const d = await api.get('/ico/' + ico);
      setEdit(p => ({
        ...p, ico: d.ico || p.ico, name: d.name || p.name,
        street: d.street || p.street, city: d.city || p.city,
        zip: d.zip || p.zip, country: d.country || p.country,
      }));
      setIcoMsg('✓ ' + d.name);
    } catch (e) { setIcoMsg('⚠ ' + e.message); }
    finally { setIcoBusy(false); }
  };

  const save = async (e) => {
    e.preventDefault();
    if (edit.id) await api.put('/partners/' + edit.id, edit);
    else await api.post('/partners', edit);
    setEdit(null); load();
  };
  const del = async () => {
    if (!sel || !confirm(`Zmazať partnera ${sel.name}?`)) return;
    await api.del('/partners/' + sel.id); setSel(null); load();
  };

  const filtered = rows.filter(r => !filter || (r.name + ' ' + r.ico + ' ' + (r.city || '')).toLowerCase().includes(filter.toLowerCase()));
  const [shown, sort, onSort] = useSort(filtered);
  const F = (k, label, req) => (
    <Frow label={label} req={req}>
      <input value={edit[k] || ''} required={req} onChange={e => setEdit(p => ({ ...p, [k]: e.target.value }))} />
    </Frow>
  );

  return (
    <>
      <PageHead title="Zoznam partnerov">
        <button className="btn primary" onClick={() => setEdit({ ...empty })}>👤 Nový partner</button>
      </PageHead>
      <div className="toolbar">
        <button className="btn" disabled={!sel} onClick={() => setEdit(sel)}>Detail / úprava</button>
        <button className="btn danger" disabled={!sel} onClick={del}>Zmazať</button>
      </div>
      <div className="filter-row">
        <label>Hľadať</label>
        <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="názov, IČO, mesto…" />
      </div>
      <div className="grid-wrap">
        <table className="grid">
          <thead><tr>
            <SortTh label="Názov" k="name" sort={sort} onSort={onSort} />
            <SortTh label="IČO" k="ico" sort={sort} onSort={onSort} />
            <SortTh label="DIČ" k="dic" sort={sort} onSort={onSort} />
            <SortTh label="IČ DPH" k="icdph" sort={sort} onSort={onSort} />
            <SortTh label="Mesto" k="city" sort={sort} onSort={onSort} />
            <SortTh label="E-mail" k="email" sort={sort} onSort={onSort} />
            <SortTh label="Telefón" k="phone" sort={sort} onSort={onSort} />
          </tr></thead>
          <tbody>
            {shown.map(r => (
              <tr key={r.id} className={sel?.id === r.id ? 'sel' : ''}
                onClick={() => setSel(r)} onDoubleClick={() => setEdit(r)}>
                <td><b>{r.name}</b></td><td>{r.ico}</td><td>{r.dic}</td><td>{r.icdph}</td><td>{r.city}</td><td>{r.email}</td><td>{r.phone}</td>
              </tr>
            ))}
            {!shown.length && <tr><td colSpan={7} style={{ textAlign: 'center', color: '#999' }}>Žiadni partneri</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="grid-foot">{shown.length} položiek</div>

      {edit && (
        <Modal title={edit.id ? 'Partner: ' + edit.name : 'Nový partner'} onClose={() => setEdit(null)}>
          <form onSubmit={save}>
            {F('name', 'Názov / meno', true)}
            <Frow label="IČO">
              <div style={{ display: 'flex', gap: 6 }}>
                <input value={edit.ico || ''} onChange={e => setEdit(p => ({ ...p, ico: e.target.value }))} />
                <button type="button" className="btn" style={{ whiteSpace: 'nowrap' }} onClick={lookupIco} disabled={icoBusy}>
                  {icoBusy ? '…' : '🔎 Z registra'}
                </button>
              </div>
            </Frow>
            {icoMsg && <div style={{ fontSize: 12, color: icoMsg.startsWith('✓') ? '#2a8f4f' : '#c0392b', padding: '0 0 6px' }}>{icoMsg}</div>}
            {F('dic', 'DIČ')}
            {F('icdph', 'IČ DPH')}
            {F('street', 'Ulica a číslo')}
            {F('city', 'Mesto')}
            {F('zip', 'PSČ')}
            {F('country', 'Krajina')}
            {F('email', 'E-mail')}
            {F('phone', 'Telefón')}
            {F('iban', 'IBAN')}
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
