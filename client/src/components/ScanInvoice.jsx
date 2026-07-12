import React, { useEffect, useRef, useState } from 'react';
import { Modal, Frow } from './ui.jsx';
import { decode as decodeBySquare } from 'bysquare/pay';
import { BrowserMultiFormatReader } from '@zxing/browser';

/* ---------- rozpoznanie obsahu kódu ----------
   - QR "PAY by square" (slovenský štandard na faktúrach) -> IBAN, suma, VS, KS, splatnosť…
   - EAN-8 / EAN-13 / iný číselný čiarový kód -> použije sa ako VS / číslo faktúry */
export function parseScanned(text) {
  const t = String(text || '').trim();
  if (!t) return null;
  /* PAY by square */
  try {
    const data = decodeBySquare(t);
    const p = (data.payments || [])[0] || {};
    const due = p.paymentDueDate ? String(p.paymentDueDate).replace(/^(\d{4})(\d{2})(\d{2})$/, '$1-$2-$3') : '';
    return {
      kind: 'qr',
      vs: p.variableSymbol || '',
      ks: p.constantSymbol || '',
      ss: p.specificSymbol || '',
      amount: Number(p.amount) || 0,
      currency: p.currencyCode || 'EUR',
      dueDate: /^\d{4}-\d{2}-\d{2}$/.test(due) ? due : '',
      note: p.paymentNote || '',
      iban: (p.bankAccounts && p.bankAccounts[0] && p.bankAccounts[0].iban) || '',
      partnerName: (p.beneficiary && p.beneficiary.name) || '',
      invoiceId: data.invoiceId || ''
    };
  } catch { /* nie je PAY by square */ }
  /* EAN / číselný kód */
  if (/^\d{8}$/.test(t) || /^\d{12,14}$/.test(t)) return { kind: 'ean', vs: t };
  if (/^\d{1,10}$/.test(t)) return { kind: 'num', vs: t };
  return { kind: 'text', raw: t };
}

/* ---------- modálne okno skenovania ---------- */
export default function ScanInvoice({ onResult, onClose }) {
  const [tab, setTab] = useState('camera'); // camera | image | code
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const videoRef = useRef(null);
  const controlsRef = useRef(null);

  const finish = (text) => {
    const data = parseScanned(text);
    if (!data || data.kind === 'text') {
      setErr('Kód sa podarilo prečítať, ale nie je to PAY by square QR ani EAN. Obsah: ' + String(text).slice(0, 80));
      return;
    }
    onResult(data);
  };

  /* kamera */
  useEffect(() => {
    if (tab !== 'camera') return;
    setErr('');
    let stopped = false;
    const reader = new BrowserMultiFormatReader();
    reader.decodeFromVideoDevice(undefined, videoRef.current, (result, e, controls) => {
      controlsRef.current = controls;
      if (result && !stopped) {
        stopped = true;
        controls.stop();
        finish(result.getText());
      }
    }).catch(e => setErr('Kamera nie je dostupná: ' + e.message));
    return () => {
      stopped = true;
      try { controlsRef.current && controlsRef.current.stop(); } catch {}
    };
  }, [tab]);

  /* obrázok */
  const scanImage = async (file) => {
    if (!file) return;
    setErr(''); setBusy(true);
    const url = URL.createObjectURL(file);
    try {
      const reader = new BrowserMultiFormatReader();
      const result = await reader.decodeFromImageUrl(url);
      finish(result.getText());
    } catch {
      setErr('V obrázku sa nepodarilo nájsť QR ani čiarový kód. Skúste ostrejší/väčší výrez.');
    } finally {
      URL.revokeObjectURL(url);
      setBusy(false);
    }
  };

  /* ručný vstup / skener (pištoľ píše ako klávesnica + Enter) */
  const submitCode = (e) => {
    e.preventDefault();
    const v = new FormData(e.target).get('code');
    if (v) finish(v);
  };

  return (
    <Modal title="Načítať došlú faktúru (QR / EAN)" onClose={onClose}>
      <div className="tabs" style={{ marginBottom: 12 }}>
        <button type="button" className={tab === 'camera' ? 'active' : ''} onClick={() => setTab('camera')}>📷 Kamera</button>
        <button type="button" className={tab === 'image' ? 'active' : ''} onClick={() => setTab('image')}>🖼 Obrázok</button>
        <button type="button" className={tab === 'code' ? 'active' : ''} onClick={() => setTab('code')}>⌨ Skener / kód</button>
      </div>

      {tab === 'camera' && (
        <div style={{ textAlign: 'center' }}>
          <video ref={videoRef} style={{ width: '100%', maxHeight: 300, background: '#000' }} muted playsInline />
          <div className="hint">Namierte kameru na QR kód (PAY by square) alebo čiarový kód na faktúre.</div>
        </div>
      )}

      {tab === 'image' && (
        <div>
          <Frow label="Súbor s kódom">
            <input type="file" accept="image/*" onChange={e => scanImage(e.target.files[0])} />
          </Frow>
          <div className="hint">Vyberte fotografiu alebo sken faktúry s QR/EAN kódom (PDF najprv uložte ako obrázok).</div>
          {busy && <div>Spracúvam…</div>}
        </div>
      )}

      {tab === 'code' && (
        <form onSubmit={submitCode}>
          <Frow label="Obsah kódu" req>
            <input name="code" autoFocus placeholder="naskenujte pištoľou alebo vložte text kódu" />
          </Frow>
          <div className="hint">Skener pripojený ako klávesnica napíše kód a potvrdí Enterom.</div>
          <div className="form-actions">
            <button className="btn primary" type="submit">Načítať</button>
          </div>
        </form>
      )}

      {err && <div className="login-err" style={{ marginTop: 8 }}>⚠ {err}</div>}
    </Modal>
  );
}
