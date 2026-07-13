import React, { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { Modal, Frow } from './ui.jsx';
import { smartFilter } from '../integrations/partnersearch.js';

/*
 * QuickPartner — rýchle založenie partnera priamo z formulára faktúry.
 * - inteligentné živé vyhľadávanie v RPO podľa názvu firmy alebo mena živnostníka
 *   (zadáva sa do poľa „Názov"), s prednastavením údajov po výbere,
 * - našepkávanie z existujúcich partnerov (proti duplicitám),
 * - upozornenie na duplicitu podľa IČO + doplnenie z RPO podľa IČO.
 *
 * Pozn.: RPO nemá konateľov ani DIČ/IČ DPH — hľadá firmy a živnostníkov podľa názvu.
 */

const empty = { name: '', ico: '', dic: '', icdph: '', street: '', city: '', zip: '', country: 'Slovensko', email: '', phone: '', iban: '' };
const digits = s => String(s || '').replace(/\D/g, '');

export default function QuickPartner({ partners = [], initialName = '', onCreated, onClose }) {
  const [p, setP] = useState({ ...empty, name: initialName });
  const [icoBusy, setIcoBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [nameOpen, setNameOpen] = useState(false);
  const [rpoList, setRpoList] = useState([]);
  const [rpoBusy, setRpoBusy] = useState(false);
  const [orsrList, setOrsrList] = useState([]);
  const [orsrBusy, setOrsrBusy] = useState(false);
  const nameRef = useRef(null);
  const skipSearch = useRef(false); // po výbere / doplnení nehľadaj hneď znova
  const set = (k, v) => setP(o => ({ ...o, [k]: v }));

  useEffect(() => {
    const close = e => { if (nameRef.current && !nameRef.current.contains(e.target)) setNameOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  /* živé vyhľadávanie v RPO (debounce) podľa názvu */
  useEffect(() => {
    if (skipSearch.current) { skipSearch.current = false; return; }
    const q = (p.name || '').trim();
    if (q.length < 3) { setRpoList([]); return; }
    const h = setTimeout(async () => {
      setRpoBusy(true);
      try { const list = await api.get('/rpo/search?q=' + encodeURIComponent(q)); setRpoList(Array.isArray(list) ? list : []); }
      catch { setRpoList([]); }
      finally { setRpoBusy(false); }
    }, 400);
    return () => clearTimeout(h);
  }, [p.name]);

  /* našepkávanie z existujúcich partnerov (proti duplicitám) */
  const suggestions = (p.name || '').trim().length >= 2 ? smartFilter(partners, p.name).slice(0, 5) : [];
  const icoDupe = digits(p.ico) ? partners.find(x => digits(x.ico) && digits(x.ico) === digits(p.ico)) : null;

  const useExisting = (partner) => { skipSearch.current = true; setNameOpen(false); setRpoList([]); onCreated(partner); };

  const pickRpo = (d) => {
    skipSearch.current = true;
    setP(o => ({
      ...o, name: d.name || o.name, ico: d.ico || o.ico,
      street: d.street || o.street, city: d.city || o.city, zip: d.zip || o.zip, country: d.country || o.country,
    }));
    setRpoList([]); setNameOpen(false);
    setMsg('✓ Z RPO: ' + (d.name || '') + (d.sourceRegister ? ' (' + d.sourceRegister + ')' : ''));
  };

  /* ORSR (na tlačidlo — rate-limit): firma podľa názvu aj podľa mena konateľa/spoločníka */
  const searchOrsr = async () => {
    const q = (p.name || '').trim();
    if (q.length < 2) { setMsg('⚠ Zadajte názov firmy alebo meno konateľa.'); return; }
    setOrsrBusy(true); setMsg('');
    try {
      const list = await api.get('/orsr/search?q=' + encodeURIComponent(q));
      setOrsrList(Array.isArray(list) ? list : []); setNameOpen(true);
      if (!list || !list.length) setMsg('ORSR: nič sa nenašlo.');
    } catch (e) { setMsg('⚠ ' + e.message); }
    finally { setOrsrBusy(false); }
  };
  const pickOrsr = async (item) => {
    setOrsrBusy(true);
    try {
      const d = await api.get('/orsr/detail?id=' + item.id + '&sid=' + item.sid);
      skipSearch.current = true;
      setP(o => ({
        ...o, name: d.name || o.name, ico: d.ico || o.ico,
        street: d.street || o.street, city: d.city || o.city, zip: d.zip || o.zip, country: d.country || o.country,
      }));
      setOrsrList([]); setRpoList([]); setNameOpen(false);
      setMsg('✓ Z ORSR: ' + (d.name || ''));
    } catch (e) { setMsg('⚠ ' + e.message); }
    finally { setOrsrBusy(false); }
  };

  const lookupIco = async () => {
    const ico = digits(p.ico);
    if (ico.length < 6) { setMsg('⚠ Zadajte IČO (6–8 číslic).'); return; }
    setIcoBusy(true); setMsg('');
    try {
      const d = await api.get('/ico/' + ico);
      skipSearch.current = true;
      setP(o => ({
        ...o, ico: d.ico || o.ico, name: d.name || o.name,
        street: d.street || o.street, city: d.city || o.city,
        zip: d.zip || o.zip, country: d.country || o.country,
      }));
      setMsg('✓ ' + d.name);
    } catch (e) { setMsg('⚠ ' + e.message); }
    finally { setIcoBusy(false); }
  };

  const save = async (e) => {
    e.preventDefault();
    if (!p.name.trim()) { setMsg('⚠ Zadajte názov partnera.'); return; }
    setBusy(true); setMsg('');
    try {
      const created = await api.post('/partners', p);
      onCreated(created);
    } catch (ex) { setMsg('⚠ ' + ex.message); setBusy(false); }
  };

  const F = (k, label, req) => (
    <Frow label={label} req={req}>
      <input value={p[k] || ''} required={req} onChange={e => set(k, e.target.value)} />
    </Frow>
  );

  const showDrop = nameOpen && (suggestions.length > 0 || rpoList.length > 0 || orsrList.length > 0 || rpoBusy || orsrBusy);
  const dropStyle = {
    position: 'absolute', zIndex: 50, top: '100%', left: 0, right: 0,
    background: 'var(--panel,#fff)', color: 'var(--text,#222)', border: '1px solid var(--border,#ccc)',
    borderRadius: 4, boxShadow: '0 4px 12px rgba(0,0,0,.14)', maxHeight: 280, overflowY: 'auto',
  };
  const secLabel = { padding: '4px 10px', fontSize: 11, color: 'var(--muted,#667)', borderBottom: '1px solid var(--border,#eee)', background: 'var(--stripe,#f7f7fb)' };

  return (
    <Modal title="Nový partner" onClose={onClose}>
      <form onSubmit={save}>
        <Frow label="Názov / meno (firma alebo živnostník)" req>
          <div ref={nameRef} style={{ position: 'relative' }}>
            <div style={{ display: 'flex', gap: 6 }}>
              <input style={{ flex: 1 }} value={p.name || ''} required autoComplete="off"
                placeholder="názov firmy / meno živnostníka (RPO živo) — pre konateľa použite ORSR"
                onChange={e => { set('name', e.target.value); setNameOpen(true); setOrsrList([]); }}
                onFocus={() => setNameOpen(true)} />
              <button type="button" className="btn" style={{ whiteSpace: 'nowrap' }} onClick={searchOrsr} disabled={orsrBusy}
                title="Hľadať v ORSR podľa názvu aj podľa mena konateľa/spoločníka">{orsrBusy ? '…' : '🔎 ORSR'}</button>
            </div>
            {showDrop && (
              <div style={dropStyle}>
                {suggestions.length > 0 && (
                  <>
                    <div style={{ ...secLabel, color: '#c0392b' }}>⚠ Už uložený partner — vyberte, aby nevznikla duplicita:</div>
                    {suggestions.map(s => (
                      <div key={'l' + s.id} onMouseDown={e => { e.preventDefault(); useExisting(s); }}
                        style={{ padding: '6px 10px', cursor: 'pointer', fontSize: 13 }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover,#eef)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        <b>{s.name}</b><span style={{ color: 'var(--muted,#666)' }}>{s.ico ? ' · IČO ' + s.ico : ''}{s.city ? ' · ' + s.city : ''}</span>
                      </div>
                    ))}
                  </>
                )}
                <div style={secLabel}>Register RPO (firmy aj živnostníci){rpoBusy ? ' — hľadám…' : ''}</div>
                {rpoList.map(d => (
                  <div key={'r' + d.id} onMouseDown={e => { e.preventDefault(); pickRpo(d); }}
                    style={{ padding: '6px 10px', cursor: 'pointer', fontSize: 13 }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover,#eef)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <b>{d.name}</b>
                    <span style={{ color: 'var(--muted,#666)' }}>{d.ico ? ' · IČO ' + d.ico : ''}{d.city ? ' · ' + d.city : ''}{d.sourceRegister ? ' · ' + d.sourceRegister : ''}</span>
                  </div>
                ))}
                {orsrList.length > 0 && (
                  <>
                    <div style={secLabel}>ORSR — podľa názvu aj konateľa/spoločníka</div>
                    {orsrList.map(o => (
                      <div key={'o' + o.id + '/' + o.sid} onMouseDown={e => { e.preventDefault(); pickOrsr(o); }}
                        style={{ padding: '6px 10px', cursor: 'pointer', fontSize: 13 }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover,#eef)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        <b>{o.name}</b>{o.by === 'konateľ' && <span style={{ color: 'var(--muted,#666)' }}> · cez konateľa</span>}
                      </div>
                    ))}
                  </>
                )}
                {!rpoBusy && !orsrBusy && !rpoList.length && !orsrList.length && suggestions.length === 0 && (
                  <div style={{ padding: '6px 10px', color: 'var(--muted,#999)', fontSize: 12 }}>nič sa nenašlo</div>
                )}
              </div>
            )}
          </div>
        </Frow>

        <Frow label="IČO">
          <div style={{ display: 'flex', gap: 6 }}>
            <input value={p.ico || ''} onChange={e => set('ico', e.target.value)} />
            <button type="button" className="btn" style={{ whiteSpace: 'nowrap' }} onClick={lookupIco} disabled={icoBusy}>
              {icoBusy ? '…' : '🔎 Z registra (RPO)'}
            </button>
          </div>
        </Frow>
        {icoDupe && (
          <div style={{ fontSize: 12, color: '#c0392b', padding: '0 0 6px' }}>
            ⚠ Partner s IČO {p.ico} už existuje: <b>{icoDupe.name}</b>{' '}
            <a style={{ color: '#2a6', cursor: 'pointer' }} onClick={() => useExisting(icoDupe)}>Použiť existujúceho</a>
          </div>
        )}
        {msg && <div style={{ fontSize: 12, color: msg.startsWith('✓') ? '#2a8f4f' : '#c0392b', padding: '0 0 6px' }}>{msg}</div>}
        {F('dic', 'DIČ')}
        {F('icdph', 'IČ DPH')}
        {F('street', 'Ulica a číslo')}
        {F('city', 'Mesto')}
        {F('zip', 'PSČ')}
        {F('email', 'E-mail')}
        {F('iban', 'IBAN')}
        <div className="form-actions">
          <button className="btn primary" type="submit" disabled={busy}>{busy ? 'Ukladám…' : '💾 Uložiť a použiť'}</button>
          <button className="btn" type="button" onClick={onClose}>Zrušiť</button>
        </div>
      </form>
    </Modal>
  );
}
