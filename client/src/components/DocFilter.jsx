import React, { useState } from 'react';

/*
 * DocFilter — filtračný panel pre zoznamy dokladov (faktúry, ponuky, dodacie listy).
 * Zodpovedá filtru z návrhu: Obdobie, Vystavené od/do, Partner, typ, Číselný rad,
 * Štítky + Rozšírený filter (Číslo dokladu od/do).
 *
 *   const [f, setF] = useState(emptyFilter());
 *   <DocFilter value={f} seriesOptions={[...]} onApply={setF} onClose={...} />
 *   const shown = applyDocFilter(rows, f);
 */

const norm = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function emptyFilter() {
  return { period: 'Aktuálny rok', from: '', to: '', partner: '', type: 'all', series: '', tags: '', numFrom: '', numTo: '' };
}

export function periodRange(period, y = new Date().getFullYear(), today = new Date()) {
  const iso = d => d.toISOString().slice(0, 10);
  const m = today.getMonth();
  switch (period) {
    case 'Aktuálny rok': return { from: `${y}-01-01`, to: `${y}-12-31` };
    case 'Minulý rok': return { from: `${y - 1}-01-01`, to: `${y - 1}-12-31` };
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
  let { from, to } = f.period === 'Vlastné' ? { from: f.from, to: f.to } : periodRange(f.period);
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

const PERIODS = ['Aktuálny rok', 'Minulý rok', 'Aktuálny mesiac', 'Minulý mesiac', 'Všetko', 'Vlastné'];

export default function DocFilter({ value, onApply, onClose, seriesOptions = [], typeLabels = { out: 'Vyšlé', in: 'Došlé' } }) {
  const [f, setF] = useState(value || emptyFilter());
  const set = (k, v) => setF(o => ({ ...o, [k]: v }));
  const [adv, setAdv] = useState(!!(f.numFrom || f.numTo));
  const rng = f.period === 'Vlastné' ? { from: f.from, to: f.to } : periodRange(f.period);

  return (
    <div style={{ border: '1px solid #dfe3ea', borderRadius: 12, padding: 18, background: '#fff', boxShadow: '0 8px 24px rgba(0,0,0,.08)', maxWidth: 640 }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
        <b style={{ fontSize: 16 }}>▽ Filter</b>
        <span style={{ flex: 1 }} />
        <span style={{ cursor: 'pointer', color: '#3b6' }} onClick={onClose}>✕</span>
      </div>

      <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        <Field label="Obdobie">
          <select value={f.period} onChange={e => set('period', e.target.value)}>
            {PERIODS.map(p => <option key={p}>{p}</option>)}
          </select>
        </Field>
        <Field label="Vystavené od">
          <input type="date" value={f.period === 'Vlastné' ? f.from : rng.from} disabled={f.period !== 'Vlastné'}
            onChange={e => set('from', e.target.value)} />
        </Field>
        <Field label="Vystavené do">
          <input type="date" value={f.period === 'Vlastné' ? f.to : rng.to} disabled={f.period !== 'Vlastné'}
            onChange={e => set('to', e.target.value)} />
        </Field>
      </div>

      <Field label="Partner" full>
        <input value={f.partner} placeholder="názov partnera" onChange={e => set('partner', e.target.value)} />
      </Field>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Field label="Doklad">
          <select value={f.type} onChange={e => set('type', e.target.value)}>
            <option value="all">Všetko</option>
            <option value="out">{typeLabels.out}</option>
            <option value="in">{typeLabels.in}</option>
          </select>
        </Field>
        <Field label="Číselný rad">
          <select value={f.series} onChange={e => set('series', e.target.value)}>
            <option value="">Všetko</option>
            {seriesOptions.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
      </div>

      <Field label="Štítky" full>
        <input value={f.tags} placeholder="štítok" onChange={e => set('tags', e.target.value)} />
      </Field>

      <div style={{ color: '#3b6', cursor: 'pointer', fontSize: 13, margin: '4px 0 8px' }} onClick={() => setAdv(a => !a)}>
        Rozšírený filter {adv ? '▲' : '▾'}
      </div>
      {adv && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Field label="Číslo dokladu od"><input value={f.numFrom} onChange={e => set('numFrom', e.target.value)} /></Field>
          <Field label="Číslo dokladu do"><input value={f.numTo} onChange={e => set('numTo', e.target.value)} /></Field>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', marginTop: 14 }}>
        <span style={{ color: '#3b6', cursor: 'pointer', fontSize: 13 }} onClick={() => setF(emptyFilter())}>Vyčistiť filter</span>
        <span style={{ flex: 1 }} />
        <button className="btn" type="button" onClick={onClose} style={{ marginRight: 8 }}>Zrušiť</button>
        <button className="btn primary" type="button" onClick={() => { onApply(f); onClose && onClose(); }}>Použiť</button>
      </div>
    </div>
  );
}

function Field({ label, children, full }) {
  return (
    <div style={{ marginBottom: 8, gridColumn: full ? '1 / -1' : 'auto' }}>
      <label style={{ display: 'block', fontSize: 12, color: '#667', marginBottom: 3 }}>{label}</label>
      {children}
    </div>
  );
}
