import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api, eur, dt, today } from '../api.js';
import { Section, Frow, PageHead } from '../components/ui.jsx';
import { qrDataUrl } from '../integrations/paybysquare.js';

const emptyItem = () => ({ code: '', name: '', qty: 1, unit: 'ks', price: 0, vat: 23 });
/* formát čísel v tlačovej podobe (ako keepi): množstvo a JC na 5 des. miest */
const num5 = n => (Number(n) || 0).toLocaleString('sk-SK', { minimumFractionDigits: 5, maximumFractionDigits: 5 });
const num2 = n => (Number(n) || 0).toLocaleString('sk-SK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function InvoiceForm() {
  const { type: typeParam, id } = useParams();
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const isNew = !id || id === 'nova';
  const [partners, setPartners] = useState([]);
  const [settings, setSettings] = useState(null);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [inv, setInv] = useState({
    type: typeParam === 'INI' ? 'INI' : 'INO',
    number: '', vs: '', partnerId: '', currency: 'EUR',
    issueDate: today(), deliveryDate: today(),
    dueDate: new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10),
    ks: '308', paymentMethod: 'Prevodný príkaz', deliveryMethod: 'Osobne',
    orderNo: '', deliveryAddress: '', bankAccountId: '',
    items: [emptyItem()], note: '', paid: 0
  });
  const [showPrint, setShowPrint] = useState(false);
  const isOut = inv.type === 'INO';

  /* predvyplnenie z naskenovaného QR (PAY by square) / EAN kódu */
  const [scanData, setScanData] = useState(null);
  useEffect(() => {
    if (!isNew || !sp.get('scan')) return;
    try {
      const d = JSON.parse(sessionStorage.getItem('scanInvoice') || 'null');
      if (!d) return;
      sessionStorage.removeItem('scanInvoice');
      setScanData(d);
      setInv(p => ({
        ...p,
        type: 'INI',
        vs: d.vs || p.vs,
        ks: d.ks || p.ks,
        dueDate: d.dueDate || p.dueDate,
        currency: d.currency || p.currency,
        note: d.iban ? ('IBAN dodávateľa: ' + d.iban) : p.note,
        items: d.amount
          ? [{ code: '', name: d.note || 'Fakturovaná suma', qty: 1, unit: 'ks', price: d.amount, vat: 0 }]
          : p.items
      }));
    } catch {}
  }, []);
  /* po načítaní partnerov skús spárovať dodávateľa podľa IBAN alebo názvu */
  useEffect(() => {
    if (!scanData || !partners.length || inv.partnerId) return;
    const norm = s => String(s || '').replace(/\s/g, '').toLowerCase();
    const found = partners.find(p =>
      (scanData.iban && norm(p.iban) === norm(scanData.iban)) ||
      (scanData.partnerName && norm(p.name) === norm(scanData.partnerName))
    );
    if (found) setInv(p => ({ ...p, partnerId: String(found.id) }));
  }, [partners, scanData]);

  useEffect(() => {
    api.get('/partners').then(setPartners);
    api.get('/settings').then(setSettings);
    api.get('/bankaccounts').then(setBankAccounts).catch(() => {});
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

  /* platobný QR kód (PAY by square) na vyšlej faktúre — cez integračný modul (validácia IBAN + varovania) */
  const [qrUrl, setQrUrl] = useState('');
  useEffect(() => {
    if (!showPrint || !isOut || !settings) { setQrUrl(''); return; }
    const bank = bankAccounts.find(a => a.id === Number(inv.bankAccountId)) || bankAccounts[0];
    const amount = Math.round(totals.total * 100) / 100;
    const company = { name: settings.company?.name || '', iban: bank?.iban || '' };
    let cancelled = false;
    qrDataUrl(inv, company, { amount })
      .then(res => { if (!cancelled) setQrUrl(res.dataUrl); })
      .catch(() => { if (!cancelled) setQrUrl(''); });
    return () => { cancelled = true; };
  }, [showPrint, isOut, settings, bankAccounts, inv.bankAccountId, inv.number, inv.vs, inv.ks, inv.dueDate, inv.currency, totals.total]);

  if (showPrint && settings) {
    const co = settings.company;
    const sup = isOut ? co : partner;
    const cust = isOut ? partner : co;
    const vatPayer = isOut ? !!co.vatPayer : true; /* pri došlej faktúre nevieme, zobrazíme DPH */
    const bank = bankAccounts.find(a => a.id === Number(inv.bankAccountId)) || bankAccounts[0] || {};
    const rounding = Math.round(totals.total * 100) / 100 - totals.total;
    const KV = ({ k, children, plain }) => (
      <div className="kvrow"><span className="k">{k}</span><span className={'v' + (plain ? ' plain' : '')}>{children}</span></div>
    );
    return (
      <div className="inv-print">
        <div className="toolbar no-print">
          <button className="btn primary" onClick={() => window.print()}>🖨 Tlačiť</button>
          <button className="btn" onClick={() => setShowPrint(false)}>← Späť na formulár</button>
        </div>

        <div className="inv-head">
          <span className="t">Faktúra</span>
          <span className="n">číslo {inv.number}</span>
        </div>

        <div className="inv-box">
          {/* dodávateľ / odberateľ */}
          <div className="inv-row">
            <div className="inv-cell">
              <h4>Dodávateľ:</h4>
              <div className="co-name">{sup?.name}</div>
              <div>{sup?.street}</div>
              <div>{sup?.zip} {sup?.city}</div>
              <div>{sup?.country || 'Slovenská republika'}</div>
              <div style={{ height: 8 }} />
              <KV k="IČO:" plain>{sup?.ico}</KV>
              <KV k="DIČ:" plain>{sup?.dic}</KV>
              <KV k="IČ DPH:" plain>{isOut && !co.vatPayer ? 'Firma nie je platiteľom DPH' : (sup?.icdph || '')}</KV>
              {isOut && co.register && <div style={{ marginTop: 6 }}>{co.register}</div>}
            </div>
            <div className="inv-cell">
              <h4>Odberateľ:</h4>
              <div className="co-name">{cust?.name}</div>
              <div>{cust?.street}</div>
              <div>{cust?.zip} {cust?.city}</div>
              <div>{cust?.country || ''}</div>
              <div style={{ height: 8 }} />
              <KV k="IČO:" plain>{cust?.ico}</KV>
              <KV k="DIČ:" plain>{cust?.dic}</KV>
              <KV k="IČ DPH:" plain>{cust?.icdph || ''}</KV>
            </div>
          </div>
          {/* fakturačné údaje / adresa dodania */}
          <div className="inv-row">
            <div className="inv-cell">
              <h4>Fakturačné údaje:</h4>
              <KV k="Konštantný symbol:">{inv.ks}</KV>
              <KV k="Variabilný symbol:">{inv.vs}</KV>
              <KV k="Forma úhrady:">{inv.paymentMethod}</KV>
              <KV k="Spôsob dodania:">{inv.deliveryMethod}</KV>
              {inv.orderNo && <KV k="Objednávka č.:">{inv.orderNo}</KV>}
            </div>
            <div className="inv-cell">
              <h4>Adresa dodania:</h4>
              {(inv.deliveryAddress || '').split('\n').map((l, i) => <div key={i}>{l}</div>)}
            </div>
          </div>
          {/* banka / dátumy */}
          <div className="inv-row">
            <div className="inv-cell">
              <div>{bank.bank || ''}</div>
              <KV k="Číslo bankového účtu:">{bank.number || ''}</KV>
              <KV k="SWIFT:">{bank.swift || ''}</KV>
              <KV k="IBAN:">{bank.iban || ''}</KV>
            </div>
            <div className="inv-cell">
              <KV k="Dátum vystavenia:">{dt(inv.issueDate)}</KV>
              <KV k="Dátum dodania:">{dt(inv.deliveryDate)}</KV>
              <KV k="Dátum splatnosti:">{dt(inv.dueDate)}</KV>
            </div>
          </div>
        </div>

        <div style={{ padding: '6px 4px 2px' }}>Faktúrujeme Vám</div>
        <table className="inv-items">
          <thead>
            <tr>
              <th style={{ width: 55 }}>Kód<br />položky</th>
              <th>Názov položky</th>
              <th className="num">Množstvo</th>
              <th style={{ textAlign: 'center', width: 45 }}>MJ</th>
              <th className="num">JC</th>
              {vatPayer && <th className="num">DPH %</th>}
              <th className="num">Cena celkom</th>
            </tr>
          </thead>
          <tbody>
            {inv.items.filter(i => i.name).map((it, i) => (
              <tr key={i}>
                <td>{it.code}</td>
                <td>{it.name}</td>
                <td className="num">{num5(it.qty)}</td>
                <td style={{ textAlign: 'center' }}>{(it.unit || '').toUpperCase()}</td>
                <td className="num">{num5(it.price)}</td>
                {vatPayer && <td className="num">{it.vat}</td>}
                <td className="num">{num2((it.qty || 0) * (it.price || 0) * (1 + (it.vat || 0) / 100))}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="inv-sum">
          <table>
            <tbody>
              {vatPayer && <tr><td>Základ dane:</td><td>{num2(totals.base)} {inv.currency || 'EUR'}</td></tr>}
              {vatPayer && <tr><td>DPH:</td><td>{num2(totals.vat)} {inv.currency || 'EUR'}</td></tr>}
              <tr><td>Zaokrúhlenie:</td><td>{num2(rounding)} {inv.currency || 'EUR'}</td></tr>
              <tr className="total"><td>Celkom k úhrade:</td><td>{num2(totals.total)} {inv.currency || 'EUR'}</td></tr>
            </tbody>
          </table>
        </div>

        <div className="inv-note">
          {inv.note
            ? inv.note
            : (isOut && !co.vatPayer ? 'Dodávateľ nie je platiteľom DPH. Číslo faktúry uvádzajte ako VS. Ďakujeme' : '')}
        </div>

        {qrUrl && (
          <div className="inv-qr">
            <img src={qrUrl} alt="PAY by square" />
            <div className="inv-qr-label">PAY by square<br />Naskenujte v aplikácii svojej banky</div>
          </div>
        )}

        <div className="inv-footer">
          <span>Vystavil: {co.owner || co.name}</span>
          <span>Telefón: {co.phone}</span>
          <span>E-mail : {co.email}</span>
        </div>
        <div className="inv-created">
          <span>Vytvorené cez účtoERP</span>
          <span>Strana 1 z 1</span>
        </div>
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
        <span>Variabilný symbol č. <b style={{ color: 'var(--accent)', fontSize: 15 }}>{inv.vs || '(pridelí sa automaticky)'}</b></span>
        <span>Spolu: <b style={{ color: '#f39200', fontSize: 15 }}>{eur(totals.total)}</b></span>
      </div>

      {scanData && (
        <div style={{ background: '#eef6e3', border: '1px solid #b6d98a', padding: '8px 12px', marginBottom: 10, fontSize: 12 }}>
          📷 Údaje načítané z {scanData.kind === 'qr' ? 'QR kódu (PAY by square)' : 'čiarového kódu (EAN)'}.
          {scanData.partnerName && !inv.partnerId && <> Dodávateľ „{scanData.partnerName}" sa nenašiel v partneroch — vyberte ho alebo ho najprv vytvorte v Partneroch.</>}
        </div>
      )}
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
            <Frow label="Konštantný symbol"><input value={inv.ks || ''} onChange={e => set('ks', e.target.value)} /></Frow>
            <Frow label="Forma úhrady">
              <select value={inv.paymentMethod || 'Prevodný príkaz'} onChange={e => set('paymentMethod', e.target.value)}>
                <option>Prevodný príkaz</option><option>Hotovosť</option><option>Dobierka</option><option>Platobná karta</option><option>Zápočet</option>
              </select>
            </Frow>
            <Frow label="Spôsob dodania">
              <select value={inv.deliveryMethod || 'Osobne'} onChange={e => set('deliveryMethod', e.target.value)}>
                <option>Osobne</option><option>Poštou</option><option>Kuriérom</option><option>E-mailom</option>
              </select>
            </Frow>
            <Frow label="Objednávka č."><input value={inv.orderNo || ''} onChange={e => set('orderNo', e.target.value)} /></Frow>
            <Frow label="Bankový účet">
              <select value={inv.bankAccountId || ''} onChange={e => set('bankAccountId', e.target.value)}>
                {bankAccounts.map(a => <option key={a.id} value={a.id}>{a.name}{a.iban ? ' – ' + a.iban : ''}</option>)}
                {!bankAccounts.length && <option value="">(žiadny účet – pridajte v Nastaveniach)</option>}
              </select>
            </Frow>
            <Frow label="Adresa dodania">
              <textarea rows={3} value={inv.deliveryAddress || ''} placeholder="ak sa líši od adresy odberateľa"
                onChange={e => set('deliveryAddress', e.target.value)} />
            </Frow>
          </div>
        </div>
      </Section>

      <Section title="Položky faktúry">
        <table className="grid items-table">
          <thead>
            <tr><th style={{ width: 70 }}>Kód</th><th style={{ width: '36%' }}>Názov položky</th><th>Množstvo</th><th>MJ</th><th>Cena/MJ bez DPH</th><th>DPH %</th><th className="num">Spolu s DPH</th><th></th></tr>
          </thead>
          <tbody>
            {inv.items.map((it, i) => (
              <tr key={i} style={{ cursor: 'default' }}>
                <td><input value={it.code || ''} onChange={e => setItem(i, 'code', e.target.value)} /></td>
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
