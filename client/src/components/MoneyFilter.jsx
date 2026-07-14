import React, { useState } from 'react';
import { periodRange, PERIODS } from './DocFilter.jsx';
import DateRangeCalendar from './DateRangeCalendar.jsx';
import { GROUP_LABELS } from './CatSelect.jsx';

/*
 * MoneyFilter — filtračný panel pre peňažné doklady (denník, banka, pokladňa).
 * Obdobie (vr. štvrťrokov) + grafický kalendár od/do, partner, typ (P/V), druh.
 * Dátumová časť je rovnaká ako pri faktúrach (zdieľa periodRange).
 */
const norm = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function emptyMoneyFilter() {
  return { period: 'Všetko', from: '', to: '', partner: '', type: 'all', category: '' };
}

/** Čistá funkcia — vyfiltruje riadky peňažných dokladov. */
export function applyMoneyFilter(rows, f) {
  if (!f) return rows;
  const { from, to } = f.period === 'Vlastné' ? { from: f.from, to: f.to } : periodRange(f.period);
  const p = norm(f.partner);
  return rows.filter(r => {
    const d = r.date || '';
    if (from && d && d < from) return false;
    if (to && d && d > to) return false;
    if (f.type !== 'all' && r.type !== f.type) return false;
    if (f.category && r.category !== f.category) return false;
    if (p && !norm(r.partnerName || '').includes(p)) return false;
    return true;
  });
}

const inp = {
  width: '100%', padding: '8px 10px', border: '1px solid var(--input-border)', borderRadius: 8,
  background: 'var(--input-bg)', color: 'var(--text)', fontSize: 13, boxSizing: 'border-box',
};

function groupOptions(list) {
  const byG = {};
  const order = [];
  for (const c of list) { const g = c.group || '_'; if (!byG[g]) { byG[g] = []; order.push(g); } byG[g].push(c); }
  return order.map(g => g === '_'
    ? byG[g].map(c => <option key={c.code} value={c.code}>{c.name}</option>)
    : <optgroup key={g} label={GROUP_LABELS[g] || g}>{byG[g].map(c => <option key={c.code} value={c.code}>{c.name}</option>)}</optgroup>);
}

export default function MoneyFilter({ value, onApply, onClose, cats = { P: [], V: [] } }) {
  const [f, setF] = useState(value || emptyMoneyFilter());
  const set = (k, v) => setF(o => ({ ...o, [k]: v }));
  const rng = f.period === 'Vlastné' ? { from: f.from, to: f.to } : periodRange(f.period);

  const editDate = (which, val) => setF(o => {
    const base = o.period === 'Vlastné' ? { from: o.from, to: o.to } : periodRange(o.period);
    return { ...o, period: 'Vlastné', from: which === 'from' ? val : base.from, to: which === 'to' ? val : base.to };
  });
  const setType = t => setF(o => ({ ...o, type: t, category: '' }));

  const catList = f.type === 'P' ? cats.P : f.type === 'V' ? cats.V : null;

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
        <Field label="Dátum od">
          <input type="date" style={inp} value={rng.from || ''} onChange={e => editDate('from', e.target.value)} />
        </Field>
        <Field label="Dátum do">
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
        <Field label="Typ">
          <select style={inp} value={f.type} onChange={e => setType(e.target.value)}>
            <option value="all">Všetko</option>
            <option value="P">Príjmy</option>
            <option value="V">Výdaje</option>
          </select>
        </Field>
        <Field label="Druh">
          <select style={inp} value={f.category} onChange={e => set('category', e.target.value)}>
            <option value="">Všetky druhy</option>
            {catList
              ? groupOptions(catList)
              : [<optgroup key="P" label="Príjmy">{cats.P.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}</optgroup>,
                 <optgroup key="V" label="Výdaje">{cats.V.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}</optgroup>]}
          </select>
        </Field>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
        <span style={{ color: 'var(--accent)', cursor: 'pointer', fontSize: 13 }} onClick={() => setF(emptyMoneyFilter())}>Vyčistiť filter</span>
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
