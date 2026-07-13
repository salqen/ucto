/*
 * integrations/paybysquare.js — PAY by square QR z faktúry (SK bankový štandard).
 * Prevzaté z ucto-git/components/pay-by-square (core.js + index.js).
 *
 * Oproti priamemu volaniu bysquare pridáva: validáciu IBAN (mod-97), varovania
 * (chýbajúci VS, nulová suma, neznáma mena) a jednotný výstup pre UI.
 *
 * Vstupy v tvare keepi:
 *   invoice = { number, vs, ks, total, paid, currency, dueDate }
 *   company = { name, iban }     // príjemca platby (názov firmy + IBAN účtu)
 */

import { encode, PaymentOptions, CurrencyCode } from 'bysquare/pay';
import QRCode from 'qrcode';

/** Odstráni medzery a zjednotí na veľké písmená. */
export function normalizeIban(iban) {
  return String(iban || '').replace(/\s+/g, '').toUpperCase();
}

/** Validácia IBAN podľa ISO 13616 (mod-97). */
export function isValidIban(iban) {
  const s = normalizeIban(iban);
  if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{10,30}$/.test(s)) return false;
  const rearranged = s.slice(4) + s.slice(0, 4);
  const numeric = rearranged.replace(/[A-Z]/g, ch => (ch.charCodeAt(0) - 55).toString());
  let rem = 0;
  for (let i = 0; i < numeric.length; i += 7) {
    rem = Number(String(rem) + numeric.slice(i, i + 7)) % 97;
  }
  return rem === 1;
}

/** Dátum 'YYYY-MM-DD' (alebo Date) → 'YYYYMMDD'. Prázdne → undefined. */
export function toYYYYMMDD(date) {
  if (!date) return undefined;
  if (date instanceof Date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}${m}${d}`;
  }
  const s = String(date).slice(0, 10);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return m[1] + m[2] + m[3];
  if (/^\d{8}$/.test(s)) return s;
  return undefined;
}

export function round2(n) { return Math.round((Number(n) || 0) * 100) / 100; }

/** Zvyšná suma na úhradu (total - paid), min. 0. */
export function remainingAmount(invoice) {
  return round2(Math.max(0, (Number(invoice.total) || 0) - (Number(invoice.paid) || 0)));
}

/** Variabilný symbol: invoice.vs → number (len číslice), max 10 číslic. */
export function variableSymbol(invoice) {
  const raw = invoice.vs || invoice.number || '';
  return String(raw).replace(/\D/g, '').slice(-10);
}

/** Konštantný symbol (len číslice, max 4). */
export function constantSymbol(invoice) {
  return String(invoice.ks || '').replace(/\D/g, '').slice(0, 4);
}

/**
 * Zostaví pay-by-square dátový model z faktúry.
 * @returns { model, warnings }
 */
export function buildModel({ invoice, company, partner, amount } = {}) {
  if (!invoice) throw new Error('Chýba faktúra (invoice).');
  if (!company) throw new Error('Chýba firma/príjemca (company).');

  const warnings = [];
  const iban = normalizeIban(company.iban);
  if (!iban) throw new Error('Firma nemá vyplnený IBAN — QR sa nedá vytvoriť.');
  /* mod-97 kontrola je len upozornenie — QR vygenerujeme aj tak (nechceme skryť platobný kód
     kvôli prísnej validácii; nesprávny IBAN si používateľ opraví v nastaveniach). */
  if (!isValidIban(iban)) warnings.push(`IBAN "${company.iban}" neprešiel kontrolou mod-97 — overte správnosť.`);

  const amt = amount != null ? round2(amount) : remainingAmount(invoice);
  if (amt <= 0) warnings.push('Suma na úhradu je 0 — faktúra je zrejme uhradená.');

  const vs = variableSymbol(invoice);
  if (!vs) warnings.push('Faktúra nemá variabilný symbol.');
  const ks = constantSymbol(invoice);

  const dueDate = toYYYYMMDD(invoice.dueDate);
  const currency = (invoice.currency || 'EUR').toUpperCase();
  const currencyCode = CurrencyCode[currency] || CurrencyCode.EUR;
  if (!CurrencyCode[currency]) warnings.push(`Neznáma mena "${currency}", použité EUR.`);

  const model = {
    invoiceId: String(invoice.number || invoice.id || vs || ''),
    payments: [{
      type: PaymentOptions.PaymentOrder,
      amount: amt,
      currencyCode,
      variableSymbol: vs || undefined,
      constantSymbol: ks || undefined,
      paymentDueDate: dueDate,
      bankAccounts: [{ iban }],
      beneficiary: { name: company.name || 'Príjemca' },
      paymentNote: invoice.number ? `Faktúra ${invoice.number}` : undefined,
    }],
  };
  return { model, warnings };
}

/**
 * Faktúra → pay-by-square reťazec (obsah QR).
 * @returns { qrString, amount, variableSymbol, iban, currency, warnings }
 */
export function invoiceToPayBySquare(args) {
  const { model, warnings } = buildModel(args);
  const qrString = encode(model);
  const p = model.payments[0];
  return {
    qrString,
    amount: p.amount,
    variableSymbol: p.variableSymbol || '',
    iban: p.bankAccounts[0].iban,
    currency: model.payments[0].currencyCode,
    warnings,
  };
}

/**
 * Vytvorí PNG data URL s pay-by-square QR kódom z faktúry.
 * @returns { dataUrl, ...meta }
 */
export async function qrDataUrl(invoice, company, opts = {}) {
  const res = invoiceToPayBySquare({ invoice, company, partner: opts.partner, amount: opts.amount });
  const dataUrl = await QRCode.toDataURL(res.qrString, {
    errorCorrectionLevel: opts.errorCorrectionLevel || 'M',
    margin: opts.margin ?? 1,
    width: opts.width ?? 240,
  });
  return { dataUrl, ...res };
}

export default invoiceToPayBySquare;
