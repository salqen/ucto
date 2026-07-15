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
  const byName = (a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'sk', { sensitivity: 'base' });
  /* prázdny dopyt → celý zoznam podľa abecedy; s dopytom → inteligentné poradie */
  const list = (q ? smartFilter(partners, q).slice(0, 30) : [...partners].sort(byName));
  const pick = (p) => { onChange(String(p.id)); setOpen(false); setQ(''); };
  const selBg = 'var(--hover, rgba(127,127,127,.14))';

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
          background: 'var(--panel, #fff)', color: 'var(--text)', border: '1px solid var(--border, #ccc)', borderRadius: 8,
          boxShadow: 'var(--shadow, 0 4px 12px rgba(0,0,0,.12))', maxHeight: 300, overflowY: 'auto'
        }}>
          {list.map(p => {
            const sel = String(p.id) === String(value);
            return (
              <div key={p.id} onMouseDown={e => { e.preventDefault(); pick(p); }}
                title={p.name}
                style={{
                  display: 'flex', alignItems: 'baseline', gap: 8, padding: '6px 10px', cursor: 'pointer', fontSize: 13,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  borderBottom: '1px solid var(--border, #eee)', background: sel ? selBg : 'transparent'
                }}
                onMouseEnter={e => (e.currentTarget.style.background = selBg)}
                onMouseLeave={e => (e.currentTarget.style.background = sel ? selBg : 'transparent')}>
                <b style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</b>
                <span style={{ color: 'var(--muted, #666)', marginLeft: 'auto', flexShrink: 0 }}>
                  {p.ico ? 'IČO ' + p.ico : ''}{p.ico && p.city ? ' · ' : ''}{p.city || ''}
                </span>
              </div>
            );
          })}
          {!list.length && <div style={{ padding: '6px 10px', color: 'var(--muted, #999)', fontSize: 12 }}>žiadny partner nevyhovuje</div>}
        </div>
      )}
    </div>
  );
}
