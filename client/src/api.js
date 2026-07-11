const j = r => {
  if (!r.ok) throw new Error('Chyba servera: ' + r.status);
  return r.json();
};
export const api = {
  get: (url) => fetch('/api' + url).then(j),
  post: (url, body) => fetch('/api' + url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(j),
  put: (url, body) => fetch('/api' + url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(j),
  del: (url) => fetch('/api' + url, { method: 'DELETE' }).then(j)
};
export const eur = n => (Number(n) || 0).toLocaleString('sk-SK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
export const dt = s => s ? s.split('-').reverse().map(Number).join('.') : '';
export const today = () => new Date().toISOString().slice(0, 10);
