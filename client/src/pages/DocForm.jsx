import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, eur, dt, today } from '../api.js';
import { Section, Frow, PageHead } from '../components/ui.jsx';
import PartnerCombo from '../components/PartnerCombo.jsx';
import QuickPartner from '../components/QuickPartner.jsx';

const emptyItem = () => ({ code: '', name: '', qty: 1, unit: 'ks', price: 0, vat: 23 });
const num2 = n => (Number(n) || 0).toLocaleString('sk-SK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* kind: 'quotes' | 'deliverynotes' */
const META = {
  quotes: { coll: 'quotes', title: 'Cenová ponuka', titlePrint: 'CENOVÁ PONUKA', base: '/ponuky' },
  deliverynotes: { coll: 'deliverynotes', title: 'Dodací list', titlePrint: 'DODACÍ LIST', base: '/dodacie-listy' },
};

export default function DocForm({ kind }) {
  const meta = META[kind];
  const { type: typeParam, id } = useParams();
  const nav = useNavigate();
  const isNew = !id || id === 'nova';
  const isOut = typeParam !== 'dosle';
  const [partners, setPartners] = useState([]);
  const [settings, setSettings] = useState(null);
  const [addPartner, setAddPartner] = useState(false);
  const [showPrint, setShowPrint] = useState(false);
  const [busy, setBusy] = useState(false);
  const [doc, setDoc] = useState({
    type: isOut ? 'O' : 'I', number: '', partnerId: '', currency: 'EUR',
    issueDate: today(), deliveryDate: today(),
    validUntil: new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10),
    items: [emptyItem()], note: '', invoiceId: null, invoiceNumber: '',
  });

  useEffect(() => {
    api.get('/partners').then(setPartners);
    api.get('/settings').then(setSettings).catch(() => {});
    if (!isNew) api.get('/' + meta.coll).then(rows => {
      const d = rows.find(r => String(r.id) === String(id));
      if (d) setDoc({ ...d, items: d.items && d.items.length ? d.items : [emptyItem()] });
    });
  }, [id]);

  const set = (k, v) => setDoc(p => ({ ...p, [k]: v }));
  const setItem = (i, k, v) => setDoc(p => ({ ...p, items: p.items.map((it, ix) => ix === i ? { ...it, [k]: v } : it) }));
  const addRow = () => setDoc(p => ({ ...p, items: [...p.items, emptyItem()] }));
  const delRow = (i) => setDoc(p => ({ ...p, items: p.items.filter((_, ix) => ix !== i) }));

  const totals = useMemo(() => {
    let base = 0, vat = 0;
    for (const it of doc.items) { const b = (Number(it.qty) || 0) * (Number(it.price) || 0); base += b; vat += b * (Number(it.vat) || 0) / 100; }
    return { base: Math.round(base * 100) / 100, vat: Math.round(vat * 100) / 100, total: Math.round((base + vat) * 100) / 100 };
  }, [doc.items]);

  const partner = partners.find(p => String(p.id) === String(doc.partnerId));

  const save = async () => {
    setBusy(true);
    try {
      const body = { ...doc, partnerId: doc.partnerId ? Number(doc.partnerId) : null };
      const saved = doc.id ? await api.put('/' + meta.coll + '/' + doc.id, body) : await api.post('/' + meta.coll, body);
      setDoc(d => ({ ...d, ...saved }));
      nav(meta.base + '/' + (isOut ? 'vysle' : 'dosle'));
      return saved;
    } catch (e) { alert(e.message); } finally { setBusy(false); }
  };

  const convert = async () => {
    if (!doc.id) { alert('Najprv doklad uložte.'); return; }
    if (doc.invoiceId) { nav('/faktury/' + (isOut ? 'vysle' : 'dosle')); return; }
    if (!confirm('Vytvoriť faktúru z tohto dokladu?')) return;
    setBusy(true);
    try {
      const inv = await api.post('/' + meta.coll + '/' + doc.id + '/to-invoice', {});
      setDoc(d => ({ ...d, invoiceId: inv.id, invoiceNumber: inv.number }));
      nav('/faktury/' + (inv.type === 'INI' ? 'dosle' : 'vysle') + '/' + inv.id);
    } catch (e) { alert(e.message); setBusy(false); }
  };

  if (showPrint && settings) {
    const co = settings.company;
    const sup = isOut ? co : (partner || {});
    const cust = isOut ? (partner || {}) : co;
    return (
      <div className="print-doc">
        <div className="toolbar no-print">
          <button className="btn" onClick={() => setShowPrint(false)}>← Späť</button>
          <button className="btn primary" onClick={() => window.print()}>🖨 Tlačiť</button>
        </div>
        <div className="inv-paper">
          <h2>{meta.titlePrint} {doc.number}</h2>
          <div style={{ display: 'flex', justifyContent: 'space-between', margin: '12px 0' }}>
            <div><b>Dodávateľ</b><br />{sup.name}<br />{sup.street}<br />{sup.zip} {sup.city}<br />IČO: {sup.ico} {sup.icdph && <>• IČ DPH: {sup.icdph}</>}</div>
            <div><b>Odberateľ</b><br />{cust.name}<br />{cust.street}<br />{cust.zip} {cust.city}<br />IČO: {cust.ico} {cust.icdph && <>• IČ DPH: {cust.icdph}</>}</div>
          </div>
          <div>Dátum vystavenia: {dt(doc.issueDate)}{kind === 'quotes' ? ' • Platnosť do: ' + dt(doc.validUntil) : ' • Dodanie: ' + dt(doc.deliveryDate)}</div>
          <table className="grid" style={{ marginTop: 10 }}>
            <thead><tr><th>Názov</th><th>Množstvo</th><th>MJ</th><th>Cena/MJ</th><th>DPH %</th><th className="num">Spolu s DPH</th></tr></thead>
            <tbody>
              {doc.items.map((it, i) => (
                <tr key={i}><td>{it.name}</td><td>{num2(it.qty)}</td><td>{it.unit}</td><td>{num2(it.price)}</td><td>{it.vat}</td>
                  <td className="num">{eur((it.qty || 0) * (it.price || 0) * (1 + (it.vat || 0) / 100))}</td></tr>
              ))}
            </tbody>
          </table>
          <table style={{ marginTop: 10, marginLeft: 'auto' }}>
            <tbody>
              <tr><td>Základ dane:</td><td className="num">{num2(totals.base)} {doc.currency}</td></tr>
              <tr><td>DPH:</td><td className="num">{num2(totals.vat)} {doc.currency}</td></tr>
              <tr><td><b>Spolu:</b></td><td className="num"><b>{num2(totals.total)} {doc.currency}</b></td></tr>
            </tbody>
          </table>
          {doc.note && <p style={{ marginTop: 10 }}>{doc.note}</p>}
        </div>
      </div>
    );
  }

  return (
    <>
      <PageHead title={(isNew ? 'Nová: ' : '') + meta.title + (isOut ? ' (vyšlá)' : ' (došlá)') + (doc.number ? ' — ' + doc.number : '')}>
        <button className="btn" onClick={() => nav(meta.base + '/' + (isOut ? 'vysle' : 'dosle'))}>← Zoznam</button>
        {!isNew && <button className="btn" onClick={() => setShowPrint(true)}>🖨 Tlač</button>}
        <button className="btn primary" onClick={save} disabled={busy}>💾 Uložiť</button>
      </PageHead>

      {doc.invoiceId && (
        <div style={{ background: '#eefaf0', border: '1px solid #bfe6c8', borderRadius: 8, padding: '8px 12px', margin: '8px 0', fontSize: 13 }}>
          ✓ Prepojené s faktúrou <b>{doc.invoiceNumber}</b>{' '}
          <a style={{ color: '#2a6', cursor: 'pointer' }} onClick={() => nav('/faktury/' + (isOut ? 'vysle' : 'dosle') + '/' + doc.invoiceId)}>otvoriť</a>
        </div>
      )}

      <Section title="Hlavička">
        <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <Frow label="Dátum vystavenia"><input type="date" value={doc.issueDate} onChange={e => set('issueDate', e.target.value)} /></Frow>
            {kind === 'quotes'
              ? <Frow label="Platnosť do"><input type="date" value={doc.validUntil || ''} onChange={e => set('validUntil', e.target.value)} /></Frow>
              : <Frow label="Dátum dodania"><input type="date" value={doc.deliveryDate || ''} onChange={e => set('deliveryDate', e.target.value)} /></Frow>}
            <Frow label="Mena"><select value={doc.currency} onChange={e => set('currency', e.target.value)}><option>EUR</option><option>CZK</option><option>USD</option></select></Frow>
          </div>
          <div>
            <Frow label="Partner" req>
              <div style={{ display: 'flex', gap: 6 }}>
                <PartnerCombo partners={partners} value={doc.partnerId} onChange={pid => set('partnerId', pid)} />
                <button type="button" className="btn" style={{ whiteSpace: 'nowrap' }} onClick={() => setAddPartner(true)}>＋ Nový</button>
              </div>
            </Frow>
            {addPartner && (
              <QuickPartner partners={partners}
                onCreated={pnew => { setPartners(ps => ps.some(x => x.id === pnew.id) ? ps : [...ps, pnew]); set('partnerId', String(pnew.id)); setAddPartner(false); }}
                onClose={() => setAddPartner(false)} />
            )}
            {partner && <div style={{ padding: '8px 0', color: '#666', fontSize: 12 }}>{partner.street}, {partner.zip} {partner.city}<br />IČO: {partner.ico} {partner.icdph && <>• IČ DPH: {partner.icdph}</>}</div>}
            <Frow label="Poznámka"><textarea rows={2} value={doc.note || ''} onChange={e => set('note', e.target.value)} /></Frow>
          </div>
        </div>
      </Section>

      <Section title="Položky">
        <table className="grid items-table">
          <thead><tr><th style={{ width: 70 }}>Kód</th><th style={{ width: '36%' }}>Názov</th><th>Množstvo</th><th>MJ</th><th>Cena/MJ</th><th>DPH %</th><th className="num">Spolu s DPH</th><th></th></tr></thead>
          <tbody>
            {doc.items.map((it, i) => (
              <tr key={i} style={{ cursor: 'default' }}>
                <td><input value={it.code || ''} onChange={e => setItem(i, 'code', e.target.value)} /></td>
                <td><input value={it.name} onChange={e => setItem(i, 'name', e.target.value)} placeholder="popis položky" /></td>
                <td><input type="number" step="0.01" value={it.qty} onChange={e => setItem(i, 'qty', Number(e.target.value))} /></td>
                <td><input value={it.unit} onChange={e => setItem(i, 'unit', e.target.value)} style={{ width: 50 }} /></td>
                <td><input type="number" step="0.01" value={it.price} onChange={e => setItem(i, 'price', Number(e.target.value))} /></td>
                <td><select value={it.vat} onChange={e => setItem(i, 'vat', Number(e.target.value))}><option value={23}>23</option><option value={19}>19</option><option value={5}>5</option><option value={0}>0</option></select></td>
                <td className="num">{eur((it.qty || 0) * (it.price || 0) * (1 + (it.vat || 0) / 100))}</td>
                <td className="no-print"><button className="btn danger" style={{ padding: '3px 8px' }} type="button" onClick={() => delRow(i)}>✕</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <button className="btn" type="button" onClick={addRow} style={{ marginTop: 8 }}>＋ Pridať položku</button>
        <div style={{ marginTop: 12, textAlign: 'right' }}>
          Základ: <b>{num2(totals.base)}</b> • DPH: <b>{num2(totals.vat)}</b> • Spolu s DPH: <b>{num2(totals.total)} {doc.currency}</b>
        </div>
      </Section>

      <div className="toolbar">
        <button className="btn primary" onClick={save} disabled={busy}>💾 Uložiť</button>
        {!isNew && !doc.invoiceId && <button className="btn" onClick={convert} disabled={busy} title="Vytvoriť faktúru z tohto dokladu">🧾 Vytvoriť faktúru</button>}
      </div>
    </>
  );
}
