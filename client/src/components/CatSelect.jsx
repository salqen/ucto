import React from 'react';

/*
 * CatSelect — výber druhu (kategórie) peňažného denníka so zoskupením
 * do optgroup podľa vplyvu na základ dane.
 * props:
 *  cats     - objekt z /api/categories: { P:[...], V:[...], groups:{B,N} }
 *  type     - 'P' (príjmy) | 'V' (výdavky)
 *  value    - vybraný kód
 *  onChange - (code) => void
 *  ...rest  - ostatné atribúty <select> (napr. required, style)
 */
export const GROUP_LABELS = { B: 'Ovplyvňujúce základ dane', N: 'Neovplyvňujúce základ dane' };

export function catList(cats, type) {
  return (cats && cats[type]) || [];
}

export function catName(cats, type, code) {
  const c = catList(cats, type).find(x => x.code === code);
  return c ? c.name : (code || '');
}

export default function CatSelect({ cats, type, value, onChange, includeAll, allLabel = 'Všetky druhy', ...rest }) {
  /* type 'all' | 'PV' → kombinovaný zoznam príjmov aj výdavkov */
  const combined = type !== 'P' && type !== 'V';
  const groups = (cats && cats.groups) || GROUP_LABELS;
  const renderGrouped = (list) => {
    const byGroup = {};
    const order = [];
    for (const c of list) {
      const g = c.group || '_';
      if (!byGroup[g]) { byGroup[g] = []; order.push(g); }
      byGroup[g].push(c);
    }
    if (!order.some(g => g !== '_')) return list.map(c => <option key={c.code} value={c.code}>{c.name}</option>);
    return order.map(g => g === '_'
      ? byGroup[g].map(c => <option key={c.code} value={c.code}>{c.name}</option>)
      : <optgroup key={g} label={groups[g] || g}>
          {byGroup[g].map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
        </optgroup>);
  };
  return (
    <select value={value || ''} onChange={e => onChange(e.target.value)} {...rest}>
      {includeAll && <option value="">{allLabel}</option>}
      {combined
        ? [<optgroup key="P" label="Príjmy">{catList(cats, 'P').map(c => <option key={c.code} value={c.code}>{c.name}</option>)}</optgroup>,
           <optgroup key="V" label="Výdavky">{catList(cats, 'V').map(c => <option key={c.code} value={c.code}>{c.name}</option>)}</optgroup>]
        : renderGrouped(catList(cats, type))}
    </select>
  );
}
