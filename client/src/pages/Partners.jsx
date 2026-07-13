import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { PageHead, Modal, Frow, useSort, SortTh } from '../components/ui.jsx';
import { smartFilter } from '../integrations/partnersearch.js';

const empty = { name: '', ico: '', dic: '', icdph: '', street: '', city: '', zip: '', country: 'Slovensko', email: '', phone: '', iban: '' };

export default function Partners() {
  const [rows, setRows] = useState([]);
  const [filter, setFilter] = useState('');
  const [edit, setEdit] = useState(null);
  const [sel, setSel] = useState(null);
  const [icoBusy, setIcoBusy] = useState(false);
  const [icoMsg, setIcoMsg] = useState('');
  const [viesBusy, setViesBusy] = useState(false);
  const [viesMsg, setViesMsg] = useState('');
  const [kontrola, setKontrola] = useState(null);   // { busy, ico, name, data, error }
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

  /* overenie IČ DPH cez VIES (EÚ) — potvrdí platnosť a doplní oficiálny názov/adresu */
  const verifyVat = async () => {
    const vat = String(edit.icdph || '').replace(/\s+/g, '');
    if (!vat) { setViesMsg('⚠ Zadajte IČ DPH (napr. SK2020318813).'); return; }
    setViesBusy(true); setViesMsg('');
    try {
      const d = await api.get('/vies/' + vat);
      if (d.valid) {
        setEdit(p => ({ ...p, icdph: d.icdph || p.icdph, name: (!p.name && d.name) ? d.name : p.name }));
        setViesMsg('✓ Platné IČ DPH' + (d.name ? ' — ' + d.name : ''));
      } else {
        setViesMsg('⚠ IČ DPH nie je v systéme VIES platné.');
      }
    } catch (e) { setViesMsg('⚠ ' + e.message); }
    finally { setViesBusy(false); }
  };

  /* riziková previerka partnera (RÚZ + RPVS + insolvencia + exekúcie) */
  const runKontrola = async (partner) => {
    const p = partner || sel;
    if (!p) return;
    const ico = String(p.ico || '').replace(/\D/g, '');
    if (ico.length < 6) { setKontrola({ ico: '', name: p.name, error: 'Partner nemá vyplnené IČO (6–8 číslic).' }); return; }
    setKontrola({ busy: true, ico, name: p.name });
    try {
      const data = await api.get('/kontrola/' + ico);
      setKontrola({ ico, name: p.name, data });
    } catch (e) {
      setKontrola({ ico, name: p.name, error: e.message });
    }
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

  const filtered = smartFilter(rows, filter);
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
        <button className="btn" disabled={!sel} onClick={() => runKontrola(sel)} title="Riziková previerka partnera vo verejných registroch">🛡 Kontrola</button>
        <button className="btn danger" disabled={!sel} onClick={del}>Zmazať</button>
      </div>
      <div className="filter-row">
        <label>Hľadať</label>
        <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="názov, IČO, DIČ, IČ DPH, mesto, e-mail… (bez diakritiky, viac slov)" />
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
            <Frow label="IČ DPH">
              <div style={{ display: 'flex', gap: 6 }}>
                <input value={edit.icdph || ''} onChange={e => setEdit(p => ({ ...p, icdph: e.target.value }))} />
                <button type="button" className="btn" style={{ whiteSpace: 'nowrap' }} onClick={verifyVat} disabled={viesBusy}>
                  {viesBusy ? '…' : '✔ Overiť (VIES)'}
                </button>
              </div>
            </Frow>
            {viesMsg && <div style={{ fontSize: 12, color: viesMsg.startsWith('✓') ? '#2a8f4f' : '#c0392b', padding: '0 0 6px' }}>{viesMsg}</div>}
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

      {kontrola && (
        <Modal title={'🛡 Kontrola partnera' + (kontrola.name ? ' — ' + kontrola.name : '')} onClose={() => setKontrola(null)}>
          {kontrola.busy && <div style={{ padding: 20, textAlign: 'center', color: '#888' }}>Overujem vo verejných registroch…</div>}
          {kontrola.error && <div className="login-err">⚠ {kontrola.error}</div>}
          {kontrola.data && (() => {
            const d = kontrola.data;
            const RISK = { ok: { c: '#5f9622', t: 'Bez zistených rizík' }, warning: { c: '#e67e22', t: 'Upozornenia' }, critical: { c: '#c0392b', t: 'Kritické riziko' } };
            const FL = { critical: '#c0392b', warning: '#e67e22', info: '#3a7', ok: '#5f9622' };
            const r = RISK[d.risk] || RISK.ok;
            const s = d.sources || {};
            const eur = n => (Number(n) || 0).toLocaleString('sk-SK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
            const Ext = ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: '#2a6' }}>{children} ↗</a>;
            return (
              <div style={{ fontSize: 13, lineHeight: 1.55 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <span style={{ background: r.c, color: '#fff', borderRadius: 4, padding: '3px 10px', fontWeight: 600 }}>{r.t}</span>
                  <span className="hint" style={{ margin: 0 }}>IČO {d.ico} · overené {d.checkedAt}</span>
                </div>

                {!!(d.flags || []).length && (
                  <ul style={{ margin: '0 0 12px', padding: 0, listStyle: 'none' }}>
                    {d.flags.map((f, i) => (
                      <li key={i} style={{ padding: '2px 0' }}>
                        <span style={{ color: FL[f.level] || '#666' }}>●</span> {f.text}
                      </li>
                    ))}
                  </ul>
                )}

                {/* RÚZ */}
                <div style={{ borderTop: '1px solid #eee', paddingTop: 8 }}>
                  <b>RÚZ — účtovné závierky</b>{' '}
                  {s.ruz && s.ruz.url && <Ext href={s.ruz.url}>registeruz.sk</Ext>}
                  {s.ruz && s.ruz.found && (
                    <div className="hint" style={{ margin: '2px 0 0' }}>
                      {s.ruz.name}{s.ruz.address ? ' · ' + s.ruz.address : ''}<br />
                      Závierok: {s.ruz.statementsCount}{s.ruz.lastPeriod ? ` · posledná ${s.ruz.lastPeriod}` : ''}
                      {s.ruz.result != null && <> · orientačný výsledok <b style={{ color: s.ruz.result < 0 ? '#c0392b' : '#5f9622' }}>{eur(s.ruz.result)}</b></>}
                      {s.ruz.revenue != null && <> (výnosy {eur(s.ruz.revenue)}{s.ruz.costs != null ? `, náklady ${eur(s.ruz.costs)}` : ''})</>}
                    </div>
                  )}
                  {s.ruz && s.ruz.found === false && <div className="hint" style={{ margin: '2px 0 0' }}>Účtovná jednotka sa nenašla.</div>}
                  {s.ruz && s.ruz.ok === false && <div className="hint" style={{ margin: '2px 0 0', color: '#c0392b' }}>Nedostupné: {s.ruz.error}</div>}
                </div>

                {/* RPVS */}
                <div style={{ borderTop: '1px solid #eee', paddingTop: 8, marginTop: 8 }}>
                  <b>RPVS — partner verejného sektora</b>{' '}
                  {s.rpvs && s.rpvs.url && <Ext href={s.rpvs.url}>rpvs.gov.sk</Ext>}
                  <div className="hint" style={{ margin: '2px 0 0' }}>{(s.rpvs && s.rpvs.note) || '—'}</div>
                </div>

                {/* Insolvencia */}
                <div style={{ borderTop: '1px solid #eee', paddingTop: 8, marginTop: 8 }}>
                  <b>Insolvencia / konkurz</b>{' '}
                  {s.insolvency && s.insolvency.url && <Ext href={s.insolvency.url}>Obchodný vestník</Ext>}
                  <div className="hint" style={{ margin: '2px 0 0' }}>{(s.insolvency && s.insolvency.note) || '—'}</div>
                </div>

                {/* Exekúcie */}
                <div style={{ borderTop: '1px solid #eee', paddingTop: 8, marginTop: 8 }}>
                  <b>Exekúcie</b>{' '}
                  {s.executions && s.executions.rpve && s.executions.rpve.url && <Ext href={s.executions.rpve.url}>RPVE — obcan.justice.sk (zadarmo)</Ext>}
                  {s.executions && s.executions.url && s.executions.status !== 'manual' && <> · <Ext href={s.executions.url}>cre.sk</Ext></>}
                  <div className="hint" style={{ margin: '2px 0 0' }}>
                    {s.executions && s.executions.status === 'found' && <span style={{ color: '#c0392b' }}>CRE: nájdených {s.executions.count} exekúcií.</span>}
                    {s.executions && s.executions.status === 'clear' && <span style={{ color: '#5f9622' }}>CRE: bez záznamu o exekúcii.</span>}
                    {s.executions && s.executions.status !== 'found' && s.executions.status !== 'clear' && (s.executions.rpve ? s.executions.rpve.note : (s.executions.note || '—'))}
                  </div>
                </div>

                <div className="form-actions" style={{ marginTop: 12 }}>
                  <button className="btn" type="button" onClick={() => runKontrola({ ico: kontrola.ico, name: kontrola.name })}>↻ Znova</button>
                  <button className="btn primary" type="button" onClick={() => setKontrola(null)}>Zavrieť</button>
                </div>
              </div>
            );
          })()}
        </Modal>
      )}
    </>
  );
}
