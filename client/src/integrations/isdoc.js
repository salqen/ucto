/*
 * isdoc-export — CORE (čistá logika, žiadne IO, žiadny React)
 *
 * Prevod faktúry účtoERP → ISDOC 6.0.1 XML (elektronická faktúra, štandard
 * používaný v SK/CZ, namespace http://isdoc.cz/namespace/2013).
 *
 * Vstupy v tvare keepi:
 *   invoice  = { number, vs, issueDate, deliveryDate, dueDate, currency, items:[{name,qty,unit,price,vat}], total, paid }
 *   supplier = { name, ico, dic, icdph, street, city, zip, country, iban }  (nastavenia firmy)
 *   customer = { name, ico, dic, icdph, street, city, zip, country }        (partner)
 */

/* ---------- pomocné ---------- */

export function escapeXml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

export function num(n) {
  return (Math.round((Number(n) || 0) * 100) / 100).toFixed(2);
}

/** Jednoduché UUID v4 (deterministické nie je potrebné; dá sa podstrčiť cez opts). */
export function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.floor(Math.random() * 16);
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Sumarizácia položiek: základ, DPH a spolu, aj po jednotlivých sadzbách DPH.
 * @returns { taxExclusive, taxAmount, taxInclusive, byRate: [{rate, base, tax, withTax}] }
 */
export function summarize(items = []) {
  const groups = new Map();
  let taxExclusive = 0, taxAmount = 0;
  for (const it of items) {
    const base = (Number(it.qty) || 0) * (Number(it.price) || 0);
    const rate = Number(it.vat) || 0;
    const tax = base * rate / 100;
    taxExclusive += base;
    taxAmount += tax;
    const g = groups.get(rate) || { rate, base: 0, tax: 0 };
    g.base += base; g.tax += tax;
    groups.set(rate, g);
  }
  const byRate = [...groups.values()]
    .map(g => ({ ...g, withTax: g.base + g.tax }))
    .sort((a, b) => b.rate - a.rate);
  return {
    taxExclusive: Math.round(taxExclusive * 100) / 100,
    taxAmount: Math.round(taxAmount * 100) / 100,
    taxInclusive: Math.round((taxExclusive + taxAmount) * 100) / 100,
    byRate,
  };
}

/* ---------- stavba XML ---------- */

function partyXml(tag, p = {}, { vatApplicable }) {
  const addr = `
      <PostalAddress>
        <StreetName>${escapeXml(p.street || '')}</StreetName>
        <BuildingNumber></BuildingNumber>
        <CityName>${escapeXml(p.city || '')}</CityName>
        <PostalZone>${escapeXml((p.zip || '').replace(/\s/g, ''))}</PostalZone>
        <Country><IdentificationCode>${escapeXml(countryCode(p.country))}</IdentificationCode><Name>${escapeXml(p.country || 'Slovensko')}</Name></Country>
      </PostalAddress>`;
  const taxScheme = (p.dic || p.icdph)
    ? `
      <PartyTaxScheme>
        <CompanyID>${escapeXml(p.icdph || p.dic || '')}</CompanyID>
        <TaxScheme>${p.icdph ? 'VAT' : 'TIN'}</TaxScheme>
      </PartyTaxScheme>`
    : '';
  return `
    <${tag}>
      <Party>
        <PartyIdentification><ID>${escapeXml(p.ico || '')}</ID></PartyIdentification>
        <PartyName><Name>${escapeXml(p.name || '')}</Name></PartyName>${addr}${taxScheme}
      </Party>
    </${tag}>`;
}

function countryCode(name) {
  const n = String(name || '').toLowerCase();
  if (n.includes('sloven')) return 'SK';
  if (n.includes('česk') || n.includes('czech')) return 'CZ';
  return 'SK';
}

/**
 * Zostaví ISDOC 6.0.1 XML z faktúry.
 * @param {object} args { invoice, supplier, customer, opts }
 * @returns {string} XML dokument
 */
