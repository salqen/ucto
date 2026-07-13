/*
 * integrations/bridges.js — mostíky na účtovné programy (POHODA XML + CSV pre MRP/KROS).
 * Prevzaté z ucto-git/components/ucto-bridges (bez závislostí, browser-safe).
 */

export function escapeXml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}
export function num(n) { return (Math.round((Number(n) || 0) * 100) / 100).toFixed(2); }

export function summarize(items = []) {
  const groups = new Map();
  let base = 0, tax = 0;
  for (const it of items) {
    const b = (Number(it.qty) || 0) * (Number(it.price) || 0);
    const rate = Number(it.vat) || 0;
    const t = b * rate / 100;
    base += b; tax += t;
    const g = groups.get(rate) || { rate, base: 0, tax: 0 };
    g.base += b; g.tax += t; groups.set(rate, g);
  }
  return {
    taxExclusive: Math.round(base * 100) / 100,
    taxAmount: Math.round(tax * 100) / 100,
    taxInclusive: Math.round((base + tax) * 100) / 100,
    byRate: [...groups.values()].map(g => ({ ...g, withTax: g.base + g.tax })).sort((a, b) => b.rate - a.rate),
  };
}
export function pohodaRateVat(rate) {
  const r = Number(rate) || 0;
  if (r === 0) return 'none';
  if (r >= 19) return 'high';
  if (r >= 9) return 'low';
  return 'third';
}
function csvCell(v) { const s = String(v ?? ''); return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
function csvRow(cells, sep = ';') { return cells.map(csvCell).join(sep); }

export function buildPohodaXml(invoices, { supplier = {}, resolveCustomer } = {}) {
  const list = Array.isArray(invoices) ? invoices : [invoices];
  const ico = escapeXml((supplier.ico || '').replace(/\s/g, ''));
  const items = list.map((invoice, idx) => {
    const customer = resolveCustomer ? resolveCustomer(invoice) : (invoice._customer || {});
    const sums = summarize(invoice.items || []);
    const vs = String(invoice.vs || invoice.number || '').replace(/\D/g, '');
    const detail = (invoice.items || []).map(it => `
        <inv:invoiceItem>
          <inv:text>${escapeXml(it.name || 'Položka')}</inv:text>
          <inv:quantity>${num(it.qty)}</inv:quantity>
          <inv:unit>${escapeXml(it.unit || 'ks')}</inv:unit>
          <inv:rateVAT>${pohodaRateVat(it.vat)}</inv:rateVAT>
          <inv:homeCurrency><typ:unitPrice>${num(it.price)}</typ:unitPrice></inv:homeCurrency>
        </inv:invoiceItem>`).join('');
    const isVat = !!supplier.icdph;
    let summaryCur;
    if (!isVat) {
      summaryCur = `
          <typ:priceNone>${num(sums.taxInclusive)}</typ:priceNone>`;
    } else {
      const high = sums.byRate.find(g => g.rate >= 19);
      const low = sums.byRate.find(g => g.rate >= 9 && g.rate < 19);
      summaryCur =
        (high ? `
          <typ:priceHighSum>${num(high.withTax)}</typ:priceHighSum>
          <typ:priceHigh>${num(high.base)}</typ:priceHigh>
          <typ:priceHighVAT>${num(high.tax)}</typ:priceHighVAT>` : '') +
        (low ? `
          <typ:priceLow>${num(low.base)}</typ:priceLow>
          <typ:priceLowVAT>${num(low.tax)}</typ:priceLowVAT>` : '');
    }
    return `
  <dat:dataPackItem version="2.0" id="INV${String(idx + 1).padStart(3, '0')}">
    <inv:invoice version="2.0">
      <inv:invoiceHeader>
        <inv:invoiceType>issuedInvoice</inv:invoiceType>
        <inv:number><typ:numberRequested>${escapeXml(invoice.number || '')}</typ:numberRequested></inv:number>
        <inv:symVar>${escapeXml(vs)}</inv:symVar>
        <inv:date>${escapeXml(invoice.issueDate || '')}</inv:date>
        <inv:dateTax>${escapeXml(invoice.deliveryDate || invoice.issueDate || '')}</inv:dateTax>
        <inv:dateDue>${escapeXml(invoice.dueDate || '')}</inv:dateDue>
        <inv:text>${escapeXml('Faktúra ' + (invoice.number || ''))}</inv:text>
        <inv:partnerIdentity><typ:address>
            <typ:company>${escapeXml(customer.name || '')}</typ:company>
            <typ:city>${escapeXml(customer.city || '')}</typ:city>
            <typ:street>${escapeXml(customer.street || '')}</typ:street>
            <typ:zip>${escapeXml((customer.zip || '').replace(/\s/g, ''))}</typ:zip>
            <typ:ico>${escapeXml(customer.ico || '')}</typ:ico>
            <typ:dic>${escapeXml(customer.icdph || customer.dic || '')}</typ:dic>
        </typ:address></inv:partnerIdentity>
        <inv:paymentType><typ:paymentType>draft</typ:paymentType></inv:paymentType>
        <inv:account><typ:accountNo>${escapeXml((supplier.iban || '').replace(/\s/g, ''))}</typ:accountNo></inv:account>
      </inv:invoiceHeader>
      <inv:invoiceDetail>${detail}
      </inv:invoiceDetail>
      <inv:invoiceSummary>
        <inv:roundingDocument>math2one</inv:roundingDocument>
        <inv:homeCurrency>${summaryCur}
        </inv:homeCurrency>
      </inv:invoiceSummary>
    </inv:invoice>
  </dat:dataPackItem>`;
  }).join('');
  return `<?xml version="1.0" encoding="UTF-8"?>
<dat:dataPack version="2.0" id="uctoERP" ico="${ico}" application="uctoERP" note="Export faktúr"
  xmlns:dat="http://www.stormware.cz/schema/version_2/data.xsd"
  xmlns:inv="http://www.stormware.cz/schema/version_2/invoice.xsd"
  xmlns:typ="http://www.stormware.cz/schema/version_2/type.xsd">${items}
</dat:dataPack>`;
}

const CSV_HEADER = ['Cislo', 'DatumVystavenia', 'DatumSplatnosti', 'Partner', 'ICO', 'DIC', 'Zaklad', 'DPH', 'Spolu', 'Uhradene', 'Zostatok', 'VS', 'Mena'];
export function buildCsv(invoices, { resolveCustomer, sep = ';' } = {}) {
  const list = Array.isArray(invoices) ? invoices : [invoices];
  const rows = [csvRow(CSV_HEADER, sep)];
  for (const invoice of list) {
    const c = resolveCustomer ? resolveCustomer(invoice) : (invoice._customer || {});
    const s = summarize(invoice.items || []);
    const paid = Number(invoice.paid) || 0;
    rows.push(csvRow([
      invoice.number || '', invoice.issueDate || '', invoice.dueDate || '',
      c.name || '', c.ico || '', c.icdph || c.dic || '',
      num(s.taxExclusive), num(s.taxAmount), num(s.taxInclusive), num(paid), num(s.taxInclusive - paid),
      String(invoice.vs || invoice.number || '').replace(/\D/g, ''), (invoice.currency || 'EUR').toUpperCase(),
    ], sep));
  }
  return rows.join('\r\n');
}

export const FORMATS = {
  pohoda: { label: 'POHODA (XML)', ext: 'xml', mime: 'application/xml;charset=utf-8', build: (inv, o) => buildPohodaXml(inv, o) },
  csv: { label: 'CSV (MRP/KROS/Excel)', ext: 'csv', mime: 'text/csv;charset=utf-8', build: (inv, o) => buildCsv(inv, o) },
};

export function exportInvoices(invoices, opts = {}) {
  const key = opts.format || 'pohoda';
  const fmt = FORMATS[key];
  if (!fmt) throw new Error(`Neznámy formát: "${key}".`);
  const content = fmt.build(invoices, opts);
  const n = Array.isArray(invoices) ? invoices.length : 1;
  return { content, filename: opts.filename || `export-${key}-${n}fakt.${fmt.ext}`, mime: fmt.mime, format: key };
}

/** Stiahne súbor v prehliadači. */
export function downloadBlob(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}
