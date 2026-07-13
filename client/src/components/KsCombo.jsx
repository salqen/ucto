import React, { useEffect, useRef, useState } from 'react';

/*
 * KsCombo — combobox pre konštantný symbol (KS).
 * Prednastavené najčastejšie SK konštantné symboly + inteligentné doplňanie
 * (filtruje podľa kódu aj popisu, bez diakritiky). Povoľuje aj vlastný KS.
 *
 *   <KsCombo value={inv.ks} onChange={v => set('ks', v)} />
 */

export const KS_PRESETS = [
  { code: '0008', desc: 'Platby za tovar' },
  { code: '0308', desc: 'Platby za služby' },
  { code: '0138', desc: 'Platby za služby (alt.)' },
  { code: '0558', desc: 'Splátky úverov, pôžičiek, leasingu' },
  { code: '0058', desc: 'Dane, odvody a poplatky' },
  { code: '1148', desc: 'Platby na základe faktúr a zmlúv' },
  { code: '3558', desc: 'Ostatné / nešpecifikované platby' },
  { code: '0968', desc: 'Platby po vzájomnom zápočte' },
];

const norm = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export default function KsCombo({ value, onChange, presets = KS_PRESETS, placeholder = 'napr. 0308' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const close = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const q = norm(value);
  const list = presets.filter(p => !q || norm(p.code).includes(q) || norm(p.desc).includes(q));
  const shown = list.length ? list : presets;

  const pick = (code) => { onChange(code); setOpen(false); };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div style={{ display: 'flex' }}>
        <input
          style={{ flex: 1 }}
          value={value || ''}
          placeholder={placeholder}
          onChange={e => { onChange(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          autoComplete="off"
        />
        <button type="button" className="btn" style={{ padding: '0 8px', whiteSpace: 'nowrap' }} tabIndex={-1}
          onClick={() => setOpen(o => !o)} title="Zobraziť konštantné symboly">▾</button>
      </div>
      {open && (
        <div style={{
          position: 'absolute', zIndex: 50, top: '100%', left: 0, right: 0,
          background: '#fff', border: '1px solid #ccc', borderRadius: 4,
          boxShadow: '0 4px 12px rgba(0,0,0,.12)', maxHeight: 220, overflowY: 'auto'
        }}>
          {shown.map(p => (
            <div key={p.code}
              onMouseDown={e => { e.preventDefault(); pick(p.code); }}
              style={{ padding: '6px 10px', cursor: 'pointer', fontSize: 13, display: 'flex', gap: 8 }}
              onMouseEnter={e => (e.currentTarget.style.background = '#eef')}
              onMouseLeave={e => (e.currentTarget.style.background = '#fff')}>
              <b style={{ minWidth: 42 }}>{p.code}</b>
              <span style={{ color: '#666' }}>{p.desc}</span>
            </div>
          ))}
          {!shown.length && <div style={{ padding: '6px 10px', color: '#999', fontSize: 12 }}>vlastný KS: {value}</div>}
        </div>
      )}
    </div>
  );
}
