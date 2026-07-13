import React, { useEffect, useRef, useState } from 'react';
import { smartFilter } from '../integrations/partnersearch.js';

/*
 * PartnerCombo — výber partnera s inteligentným vyhľadávaním z uložených partnerov.
 * - píš názov / IČO / mesto (bez diakritiky) → zoznam sa filtruje,
 * - šípka ▾ otvorí celý zoznam (roller),
 * - kliknutím sa partner vyberie.
 *
 *   <PartnerCombo partners={partners} value={inv.partnerId} onChange={id => set('partnerId', id)} />
 */

export default function PartnerCombo({ partners = [], value, onChange, placeholder = 'Hľadať partnera (názov, IČO, mesto…)' }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    const close = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const selected = partners.find(p => String(p.id) === String(value));
  const list = smartFilter(partners, q).slice(0, 12);
  const pick = (p) => { onChange(String(p.id)); setOpen(false); setQ(''); };

  return (
    <div ref={ref} style={{ position: 'relative', flex: 1 }}>
      <div style={{ display: 'flex' }}>
        <input style={{ flex: 1 }} autoComplete="off"
          value={open ? q : (selected ? selected.name : '')}
          placeholder={placeholder}
          onFocus={() => { setOpen(true); setQ(''); }}
          onChange={e => { setQ(e.target.value); setOpen(true); }} />
        <button type="button" className="btn" style={{ padding: '0 8px', whiteSpace: 'nowrap' }} tabIndex={-1}
          onClick={() => setOpen(o => !o)} title="Zobraziť zoznam">▾</button>
      </div>
      {open && (
        <div style={{
          position: 'absolute', zIndex: 50, top: '100%', left: 0, right: 0,
          background: '#fff', border: '1px solid #ccc', borderRadius: 4,
          boxShadow: '0 4px 12px rgba(0,0,0,.12)', maxHeight: 260, overflowY: 'auto'
        }}>
          {list.map(p => {
            const sel = String(p.id) === String(value);
            return (
              <div key={p.id} onMouseDown={e => { e.preventDefault(); pick(p); }}
                style={{ padding: '6px 10px', cursor: 'pointer', fontSize: 13, background: sel ? '#eef' : '#fff' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#eef')}
                onMouseLeave={e => (e.currentTarget.style.background = sel ? '#eef' : '#fff')}>
                <b>{p.name}</b>
                <span style={{ color: '#666' }}>{p.ico ? ' · IČO ' + p.ico : ''}{p.city ? ' · ' + p.city : ''}</span>
              </div>
            );
          })}
          {!list.length && <div style={{ padding: '6px 10px', color: '#999', fontSize: 12 }}>žiadny partner nevyhovuje</div>}
        </div>
      )}
    </div>
  );
}
