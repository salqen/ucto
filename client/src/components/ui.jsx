import React, { useMemo, useState } from 'react';

/* ---------- triedenie tabuliek podľa typu stĺpca ----------
   typy: 'str' (text, sk locale), 'num' (číslo), 'date' (ISO dátum) */
export function useSort(rows) {
  const [sort, setSort] = useState({ key: null, dir: 1, type: 'str' });
  const toggle = (key, type = 'str') =>
    setSort(s => (s.key === key ? { ...s, dir: -s.dir } : { key, dir: 1, type }));
  const sorted = useMemo(() => {
    if (!sort.key) return rows;
    const empty = v => v === null || v === undefined || v === '';
    const cmp = (a, b) => {
      const x = a[sort.key], y = b[sort.key];
      if (empty(x) && empty(y)) return 0;
      if (empty(x)) return 1;          /* prázdne vždy na koniec */
      if (empty(y)) return -1;
      if (sort.type === 'num') return ((Number(x) || 0) - (Number(y) || 0)) * sort.dir;
      if (sort.type === 'date') return String(x).localeCompare(String(y)) * sort.dir; /* ISO YYYY-MM-DD */
      return String(x).localeCompare(String(y), 'sk', { numeric: true, sensitivity: 'base' }) * sort.dir;
    };
    return [...rows].sort(cmp);
  }, [rows, sort]);
  return [sorted, sort, toggle];
}

/* klikateľná hlavička stĺpca */
export function SortTh({ label, k, type = 'str', sort, onSort, className = '' }) {
  const active = sort.key === k;
  return (
    <th className={(className + ' sortable').trim()} onClick={() => onSort(k, type)} title="Kliknutím zoradíte">
      {label}
      <span className={'sort-arrow' + (active ? ' active' : '')}>
        {active ? (sort.dir === 1 ? ' ▲' : ' ▼') : ' ⇅'}
      </span>
    </th>
  );
}

/* zbaliteľná sekcia formulára (ako na keepi) */
export function Section({ title, children, open: defOpen = true }) {
  const [open, setOpen] = useState(defOpen);
  return (
    <div className="section">
      <div className={'section-head' + (open ? '' : ' collapsed')} onClick={() => setOpen(!open)}>
        <span>{title}</span><span>{open ? '▲' : '▼'}</span>
      </div>
      {open && <div className="section-body">{children}</div>}
    </div>
  );
}

export function Frow({ label, req, children }) {
  return (
    <div className="frow">
      <label className={req ? 'req' : ''}>{label}</label>
      {children}
    </div>
  );
}

export function Modal({ title, onClose, children, wide }) {
  return (
    <div className="modal-back" onClick={onClose}>
      <div className={'modal' + (wide ? ' wide' : '')} onClick={e => e.stopPropagation()}>
        <div className="modal-head">{title}<span onClick={onClose}>✕</span></div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

export function PageHead({ title, children }) {
  return (
    <div className="page-head">
      <div className="page-title">{title}</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{children}</div>
    </div>
  );
}
