/*
 * integrations/bankmatch.js — parsovanie bankového výpisu + párovanie platieb na faktúry.
 * Prevzaté z ucto-git/components/bank-matching (core.js + index.js), bez závislostí, browser-safe.
 *
 * 1) Parsovanie výpisu: SEPA CAMT.053/052 (XML) alebo generický CSV.
 * 2) Párovanie prijatých platieb na faktúry podľa VS → sumy → IBAN, s úrovňou istoty.
 *
 * Transakcia (normalizovaný tvar):
 *   { date, amount, currency, side:'credit'|'debit', vs, ks, ss,
 *     counterpartyName, counterpartyIban, ref }
 */

/* ---------- pomocné ---------- */

export function round2(n) { return Math.round((Number(n) || 0) * 100) / 100; }

/** Vytiahne prvý výskyt tagu (bez ohľadu na namespace) z útržku XML. */
function tag(xml, name) {
  const m = xml.match(new RegExp(`<(?:[\\w]+:)?${name}\\b[^>]*>([\\s\\S]*?)</(?:[\\w]+:)?${name}>`, 'i'));
  return m ? m[1].trim() : '';
}
function tagAll(xml, name) {
  const re = new RegExp(`<(?:[\\w]+:)?${name}\\b[^>]*>([\\s\\S]*?)</(?:[\\w]+:)?${name}>`, 'gi');
  const out = []; let m;
  while ((m = re.exec(xml))) out.push(m[1].trim());
  return out;
}

/** Vytiahne VS/SS/KS z referenčného textu (SK zápis /VS.../SS.../KS...). */
export function parseSymbols(text) {
  const s = String(text || '');
  const vs = (s.match(/\/VS(\d{1,10})/i) || s.match(/\bVS[:\s]?(\d{1,10})/i) || [])[1] || '';
  const ss = (s.match(/\/SS(\d{1,10})/i) || [])[1] || '';
  const ks = (s.match(/\/KS(\d{1,4})/i) || [])[1] || '';
  return { vs, ss, ks };
}

/* ---------- CAMT.053 ---------- */

/**
 * Naparsuje CAMT.053/052 XML → pole transakcií.
 * Tolerantný regex parser (bez XML knižnice — funguje aj mimo prehliadača). Berie <Ntry> záznamy.
 */
export function parseCamt053(xml) {
  const entries = tagAll(xml, 'Ntry');
  return entries.map(e => {
    const amtM = e.match(/<(?:[\w]+:)?Amt\b[^>]*Ccy="([^"]*)"[^>]*>([\d.,]+)</i);
    const amount = amtM ? round2(String(amtM[2]).replace(/\s/g, '').replace(',', '.')) : 0;
    const currency = amtM ? amtM[1] : 'EUR';
    const cd = tag(e, 'CdtDbtInd').toUpperCase();
    const side = cd.startsWith('CRDT') ? 'credit' : 'debit';
    const date = (tag(tag(e, 'BookgDt') || e, 'Dt') || tag(e, 'Dt') || '').slice(0, 10);
    const refText = [...tagAll(e, 'Ustrd'), ...tagAll(e, 'Ref')].join(' ');
    const e2e = tag(e, 'EndToEndId');
    const symText = [refText, e2e].join(' ');
    let { vs, ss, ks } = parseSymbols(symText);
    /* fallback: EndToEndId ako čisté číslo je typicky VS */
    if (!vs && /^\d{1,10}$/.test(e2e)) vs = e2e;
    // protistrana (pre kredit = dlžník/Dbtr)
    const party = side === 'credit' ? (tag(e, 'Dbtr') || '') : (tag(e, 'Cdtr') || '');
    const counterpartyName = tag(party, 'Nm') || tag(e, 'Nm');
    const iban = (e.match(/<(?:[\w]+:)?IBAN>([^<]+)</i) || [])[1] || '';
    return {
      date, amount, currency, side,
      vs, ss, ks,
      counterpartyName, counterpartyIban: iban.replace(/\s/g, ''),
      ref: refText.trim(),
    };
  }).filter(t => t.amount > 0);
}

/* ---------- CSV ---------- */

