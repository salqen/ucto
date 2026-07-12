import React, { useEffect, useState } from 'react';
import { api, eur, dt, today } from '../api.js';
import { PageHead, Modal, Frow, useSort, SortTh } from '../components/ui.jsx';

export default function Warehouse() {
  const [tab, setTab] = useState('stock'); // stock | cards | moves
  const [stock, setStock] = useState([]);
  const [products, setProducts] = useState([]);
  const [moves, setMoves] = useState([]);
  const [partners, setPartners] = useState([]);
  const [editP, setEditP] = useState(null);
  const [editM, setEditM] = useState(null);
  const [sel, setSel] = useState(null);

  const load = () => {
    api.get('/stock').then(setStock);
    api.get('/products').then(setProducts);
    api.get('/stockmoves').then(setMoves);
  };
  useEffect(() => { load(); api.get('/partners').then(setPartners); }, []);

  const saveP = async (e) => {
    e.preventDefault();
    const body = { ...editP, price: Number(editP.price || 0), minStock: Number(editP.minStock || 0) };
    if (editP.id) await api.put('/products/' + editP.id, body); else await api.post('/products', body);
    setEditP(null); load();
  };
  const saveM = async (e) => {
    e.preventDefault();
    const body = { ...editM, productId: Number(editM.productId), qty: Number(editM.qty), price: Number(editM.price || 0), partnerId: editM.partnerId ? Number(editM.partnerId) : null };
    if (editM.id) await api.put('/stockmoves/' + editM.id, body); else await api.post('/stockmoves', body);
    setEditM(null); load();
  };
  const del = async (coll, row) => {
    if (!row || !confirm('Zmazať záznam?')) return;
    await api.del(`/${coll}/${row.id}`); setSel(null); load();
  };

  const [stockRows, stockSort, stockOnSort] = useSort(stock);
  const [prodRows, prodSort, prodOnSort] = useSort(products);
  const movesWithNames = [...moves]
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    .map(m => ({
      ...m,
      typeName: m.type === 'P' ? 'Príjemka' : 'Výdajka',
      productName: (products.find(p => p.id === m.productId) || {}).name || '',
      partnerName: (partners.find(p => p.id === m.partnerId) || {}).name || ''
    }));
  const [moveRows, moveSort, moveOnSort] = useSort(movesWithNames);

  return (
    <>
      <PageHead title="Sklad">
        <button className="btn primary" onClick={() => setEditP({ code: '', name: '', unit: 'ks', price: 0, vat: 23, minStock: 0 })}>+ Skladová karta</button>
        <button className="btn primary" disabled={!products.length} onClick={() => setEditM({ type: 'P', date: today(), productId: products[0]?.id, qty: 1, price: 0, note: '', partnerId: '' })}>📥 Príjemka</button>
        <button className="btn primary" disabled={!products.length} onClick={() => setEditM({ type: 'V', date: today(), productId: products[0]?.id, qty: 1, price: 0, note: '', partnerId: '' })}>📤 Výdajka</button>
      </PageHead>

      <div className="tabs">
        <button className={tab === 'stock' ? 'active' : ''} onClick={() => setTab('stock')}>Stav zásob</button>
        <button className={tab === 'cards' ? 'active' : ''} onClick={() => setTab('cards')}>Skladové karty</button>
        <button className={tab === 'moves' ? 'active' : ''} onClick={() => setTab('moves')}>Pohyby</button>
      </div>

      {tab === 'stock' && (
        <div className="grid-wrap">
          <table className="grid">
            <thead><tr>
              <SortTh label="Kód" k="code" sort={stockSort} onSort={stockOnSort} />
              <SortTh label="Názov" k="name" sort={stockSort} onSort={stockOnSort} />
              <SortTh label="MJ" k="unit" sort={stockSort} onSort={stockOnSort} />
              <SortTh label="Množstvo" k="qty" type="num" className="num" sort={stockSort} onSort={stockOnSort} />
              <SortTh label="Priem. cena" k="avgPrice" type="num" className="num" sort={stockSort} onSort={stockOnSort} />
              <SortTh label="Hodnota" k="value" type="num" className="num" sort={stockSort} onSort={stockOnSort} />
              <SortTh label="Min. zásoba" k="minStock" type="num" sort={stockSort} onSort={stockOnSort} />
            </tr></thead>
            <tbody>
              {stockRows.map(r => (
                <tr key={r.id} style={{ cursor: 'default', ...(r.minStock && r.qty < r.minStock ? { background: '#fdecea' } : {}) }}>
                  <td>{r.code}</td><td><b>{r.name}</b></td><td>{r.unit}</td>
                  <td className="num">{r.qty}</td><td className="num">{eur(r.avgPrice)}</td><td className="num">{eur(r.value)}</td>
                  <td>{r.minStock || ''}{r.minStock && r.qty < r.minStock ? ' ⚠ podlimit' : ''}</td>
                </tr>
              ))}
              {!stock.length && <tr><td colSpan={7} style={{ textAlign: 'center', color: '#999' }}>Žiadne skladové karty</td></tr>}
            </tbody>
            <tfoot><tr><td colSpan={5}>Stav zásob celkom</td><td className="num">{eur(stock.reduce((s, r) => s + r.value, 0))}</td><td></td></tr></tfoot>
          </table>
        </div>
      )}

      {tab === 'cards' && (
        <>
          <div className="toolbar">
            <button className="btn" disabled={!sel} onClick={() => setEditP(sel)}>Úprava</button>
            <button className="btn danger" disabled={!sel} onClick={() => del('products', sel)}>Zmazať</button>
          </div>
          <div className="grid-wrap">
            <table className="grid">
              <thead><tr>
                <SortTh label="Kód" k="code" sort={prodSort} onSort={prodOnSort} />
                <SortTh label="Názov" k="name" sort={prodSort} onSort={prodOnSort} />
                <SortTh label="MJ" k="unit" sort={prodSort} onSort={prodOnSort} />
                <SortTh label="Predajná cena" k="price" type="num" className="num" sort={prodSort} onSort={prodOnSort} />
                <SortTh label="DPH %" k="vat" type="num" className="num" sort={prodSort} onSort={prodOnSort} />
                <SortTh label="Min. zásoba" k="minStock" type="num" className="num" sort={prodSort} onSort={prodOnSort} />
              </tr></thead>
              <tbody>
                {prodRows.map(r => (
                  <tr key={r.id} className={sel?.id === r.id ? 'sel' : ''} onClick={() => setSel(r)} onDoubleClick={() => setEditP(r)}>
                    <td>{r.code}</td><td><b>{r.name}</b></td><td>{r.unit}</td>
                    <td className="num">{eur(r.price)}</td><td className="num">{r.vat}</td><td className="num">{r.minStock}</td>
                  </tr>
                ))}
                {!products.length && <tr><td colSpan={6} style={{ textAlign: 'center', color: '#999' }}>Žiadne skladové karty</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'moves' && (
        <>
          <div className="toolbar">
            <button className="btn" disabled={!sel} onClick={() => setEditM(sel)}>Úprava</button>
            <button className="btn danger" disabled={!sel} onClick={() => del('stockmoves', sel)}>Zmazať</button>
          </div>
          <div className="grid-wrap">
            <table className="grid">
              <thead><tr>
                <SortTh label="Doklad č." k="number" sort={moveSort} onSort={moveOnSort} />
                <SortTh label="Dátum" k="date" type="date" sort={moveSort} onSort={moveOnSort} />
                <SortTh label="Typ" k="typeName" sort={moveSort} onSort={moveOnSort} />
                <SortTh label="Položka" k="productName" sort={moveSort} onSort={moveOnSort} />
                <SortTh label="Množstvo" k="qty" type="num" className="num" sort={moveSort} onSort={moveOnSort} />
                <SortTh label="Cena/MJ" k="price" type="num" className="num" sort={moveSort} onSort={moveOnSort} />
                <SortTh label="Partner" k="partnerName" sort={moveSort} onSort={moveOnSort} />
                <SortTh label="Poznámka" k="note" sort={moveSort} onSort={moveOnSort} />
              </tr></thead>
              <tbody>
                {moveRows.map(r => (
                  <tr key={r.id} className={sel?.id === r.id ? 'sel' : ''} onClick={() => setSel(r)} onDoubleClick={() => setEditM(r)}>
                    <td>{r.number}</td><td>{dt(r.date)}</td>
                    <td>{r.typeName}</td>
                    <td>{r.productName}</td>
                    <td className="num">{r.qty}</td><td className="num">{eur(r.price)}</td>
                    <td>{r.partnerName}</td>
                    <td>{r.note}</td>
                  </tr>
                ))}
                {!moves.length && <tr><td colSpan={8} style={{ textAlign: 'center', color: '#999' }}>Žiadne pohyby</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}

      {editP && (
        <Modal title={editP.id ? 'Skladová karta: ' + editP.name : 'Nová skladová karta'} onClose={() => setEditP(null)}>
          <form onSubmit={saveP}>
            <Frow label="Kód"><input value={editP.code} onChange={e => setEditP(p => ({ ...p, code: e.target.value }))} /></Frow>
            <Frow label="Názov" req><input value={editP.name} required onChange={e => setEditP(p => ({ ...p, name: e.target.value }))} /></Frow>
            <Frow label="MJ"><input value={editP.unit} onChange={e => setEditP(p => ({ ...p, unit: e.target.value }))} /></Frow>
            <Frow label="Predajná cena (€)"><input type="number" step="0.01" value={editP.price} onChange={e => setEditP(p => ({ ...p, price: e.target.value }))} /></Frow>
            <Frow label="DPH %">
              <select value={editP.vat} onChange={e => setEditP(p => ({ ...p, vat: Number(e.target.value) }))}>
                <option value={23}>23</option><option value={19}>19</option><option value={5}>5</option><option value={0}>0</option>
              </select>
            </Frow>
            <Frow label="Minimálna zásoba"><input type="number" step="0.01" value={editP.minStock} onChange={e => setEditP(p => ({ ...p, minStock: e.target.value }))} /></Frow>
            <div className="form-actions">
              <button className="btn primary" type="submit">💾 Ulož</button>
              <button className="btn" type="button" onClick={() => setEditP(null)}>Zrušiť</button>
            </div>
          </form>
        </Modal>
      )}

      {editM && (
        <Modal title={editM.id ? 'Pohyb ' + editM.number : (editM.type === 'P' ? 'Nová príjemka' : 'Nová výdajka')} onClose={() => setEditM(null)}>
          <form onSubmit={saveM}>
            <Frow label="Typ" req>
              <select value={editM.type} onChange={e => setEditM(p => ({ ...p, type: e.target.value }))}>
                <option value="P">Príjemka</option><option value="V">Výdajka</option>
              </select>
            </Frow>
            <Frow label="Dátum" req><input type="date" value={editM.date} required onChange={e => setEditM(p => ({ ...p, date: e.target.value }))} /></Frow>
            <Frow label="Položka" req>
              <select value={editM.productId} onChange={e => setEditM(p => ({ ...p, productId: e.target.value }))}>
                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Frow>
            <Frow label="Množstvo" req><input type="number" step="0.01" min="0.01" value={editM.qty} required onChange={e => setEditM(p => ({ ...p, qty: e.target.value }))} /></Frow>
            <Frow label="Cena/MJ (€)"><input type="number" step="0.01" value={editM.price} onChange={e => setEditM(p => ({ ...p, price: e.target.value }))} /></Frow>
            <Frow label="Partner">
              <select value={editM.partnerId || ''} onChange={e => setEditM(p => ({ ...p, partnerId: e.target.value }))}>
                <option value="">—</option>
                {partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Frow>
            <Frow label="Poznámka"><input value={editM.note || ''} onChange={e => setEditM(p => ({ ...p, note: e.target.value }))} /></Frow>
            <div className="form-actions">
              <button className="btn primary" type="submit">💾 Ulož</button>
              <button className="btn" type="button" onClick={() => setEditM(null)}>Zrušiť</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
