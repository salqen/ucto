/*
 * integrations/notify.js — push/desktop notifikácie pre pripomienky faktúr.
 *
 * Používa Web Notifications API (funguje v prehliadači na PC aj v PWA na mobile).
 * Throttling cez localStorage: to isté upozornenie sa nezobrazí viackrát za deň.
 *
 * Pre skutočný push na pozadí (aj keď je appka zavretá) treba Web Push (VAPID) +
 * service worker — pozri public/sw.js a serverový endpoint /api/push (scaffold).
 */

const SEEN_KEY = 'ucto_notify_seen';

export function notifySupported() {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function notifyPermission() {
  return notifySupported() ? Notification.permission : 'unsupported';
}

/** Vyžiada povolenie na notifikácie. */
export async function ensurePermission() {
  if (!notifySupported()) return 'unsupported';
  if (Notification.permission === 'default') {
    try { return await Notification.requestPermission(); } catch { return 'denied'; }
  }
  return Notification.permission;
}

function loadSeen() {
  try { return JSON.parse(localStorage.getItem(SEEN_KEY) || '{}'); } catch { return {}; }
}
function saveSeen(o) { try { localStorage.setItem(SEEN_KEY, JSON.stringify(o)); } catch {} }

/** Kľúč upozornenia na daný deň (aby sa neopakovalo v ten istý deň). */
function alertKey(a, day) { return `${day}|${a.invoiceId}|${a.kind}`; }

/**
 * Zobrazí notifikácie pre nové upozornenia (throttlované na 1× denne / faktúru).
 * @returns {number} počet zobrazených notifikácií
 */
export function pushAlerts(alerts, opts = {}) {
  if (notifyPermission() !== 'granted') return 0;
  const day = (opts.today || new Date().toISOString().slice(0, 10));
  const seen = loadSeen();
  let shown = 0;
  const fresh = alerts.filter(a => !seen[alertKey(a, day)]);
  if (!fresh.length) return 0;

  // aby sme nezahltili: ak je viac ako 3, jedna súhrnná notifikácia
  if (fresh.length > 3) {
    const over = fresh.filter(a => a.kind === 'overdue').length;
    new Notification('účtoERP — pripomienky faktúr', {
      body: `${fresh.length} upozornení (${over} po splatnosti). Otvorte Pripomienky.`,
      tag: 'ucto-summary-' + day,
    });
    shown = 1;
  } else {
    for (const a of fresh) {
      new Notification(a.title, { body: a.message, tag: 'ucto-' + a.invoiceId + '-' + a.kind });
      shown++;
    }
  }
  fresh.forEach(a => { seen[alertKey(a, day)] = 1; });
  // ponechaj len dnešné kľúče (vyčisti staré)
  const pruned = {};
  Object.keys(seen).forEach(k => { if (k.startsWith(day + '|')) pruned[k] = 1; });
  saveSeen(pruned);
  return shown;
}

/** Jednoduchá testovacia notifikácia. */
export function testNotification() {
  if (notifyPermission() !== 'granted') return false;
  new Notification('účtoERP', { body: 'Notifikácie sú zapnuté ✅' });
  return true;
}
