import React, { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { Modal, Frow } from './ui.jsx';
import { smartFilter } from '../integrations/partnersearch.js';

/*
 * QuickPartner — rýchle založenie partnera priamo z formulára faktúry.
 * - našepkávanie z existujúcich partnerov (proti duplicitám): pri písaní názvu
 *   ponúkne zhody, kliknutím sa použije existujúci partner (bez zakladania nového),
 * - upozornenie na duplicitu podľa IČO,
 * - doplnenie údajov z registra (RPO) podľa IČO.
 *
 *   <QuickPartner partners={partners} initialName="" onCreated={p => ...} onClose={() => ...} />
 *
 * onCreated dostane buď novozaloženého, alebo vybraného existujúceho partnera.
 */

const empty = { name: '', ico: '', dic: '', icdph: '', street: '', city: '', zip: '', country: 'Slovensko', email: '', phone: '', iban: '' };
const digits = s => String(s || '').replace(/\D/g, '');

export default function QuickPartner({ partners = [], initialName = '', onCreated, onClose }) {
  const [p, setP] = useState({ ...empty, name: initialName });
  const [icoBusy, setIcoBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [nameOpen, setNameOpen] = useState(false);
  const nameRef = useRef(null);
  const set = (k, v) => setP(o => ({ ...o, [k]: v }));

  useEffect(() => {
    const close = e => { if (nameRef.current && !nameRef.current.contains(e.target)) setNameOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  /* našepkávanie z existujúcich partnerov podľa názvu */
  const suggestions = (p.name || '').trim().length >= 2
    ? smartFilter(partners, p.name).slice(0, 6)
    : [];

  /* duplicita podľa IČO */
  const icoDupe = digits(p.ico) ? partners.find(x => digits(x.ico) && digits(x.ico) === digits(p.ico)) : null;

  const useExisting = (partner) => { setNameOpen(false); onCreated(partner); };

  const lookupIco = async () => {
    const ico = digits(p.ico);
    if (ico.length < 6) { setMsg('⚠ Zadajte IČO (6–8 číslic).'); return; }
    setIcoBusy(true); setMsg('');
    try {
      const d = await api.get('/ico/' + ico);
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

  return (
    <Modal title="Nový partner" onClose={onClose}>
      <form onSubmit={save}>
        <Frow label="Názov / meno" req>
          <div ref={nameRef} style={{ position: 'relative' }}>
            <input value={p.name || ''} required autoComplete="off"
              onChange={e => { set('name', e.target.value); setNameOpen(true); }}
              onFocus={() => setNameOpen(true)} />
            {nameOpen && suggestions.length > 0 && (
              <div style={{
                position: 'absolute', zIndex: 50, top: '100%', left: 0, right: 0,
                background: '#fff', border: '1px solid #ccc', borderRadius: 4,
                boxShadow: '0 4px 12px rgba(0,0,0,.12)', maxHeight: 220, overflowY: 'auto'
              }}>
                <div style={{ padding: '4px 10px', fontSize: 11, color: '#c0392b', borderBottom: '1px solid #eee' }}>
                  ⚠ Už existuje podobný partner — vyberte, aby nevznikla duplicita:
                </div>
                {suggestions.map(s => (
                  <div key={s.id} onMouseDown={e => { e.preventDefault(); useExisting(s); }}
                    style={{ padding: '6px 10px', cursor: 'pointer', fontSize: 13 }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#eef')}
                    onMouseLeave={e => (e.currentTarget.style.background = '#fff')}>
                    <b>{s.name}</b>
                    <span style={{ color: '#666' }}>{s.ico ? ' · IČO ' + s.ico : ''}{s.city ? ' · ' + s.city : ''}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Frow>

        <Frow label="IČO">
          <div style={{ display: 'flex', gap: 6 }}>
            <input value={p.ico || ''} onChange={e => set('ico', e.target.value)} />
            <button type="button" className="btn" style={{ whiteSpace: 'nowrap' }} onClick={lookupIco} disabled={icoBusy}>
              {icoBusy ? '…' : '🔎 Z registra'}
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
