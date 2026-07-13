import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, eur, dt } from '../api.js';
import { PageHead, useSort, SortTh } from '../components/ui.jsx';
import DocFilter, { applyDocFilter, emptyFilter } from '../components/DocFilter.jsx';

const META = {
  quotes: { coll: 'quotes', title: 'Cenové ponuky', base: '/ponuky', typeLabels: { out: 'Vyšlé', in: 'Došlé' } },
  deliverynotes: { coll: 'deliverynotes', title: 'Dodacie listy', base: '/dodacie-listy', typeLabels: { out: 'Vyšlé', in: 'Došlé' } },
};

/* kind: 'quotes' | 'deliverynotes' ; type: 'O' | 'I' */
export default function Documents({ kind, type }) {
  const meta = META[kind];
  const nav = useNavigate();
  const isOut = type === 'O';
  const seg = isOut ? 'vysle' : 'dosle';
  const [rows, setRows] = useState([]);
  const [sel, setSel] = useState(null);
  const [filter, setFilter] = useState(emptyFilter());
  const [showFilter, setShowFilter] = useState(false);

  const load = () => api.get('/' + meta.coll + '?type=' + type).then(setRows).catch(() => setRows([]));
  useEffect(() => { load(); setSel(null); }, [kind, type]);

  const seriesOptions = useMemo(() => {
    const s = new Set();
    rows.forEach(r => { const m = String(r.number || '').match(/^[A-Za-z]+/); if (m) s.add(m[0]); });
    return [...s].sort();
  }, [rows]);

  const filtered = applyDocFilter(rows, filter);
  const byDate = [...filtered].sort((a, b) => (b.issueDate || '').localeCompare(a.issueDate || ''));
  const [shown, sort, onSort] = useSort(byDate);

  const del = async () => {
    if (!sel || !confirm(`Zmazať doklad ${sel.number}?`)) return;
    await api.del('/' + meta.coll + '/' + sel.id); setSel(null); load();
  };

  return (
    <>
      <PageHead title={meta.title + ' — ' + (isOut ? 'vyšlé' : 'došlé')}>
        <button className="btn primary" onClick={() => nav(meta.base + '/' + seg + '/nova')}>🗎 Nový doklad</button>
      </PageHead>
      <div className="toolbar">
        <button className="btn" disabled={!sel} onClick={() => nav(meta.base + '/' + seg + '/' + sel.id)}>Detail / úprava</button>
        <button className="btn" onClick={() => setShowFilter(f => !f)}>▽ Filter</button>
        <button className="btn danger" disabled={!sel} onClick={del}>Zmazať</button>
      </div>

      {showFilter && (
        <div style={{ margin: '8px 0' }}>
          <DocFilter value={filter} seriesOptions={seriesOptions} typeLabels={meta.typeLabels}
            onApply={setFilter} onClose={() => setShowFilter(false)} />
        </div>
      )}

      <div className="grid-wrap">
        <table className="grid">
          <thead><tr>
            <SortTh label="Číslo" k="number" sort={sort} onSort={onSort} />
            <SortTh label="Dátum" k="issueDate" sort={sort} onSort={onSort} />
            <SortTh label="Partner" k="partnerName" sort={sort} onSort={onSort} />
            <SortTh label="Spolu" k="total" sort={sort} onSort={onSort} />
            <th>Faktúra</th>
          </tr></thead>
          <tbody>
            {shown.map(r => (
              <tr key={r.id} className={sel?.id === r.id ? 'sel' : ''}
                onClick={() => setSel(r)} onDoubleClick={() => nav(meta.base + '/' + seg + '/' + r.id)}>
                <td><b>{r.number}</b></td>
                <td>{dt(r.issueDate)}</td>
                <td>{r.partnerName}</td>
                <td className="num">{eur(r.total)}</td>
                <td>{r.invoiceNumber ? <span style={{ color: '#5f9622' }}>✓ {r.invoiceNumber}</span> : <span className="hint" style={{ margin: 0 }}>—</span>}</td>
              </tr>
            ))}
            {!shown.length && <tr><td colSpan={5} style={{ textAlign: 'center', color: '#999' }}>Žiadne doklady</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="grid-foot">{shown.length} položiek{filtered.length !== rows.length ? ` (z ${rows.length})` : ''}</div>
    </>
  );
}
