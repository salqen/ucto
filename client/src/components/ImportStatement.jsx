import React, { useEffect, useMemo, useState } from 'react';
import { api, eur, dt } from '../api.js';
import { Modal, Frow } from './ui.jsx';
import { parseCamt053, invoiceRemaining } from '../integrations/bankmatch.js';

/* ================= parsovanie výpisu ================= */

/* CSV parser (úvodzovky, ; alebo , alebo tab) */
function parseCSV(text) {
  const head = text.split(/\r?\n/, 1)[0] || '';
  const delim = [';', '\t', ','].map(d => [d, head.split(d).length]).sort((a, b) => b[1] - a[1])[0][0];
  const rows = [];
  let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === delim) { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some(x => x.trim() !== '')) rows.push(row);
      row = [];
    } else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); if (row.some(x => x.trim() !== '')) rows.push(row); }
  return rows;
}

const parseAmount = s => {
  const v = String(s || '').replace(/\s| |EUR|€/gi, '').replace(',', '.');
  return Number(v) || 0;
};
const parseDate = s => {
  const t = String(s || '').trim();
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);            // ISO
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = t.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})/);      // DD.MM.YYYY
  if (m) return `${m[3]}-${String(m[2]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`;
  return '';
};

/* automatické rozpoznanie stĺpcov podľa hlavičky */
function guessMapping(header) {
  const find = (re) => header.findIndex(h => re.test(String(h)));
  return {
    date: find(/d[áa]tum|date|valut|za[úu][čc]t/i),
    amount: find(/suma|amount|[čc]iastka|obrat|value/i),
    vs: find(/variab|(^|\W)vs(\W|$)|symbol/i),
    iban: find(/iban|proti[úu][čc]et|[úu][čc]et\s*(partnera|protistrany)|counter/i),
    text: find(/popis|text|spr[áa]va|pozn[áa]m|description|refer|n[áa]zov\s*protistrany/i)
  };
}

/* camt.053 / camt.052 XML (SEPA výpis) — parsuje spoločný modul bankmatch (regex, extrahuje aj SS/KS/IBAN) */
function parseCamt(text) {
  return parseCamt053(text).map(t => ({
    date: t.date,
    amount: Math.abs(t.amount),
    type: t.side === 'debit' ? 'V' : 'P',
    vs: t.vs || '',
    iban: (t.counterpartyIban || '').replace(/\s/g, ''),
    text: (t.counterpartyName || t.ref || 'Import výpisu').trim().slice(0, 120)
  })).filter(r => r.amount > 0);
}

/* farba podľa istoty párovania */
const CONF_COLOR = { 'vysoká': '#5f9622', 'stredná': '#d4a012', 'nízka': '#c0392b' };

