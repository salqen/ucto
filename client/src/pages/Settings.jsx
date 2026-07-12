import React, { useEffect, useState } from 'react';
import { api, eur } from '../api.js';
import { PageHead, Section, Frow, Modal } from '../components/ui.jsx';

export default function Settings() {
  const [s, setS] = useState(null);
  const [saved, setSaved] = useState(false);
  const [me, setMe] = useState(null);
  const [users, setUsers] = useState([]);
  const [userEdit, setUserEdit] = useState(null);   // nový používateľský účet
  const [accEdit, setAccEdit] = useState(null);     // bankový účet
  const [accounts, setAccounts] = useState([]);
  const [accMsg, setAccMsg] = useState('');

  const loadUsers = () => api.get('/auth/users').then(setUsers).catch(() => setUsers([]));
  const loadAccounts = () => api.get('/bankaccounts').then(setAccounts).catch(() => setAccounts([]));
  useEffect(() => {
    api.get('/settings').then(setS);
    api.get('/auth/me').then(r => setMe(r.user)).catch(() => {});
    loadUsers();
    loadAccounts();
  }, []);
  if (!s) return null;

  const setCo = (k, v) => setS(p => ({ ...p, company: { ...p.company, [k]: v } }));
  const save = async () => {
    await api.put('/settings', s);
    setSaved(true); setTimeout(() => setSaved(false), 2500);
  };
  const F = (k, label, req) => (
    <Frow label={label} req={req}>
      <input value={s.company[k] || ''} onChange={e => setCo(k, e.target.value)} />
    </Frow>
  );

  /* --- môj účet --- */
  const saveMe = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    try {
      const r = await api.put('/auth/me', {
        name: f.get('name'), email: f.get('email'),
        password: f.get('password') || undefined, oldPassword: f.get('oldPassword') || undefined
      });
      setMe(r.user); loadUsers();
      setAccMsg('✓ Účet uložený'); setTimeout(() => setAccMsg(''), 2500);
      e.target.reset();
    } catch (ex) { alert(ex.message); }
  };

  /* --- nový používateľský účet --- */
  const saveUser = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    if (f.get('password') !== f.get('password2')) return alert('Heslá sa nezhodujú');
    try {
      await api.post('/auth/register', { name: f.get('name'), email: f.get('email'), password: f.get('password') });
      setUserEdit(null); loadUsers();
      api.get('/auth/me').then(r => setMe(r.user)).catch(() => {});
    } catch (ex) { alert(ex.message); }
  };
  const delUser = async (u) => {
    if (!confirm(`Zmazať účet ${u.name} (${u.email})?`)) return;
    try { await api.del('/auth/users/' + u.id); loadUsers(); } catch (ex) { alert(ex.message); }
  };

  /* --- bankové účty --- */
  const saveAcc = async (e) => {
    e.preventDefault();
    const body = { ...accEdit, initial: Number(accEdit.initial || 0) };
    if (accEdit.id) await api.put('/bankaccounts/' + accEdit.id, body);
    else await api.post('/bankaccounts', body);
    setAccEdit(null); loadAccounts();
  };
  const delAcc = async (a) => {
    if (!confirm(`Zmazať bankový účet ${a.name}?`)) return;
    await api.del('/bankaccounts/' + a.id); loadAccounts();
  };

  return (
    <>
      <PageHead title="Nastavenia" />
      <Section title="Údaje o firme (dodávateľ na faktúrach)">
        <div className="form-grid">
          <div>
            {F('name', 'Obchodné meno', true)}
            {F('ico', 'IČO', true)}
            {F('dic', 'DIČ')}
            {F('icdph', 'IČ DPH')}
            <Frow label="Platiteľ DPH">
              <select value={s.company.vatPayer ? '1' : '0'} onChange={e => setCo('vatPayer', e.target.value === '1')}>
                <option value="0">Nie – nie je platiteľom DPH</option>
                <option value="1">Áno – platiteľ DPH</option>
              </select>
            </Frow>
            {F('register', 'Zápis v registri (napr. Okresný súd…)')}
          </div>
          <div>
            {F('street', 'Ulica a číslo')}
            {F('city', 'Mesto')}
            {F('zip', 'PSČ')}
            {F('country', 'Krajina')}
            {F('phone', 'Telefón')}
            {F('email', 'E-mail')}
            {F('owner', 'Vystavil (meno na faktúre)')}
          </div>
        </div>
      </Section>

      <Section title="Účtovné obdobie">
        <Frow label="Aktuálny rok">
          <input type="number" value={s.year} onChange={e => setS(p => ({ ...p, year: Number(e.target.value) }))} />
        </Frow>
      </Section>

      <div className="form-actions">
        <button className="btn primary" onClick={save}>💾 Ulož firemné údaje</button>
        {saved && <span style={{ alignSelf: 'center', color: '#5f9622', fontWeight: 700 }}>✓ Uložené</span>}
      </div>

      <Section title="Bankové účty (tlačia sa na faktúre)">
        <table className="grid">
          <thead><tr><th>Názov</th><th>Banka</th><th>Číslo účtu</th><th>SWIFT</th><th>IBAN</th><th className="num">Poč. stav</th><th></th></tr></thead>
          <tbody>
            {accounts.map(a => (
              <tr key={a.id} style={{ cursor: 'default' }}>
                <td><b>{a.name}</b></td><td>{a.bank}</td><td>{a.number}</td><td>{a.swift}</td><td>{a.iban}</td>
                <td className="num">{eur(a.initial)}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button className="btn" style={{ padding: '3px 8px' }} onClick={() => setAccEdit(a)}>Upraviť</button>{' '}
                  <button className="btn danger" style={{ padding: '3px 8px' }} onClick={() => delAcc(a)}>✕</button>
                </td>
              </tr>
            ))}
            {!accounts.length && <tr><td colSpan={7} style={{ textAlign: 'center', color: '#999' }}>Žiadne bankové účty</td></tr>}
          </tbody>
        </table>
        <div style={{ marginTop: 8 }}>
          <button className="btn primary" onClick={() => setAccEdit({ name: '', bank: '', number: '', swift: '', iban: '', initial: 0 })}>+ Nový bankový účet</button>
        </div>
      </Section>

      <Section title="Používateľský účet">
        {me ? (
          <div className="form-grid">
            <div>
              <h4 style={{ margin: '0 0 8px', color: '#555' }}>Môj účet</h4>
              <form onSubmit={saveMe}>
                <Frow label="Meno" req><input name="name" defaultValue={me.name} required /></Frow>
                <Frow label="E-mail" req><input type="email" name="email" defaultValue={me.email} required /></Frow>
                <Frow label="Pôvodné heslo"><input type="password" name="oldPassword" autoComplete="current-password" /></Frow>
                <Frow label="Nové heslo"><input type="password" name="password" minLength={6} autoComplete="new-password" placeholder="vyplňte len pri zmene" /></Frow>
                <div className="form-actions" style={{ justifyContent: 'flex-start' }}>
                  <button className="btn primary" type="submit">💾 Ulož účet</button>
                  {accMsg && <span style={{ alignSelf: 'center', color: '#5f9622', fontWeight: 700 }}>{accMsg}</span>}
                </div>
              </form>
            </div>
            <div>
              <h4 style={{ margin: '0 0 8px', color: '#555' }}>Všetky účty</h4>
              <table className="grid">
                <thead><tr><th>Meno</th><th>E-mail</th><th></th></tr></thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id} style={{ cursor: 'default' }}>
                      <td>{u.name}{u.id === me.id ? ' (ja)' : ''}</td><td>{u.email}</td>
                      <td>{u.id !== me.id && <button className="btn danger" style={{ padding: '3px 8px' }} onClick={() => delUser(u)}>✕</button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ marginTop: 8 }}>
                <button className="btn primary" onClick={() => setUserEdit({})}>👤 Vytvoriť nový účet</button>
              </div>
            </div>
          </div>
        ) : (
          <div>
            <p style={{ marginBottom: 10, color: '#666' }}>
              Zatiaľ nie je vytvorený žiadny používateľský účet — aplikácia je prístupná bez prihlásenia.
              Po vytvorení prvého účtu sa bude vyžadovať prihlásenie.
            </p>
            <button className="btn primary" onClick={() => setUserEdit({})}>👤 Vytvoriť nový účet</button>
          </div>
        )}
      </Section>

      {userEdit && (
        <Modal title="Vytvoriť nový účet" onClose={() => setUserEdit(null)}>
          <form onSubmit={saveUser}>
            <Frow label="Meno a priezvisko" req><input name="name" required /></Frow>
            <Frow label="E-mail" req><input type="email" name="email" required /></Frow>
            <Frow label="Heslo" req><input type="password" name="password" required minLength={6} /></Frow>
            <Frow label="Heslo znova" req><input type="password" name="password2" required minLength={6} /></Frow>
            <div className="form-actions">
              <button className="btn primary" type="submit">💾 Vytvoriť</button>
              <button className="btn" type="button" onClick={() => setUserEdit(null)}>Zrušiť</button>
            </div>
          </form>
        </Modal>
      )}

      {accEdit && (
        <Modal title={accEdit.id ? 'Bankový účet: ' + accEdit.name : 'Nový bankový účet'} onClose={() => setAccEdit(null)}>
          <form onSubmit={saveAcc}>
            <Frow label="Názov" req><input value={accEdit.name} required onChange={e => setAccEdit(p => ({ ...p, name: e.target.value }))} /></Frow>
            <Frow label="Banka"><input value={accEdit.bank || ''} placeholder="napr. Fio banka, a.s." onChange={e => setAccEdit(p => ({ ...p, bank: e.target.value }))} /></Frow>
            <Frow label="Číslo účtu"><input value={accEdit.number || ''} placeholder="napr. 2503152726/8330" onChange={e => setAccEdit(p => ({ ...p, number: e.target.value }))} /></Frow>
            <Frow label="SWIFT"><input value={accEdit.swift || ''} onChange={e => setAccEdit(p => ({ ...p, swift: e.target.value }))} /></Frow>
            <Frow label="IBAN"><input value={accEdit.iban || ''} onChange={e => setAccEdit(p => ({ ...p, iban: e.target.value }))} /></Frow>
            <Frow label="Počiatočný stav (€)"><input type="number" step="0.01" value={accEdit.initial} onChange={e => setAccEdit(p => ({ ...p, initial: e.target.value }))} /></Frow>
            <div className="form-actions">
              <button className="btn primary" type="submit">💾 Ulož</button>
              <button className="btn" type="button" onClick={() => setAccEdit(null)}>Zrušiť</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
