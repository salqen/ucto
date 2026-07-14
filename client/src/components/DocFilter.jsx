import React, { useState } from 'react';
import DateRangeCalendar from './DateRangeCalendar.jsx';

/*
 * DocFilter — filtračný panel pre zoznamy dokladov (faktúry, ponuky, dodacie listy).
 * Obdobie (vr. štvrťrokov), Vystavené od/do (kalendár), Partner, typ, Číselný rad,
 * Štítky + Rozšírený filter (Číslo dokladu od/do). Štýl podľa dizajnu aplikácie (CSS premenné).
 */

const norm = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function emptyFilter() {
  return { period: 'Aktuálny rok', from: '', to: '', partner: '', type: 'all', series: '', tags: '', numFrom: '', numTo: '' };
}

export function periodRange(period, y = new Date().getFullYear(), today = new Date()) {
  const iso = d => d.toISOString().slice(0, 10);
  const m = today.getMonth();
  const q = Math.floor(m / 3);
  const quarter = (yy, qq) => ({ from: iso(new Date(yy, qq * 3, 1)), to: iso(new Date(yy, qq * 3 + 3, 0)) });
  switch (period) {
    case 'Aktuálny rok': return { from: `${y}-01-01`, to: `${y}-12-31` };
    case 'Minulý rok': return { from: `${y - 1}-01-01`, to: `${y - 1}-12-31` };
    case 'Aktuálny štvrťrok': return quarter(y, q);
    case 'Minulý štvrťrok': return q === 0 ? quarter(y - 1, 3) : quarter(y, q - 1);
    case 'Q1': return quarter(y, 0);
    case 'Q2': return quarter(y, 1);
    case 'Q3': return quarter(y, 2);
    case 'Q4': return quarter(y, 3);
    case 'Aktuálny mesiac': return { from: iso(new Date(y, m, 1)), to: iso(new Date(y, m + 1, 0)) };
    case 'Minulý mesiac': return { from: iso(new Date(y, m - 1, 1)), to: iso(new Date(y, m, 0)) };
    default: return { from: '', to: '' }; // Všetko / Vlastné
  }
}

const dateOf = r => r.issueDate || r.date || '';
const typeMatch = (r, t) => t === 'all' ? true
  : t === 'out' ? (r.type === 'INO' || r.type === 'O')
  : (r.type === 'INI' || r.type === 'I');

/** Čistá funkcia — vyfiltruje riadky podľa filtra. */
export function applyDocFilter(rows, f) {
  if (!f) return rows;
  const { from, to } = f.period === 'Vlastné' ? { from: f.from, to: f.to } : periodRange(f.period);
  const p = norm(f.partner), tg = norm(f.tags);
  return rows.filter(r => {
    const d = dateOf(r);
    if (from && d && d < from) return false;
    if (to && d && d > to) return false;
    if (!typeMatch(r, f.type)) return false;
    if (p && !norm(r.partnerName || '').includes(p)) return false;
    if (f.series && !String(r.number || '').toUpperCase().startsWith(f.series.toUpperCase())) return false;
    if (tg) {
      const rt = Array.isArray(r.tags) ? r.tags.join(' ') : (r.tags || '');
      if (!norm(rt).includes(tg)) return false;
    }
    if (f.numFrom && String(r.number || '') < f.numFrom) return false;
    if (f.numTo && String(r.number || '') > f.numTo) return false;
    return true;
  });
}

export const PERIODS = ['Aktuálny rok', 'Minulý rok', 'Aktuálny štvrťrok', 'Minulý štvrťrok', 'Q1', 'Q2', 'Q3', 'Q4', 'Aktuálny mesiac', 'Minulý mesiac', 'Všetko', 'Vlastné'];

const inp = {
  width: '100%', padding: '8px 10px', border: '1px solid var(--input-border)', borderRadius: 8,
  background: 'var(--input-bg)', color: 'var(--text)', fontSize: 13, boxSizing: 'border-box',
};

