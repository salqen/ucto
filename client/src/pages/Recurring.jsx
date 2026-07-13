import React, { useEffect, useMemo, useState } from 'react';
import { api, eur, today } from '../api.js';
import { PageHead, Modal, Frow } from '../components/ui.jsx';
import { generateDue, dueIssueDates, upcoming, itemsTotal, PERIODICITY_LABELS } from '../integrations/recurring.js';

const emptyItem = () => ({ name: '', qty: 1, unit: 'ks', price: 0, vat: 23 });
const emptyTmpl = () => ({
  partnerId: '', currency: 'EUR', periodicity: 'monthly',
  startDate: today(), dueDays: 14, active: true, note: '', items: [emptyItem()],
});

export default function Recurring() {
  const [rows, setRows] = useState([]);
  const [partners, setPartners] = useState([]);
  const [edit, setEdit] = useState(null);
  const [busy, setBusy] = useState(false);
  const t0 = today();

  const load = () => api.get('/recurring').then(setRows).catch(() => setRows([]));
  useEffect(() => { load(); api.get('/partners').then(setPartners).catch(() => {}); }, []);

  const nameOf = (id) => (partners.find(p => p.id === Number(id)) || {}).name || '—';
  const totalDue = useMemo(() => rows.reduce((s, t) => s + dueIssueDates(t, t0).length, 0), [rows, t0]);

  const save = async (e) => {
    e.preventDefault();
    const body = { ...edit, partnerId: Number(edit.partnerId), dueDays: Number(edit.dueDays) || 14, items: edit.items.filter(i => i.name) };
    if (edit.id) await api.put('/recurring/' + edit.id, body);
    else await api.post('/recurring', body);
    setEdit(null); load();
  };
  const del = async (t) => { if (confirm('Zmazať šablónu?')) { await api.del('/recurring/' + t.id); load(); } };

  const generate = async () => {
    if (!totalDue) return;
    if (!confirm(`Vygenerovať ${totalDue} faktúr z pravidelných šablón?`)) return;
    setBusy(true);
    try {
      const { invoices, updatedTemplates } = generateDue(rows, t0);
      for (const inv of invoices) {
        const { number, vs, recurringId, ...rest } = inv;   // číslo pridelí server
        await api.post('/invoices', rest);
      }
      for (const tpl of updatedTemplates) { if (tpl.id) await api.put('/recurring/' + tpl.id, tpl); }
      alert(`Vytvorených ${invoices.length} faktúr.`);
      load();
    } catch (e) { alert('Chyba: ' + e.message); }
    finally { setBusy(false); }
  };

  const setItem = (i, k, v) => setEdit(p => ({ ...p, items: p.items.map((it, ix) => ix === i ? { ...it, [k]: v } : it) }));

  return (
    <>
      <PageHead title="Pravidelné faktúry">
        <button className="btn primary" onClick={() => setEdit(emptyTmpl())}>➕ Nová šablóna</button>
        {totalDue > 0 && <button className="btn primary" disabled={busy} onClick={generate}>⚡ Vygenerovať {totalDue} faktúr</button>}
      </PageHead>

      <div className="grid-wrap">
        <table className="grid">
          <thead><tr>
            <th>Partner</th><th>Perióda</th><th className="num">Suma</th><th>Ďalšia</th><th>Po termíne</th><th>Stav</th><th></th>
          </tr></thead>
          <tbody>
            {rows.map(t => (
              <tr key={t.id} onDoubleClick={() => setEdit({ ...t, items: t.items?.length ? t.items : [emptyItem()] })} style={{ cursor: 'pointer' }}>
                <td><b>{nameOf(t.partnerId)}</b></td>
                <td>{PERIODICITY_LABELS[t.periodicity] || t.periodicity}</td>
                <td className="num">{eur(itemsTotal(t.items))}</td>
                <td>{upcoming(t, 1)[0] || '—'}</td>
                <td>{dueIssueDates(t, t0).length || '—'}</td>
                <td>{t.active === false ? '⏸ pozastavená' : '▶ aktívna'}</td>
                <td className="no-print"><button className="btn danger" style={{ padding: '3px 8px' }} onClick={() => del(t)}>✕</button></td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={7} style={{ textAlign: 'center', color: '#999' }}>Žiadne šablóny — pridajte prvú</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="grid-foot">{rows.length} šablón • {totalDue} faktúr čaká na vystavenie • dvojklik = úprava</div>

      {edit && (
        <Modal title={edit.id ? 'Šablóna pravidelnej faktúry' : 'Nová pravidelná faktúra'} onClose={() => setEdit(null)} wide>
          <form onSubmit={save}>
            <div className="form-grid">
              <div>
                <Frow label="Partner" req>
                  <select value={edit.partnerId} required onChange={e => setEdit(p => ({ ...p, partnerId: e.target.value }))}>
                    <option value="">Vyberte…</option>
                    {partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </Frow>
                <Frow label="Perióda" req>
                  <select value={edit.periodicity} onChange={e => setEdit(p => ({ ...p, periodicity: e.target.value }))}>
                    <option value="weekly">týždenne</option>
                    <option value="monthly">mesačne</option>
                    <option value="quarterly">štvrťročne</option>
                    <option value="yearly">ročne</option>
                  </select>
                </Frow>
              </div>
              <div>
                <Frow label="Prvé vystavenie" req><input type="date" value={edit.startDate} onChange={e => setEdit(p => ({ ...p, startDate: e.target.value }))} /></Frow>
                <Frow label="Splatnosť (dní)"><input type="number" value={edit.dueDays} onChange={e => setEdit(p => ({ ...p, dueDays: e.target.value }))} /></Frow>
                <Frow label="Aktívna"><input type="checkbox" checked={edit.active !== false} onChange={e => setEdit(p => ({ ...p, active: e.target.checked }))} /></Frow>
              </div>
            </div>

            <table className="grid items-table">
              <thead><tr><th style={{ width: '40%' }}>Názov položky</th><th>Množstvo</th><th>MJ</th><th>Cena/MJ</th><th>DPH %</th><th></th></tr></thead>
              <tbody>
                {edit.items.map((it, i) => (
                  <tr key={i}>
                    <td><input value={it.name} onChange={e => setItem(i, 'name', e.target.value)} placeholder="popis" /></td>
                    <td><input type="number" step="0.01" value={it.qty} onChange={e => setItem(i, 'qty', Number(e.target.value))} /></td>
                    <td><input value={it.unit} style={{ width: 50 }} onChange={e => setItem(i, 'unit', e.target.value)} /></td>
                    <td><input type="number" step="0.01" value={it.price} onChange={e => setItem(i, 'price', Number(e.target.value))} /></td>
                    <td>
                      <select value={it.vat} onChange={e => setItem(i, 'vat', Number(e.target.value))}>
                        <option value={23}>23</option><option value={19}>19</option><option value={5}>5</option><option value={0}>0</option>
                      </select>
                    </td>
                    <td><button className="btn danger" type="button" style={{ padding: '3px 8px' }} onClick={() => setEdit(p => ({ ...p, items: p.items.filter((_, ix) => ix !== i) }))}>✕</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ marginTop: 8 }}>
              <button className="btn" type="button" onClick={() => setEdit(p => ({ ...p, items: [...p.items, emptyItem()] }))}>+ Položka</button>
              <span style={{ marginLeft: 12 }}>Spolu: <b>{eur(itemsTotal(edit.items))}</b></span>
            </div>

            <div className="form-actions">
              <button className="btn primary" type="submit">💾 Uložiť</button>
              <button className="btn" type="button" onClick={() => setEdit(null)}>Zrušiť</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
