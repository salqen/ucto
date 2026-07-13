/*
 * recurring — CORE (čistá logika, žiadne IO, žiadny React)
 *
 * Šablóny opakovaných (pravidelných) faktúr a ich generovanie podľa periódy,
 * vrátane dobiehania (catch-up) zameškaných období.
 *
 * template = {
 *   id, partnerId, currency, items:[{name,qty,unit,price,vat}],
 *   periodicity: 'weekly'|'monthly'|'quarterly'|'yearly',
 *   startDate, endDate?, dueDays=14, lastIssued?, note?, active=true
 * }
 */

export function round2(n) { return Math.round((Number(n) || 0) * 100) / 100; }

/** Súčet položiek vrátane DPH. */
export function itemsTotal(items = []) {
  return round2(items.reduce((s, it) =>
    s + (Number(it.qty) || 0) * (Number(it.price) || 0) * (1 + (Number(it.vat) || 0) / 100), 0));
}

function iso(d) { return d.toISOString().slice(0, 10); }
function parse(s) { return new Date(s + 'T00:00:00Z'); }

/** Pripočíta jednu periódu k dátumu (ISO string → ISO string). */
export function addPeriod(dateStr, periodicity) {
  const d = parse(dateStr);
  switch (periodicity) {
    case 'weekly': d.setUTCDate(d.getUTCDate() + 7); break;
    case 'monthly': d.setUTCMonth(d.getUTCMonth() + 1); break;
    case 'quarterly': d.setUTCMonth(d.getUTCMonth() + 3); break;
    case 'yearly': d.setUTCFullYear(d.getUTCFullYear() + 1); break;
    default: throw new Error(`Neznáma perióda: ${periodicity}`);
  }
  return iso(d);
}

/** Dátum najbližšieho vystavenia (po lastIssued, resp. od startDate). */
export function nextIssueDate(template) {
  if (!template.startDate) throw new Error('Šablóna nemá startDate.');
  if (!template.lastIssued) return template.startDate;
  return addPeriod(template.lastIssued, template.periodicity);
}

/**
 * Dátumy vystavenia, ktoré majú byť vygenerované do dnešného dňa (vrátane).
 * Dobieha zameškané obdobia. Obmedzené na 1000 iterácií.
 */
export function dueIssueDates(template, today, maxIter = 1000) {
  if (template.active === false) return [];
  const out = [];
  let d = nextIssueDate(template);
  let i = 0;
  while (d <= today && i++ < maxIter) {
    if (template.endDate && d > template.endDate) break;
    out.push(d);
    d = addPeriod(d, template.periodicity);
  }
  return out;
}

/** Vygeneruje faktúru z šablóny pre daný dátum vystavenia. */
export function buildInvoiceFromTemplate(template, issueDate, opts = {}) {
  const items = (template.items || []).map(it => ({ ...it }));
  const number = opts.number || makeNumber(issueDate, opts.seq);
  const vs = String(number).replace(/\D/g, '').slice(-10);
  const dueDate = addDays(issueDate, template.dueDays ?? 14);
  return {
    type: 'INO',
    number,
    vs,
    partnerId: template.partnerId,
    issueDate,
    deliveryDate: issueDate,
    dueDate,
    currency: template.currency || 'EUR',
    items,
    total: itemsTotal(items),
    paid: 0,
    note: (template.note ? template.note + ' · ' : '') + 'Pravidelná faktúra',
    recurringId: template.id,
  };
}

function addDays(dateStr, days) {
  const d = parse(dateStr); d.setUTCDate(d.getUTCDate() + (Number(days) || 0)); return iso(d);
}
function makeNumber(issueDate, seq) {
  const ymd = issueDate.replace(/-/g, '');
  return 'VF' + ymd + String(seq ?? 1).padStart(3, '0');
}

/**
 * Vygeneruje všetky faktúry po termíne pre zoznam šablón.
 * @param {object[]} templates
 * @param {string} today
 * @param {object} opts { seqStart=1 }
 * @returns {{ invoices, updatedTemplates }}
 *   invoices = nové faktúry; updatedTemplates = šablóny s posunutým lastIssued
 */
export function generateDue(templates, today, opts = {}) {
  let seq = opts.seqStart || 1;
  const invoices = [];
  const updatedTemplates = templates.map(t => ({ ...t }));
  updatedTemplates.forEach(t => {
    const dates = dueIssueDates(t, today);
    dates.forEach(d => {
      invoices.push(buildInvoiceFromTemplate(t, d, { seq: seq++ }));
      t.lastIssued = d;
    });
  });
  return { invoices, updatedTemplates };
}

/** Náhľad najbližších N vystavení (bez zmeny stavu). */
export function upcoming(template, count = 3) {
  const out = [];
  let d = nextIssueDate(template);
  for (let i = 0; i < count; i++) {
    if (template.endDate && d > template.endDate) break;
    out.push(d);
    d = addPeriod(d, template.periodicity);
  }
  return out;
}

export const PERIODICITY_LABELS = {
  weekly: 'týždenne', monthly: 'mesačne', quarterly: 'štvrťročne', yearly: 'ročne',
};

/** Koľko faktúr je práve po termíne (bez generovania). */
export function countDue(templates, today) {
  return templates.reduce((s, t) => s + dueIssueDates(t, today).length, 0);
}