export default function DocFilter({ value, onApply, onClose, seriesOptions = [], typeLabels = { out: 'Vyšlé', in: 'Došlé' } }) {
  const [f, setF] = useState(value || emptyFilter());
  const set = (k, v) => setF(o => ({ ...o, [k]: v }));
  const [adv, setAdv] = useState(!!(f.numFrom || f.numTo));
  const rng = f.period === 'Vlastné' ? { from: f.from, to: f.to } : periodRange(f.period);

  /* úprava dátumu = prepnutie na "Vlastné" a zachovanie druhého konca rozsahu */
  const editDate = (which, val) => setF(o => {
    const base = o.period === 'Vlastné' ? { from: o.from, to: o.to } : periodRange(o.period);
    return { ...o, period: 'Vlastné', from: which === 'from' ? val : base.from, to: which === 'to' ? val : base.to };
  });

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 18, background: 'var(--panel)', color: 'var(--text)', boxShadow: 'var(--shadow)', maxWidth: 660 }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
        <b style={{ fontSize: 16 }}>⛃ Filter</b>
        <span style={{ flex: 1 }} />
        <span style={{ cursor: 'pointer', color: 'var(--accent)', fontSize: 18 }} onClick={onClose}>✕</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        <Field label="Obdobie">
          <select style={inp} value={f.period} onChange={e => set('period', e.target.value)}>
            {PERIODS.map(p => <option key={p}>{p}</option>)}
          </select>
        </Field>
        <Field label="Vystavené od">
          <input type="date" style={inp} value={rng.from || ''} onChange={e => editDate('from', e.target.value)} />
        </Field>
        <Field label="Vystavené do">
          <input type="date" style={inp} value={rng.to || ''} onChange={e => editDate('to', e.target.value)} />
        </Field>
      </div>

      <div style={{ margin: '2px 0 12px' }}>
        <DateRangeCalendar from={rng.from} to={rng.to} months={2}
          onChange={({ from, to }) => setF(o => ({ ...o, period: 'Vlastné', from, to }))} />
      </div>

      <Field label="Partner" full>
        <input style={inp} value={f.partner} placeholder="názov partnera" onChange={e => set('partner', e.target.value)} />
      </Field>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Doklad">
          <select style={inp} value={f.type} onChange={e => set('type', e.target.value)}>
            <option value="all">Všetko</option>
            <option value="out">{typeLabels.out}</option>
            <option value="in">{typeLabels.in}</option>
          </select>
        </Field>
        <Field label="Číselný rad">
          <select style={inp} value={f.series} onChange={e => set('series', e.target.value)}>
            <option value="">Všetko</option>
            {seriesOptions.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
      </div>

      <Field label="Štítky" full>
        <input style={inp} value={f.tags} placeholder="štítok" onChange={e => set('tags', e.target.value)} />
      </Field>

      <div style={{ color: 'var(--accent)', cursor: 'pointer', fontSize: 13, margin: '6px 0 10px' }} onClick={() => setAdv(a => !a)}>
        Rozšírený filter {adv ? '▲' : '▾'}
      </div>
      {adv && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Číslo dokladu od"><input style={inp} value={f.numFrom} onChange={e => set('numFrom', e.target.value)} /></Field>
          <Field label="Číslo dokladu do"><input style={inp} value={f.numTo} onChange={e => set('numTo', e.target.value)} /></Field>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
        <span style={{ color: 'var(--accent)', cursor: 'pointer', fontSize: 13 }} onClick={() => setF(emptyFilter())}>Vyčistiť filter</span>
        <span style={{ flex: 1 }} />
        <button className="btn" type="button" onClick={onClose} style={{ marginRight: 8 }}>Zrušiť</button>
        <button className="btn primary" type="button" onClick={() => { onApply(f); onClose && onClose(); }}>Použiť</button>
      </div>
    </div>
  );
}

function Field({ label, children, full }) {
  return (
    <div style={{ marginBottom: 10, gridColumn: full ? '1 / -1' : 'auto' }}>
      <label style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>{label}</label>
      {children}
    </div>
  );
}