/* ================= komponent ================= */
export default function ImportStatement({ accountId, onClose, onDone }) {
  const [step, setStep] = useState('file');     // file | map | preview
  const [err, setErr] = useState('');
  const [csv, setCsv] = useState(null);         // riadky CSV
  const [hasHeader, setHasHeader] = useState(true);
  const [map, setMap] = useState({ date: -1, amount: -1, vs: -1, iban: -1, text: -1 });
  const [rows, setRows] = useState([]);         // normalizované pohyby
  const [invoices, setInvoices] = useState([]);
  const [partners, setPartners] = useState([]);
  const [existing, setExisting] = useState([]);
  const [cats, setCats] = useState({ P: [], V: [] });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get('/invoices').then(setInvoices).catch(() => {});
    api.get('/partners').then(setPartners).catch(() => {});
    api.get('/bankmoves').then(setExisting).catch(() => {});
    api.get('/categories').then(setCats).catch(() => {});
  }, []);

  const readFile = async (file) => {
    if (!file) return;
    setErr('');
    const text = await file.text();
    if (text.trimStart().startsWith('<')) {
      /* XML výpis (camt) */
      try {
        const parsed = parseCamt(text);
        if (!parsed.length) throw new Error('empty');
        prepare(parsed);
      } catch {
        setErr('XML sa nepodarilo spracovať — podporovaný je formát camt.053/052 (SEPA výpis).');
      }
    } else {
      const c = parseCSV(text);
      if (c.length < (hasHeader ? 2 : 1)) { setErr('Súbor neobsahuje žiadne riadky s dátami.'); return; }
      setCsv(c);
      setMap(guessMapping(c[0]));
      setStep('map');
    }
  };

  const applyMapping = () => {
    if (map.date < 0 || map.amount < 0) { setErr('Vyberte aspoň stĺpec s dátumom a sumou.'); return; }
    const data = (hasHeader ? csv.slice(1) : csv).map(r => {
      const amount = parseAmount(r[map.amount]);
      return {
        date: parseDate(r[map.date]),
        amount: Math.abs(amount),
        type: amount < 0 ? 'V' : 'P',
        vs: map.vs >= 0 ? String(r[map.vs] || '').replace(/\D/g, '') : '',
        iban: map.iban >= 0 ? String(r[map.iban] || '').replace(/\s/g, '') : '',
        text: map.text >= 0 ? String(r[map.text] || '').trim().slice(0, 120) : ''
      };
    }).filter(r => r.amount > 0 && r.date);
    if (!data.length) { setErr('Po spracovaní nezostali žiadne platné riadky — skontrolujte priradenie stĺpcov.'); return; }
    prepare(data);
  };

  /* párovanie s faktúrami (VS → suma → IBAN, s úrovňou istoty) + duplicitné pohyby */
  const prepare = (data) => {
    setErr('');
    const remaining = {}; /* zostatok faktúr počas párovania (sekvenčná alokácia) */
    const unpaidList = invoices.filter(i => invoiceRemaining(i) > 0.004);
    for (const i of unpaidList) remaining[i.id] = invoiceRemaining(i);
    const partnerIbanOf = (i) => {
      const p = partners.find(pp => pp.id === i.partnerId);
      return p ? String(p.iban || '').replace(/\s/g, '') : '';
    };
    const stripZeros = v => String(v || '').replace(/^0+/, '');
    const enriched = data.map((r, ix) => {
      const dir = r.type === 'P' ? 'INO' : 'INI';
      const cands = unpaidList.filter(i => i.type === dir && remaining[i.id] > 0.004);
      const amountFits = (i) => Math.abs(remaining[i.id] - r.amount) < 0.005;
      let inv = null, by = '', confidence = 'žiadna';

      const byVs = r.vs ? cands.filter(i => stripZeros(i.vs) === stripZeros(r.vs)) : [];
      if (byVs.length === 1) {
        inv = byVs[0];
        confidence = amountFits(inv) ? 'vysoká' : 'stredná';
        by = amountFits(inv) ? 'VS + suma' : 'VS (suma sa líši)';
      } else if (byVs.length > 1) {
        const exact = byVs.find(amountFits);
        inv = exact || byVs[0];
        confidence = exact ? 'vysoká' : 'nízka';
        by = exact ? 'VS + suma' : 'viac faktúr s rovnakým VS';
      } else {
        const bySum = cands.filter(amountFits);
        if (bySum.length === 1) { inv = bySum[0]; confidence = 'stredná'; by = 'zhoda sumy'; }
        else if (bySum.length > 1 && r.iban) {
          const ibanHit = bySum.filter(i => partnerIbanOf(i) && partnerIbanOf(i) === r.iban);
          if (ibanHit.length === 1) { inv = ibanHit[0]; confidence = 'stredná'; by = 'suma + IBAN'; }
        }
      }
      if (inv) remaining[inv.id] = Math.max(0, remaining[inv.id] - r.amount);
      const partner = r.iban ? partners.find(p => String(p.iban || '').replace(/\s/g, '') === r.iban) : null;
      const dup = existing.some(b => b.date === r.date && Math.abs(Number(b.amount) - r.amount) < 0.005
        && (r.vs ? String(b.vs || '') === r.vs : (b.text || '') === r.text));
      return {
        ...r, key: ix,
        invoiceId: inv ? inv.id : null, invoiceNo: inv ? inv.number : '', matchBy: by, confidence,
        partnerId: partner ? partner.id : null,
        category: r.type === 'P' ? 'OP' : 'OV',
        dup, checked: !dup
      };
    });
    setRows(enriched);
    setStep('preview');
  };

  const setRow = (key, patch) => setRows(rs => rs.map(r => r.key === key ? { ...r, ...patch } : r));

  const doImport = async () => {
    const sel = rows.filter(r => r.checked);
    if (!sel.length) { setErr('Nie je vybraný žiadny pohyb.'); return; }
    setBusy(true); setErr('');
    try {
      const r = await api.post('/bankmoves/import', {
        accountId,
        moves: sel.map(m => ({
          date: m.date, amount: m.amount, type: m.type, vs: m.vs, text: m.text,
          invoiceId: m.invoiceId || undefined, partnerId: m.partnerId || undefined,
          category: m.invoiceId ? undefined : m.category
        }))
      });
      alert(`Import hotový: ${r.created} pohybov, z toho ${r.paired} spárovaných s faktúrami.`);
      onDone();
    } catch (ex) { setErr(ex.message); } finally { setBusy(false); }
  };

  const selCount = rows.filter(r => r.checked).length;
  const pairCount = rows.filter(r => r.checked && r.invoiceId).length;
  const confCounts = rows.reduce((a, r) => { if (r.checked && r.invoiceId) a[r.confidence] = (a[r.confidence] || 0) + 1; return a; }, {});
  const COLS = csv ? csv[0].map((h, i) => ({ i, label: (hasHeader ? h : 'Stĺpec ' + (i + 1)) || ('Stĺpec ' + (i + 1)) })) : [];
  const colSel = (k) => (
    <select value={map[k]} onChange={e => setMap(p => ({ ...p, [k]: Number(e.target.value) }))}>
      <option value={-1}>—</option>
      {COLS.map(c => <option key={c.i} value={c.i}>{c.label}</option>)}
    </select>
  );

  return (
    <Modal wide title="Import výpisu z účtu" onClose={onClose}>
      {step === 'file' && (
        <div>
          <Frow label="Súbor s výpisom">
            <input type="file" accept=".csv,.txt,.xml,.camt" onChange={e => readFile(e.target.files[0])} />
          </Frow>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 0', fontSize: 12 }}>
            <input type="checkbox" checked={hasHeader} onChange={e => setHasHeader(e.target.checked)} />
            prvý riadok CSV je hlavička
          </label>
          <div className="hint">
            Podporované formáty: CSV export z internetbankingu (stĺpce si priradíte) a XML camt.053/052 (SEPA výpis).
            Príjmy sa párujú s vyšlými faktúrami, výdaje s došlými — podľa VS, potom podľa presnej sumy.
          </div>
        </div>
      )}

      {step === 'map' && csv && (
        <div>
          <div className="hint">Priraďte stĺpce CSV súboru (rozpoznané automaticky, skontrolujte):</div>
          <div className="form-grid">
            <div>
              <Frow label="Dátum *">{colSel('date')}</Frow>
              <Frow label="Suma * (záporná = výdaj)">{colSel('amount')}</Frow>
              <Frow label="Variabilný symbol">{colSel('vs')}</Frow>
            </div>
            <div>
              <Frow label="IBAN protistrany">{colSel('iban')}</Frow>
              <Frow label="Popis / správa">{colSel('text')}</Frow>
            </div>
          </div>
          <div style={{ margin: '10px 0', overflowX: 'auto' }}>
            <table className="grid"><tbody>
              {(hasHeader ? csv.slice(1, 4) : csv.slice(0, 3)).map((r, i) => (
                <tr key={i} style={{ cursor: 'default' }}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>
              ))}
            </tbody></table>
          </div>
          <div className="form-actions">
            <button className="btn" onClick={() => { setStep('file'); setCsv(null); }}>← Späť</button>
            <button className="btn primary" onClick={applyMapping}>Pokračovať →</button>
          </div>
        </div>
      )}

      {step === 'preview' && (
        <div>
          <div style={{ marginBottom: 8, fontSize: 12 }}>
            {rows.length} pohybov • vybraných <b>{selCount}</b> • spárovaných s faktúrami <b style={{ color: '#5f9622' }}>{pairCount}</b>
            {pairCount > 0 && (
              <span className="hint" style={{ margin: '0 0 0 4px' }}>
                (istota: <span style={{ color: CONF_COLOR['vysoká'] }}>● vysoká {confCounts['vysoká'] || 0}</span>,{' '}
                <span style={{ color: CONF_COLOR['stredná'] }}>● stredná {confCounts['stredná'] || 0}</span>,{' '}
                <span style={{ color: CONF_COLOR['nízka'] }}>● nízka {confCounts['nízka'] || 0}</span> — skontrolujte)
              </span>
            )}
            {rows.some(r => r.dup) && <span style={{ color: '#c0392b' }}> • šedé riadky vyzerajú ako už zaúčtované (duplicita)</span>}
          </div>
          <div style={{ maxHeight: '48vh', overflow: 'auto', border: '1px solid #ddd' }}>
            <table className="grid">
              <thead><tr>
                <th></th><th>Dátum</th><th>Text</th><th>VS</th>
                <th className="num">Suma</th><th>Faktúra / druh</th>
              </tr></thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.key} style={{ cursor: 'default', opacity: r.dup && !r.checked ? .55 : 1 }}>
                    <td><input type="checkbox" checked={r.checked} onChange={e => setRow(r.key, { checked: e.target.checked })} /></td>
                    <td>{dt(r.date)}</td>
                    <td style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.text}>{r.text}</td>
                    <td>{r.vs}</td>
                    <td className="num" style={{ color: r.type === 'P' ? '#5f9622' : '#c0392b' }}>
                      {r.type === 'P' ? '+' : '−'}{eur(r.amount)}
                    </td>
                    <td>
                      {r.invoiceId ? (
                        <span>
                          <span title={'Istota párovania: ' + (r.confidence || '')} style={{ color: CONF_COLOR[r.confidence] || '#888' }}>●</span>{' '}
                          <b>{r.invoiceNo}</b> <span className="hint" style={{ margin: 0 }}>(podľa {r.matchBy})</span>{' '}
                          <a style={{ color: '#c0392b', cursor: 'pointer' }} onClick={() => setRow(r.key, { invoiceId: null, invoiceNo: '', matchBy: '', confidence: 'žiadna' })}>✕</a>
                        </span>
                      ) : (
                        <select value={r.category} onChange={e => setRow(r.key, { category: e.target.value })}>
                          {(cats[r.type] || []).map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                        </select>
                      )}
                      {r.dup && <div style={{ color: '#c0392b', fontSize: 10 }}>možná duplicita</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="form-actions">
            <button className="btn" onClick={() => setStep('file')}>← Iný súbor</button>
            <button className="btn primary" disabled={busy || !selCount} onClick={doImport}>
              💾 Importovať {selCount} pohybov{pairCount ? ` (uhradí ${pairCount} faktúr)` : ''}
            </button>
          </div>
        </div>
      )}

      {err && <div className="login-err">⚠ {err}</div>}
    </Modal>
  );
}
