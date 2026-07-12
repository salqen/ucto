import React, { useState } from 'react';
import { api, setToken } from '../api.js';
import { Frow } from '../components/ui.jsx';

/* prihlásenie / vytvorenie nového účtu */
export default function Login({ onLogin, allowRegister }) {
  const [mode, setMode] = useState('login'); // login | register
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr(''); setBusy(true);
    const f = new FormData(e.target);
    try {
      let r;
      if (mode === 'register') {
        if (f.get('password') !== f.get('password2')) throw new Error('Heslá sa nezhodujú');
        r = await api.post('/auth/register', { name: f.get('name'), email: f.get('email'), password: f.get('password') });
      } else {
        r = await api.post('/auth/login', { email: f.get('email'), password: f.get('password') });
      }
      setToken(r.token);
      onLogin(r.user);
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-wrap">
      <div className="login-box">
        <div className="login-brand">
          <span className="login-logo">účto<span className="leaf"></span></span>
          <span className="login-brand-sub">ERP systém</span>
        </div>
        <p className="login-intro">Jednoduché účtovníctvo, faktúry, pokladňa, banka a sklad — všetko na jednom mieste.</p>
        <h2>{mode === 'register' ? 'Vytvoriť nový účet' : 'Prihlásenie'}</h2>
        <form onSubmit={submit}>
          {mode === 'register' && (
            <Frow label="Meno a priezvisko" req><input name="name" required autoFocus /></Frow>
          )}
          <Frow label="E-mail" req><input type="email" name="email" required autoFocus={mode === 'login'} /></Frow>
          <Frow label="Heslo" req><input type="password" name="password" required minLength={6} /></Frow>
          {mode === 'register' && (
            <Frow label="Heslo znova" req><input type="password" name="password2" required minLength={6} /></Frow>
          )}
          {err && <div className="login-err">⚠ {err}</div>}
          <div className="form-actions">
            <button className="btn primary" type="submit" disabled={busy}>
              {mode === 'register' ? '👤 Vytvoriť účet' : '→ Prihlásiť sa'}
            </button>
          </div>
        </form>
        {allowRegister && (
          <div className="login-switch">
            {mode === 'login'
              ? <>Nemáte účet? <a onClick={() => { setMode('register'); setErr(''); }}>Vytvoriť nový účet</a></>
              : <>Máte už účet? <a onClick={() => { setMode('login'); setErr(''); }}>Prihlásiť sa</a></>}
          </div>
        )}
        {mode === 'register' && (
          <p className="login-note">Registráciou sa automaticky vytvorí vaša vlastná firma, ktorej budete administrátorom.</p>
        )}
      </div>
    </div>
  );
}
