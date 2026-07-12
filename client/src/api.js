const TOKEN_KEY = 'ucto_token';
export const getToken = () => localStorage.getItem(TOKEN_KEY) || '';
export const setToken = (t) => t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY);

const j = async r => {
  if (r.status === 401) {
    window.dispatchEvent(new CustomEvent('auth-required'));
    const data = await r.json().catch(() => ({}));
    throw new Error(data.error || 'Neprihlásený používateľ');
  }
  if (!r.ok) {
    const data = await r.json().catch(() => ({}));
    throw new Error(data.error || ('Chyba servera: ' + r.status));
  }
  return r.json();
};
const headers = (extra = {}) => {
  const h = { ...extra };
  const t = getToken();
  if (t) h.Authorization = 'Bearer ' + t;
  return h;
};
export const api = {
  get: (url) => fetch('/api' + url, { headers: headers() }).then(j),
  post: (url, body) => fetch('/api' + url, { method: 'POST', headers: headers({ 'Content-Type': 'application/json' }), body: JSON.stringify(body) }).then(j),
  put: (url, body) => fetch('/api' + url, { method: 'PUT', headers: headers({ 'Content-Type': 'application/json' }), body: JSON.stringify(body) }).then(j),
  del: (url) => fetch('/api' + url, { method: 'DELETE', headers: headers() }).then(j)
};
export const eur = n => (Number(n) || 0).toLocaleString('sk-SK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
export const dt = s => s ? s.split('-').reverse().map(Number).join('.') : '';
export const today = () => new Date().toISOString().slice(0, 10);