export function buildIsdoc({ invoice, supplier, customer, opts = {} } = {}) {
  if (!invoice) throw new Error('Chýba faktúra (invoice).');
  if (!supplier) throw new Error('Chýbajú údaje dodávateľa (supplier).');
  const items = invoice.items || [];
  const sums = summarize(items);
  const vatApplicable = !!(supplier.icdph) && sums.taxAmount > 0 ? true : !!supplier.icdph;
  const cur = (invoice.currency || 'EUR').toUpperCase();
  const id = escapeXml(invoice.number || invoice.id || '');
  const vs = escapeXml((invoice.vs || String(invoice.number || '')).replace(/\D/g, ''));
  const paid = Number(invoice.paid) || 0;
  const payable = Math.round((sums.taxInclusive - paid) * 100) / 100;

  const lines = items.map((it, i) => {
    const base = (Number(it.qty) || 0) * (Number(it.price) || 0);
    const rate = Number(it.vat) || 0;
    const tax = base * rate / 100;
    return `
    <InvoiceLine>
      <ID>${i + 1}</ID>
      <InvoicedQuantity unitCode="${escapeXml(it.unit || 'ks')}">${num(it.qty)}</InvoicedQuantity>
      <LineExtensionAmount>${num(base)}</LineExtensionAmount>
      <LineExtensionAmountTaxInclusive>${num(base + tax)}</LineExtensionAmountTaxInclusive>
      <LineExtensionTaxAmount>${num(tax)}</LineExtensionTaxAmount>
      <UnitPrice>${num(it.price)}</UnitPrice>
      <UnitPriceTaxInclusive>${num((Number(it.price) || 0) * (1 + rate / 100))}</UnitPriceTaxInclusive>
      <ClassifiedTaxCategory>
        <Percent>${num(rate)}</Percent>
        <VATCalculationMethod>0</VATCalculationMethod>
      </ClassifiedTaxCategory>
      <Item><Description>${escapeXml(it.name || 'Položka')}</Description></Item>
    </InvoiceLine>`;
  }).join('');

  const taxSubTotals = sums.byRate.map(g => `
      <TaxSubTotal>
        <TaxableAmount>${num(g.base)}</TaxableAmount>
        <TaxAmount>${num(g.tax)}</TaxAmount>
        <TaxInclusiveAmount>${num(g.withTax)}</TaxInclusiveAmount>
        <AlreadyClaimedTaxableAmount>0.00</AlreadyClaimedTaxableAmount>
        <AlreadyClaimedTaxAmount>0.00</AlreadyClaimedTaxAmount>
        <AlreadyClaimedTaxInclusiveAmount>0.00</AlreadyClaimedTaxInclusiveAmount>
        <DifferenceTaxableAmount>${num(g.base)}</DifferenceTaxableAmount>
        <DifferenceTaxAmount>${num(g.tax)}</DifferenceTaxAmount>
        <DifferenceTaxInclusiveAmount>${num(g.withTax)}</DifferenceTaxInclusiveAmount>
        <TaxCategory><Percent>${num(g.rate)}</Percent></TaxCategory>
      </TaxSubTotal>`).join('');

  const payment = supplier.iban ? `
  <PaymentMeans>
    <Payment>
      <PaidAmount>${num(payable)}</PaidAmount>
      <PaymentMeansCode>42</PaymentMeansCode>
      <Details>
        <PaymentDueDate>${escapeXml(invoice.dueDate || '')}</PaymentDueDate>
        <ID>${escapeXml((supplier.iban || '').replace(/\s/g, ''))}</ID>
        <VariableSymbol>${vs}</VariableSymbol>
      </Details>
    </Payment>
  </PaymentMeans>` : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="http://isdoc.cz/namespace/2013" version="6.0.1">
  <DocumentType>1</DocumentType>
  <ID>${id}</ID>
  <UUID>${escapeXml(opts.uuid || uuid())}</UUID>
  <IssueDate>${escapeXml(invoice.issueDate || '')}</IssueDate>
  <TaxPointDate>${escapeXml(invoice.deliveryDate || invoice.issueDate || '')}</TaxPointDate>
  <VATApplicable>${vatApplicable ? 'true' : 'false'}</VATApplicable>
  <LocalCurrencyCode>${escapeXml(cur)}</LocalCurrencyCode>
  <CurrRate>1</CurrRate>
  <RefCurrRate>1</RefCurrRate>${partyXml('AccountingSupplierParty', supplier, { vatApplicable })}${partyXml('AccountingCustomerParty', customer || {}, { vatApplicable })}
  <InvoiceLines>${lines}
  </InvoiceLines>
  <TaxTotal>${taxSubTotals}
    <TaxAmount>${num(sums.taxAmount)}</TaxAmount>
  </TaxTotal>
  <LegalMonetaryTotal>
    <TaxExclusiveAmount>${num(sums.taxExclusive)}</TaxExclusiveAmount>
    <TaxInclusiveAmount>${num(sums.taxInclusive)}</TaxInclusiveAmount>
    <AlreadyClaimedTaxExclusiveAmount>0.00</AlreadyClaimedTaxExclusiveAmount>
    <AlreadyClaimedTaxInclusiveAmount>${num(paid)}</AlreadyClaimedTaxInclusiveAmount>
    <DifferenceTaxExclusiveAmount>${num(sums.taxExclusive)}</DifferenceTaxExclusiveAmount>
    <DifferenceTaxInclusiveAmount>${num(payable)}</DifferenceTaxInclusiveAmount>
    <PayableAmount>${num(payable)}</PayableAmount>
  </LegalMonetaryTotal>${payment}
</Invoice>`;
}

/** Navrhne názov súboru pre faktúru. */
export function isdocFilename(invoice) {
  const base = String(invoice.number || invoice.id || 'faktura').replace(/[^\w.-]+/g, '_');
  return `${base}.isdoc`;
}

export default buildIsdoc;
