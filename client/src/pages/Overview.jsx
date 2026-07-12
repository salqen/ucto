import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { PageHead } from '../components/ui.jsx';

/* Prehľady v štýle iDoklad: Fakturácia za obdobie, Bilancia, Neuhradené */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Máj', 'Jún', 'Júl', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec'];
const fmt = n => (Number(n) || 0).toLocaleString('sk-SK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' EUR';
const fmtShort = n => {
  const v = Number(n) || 0;
  if (Math.abs(v) >= 1000) return Math.round(v / 1000) + 'k EUR';
  return Math.round(v) + ' EUR';
};

/* prepínač (toggle switch) */
function Toggle({ on, onChange, label }) {
  return (
    <label className="pv-toggle-row">
      <span className={'pv-toggle' + (on ? ' on' : '')} onClick={e => { e.preventDefault(); onChange(!on); }}>
        <span className="pv-knob" />
      </span>
      {label}
    </label>
  );
}

export default function Overview() {
  const nav = useNavigate();
  const [invoices, setInvoices] = useState([]);
  const [period, setPeriod] = useState('m'); // m | q | y
  const [balYear, setBalYear] = useState('this');
  const [unpYear, setUnpYear] = useState('this');
  const [unpTab, setUnpTab] = useState('INO'); // INO faktúry | INI záväzky
  const [cfg, setCfg] = useState(() => {
    try { return { cumulative: false, out: true, inc: true, ...JSON.parse(localStorage.getItem('pv_cfg') || '{}') }; }
    catch { return { cumulative: false, out: true, inc: true }; }
  });
  const [cfgOpen, setCfgOpen] = useState(false);
  const saveCfg = (c) => { setCfg(c); localStorage.setItem('pv_cfg', JSON.stringify(c)); };

  useEffect(() => { api.get('/invoices').then(setInvoices).catch(() => {}); }, []);

  const thisYear = new Date().getFullYear();
  const years = [...new Set(invoices.map(i => (i.issueDate || '').slice(0, 4)).filter(Boolean))].sort().reverse();

  /* ---------- graf: fakturácia za obdobie ---------- */
  const chart = useMemo(() => {
    const now = new Date();
    let buckets = [];
    if (period === 'm') {
      for (let k = 11; k >= 0; k--) {
        const d = new Date(now.getFullYear(), now.getMonth() - k, 1);
        buckets.push({ label: MONTHS[d.getMonth()], key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` });
      }
    } else if (period === 'q') {
      const qNow = Math.floor(now.getMonth() / 3);
      for (let k = 7; k >= 0; k--) {
        let y = now.getFullYear(), q = qNow - k;
        while (q < 0) { q += 4; y -= 1; }
        buckets.push({ label: `Q${q + 1}/${String(y).slice(2)}`, key: `${y}-Q${q}` });
      }
    } else {
      for (let k = 4; k >= 0; k--) buckets.push({ label: String(thisYear - k), key: String(thisYear - k) });
    }
    const idx = Object.fromEntries(buckets.map((b, i) => [b.key, i]));
    const out = buckets.map(() => 0), inc = buckets.map(() => 0);
    for (const iv of invoices) {
      const d = iv.issueDate || '';
      if (!d) continue;
      const y = d.slice(0, 4), m = Number(d.slice(5, 7)) - 1;
      const key = period === 'm' ? d.slice(0, 7) : period === 'q' ? `${y}-Q${Math.floor(m / 3)}` : y;
      const i = idx[key];
      if (i === undefined) continue;
      if (iv.type === 'INO') out[i] += Number(iv.total) || 0;
      else inc[i] += Number(iv.total) || 0;
    }
    if (cfg.cumulative) {
      for (let i = 1; i < buckets.length; i++) { out[i] += out[i - 1]; inc[i] += inc[i - 1]; }
    }
    return { buckets, out, inc };
  }, [invoices, period, cfg.cumulative]);

  const showOut = cfg.out !== false, showInc = cfg.inc !== false;
  const maxV = Math.max(1, ...(showOut ? chart.out : [0]), ...(showInc ? chart.inc : [0]));
  const W = 860, H = 300, PAD_L = 80, PAD_B = 34, n = chart.buckets.length;
  const bw = (W - PAD_L) / n;
  const gridLines = 7;

  /* ---------- bilancia ---------- */
  const bal = useMemo(() => {
    const y = balYear === 'this' ? String(thisYear) : balYear;
    const list = invoices.filter(i => (i.issueDate || '').startsWith(y));
    const mk = t => {
      const l = list.filter(i => i.type === t);
      const total = l.reduce((s, i) => s + (Number(i.total) || 0), 0);
      const paid = l.reduce((s, i) => s + Math.min(Number(i.paid) || 0, Number(i.total) || 0), 0);
      return { total, paid, unpaid: total - paid };
    };
    const predaj = mk('INO'), nakup = mk('INI');
    return { predaj, nakup, diff: predaj.total - nakup.total };
  }, [invoices, balYear]);

  /* ---------- neuhradené (veková štruktúra po splatnosti) ---------- */
  const unpaid = useMemo(() => {
    const y = unpYear === 'this' ? String(thisYear) : unpYear;
    const today = new Date();
    const buckets = { b30: 0, b60: 0, b90: 0, b90p: 0, current: 0 };
    let total = 0;
    for (const iv of invoices) {
      if (iv.type !== unpTab) continue;
      if (!(iv.issueDate || '').startsWith(y)) continue;
      const due = Number(iv.total) - (Number(iv.paid) || 0);
      if (due <= 0.004) continue;
      total += due;
      const days = iv.dueDate ? Math.floor((today - new Date(iv.dueDate)) / 864e5) : 0;
      if (days <= 0) buckets.current += due;
      else if (days <= 30) buckets.b30 += due;
      else if (days <= 60) buckets.b60 += due;
      else if (days <= 90) buckets.b90 += due;
      else buckets.b90p += due;
    }
    return { ...buckets, total };
  }, [invoices, unpTab, unpYear]);

  const yearSelect = (val, setVal) => (
    <select className="pv-select" value={val} onChange={e => setVal(e.target.value)}>
      <option value="this">Tento rok</option>
      {years.filter(y => y !== String(thisYear)).map(y => <option key={y} value={y}>{y}</option>)}
    </select>
  );

  return (
    <>
      <PageHead title="Prehľady" />
      <div className="pv-wrap">
        {/* ---------- Fakturácia za obdobie ---------- */}
        <div className="pv-card pv-chart-card">
          <div className="pv-card-head">
            <h3>Fakturácia za obdobie</h3>
            <div className="pv-pills">
              <button className={period === 'm' ? 'active' : ''} onClick={() => setPeriod('m')}>Mesiace</button>
              <button className={period === 'q' ? 'active' : ''} onClick={() => setPeriod('q')}>Štvrťroky</button>
              <button className={period === 'y' ? 'active' : ''} onClick={() => setPeriod('y')}>Roky</button>
            </div>
          </div>
          <div className="pv-gear-row">
            <button className="pv-gear" title="Nastavenie grafu" onClick={() => setCfgOpen(true)}>⚙</button>
          </div>

          <svg viewBox={`0 0 ${W} ${H + PAD_B}`} style={{ width: '100%' }}>
            {Array.from({ length: gridLines }, (_, i) => {
              const yy = H - (i + 1) / gridLines * (H - 10);
              const v = (i + 1) / gridLines * maxV;
              return (
                <g key={i}>
                  <line x1={PAD_L} y1={yy} x2={W} y2={yy} stroke="var(--border)" strokeDasharray="4 5" />
                  <text x={PAD_L - 10} y={yy + 4} textAnchor="end" fontSize="12" fill="var(--muted)">{fmtShort(v)}</text>
                </g>
              );
            })}
            {chart.buckets.map((b, i) => {
              const ho = chart.out[i] / maxV * (H - 10), hi = chart.inc[i] / maxV * (H - 10);
              const cx = PAD_L + i * bw;
              const barW = Math.min(18, bw / 3);
              return (
                <g key={i}>
                  {showOut && <rect x={cx + bw / 2 - barW - 2} y={H - ho} width={barW} height={Math.max(ho, chart.out[i] > 0 ? 2 : 0)} rx="3" fill="#22c55e" />}
                  {showInc && <rect x={cx + bw / 2 + 2} y={H - hi} width={barW} height={Math.max(hi, chart.inc[i] > 0 ? 2 : 0)} rx="3" fill="#f4511e" />}
                  <text x={cx + bw / 2} y={H + 22} textAnchor="middle" fontSize="13" fill="var(--muted)">{b.label}</text>
                </g>
              );
            })}
            <line x1={PAD_L} y1={H} x2={W} y2={H} stroke="var(--input-border)" />
          </svg>
          <div className="pv-legend">
            {showOut && <span><i style={{ background: '#22c55e' }} />Predaj</span>}
            {showInc && <span><i style={{ background: '#f4511e' }} />Nákup</span>}
          </div>

          {cfgOpen && (
            <div className="pv-pop-back" onClick={() => setCfgOpen(false)}>
              <div className="pv-pop" onClick={e => e.stopPropagation()}>
                <h4>Nastavenie grafu – Vývoj fakturácie</h4>
                <div className="pv-pop-row">
                  <span>Spôsob zobrazenia:</span>
                  <div className="pv-pills">
                    <button className={!cfg.cumulative ? 'active' : ''} onClick={() => saveCfg({ ...cfg, cumulative: false })}>Po obdobiach</button>
                    <button className={cfg.cumulative ? 'active' : ''} onClick={() => saveCfg({ ...cfg, cumulative: true })}>Kumulatívne</button>
                  </div>
                </div>
                <div className="pv-pop-sep" />
                <div style={{ marginBottom: 6, color: '#555' }}>Započítavať:</div>
                <Toggle on={cfg.out !== false} onChange={v => saveCfg({ ...cfg, out: v })} label="Vystavené faktúry (Predaj)" />
                <Toggle on={cfg.inc !== false} onChange={v => saveCfg({ ...cfg, inc: v })} label="Faktúry prijaté (Nákup)" />
                <div className="pv-pop-actions">
                  <button className="pv-btn-outline" onClick={() => setCfgOpen(false)}>Zrušiť</button>
                  <button className="pv-btn-solid" onClick={() => setCfgOpen(false)}>Aplikovať a uložiť</button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ---------- Bilancia ---------- */}
        <div className="pv-card">
          <div className="pv-card-head">
            <div>
              <h3>Bilancia</h3>
              <div className="pv-sub">za obdobie</div>
            </div>
            {yearSelect(balYear, setBalYear)}
          </div>
          <div className="pv-sep" />
          <div className="pv-line main"><span>Predaj</span><b className="pv-green">{fmt(bal.predaj.total)}</b></div>
          <div className="pv-line"><span>z toho uhradené</span><b>{fmt(bal.predaj.paid)}</b></div>
          <div className="pv-line"><span>z toho neuhradené</span><b>{fmt(bal.predaj.unpaid)}</b></div>
          <div className="pv-sep dashed" />
          <div className="pv-line main"><span>Nákup</span><b className="pv-red">{fmt(bal.nakup.total)}</b></div>
          <div className="pv-line"><span>z toho uhradené</span><b>{fmt(bal.nakup.paid)}</b></div>
          <div className="pv-line"><span>z toho neuhradené</span><b>{fmt(bal.nakup.unpaid)}</b></div>
          <div className="pv-sep" />
          <div className="pv-line main"><span>Rozdiel</span><b className={bal.diff >= 0 ? 'pv-green' : 'pv-red'}>{fmt(bal.diff)}</b></div>
        </div>

        {/* ---------- Neuhradené ---------- */}
        <div className="pv-card">
          <div className="pv-card-head">
            <h3>Neuhradené</h3>
            {yearSelect(unpYear, setUnpYear)}
          </div>
          <div className="pv-tabs">
            <button className={unpTab === 'INO' ? 'active' : ''} onClick={() => setUnpTab('INO')}>Faktúry</button>
            <button className={unpTab === 'INI' ? 'active' : ''} onClick={() => setUnpTab('INI')}>Záväzky</button>
          </div>
          <div className="pv-line"><span>do splatnosti</span><b>{fmt(unpaid.current)}</b></div>
          <div className="pv-line"><span>1 – 30 dní</span><b>{fmt(unpaid.b30)}</b></div>
          <div className="pv-line"><span>31 – 60 dní</span><b>{fmt(unpaid.b60)}</b></div>
          <div className="pv-line"><span>61 – 90 dní</span><b>{fmt(unpaid.b90)}</b></div>
          <div className="pv-line"><span>90+ dní</span><b>{fmt(unpaid.b90p)}</b></div>
          <div className="pv-sep" />
          <div className="pv-line main"><span>Spolu</span><b>{fmt(unpaid.total)}</b></div>
          <button className="pv-btn-outline" style={{ marginTop: 14 }}
            onClick={() => nav(unpTab === 'INO' ? '/faktury/vysle' : '/faktury/dosle')}>
            Zobraziť podrobnosti
          </button>
        </div>
      </div>
    </>
  );
}
