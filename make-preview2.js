/* ukazka.html s reálnymi dátami z bežiaceho servera */
const fs = require('fs'); const path = require('path');
const B = 'http://localhost:3000/api';
(async () => {
  const get = u => fetch(B + u).then(r => r.json());
  const data = {
    settings: await get('/settings'), categories: await get('/categories'),
    partners: await get('/partners'), cashboxes: await get('/cashboxes'),
    cashdocs: await get('/cashdocs'), bankaccounts: await get('/bankaccounts'),
    bankmoves: await get('/bankmoves'), products: await get('/products'),
    stockmoves: await get('/stockmoves'), orders: await get('/orders'),
    stock: await get('/stock'), dashboard: await get('/dashboard'),
    diary: await get('/diary'), closing: await get('/closing?year=2026'),
    manager: await get('/manager?year=2026')
  };
  const INV = await get('/invoices');
  const dist = path.join(__dirname, 'client', 'dist');
  const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
  const jsFile = (html.match(/src="\.\/(assets\/[^"]+\.js)"/) || [])[1];
  const cssFile = (html.match(/href="\.\/(assets\/[^"]+\.css)"/) || [])[1];
  const js = fs.readFileSync(path.join(dist, jsFile), 'utf8');
  const css = fs.readFileSync(path.join(dist, cssFile), 'utf8');
  const mock = `
<script>
(function(){
  const data = ${JSON.stringify(data)};
  const INV = ${JSON.stringify(INV)};
  const origFetch = window.fetch;
  window.fetch = function(url, opts){
    const s = String(url); const i = s.indexOf('/api/');
    if (i < 0) return origFetch.apply(this, arguments);
    const rest = s.slice(i + 5); const [pathPart, query] = rest.split('?'); const seg = pathPart.split('/');
    let body = null;
    if (seg[0] === 'invoices' && !seg[1]) {
      let rows = INV; const q = new URLSearchParams(query || '');
      if (q.get('type')) rows = rows.filter(r => r.type === q.get('type'));
      if (q.get('year')) rows = rows.filter(r => (r.issueDate||'').startsWith(q.get('year')));
      body = rows;
    } else if (seg[0] === 'diary') {
      const q = new URLSearchParams(query || '');
      let rows = data.diary.rows;
      if (q.get('year')) rows = rows.filter(r => (r.date||'').startsWith(q.get('year')));
      body = { initial: data.diary.initial, rows };
    } else if (data[seg[0]] !== undefined && !seg[1]) {
      body = data[seg[0]];
    } else if (opts && (opts.method === 'POST' || opts.method === 'PUT')) {
      body = Object.assign({id: 999}, JSON.parse(opts.body || '{}'));
      setTimeout(() => alert('DEMO režim: zmeny sa neukladajú. Plná verzia: npm start v priečinku keepi-erp.'), 50);
    } else body = {ok: true};
    return Promise.resolve(new Response(JSON.stringify(body), {status: 200, headers: {'Content-Type': 'application/json'}}));
  };
})();
</`+`script>`;
  const out = `<!DOCTYPE html>
<html lang="sk">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<link href="https://fonts.googleapis.com/css?family=Open+Sans:400,300,600,700&subset=latin,latin-ext" rel="stylesheet" />
<title>účtoERP – náhľad s dátami z keepi (len na čítanie)</title>
<style>${css}</style>
${mock}
<script type="module">${js.replace(/<\/script>/g, '<\\/script>')}</`+`script>
</head>
<body><div id="root"></div></body>
</html>`;
  fs.writeFileSync(path.join(__dirname, 'ukazka.html'), out, 'utf8');
  console.log('OK', Math.round(out.length/1024) + ' kB, faktur v demo:', INV.length);
})();
