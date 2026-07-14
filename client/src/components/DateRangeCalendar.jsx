import React, { useState } from 'react';

/*
 * DateRangeCalendar — grafický výber rozsahu dátumov (od–do).
 * Klik = začiatok rozsahu, druhý klik = koniec. Zvýraznený rozsah,
 * navigácia mesiacov, preview pri prechode myšou. Štýl podľa CSS premenných.
 * props: from, to (ISO 'YYYY-MM-DD' | ''), onChange({from,to}), months (1|2)
 */
const pad = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = s => { if (!s) return null; const [y, m, d] = String(s).split('-').map(Number); return y ? new Date(y, m - 1, d) : null; };
const skDate = s => (s ? s.split('-').reverse().map(Number).join('.') : '—');
const WD = ['Po', 'Ut', 'St', 'Št', 'Pi', 'So', 'Ne'];
const MON = ['Január', 'Február', 'Marec', 'Apríl', 'Máj', 'Jún', 'Júl', 'August', 'September', 'Október', 'November', 'December'];

export default function DateRangeCalendar({ from, to, onChange, months = 2 }) {
  const base = parse(from) || parse(to) || new Date();
  const [view, setView] = useState(new Date(base.getFullYear(), base.getMonth(), 1));
  const [hover, setHover] = useState('');

  const pick = (ds) => {
    if (!from || (from && to)) onChange({ from: ds, to: '' });      /* nový rozsah */
    else if (ds < from) onChange({ from: ds, to: from });
    else onChange({ from, to: ds });
  };

  const todayIso = iso(new Date());
  const effTo = to || (from && hover && hover >= from ? hover : '');

  const renderMonth = (offset) => {
    const first = new Date(view.getFullYear(), view.getMonth() + offset, 1);
    const yy = first.getFullYear(), mm = first.getMonth();
    const startDow = (first.getDay() + 6) % 7;                       /* pondelok = 0 */
    const dim = new Date(yy, mm + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < startDow; i++) cells.push(null);
    for (let d = 1; d <= dim; d++) cells.push(new Date(yy, mm, d));
    return (
      <div key={offset} style={{ minWidth: 208 }}>
        <div style={{ textAlign: 'center', fontWeight: 600, fontSize: 13, margin: '0 0 6px' }}>{MON[mm]} {yy}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2 }}>
          {WD.map(w => <div key={w} style={{ textAlign: 'center', fontSize: 11, color: 'var(--muted,#999)' }}>{w}</div>)}
          {cells.map((d, i) => {
            if (!d) return <div key={i} />;
            const ds = iso(d);
            const isEnd = ds === from || (to && ds === to);
            const inRange = from && effTo && ds > from && ds < effTo;
            const isToday = ds === todayIso;
            return (
              <button key={i} type="button" onClick={() => pick(ds)}
                onMouseEnter={() => setHover(ds)} onMouseLeave={() => setHover('')}
                style={{
                  border: isToday ? '1px solid var(--accent)' : '1px solid transparent',
                  borderRadius: 6, padding: '5px 0', fontSize: 12, cursor: 'pointer',
                  background: isEnd ? 'var(--accent)' : inRange ? 'var(--accent-soft, rgba(95,150,34,.18))' : 'transparent',
                  color: isEnd ? '#fff' : 'var(--text)'
                }}>{d.getDate()}</button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 10, background: 'var(--panel)', display: 'inline-block' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
        <button type="button" className="btn" style={{ padding: '2px 9px' }}
          onClick={() => setView(v => new Date(v.getFullYear(), v.getMonth() - 1, 1))}>‹</button>
        <span style={{ flex: 1 }} />
        <button type="button" className="btn" style={{ padding: '2px 9px' }}
          onClick={() => setView(v => new Date(v.getFullYear(), v.getMonth() + 1, 1))}>›</button>
      </div>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        {Array.from({ length: Math.max(1, months) }, (_, i) => renderMonth(i))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', marginTop: 8, fontSize: 12 }}>
        <span style={{ color: 'var(--muted,#888)' }}>{skDate(from)} → {skDate(to)}</span>
        <span style={{ flex: 1 }} />
        <span style={{ cursor: 'pointer', color: 'var(--accent)' }} onClick={() => onChange({ from: '', to: '' })}>Vymazať</span>
      </div>
    </div>
  );
}
