import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, eur, dt, today } from '../api.js';
import { PageHead } from '../components/ui.jsx';
import { invoiceAlerts, alertsSummary } from '../integrations/reminders.js';
import { notifyPermission, ensurePermission, pushAlerts, testNotification } from '../integrations/notify.js';

const SEV_COLOR = { 'kritická': '#c0392b', 'vysoká': '#e67e22', 'stredná': '#d4a012' };
const DIR_LABEL = { payable: 'Záväzok (došlá)', receivable: 'Pohľadávka (vyšlá)' };

export default function Reminders() {
  const nav = useNavigate();
  const [invoices, setInvoices] = useState([]);
  const [beforeDays, setBeforeDays] = useState(3);
  const [dir, setDir] = useState('all');
  const [perm, setPerm] = useState(notifyPermission());

  useEffect(() => {
    Promise.all([api.get('/invoices?type=INO'), api.get('/invoices?type=INI')])
      .then(([a, b]) => setInvoices([...a, ...b]))
      .catch(() => {});
  }, []);

  const alerts = useMemo(
    () => invoiceAlerts(invoices, { today: today(), beforeDays, resolveName: inv => inv.partnerName }),
    [invoices, beforeDays],
  );
  const summary = useMemo(() => alertsSummary(alerts), [alerts]);
  const shown = alerts.filter(a => dir === 'all' || a.direction === dir);

  /* automaticky zobraz notifikácie pri načítaní (throttlované 1×/deň/faktúru) */
  useEffect(() => { if (perm === 'granted' && alerts.length) pushAlerts(alerts, { today: today() }); }, [alerts, perm]);

  const enable = async () => { setPerm(await ensurePermission()); };

  return (
    <>
      <PageHead title="Pripomienky faktúr">
        {perm !== 'granted'
          ? <button className="btn primary" onClick={enable}>🔔 Zapnúť notifikácie</button>
          : <button className="btn" onClick={testNotification}>🔔 Test notifikácie</button>}
      </PageHead>

      <div className="filter-row" style={{ gap: 12, flexWrap: 'wrap' }}>
        <label>Pred splatnosťou</label>
        <select value={beforeDays} onChange={e => setBeforeDays(Number(e.target.value))}>
          <option value={0}>iba po splatnosti</option>
          <option value={3}>3 dni vopred</option>
          <option value={5}>5 dní vopred</option>
          <option value={7}>7 dní vopred</option>
          <option value={14}>14 dní vopred</option>
        </select>
        <label>Zobraziť</label>
        <select value={dir} onChange={e => setDir(e.target.value)}>
          <option value="all">Všetko</option>
          <option value="payable">Záväzky (došlé)</option>
          <option value="receivable">Pohľadávky (vyšlé)</option>
        </select>
        {perm === 'denied' && <span style={{ color: '#c0392b', fontSize: 12 }}>Notifikácie sú v prehliadači zablokované.</span>}
      </div>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', margin: '8px 0 12px', fontSize: 13 }}>
        <span>⚠ Záväzky po splatnosti: <b style={{ color: SEV_COLOR['kritická'] }}>{summary.payableOverdue}</b></span>
        <span>Záväzky pred splatnosťou: <b>{summary.payableUpcoming}</b></span>
        <span>Pohľadávky po splatnosti: <b style={{ color: SEV_COLOR['vysoká'] }}>{summary.receivableOverdue}</b></span>
        <span>Pohľadávky pred splatnosťou: <b>{summary.receivableUpcoming}</b></span>
      </div>

      <div className="grid-wrap">
        <table className="grid">
          <thead><tr>
            <th>Typ</th><th>Doklad č.</th><th>Partner</th><th>Splatnosť</th>
            <th className="num">Zostáva</th><th>Stav</th><th>Upozornenie</th>
          </tr></thead>
          <tbody>
            {shown.map((a, i) => (
              <tr key={i} onDoubleClick={() => nav(`/faktury/${a.direction === 'payable' ? 'INI' : 'INO'}/${a.invoiceId}`)} style={{ cursor: 'pointer' }}>
                <td>{DIR_LABEL[a.direction]}</td>
                <td>{a.number}</td>
                <td>{a.partnerName}</td>
                <td>{dt(a.dueDate)}</td>
                <td className="num">{eur(a.remaining)}</td>
                <td><span style={{ color: SEV_COLOR[a.severity], fontWeight: 600 }}>
                  {a.kind === 'overdue' ? `${a.overdueDays} dní po splatnosti` : `o ${a.daysToDue} dní`}
                </span></td>
                <td style={{ fontSize: 12 }}>{a.message}</td>
              </tr>
            ))}
            {!shown.length && <tr><td colSpan={7} style={{ textAlign: 'center', color: '#999' }}>Žiadne pripomienky 🎉</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="grid-foot">{shown.length} upozornení • dvojklik = otvoriť faktúru</div>
    </>
  );
}
