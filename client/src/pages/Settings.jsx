import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { PageHead, Section, Frow } from '../components/ui.jsx';

export default function Settings() {
  const [s, setS] = useState(null);
  const [saved, setSaved] = useState(false);
  useEffect(() => { api.get('/settings').then(setS); }, []);
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
            {F('iban', 'IBAN')}
          </div>
          <div>
            {F('street', 'Ulica a číslo')}
            {F('city', 'Mesto')}
            {F('zip', 'PSČ')}
            {F('phone', 'Telefón')}
            {F('email', 'E-mail')}
          </div>
        </div>
      </Section>
      <Section title="Účtovné obdobie">
        <Frow label="Aktuálny rok">
          <input type="number" value={s.year} onChange={e => setS(p => ({ ...p, year: Number(e.target.value) }))} />
        </Frow>
      </Section>
      <div className="form-actions">
        <button className="btn primary" onClick={save}>💾 Ulož</button>
        {saved && <span style={{ alignSelf: 'center', color: '#5f9622', fontWeight: 700 }}>✓ Uložené</span>}
      </div>
    </>
  );
}
