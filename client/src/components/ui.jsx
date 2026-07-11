import React, { useState } from 'react';

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

export function Modal({ title, onClose, children }) {
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
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