/** Rozdelí CSV riadok rešpektujúc úvodzovky. */
function splitCsvLine(line, sep) {
  const out = []; let cur = '', q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === sep) { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

function detectSep(text) {
  const first = String(text).split(/\r?\n/)[0] || '';
  return (first.split(';').length >= first.split(',').length) ? ';' : ',';
}

/**
 * Naparsuje bankové CSV → transakcie. Mapovanie stĺpcov cez opts.map (index/názov).
 * Predvolené mapovanie: date, amount, vs, counterpartyName, counterpartyIban.
 */
export function parseBankCsv(text, opts = {}) {
  const sep = opts.sep || detectSep(text);
  const lines = String(text).split(/\r?\n/).filter(l => l.trim());
  if (!lines.length) return [];
  const header = splitCsvLine(lines[0], sep).map(h => h.trim().toLowerCase());
  const idx = (names) => {
    for (const n of names) { const i = header.indexOf(n); if (i >= 0) return i; }
    return -1;
  };
  const map = {
    date: opts.map?.date ?? idx(['datum', 'date', 'dátum', 'datum zauctovania']),
    amount: opts.map?.amount ?? idx(['suma', 'amount', 'čiastka', 'ciastka', 'objem']),
    vs: opts.map?.vs ?? idx(['vs', 'variabilny symbol', 'variabilný symbol']),
    name: opts.map?.name ?? idx(['partner', 'nazov', 'názov', 'protistrana', 'name']),
    iban: opts.map?.iban ?? idx(['iban', 'protiucet', 'protiúčet', 'ucet']),
  };
  return lines.slice(1).map(line => {
    const c = splitCsvLine(line, sep);
    const amount = round2(String(c[map.amount] || '0').replace(/\s/g, '').replace(',', '.'));
    const vsCell = map.vs >= 0 ? String(c[map.vs] || '').replace(/\D/g, '') : '';
    return {
      date: (c[map.date] || '').trim().slice(0, 10),
      amount: Math.abs(amount),
      currency: 'EUR',
      side: amount < 0 ? 'debit' : 'credit',
      vs: vsCell || parseSymbols(line).vs,
      ss: '', ks: '',
      counterpartyName: (c[map.name] || '').trim(),
      counterpartyIban: (c[map.iban] || '').replace(/\s/g, ''),
      ref: line,
    };
  });
}

/* ---------- párovanie ---------- */

/** Zvyšok na úhradu faktúry. */
export function invoiceRemaining(inv) {
  return round2((Number(inv.total) || 0) - (Number(inv.paid) || 0));
}

/**
 * Napáruje prijaté platby (credit) na faktúry.
 * @param {object[]} transactions  z parseCamt053/parseBankCsv
 * @param {object[]} invoices      faktúry keepi (vs, total, paid, partnerId, number)
 * @param {object} opts { amountTolerance=0.01, partnerIban(inv) }
 * @returns {object[]} páry: { transaction, invoice|null, confidence, reason }
 */
export function matchPayments(transactions, invoices, opts = {}) {
  const tol = opts.amountTolerance ?? 0.01;
  const open = invoices.filter(i => invoiceRemaining(i) > 0);
  const usedInvoice = new Set();
  const results = [];

  for (const tx of transactions) {
    if (tx.side !== 'credit') continue;
    let best = null;

    const byVs = open.filter(i => i.vs && tx.vs && String(i.vs) === String(tx.vs) && !usedInvoice.has(i.id));
    const amountFits = (i) => Math.abs(invoiceRemaining(i) - tx.amount) <= tol;

    if (byVs.length === 1) {
      best = { invoice: byVs[0], confidence: amountFits(byVs[0]) ? 'vysoká' : 'stredná', reason: amountFits(byVs[0]) ? 'VS + suma' : 'VS (suma sa líši)' };
    } else if (byVs.length > 1) {
      const exact = byVs.find(amountFits);
      best = exact ? { invoice: exact, confidence: 'vysoká', reason: 'VS + suma (z viacerých)' }
                   : { invoice: byVs[0], confidence: 'nízka', reason: 'viac faktúr s rovnakým VS' };
    } else {
      // bez VS: skús sumu (+ IBAN)
      const bySum = open.filter(i => amountFits(i) && !usedInvoice.has(i.id));
      if (bySum.length === 1) {
        best = { invoice: bySum[0], confidence: 'stredná', reason: 'zhoda sumy' };
      } else if (bySum.length > 1 && tx.counterpartyIban) {
        const ibanHit = bySum.filter(i => opts.partnerIban && opts.partnerIban(i) &&
          opts.partnerIban(i).replace(/\s/g, '') === tx.counterpartyIban);
        if (ibanHit.length === 1) best = { invoice: ibanHit[0], confidence: 'stredná', reason: 'suma + IBAN' };
      }
    }

    if (best && best.invoice) usedInvoice.add(best.invoice.id);
    results.push({
      transaction: tx,
      invoice: best ? best.invoice : null,
      confidence: best ? best.confidence : 'žiadna',
      reason: best ? best.reason : 'nenašla sa faktúra',
    });
  }
  return results;
}

/** Zhrnutie výsledku párovania. */
export function matchSummary(results) {
  const matched = results.filter(r => r.invoice);
  return {
    transactions: results.length,
    matched: matched.length,
    unmatched: results.length - matched.length,
    matchedAmount: round2(matched.reduce((s, r) => s + r.transaction.amount, 0)),
  };
}

/* ---------- verejné API ---------- */

/** Zistí formát výpisu ('camt' | 'csv'). */
export function detectFormat(text) {
  return /<(?:[\w]+:)?Document|<(?:[\w]+:)?BkToCstmrStmt|CAMT\.053|Ntry>/i.test(text) ? 'camt' : 'csv';
}

/** Naparsuje výpis podľa formátu. */
export function parseStatement(text, opts = {}) {
  const fmt = opts.format && opts.format !== 'auto' ? opts.format : detectFormat(text);
  return fmt === 'camt' ? parseCamt053(text) : parseBankCsv(text, opts);
}

/** Naparsuje výpis a rovno napáruje na faktúry. */
export function importAndMatch(text, invoices, opts = {}) {
  const transactions = parseStatement(text, opts);
  const results = matchPayments(transactions, invoices, opts);
  return { transactions, results, summary: matchSummary(results) };
}

/**
 * Z potvrdených párov vytvorí príkazy na úhradu faktúr.
 * @returns [{ invoiceId, amount, date }]
 */
export function toPayments(results, { onlyConfidence } = {}) {
  return results
    .filter(r => r.invoice && (!onlyConfidence || onlyConfidence.includes(r.confidence)))
    .map(r => ({ invoiceId: r.invoice.id, amount: r.transaction.amount, date: r.transaction.date }));
}
