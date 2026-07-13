/*
 * integrations/reminders.js — pripomienky neuhradených faktúr.
 *
 * Pokrýva OBA smery:
 *   - vyšlé (INO)  = pohľadávky: odberateľ nám ešte nezaplatil (upomíname jeho)
 *   - došlé (INI)  = záväzky: MY máme uhradiť dodávateľovi (pripomíname sebe)
 * a OBA okná:
 *   - pred splatnosťou (pár dní vopred) — 'upcoming'
 *   - po splatnosti — 'overdue'
 *
 * Používa sa na notifikácie (in-app, prehliadač, extension, mobil/PWA) aj na
 * generovanie textu upomienky pre odberateľa.
 */

export function round2(n) { return Math.round((Number(n) || 0) * 100) / 100; }
export function remaining(inv) { return round2((Number(inv.total) || 0) - (Number(inv.paid) || 0)); }
export function daysBetween(a, b) {
  return Math.round((new Date(b + 'T00:00:00Z') - new Date(a + 'T00:00:00Z')) / 86400000);
}
function money(n, cur = 'EUR') {
  return (Number(n) || 0).toLocaleString('sk-SK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ' + cur;
}
function dt(iso) { return iso ? iso.split('-').reverse().join('.') : ''; }

/** Smer faktúry z typu. INO = pohľadávka (vyšlá), INI = záväzok (došlá). */
export function direction(inv) { return inv.type === 'INI' ? 'payable' : 'receivable'; }

/**
 * Vygeneruje pole upozornení pre faktúry pred/po splatnosti (oba smery).
 * @param {object[]} invoices
 * @param {object} opts { today, beforeDays=3, resolveName, includeUpcoming=true }
 * @returns {object[]} alerts zoradené podľa urgencie
 */
export function invoiceAlerts(invoices, opts = {}) {
  const today = opts.today || new Date().toISOString().slice(0, 10);
  const beforeDays = opts.beforeDays ?? 3;
  const includeUpcoming = opts.includeUpcoming !== false;
  const nameOf = opts.resolveName || (inv => inv.partnerName || '');
  const out = [];

  for (const inv of invoices) {
    const rem = remaining(inv);
    if (rem <= 0 || !inv.dueDate) continue;
    const d = daysBetween(today, inv.dueDate);   // >0 splatná o d dní, <0 d dní po splatnosti
    let kind = null;
    if (d < 0) kind = 'overdue';
    else if (includeUpcoming && d <= beforeDays) kind = 'upcoming';
    if (!kind) continue;

    const dir = direction(inv);
    const name = nameOf(inv);
    const amount = money(rem, inv.currency || 'EUR');
    const overdueDays = Math.abs(d);

    // severity: záväzok po splatnosti = kritické (pokuty), pohľadávka po splatnosti = vysoké
    let severity;
    if (kind === 'overdue') severity = dir === 'payable' ? 'kritická' : 'vysoká';
    else severity = 'stredná';

    let title, message;
    if (dir === 'payable') {
      title = kind === 'overdue'
        ? `Neuhradený záväzok — ${inv.number}`
        : `Blíži sa splatnosť záväzku — ${inv.number}`;
      message = kind === 'overdue'
        ? `Máte uhradiť ${amount} dodávateľovi ${name}. Faktúra je ${overdueDays} dní po splatnosti.`
        : `Za ${d} dní (${dt(inv.dueDate)}) treba uhradiť ${amount} dodávateľovi ${name}.`;
    } else {
      title = kind === 'overdue'
        ? `Neuhradená pohľadávka — ${inv.number}`
        : `Blíži sa splatnosť pohľadávky — ${inv.number}`;
      message = kind === 'overdue'
        ? `Odberateľ ${name} vám dlží ${amount}, ${overdueDays} dní po splatnosti.`
        : `Odberateľovi ${name} končí splatnosť ${amount} o ${d} dní (${dt(inv.dueDate)}).`;
    }

    out.push({
      invoiceId: inv.id, number: inv.number, direction: dir, kind, severity,
      daysToDue: d, overdueDays: kind === 'overdue' ? overdueDays : 0,
      remaining: rem, currency: inv.currency || 'EUR', partnerName: name,
      dueDate: inv.dueDate, title, message,
    });
  }

  const rank = a => (a.kind === 'overdue' ? 0 : 1) * 100000 + (a.kind === 'overdue' ? -a.overdueDays : a.daysToDue);
  return out.sort((a, b) => rank(a) - rank(b));
}

/** Zhrnutie pre badge/prehľad. */
export function alertsSummary(alerts) {
  const s = { total: alerts.length, payableOverdue: 0, payableUpcoming: 0, receivableOverdue: 0, receivableUpcoming: 0, sumOverdue: 0 };
  for (const a of alerts) {
    s[a.direction + (a.kind === 'overdue' ? 'Overdue' : 'Upcoming')]++;
    if (a.kind === 'overdue') s.sumOverdue = round2(s.sumOverdue + a.remaining);
  }
  return s;
}

/* ---------- text upomienky pre odberateľa (pohľadávky) ---------- */

export function reminderLevel(daysOverdue) {
  if (daysOverdue <= 0) return 0;
  if (daysOverdue <= 14) return 1;
  if (daysOverdue <= 30) return 2;
  return 3;
}
const LEVEL_TITLE = { 1: 'Pripomenutie úhrady', 2: '2. upomienka', 3: 'Posledná výzva pred vymáhaním' };

export function buildReminder(invoice, { supplier = {}, customer = {}, today, level } = {}) {
  const rem = remaining(invoice);
  const days = invoice.dueDate ? daysBetween(invoice.dueDate, today || new Date().toISOString().slice(0, 10)) : 0;
  const lvl = level || reminderLevel(days) || 1;
  const cur = invoice.currency || 'EUR';
  const amount = money(rem, cur);
  const vs = String(invoice.vs || invoice.number || '').replace(/\D/g, '');
  const iban = (supplier.iban || '').trim();
  const subject = `${LEVEL_TITLE[lvl]} — faktúra ${invoice.number} (${amount})`;
  const intro = {
    1: `dovoľujeme si Vás priateľsky upozorniť, že faktúra č. ${invoice.number} je ${days} dní po splatnosti.`,
    2: `opakovane Vás vyzývame na úhradu faktúry č. ${invoice.number}, ktorá je už ${days} dní po splatnosti.`,
    3: `faktúra č. ${invoice.number} je ${days} dní po splatnosti a doposiaľ neuhradená. Ide o poslednú výzvu pred postúpením na vymáhanie.`,
  }[lvl];
  const body = `Vážený obchodný partner${customer.name ? ' — ' + customer.name : ''},

${intro}

  Faktúra:            ${invoice.number}
  Splatnosť:         ${dt(invoice.dueDate)}
  Dlžná suma:        ${amount}
  Variabilný symbol: ${vs}${iban ? `
  IBAN:              ${iban}` : ''}

Prosíme o bezodkladnú úhradu. Ak ste medzičasom platbu vykonali, považujte túto správu za bezpredmetnú.

S pozdravom,
${supplier.name || ''}`;
  return { subject, body, level: lvl };
}
