import React, { useState } from 'react';

/*
 * DateRangeCalendar — dva samostatné kalendáre pre výber rozsahu dátumov.
 * Ľavý kalendár vyberá dátum "Od", pravý dátum "Do". Každý má vlastnú
 * navigáciu mesiacov a zvýrazňuje vybraný okraj aj celý rozsah.
 * props: from, to (ISO 'YYYY-MM-DD' | ''), onChange({from,to})
 */
const pad = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = s => { if (!s) return null; const [y, m, d] = String(s).split('-').map(Number); return y ? new Date(y, m - 1, d) : null; };
const skDate = s => (s ? s.split('-').reverse().map(Number).join('.') : '—');
const WD = ['Po', 'Ut', 'St', 'Št', 'Pi', 'So', 'Ne'];
const MON = ['Január', 'Február', 'Marec', 'Apríl', 'Máj', 'Jún', 'Júl', 'August', 'September', 'Október', 'November', 'December'];

function monthStart(s, fallback) { const d = parse(s) || fallback || new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); }

function CalPanel({ label, view, setView, from, to, onPick }) {
  const [hover, setHover] = useState('');
  const y = view.getFullYear(), m = view.getMonth();
  const startDow = (new Date(y, m, 1).getDay() + 6) % 7;   /* pondelok = 0 */
  const dim = new Date(y, m + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= dim; d++) cells.push(new Date(y, m, d));
  const todayIso = iso(new Date());
  const effTo = to || (from && hover && hover >= from ? hover : '');

  return (
    <div style={{ minWidth: 210 }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
        <button type="button" className="btn" style={{ padding: '2px 9px' }}
          onClick={() => setView(new Date(y, m - 1, 1))}>‹</button>
        <span style={{ flex: 1, textAlign: 'center', fontWeight: 600, fontSize: 13 }}>{label}: {MON[m]} {y}</span>
        <button type="button" className="btn" style={{ padding: '2px 9px' }}
          onClick={() => setView(new Date(y, m + 1, 1))}>›</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2 }}>
        {WD.map(w => <div key={w} style={{ textAlign: 'center', fontSize: 11, color: 'var(--muted,#999)' }}>{w}</div>)}
        {cells.map((d, i) => {
          if (!d) return <div key={i} />;
          const ds = iso(d);
          const isEnd = ds === from || (to && ds === to);
          const inRange = from && effTo && ds > from && ds < effTo;
          const isToday = ds === todayIso;
          return (
            <button key={i} type="button" onClick={() => onPick(ds)}
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
}

export default function DateRangeCalendar({ from, to, onChange }) {
  const [viewFrom, setViewFrom] = useState(() => monthStart(from));
  const [viewTo, setViewTo] = useState(() => monthStart(to, parse(from)));

  const pickFrom = ds => onChange({ from: ds, to: to && to < ds ? '' : to });
  const pickTo = ds => onChange({ from: from && ds < from ? '' : from, to: ds });

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 10, background: 'var(--panel)', display: 'inline-block' }}>
      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
        <CalPanel label="Od" view={viewFrom} setView={setViewFrom} from={from} to={to} onPick={pickFrom} />
        <CalPanel label="Do" view={viewTo} setView={setViewTo} from={from} to={to} onPick={pickTo} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', marginTop: 8, fontSize: 12 }}>
        <span style={{ color: 'var(--muted,#888)' }}>{skDate(from)} → {skDate(to)}</span>
        <span style={{ flex: 1 }} />
        <span style={{ cursor: 'pointer', color: 'var(--accent)' }} onClick={() => onChange({ from: '', to: '' })}>Vymazať</span>
      </div>
    </div>
  );
}
