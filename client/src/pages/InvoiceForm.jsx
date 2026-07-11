import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api, eur, dt, today } from '../api.js';
import { Section, Frow, PageHead } from '../components/ui.jsx';

const emptyItem = () => ({ name: '', qty: 1, unit: 'ks', price: 0, vat: 23 });

export default function InvoiceForm() {
  const { type: typeParam, id } = useParams();
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const isNew = !id || id === 'nova';
  const [partners, setPartners] = useState([]);
  const [settings, setSettings] = useState(null);
  const [inv, setInv] = useState({
    type: typeParam === 'INI' ? 'INI' : 'INO',
    number: '', vs: '', partnerId: '', currency: 'EUR',
    issueDate: today(), deliveryDate: today(),
    dueDate: new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10),
    items: [emptyItem()], note: '', paid: 0
  });
  const [showPrint, setShowPrint] = useState(false);
  const isOut = inv.type === 'INO';

  useEffect(() => {
    api.get('/partners').then(setPartners);
    api.get('/settings').then(setSettings);
    if (!isNew) {
      api.get('/invoices').then(list => {
        const found = list.find(r => r.id === Number(id));
        if (found) {
          setInv({ ...found, items: found.items?.length ? found.items : [emptyItem()] });
          if (sp.get('print')) setShowPrint(true);
        }
      });
    }
  }, [id]);

  const set = (k, v) => setInv(p => ({ ...p, [k]: v }));
  const setItem = (i, k, v) => setInv(p => {
    const items = p.items.map((it, ix) => ix === i ? { ...it, [k]: v } : it);
    return { ...p, items };
  });
  const totals = useMemo(() => {
    let base = 0, vat = 0;
    for (const it of inv.items) {
      const b = (Number(it.qty) || 0) * (Number(it.price) || 0);
      base += b; vat += b * (Number(it.vat) || 0) / 100;
    }
    return { base, vat, total: base + vat };
  }, [inv.items]);

  const save = async () => {
    if (!inv.partnerId) return alert('Vyberte partnera.');
    const body = { ...inv, partnerId: Number(inv.partnerId), items: inv.items.filter(i => i.name) };
    const saved = isNew ? await api.post('/invoices', body) : await api.put('/invoices/' + id, body);
    nav('/faktury/' + (inv.type === 'INI' ? 'dosle' : 'vysle'));
    return saved;
  };

  const partner = partners.find(p => p.id === Number(inv.partnerId));

  if (showPrint && settings) {
    const co = settings.company;
    const sup = isOut ? co : partner;
    const cust = isOut ? partner : co;
    return (
      <div style={{ maxWidth: 800, margin: '0 auto', padding: 20, fontSize: 13 }}>
        <div className="toolbar no-print">
          <button className="btn primary" onClick={() => window.print()}>🖨 Tlačiť</button>
          <button className="btn" onClick={() => setShowPrint(false)}>← Späť na formulár</button>
        </div>
        <h1 style={{ fontSize: 24, margin: '10px 0' }}>FAKTÚRA {inv.number}</h1>
        <div style={{ display: 'flex', gap: 40, margin: '20px 0' }}>
          <div style={{ flex: 1 }}>
            <b style={{ color: '#76b82a' }}>DODÁVATEĽ</b>
            <div><b>{sup?.name}</b></div>
            <div>{sup?.street}</div>
            <div>{sup?.zip} {sup?.city}</div>
            <div>IČO: {sup?.ico} &nbsp; DIČ: {sup?.dic}</div>
            {sup?.icdph && <div>IČ DPH: {sup.icdph}</div>}
            {sup?.iban && <div>IBAN: {sup.iban}</div>}
          </div>
          <div style={{ flex: 1 }}>
            <b style={{ color: '#76b82a' }}>ODBERATEĽ</b>
            <div><b>{cust?.name}</b></div>
            <div>{cust?.street}</div>
            <div>{cust?.zip} {cust?.city}</div>
            <div>IČO: {cust?.ico} &nbsp; DIČ: {cust?.dic}</div>
            {cust?.icdph && <div>IČ DPH: {cust.icdph}</div>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 40, marginBottom: 16 }}>
          <span>Dátum vystavenia: <b>{dt(inv.issueDate)}</b></span>
          <span>Dátum dodania: <b>{dt(inv.deliveryDate)}</b></span>
          <span>Splatnosť: <b>{dt(inv.dueDate)}</b></span>
          <span>VS: <b>{inv.vs}</b></span>
        </div>
        <table className="grid">
          <thead><tr><th>Položka</th><th className="num">Množstvo</th><th>MJ</th><th className="num">Cena/MJ</th><th className="num">DPH %</th><th className="num">Spolu</th></tr></thead>
          <tbody>
            {inv.items.filter(i => i.name).map((it, i) => (
              <tr key={i}>
                <td>{it.name}</td><td className="num">{it.qty}</td><td>{it.unit}</td>
                <td className="num">{eur(it.price)}</td><td className="num">{it.vat}</td>
                <td className="num">{eur(it.qty * it.price * (1 + it.vat / 100))}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ textAlign: 'right', marginTop: 14 }}>
          <div>Základ dane: <b>{eur(totals.base)}</b></div>
          <div>DPH: <b>{eur(totals.vat)}</b></div>
          <div style={{ fontSize: 20, marginTop: 6 }}>Spolu na úhradu: <b style={{ color: '#5f9622' }}>{eur(totals.total)}</b></div>
        </div>
        {inv.note && <p style={{ marginTop: 16 }}>Poznámka: {inv.note}</p>}
      </div>
    );
  }

  return (
    <>
      <PageHead title={isOut ? 'Vyšlá faktúra' : 'Došlá faktúra'}>
        <button className="btn" onClick={() => nav(`/faktury/${inv.type}/nova`)}>🗎 Nová faktúra</button>
        <button className="btn" onClick={() => nav('/faktury/' + (isOut ? 'vysle' : 'dosle'))}>Zoznam</button>
      </PageHead>
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0 10px' }}>
        <span>Variabilný symbol č. <b style={{ color: '#76b82a', fontSize: 15 }}>{inv.vs || '(pridelí sa automaticky)'}</b></span>
        <span>Spolu: <b style={{ color: '#f39200', fontSize: 15 }}>{eur(totals.total)}</b></span>
      </div>

      <Section title="Hlavička faktúry">
        <div className="hint">* - povinný údaj</div>
        <div className="form-grid">
          <div>
            <Frow label="Typ" req>
              <select value={inv.type} onChange={e => set('type', e.target.value)} disabled={!isNew}>
                <option value="INO">Vyšlá faktúra</option>
                <option value="INI">Došlá faktúra</option>
              </select>
            </Frow>
            <Frow label="Doklad č.">
              <input value={inv.number} onChange={e => set('number', e.target.value)} placeholder="automaticky" readOnly={!isNew} />
            </Frow>
            <Frow label="VS">
              <input value={inv.vs} onChange={e => set('vs', e.target.value)} placeholder="automaticky" />
            </Frow>
            <Frow label="Dátum vystavenia" req><input type="date" value={inv.issueDate} onChange={e => set('issueDate', e.target.value)} /></Frow>
            <Frow label="Dátum dodania"><input type="date" value={inv.deliveryDate} onChange={e => set('deliveryDate', e.target.value)} /></Frow>
            <Frow label="Dátum splatnosti" req><input type="date" value={inv.dueDate} onChange={e => set('dueDate', e.target.value)} /></Frow>
            <Frow label="Mena" req>
              <select value={inv.currency} onChange={e => set('currency', e.target.value)}>
                <option>EUR</option><option>CZK</option><option>USD</option>
              </select>
            </Frow>
          </div>
          <div>
            <Frow label="Partner" req>
              <select value={inv.partnerId} onChange={e => set('partnerId', e.target.value)}>
                <option value="">Vyberte z možností</option>
                {partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Frow>
            {partner && (
              <div style={{ padding: '8px 0', color: '#666', fontSize: 12 }}>
                {partner.street}, {partner.zip} {partner.city}<br />
                IČO: {partner.ico} • DIČ: {partner.dic} {partner.icdph && <>• IČ DPH: {partner.icdph}</>}
              </div>
            )}
          </div>
        </div>
      </Section>

      <Section title="Položky faktúry">
        <table className="grid items-table">
          <thead>
            <tr><th style={{ width: '40%' }}>Názov položky</th><th>Množstvo</th><th>MJ</th><th>Cena/MJ bez DPH</th><th>DPH %</th><th className="num">Spolu s DPH</th><th></th></tr>
          </thead>
          <tbody>
            {inv.items.map((it, i) => (
              <tr key={i} style={{ cursor: 'default' }}>
                <td><input value={it.name} onChange={e => setItem(i, 'name', e.target.value)} placeholder="popis položky" /></td>
                <td><input type="number" step="0.01" value={it.qty} onChange={e => setItem(i, 'qty', Number(e.target.value))} /></td>
                <td><input value={it.unit} onChange={e => setItem(i, 'unit', e.target.value)} style={{ width: 50 }} /></td>
                <td><input type="number" step="0.01" value={it.price} onChange={e => setItem(i, 'price', Number(e.target.value))} /></td>
                <td>
                  <select value={it.vat} onChange={e => setItem(i, 'vat', Number(e.target.value))}>
                    <option value={23}>23</option><option value={19}>19</option><option value={5}>5</option><option value={0}>0</option>
                  </select>
                </td>
                <td className="num">{eur((it.qty || 0) * (it.price || 0) * (1 + (it.vat || 0) / 100))}</td>
                <td className="no-print">
                  <button className="btn danger" style={{ padding: '3px 8px' }} type="button"
                    onClick={() => setInv(p => ({ ...p, items: p.items.filter((_, ix) => ix !== i) }))}>✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ marginTop: 8 }}>
          <button className="btn" type="button" onClick={() => setInv(p => ({ ...p, items: [...p.items, emptyItem()] }))}>+ Pridať položku</button>
        </div>
        <div className="sum-line">
          Základ: {eur(totals.base)} &nbsp; DPH: {eur(totals.vat)} &nbsp; Spolu: <b>{eur(totals.total)}</b>
        </div>
      </Section>

      <Section title="Finančné údaje" open={false}>
        <Frow label="Uhradené (€)"><input type="number" step="0.01" value={inv.paid || 0} readOnly /></Frow>
        <Frow label="Zostáva uhradiť (€)"><input value={(totals.total - (inv.paid || 0)).toFixed(2)} readOnly /></Frow>
      </Section>

      <Section title="Informačné údaje" open={false}>
        <Frow label="Poznámka"><textarea rows={3} value={inv.note} onChange={e => set('note', e.target.value)} /></Frow>
      </Section>

      <div className="form-actions">
        <button className="btn" onClick={() => nav(-1)}>← Späť</button>
        <button className="btn primary" onClick={save}>💾 Ulož</button>
        <button className="btn" onClick={() => { if (inv.partnerId) setShowPrint(true); else alert('Vyberte partnera.'); }}>🗎 Zobraz celý dokument</button>
      </div>
    </>
  );
}
