/* Vytvorí ukazka.html - samostatnú demo verziu (bez servera, s ukážkovými dátami) */
const fs = require('fs');
const path = require('path');

const dist = path.join(__dirname, 'client', 'dist');
const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
const jsFile = (html.match(/src="\.\/(assets\/[^"]+\.js)"/) || [])[1];
const cssFile = (html.match(/href="\.\/(assets\/[^"]+\.css)"/) || [])[1];
const js = fs.readFileSync(path.join(dist, jsFile), 'utf8');
const css = fs.readFileSync(path.join(dist, cssFile), 'utf8');

const mock = `
<script>
(function(){
  const P = [
    {id:1,name:'LEONARDO s.r.o.',ico:'36543219',dic:'2021987654',icdph:'SK2021987654',street:'Hlavná 12',city:'Bratislava',zip:'811 01',email:'info@leonardo.sk',phone:'+421 900 111 222',iban:'SK12 1100 0000 0026 1234 5678'},
    {id:2,name:'Harmónia plus, a.s.',ico:'31333444',dic:'2020333444',street:'Kvetná 8',city:'Nitra',zip:'949 01',email:'obchod@harmonia.sk'},
    {id:3,name:'Ján Malý - SHR',ico:'40555666',dic:'1045556666',street:'Poľná 3',city:'Trnava',zip:'917 01'}
  ];
  const INV = [
    {id:1,type:'INO',number:'VF2026070098',vs:'2026070098',partnerId:1,partnerName:'LEONARDO s.r.o.',issueDate:'2026-07-01',deliveryDate:'2026-07-01',dueDate:'2026-07-16',currency:'EUR',total:480.55,paid:0,items:[{name:'Servisné práce',qty:7,unit:'hod',price:55.87,vat:23}]},
    {id:2,type:'INO',number:'VF2026030097',vs:'2026030097',partnerId:2,partnerName:'Harmónia plus, a.s.',issueDate:'2026-03-24',deliveryDate:'2026-03-24',dueDate:'2026-04-07',currency:'EUR',total:238.00,paid:238.00,items:[{name:'Tovar A',qty:10,unit:'ks',price:19.35,vat:23}]},
    {id:3,type:'INO',number:'VF2026020096',vs:'2026020096',partnerId:3,partnerName:'Ján Malý - SHR',issueDate:'2026-02-16',deliveryDate:'2026-02-16',dueDate:'2026-03-02',currency:'EUR',total:286.90,paid:0,items:[{name:'Konzultácie',qty:4,unit:'hod',price:58.31,vat:23}]},
    {id:4,type:'INI',number:'DF2026060012',vs:'6612026',partnerId:2,partnerName:'Harmónia plus, a.s.',issueDate:'2026-06-10',dueDate:'2026-06-24',currency:'EUR',total:157.20,paid:157.20,items:[{name:'Materiál',qty:1,unit:'ks',price:131,vat:20}]}
  ];
  const CATS = {P:[{code:'PT',name:'Predaj tovaru',tax:true},{code:'PS',name:'Predaj výrobkov a služieb',tax:true},{code:'OP',name:'Ostatné príjmy',tax:true},{code:'DPHP',name:'DPH prijatá',tax:false},{code:'VP',name:'Vklad podnikateľa',tax:false},{code:'UP',name:'Úhrada pohľadávky',tax:true}],V:[{code:'NM',name:'Nákup materiálu',tax:true},{code:'NT',name:'Nákup tovaru',tax:true},{code:'MZ',name:'Mzdy',tax:true},{code:'PO',name:'Poistné a odvody',tax:true},{code:'PR',name:'Prevádzková réžia',tax:true},{code:'OV',name:'Ostatné výdavky',tax:true},{code:'DPHZ',name:'DPH zaplatená',tax:false},{code:'OS',name:'Osobná spotreba',tax:false}]};
  const CASH = [
    {id:1,cashboxId:1,type:'P',number:'PPD2026070001',date:'2026-07-02',partnerId:2,text:'Tržba za tovar',category:'PT',amount:238.00},
    {id:2,cashboxId:1,type:'V',number:'VPD2026070001',date:'2026-07-06',text:'Kancelárske potreby',category:'PR',amount:45.90}
  ];
  const BANK = [
    {id:1,accountId:1,type:'P',number:'BV2026040001',date:'2026-04-02',partnerId:2,text:'Úhrada faktúry VF2026030097',category:'UP',amount:238.00,vs:'2026030097'},
    {id:2,accountId:1,type:'V',number:'BV2026060002',date:'2026-06-25',partnerId:2,text:'Úhrada DF2026060012',category:'OV',amount:157.20}
  ];
  const PROD = [
    {id:1,code:'T001',name:'Tovar A',unit:'ks',price:23.80,vat:23,minStock:10},
    {id:2,code:'T002',name:'Tovar B',unit:'ks',price:12.50,vat:23,minStock:5}
  ];
  const data = {
    settings: {company:{name:'Moja firma s.r.o.',ico:'12345678',dic:'2020123456',icdph:'SK2020123456',street:'Hlavná 1',city:'Bratislava',zip:'811 01',iban:'SK89 0900 0000 0001 2345 6789'},year:2026},
    categories: CATS,
    partners: P,
    cashboxes: [{id:1,name:'Hlavná pokladňa',initial:150}],
    cashdocs: CASH,
    bankaccounts: [{id:1,name:'Podnikateľský účet',iban:'SK89 0900 0000 0001 2345 6789',initial:1000}],
    bankmoves: BANK,
    products: PROD,
    stockmoves: [{id:1,type:'P',number:'PRI2026010001',date:'2026-01-10',productId:1,qty:100,price:12},{id:2,type:'V',number:'VYD2026020001',date:'2026-02-16',productId:1,qty:35,price:0},{id:3,type:'P',number:'PRI2026030002',date:'2026-03-05',productId:2,qty:40,price:8}],
    orders: [{id:1,number:'OBJ2026060001',date:'2026-06-20',partnerId:1,partnerName:'LEONARDO s.r.o.',subject:'Dodávka tovaru A',total:1200,state:'potvrdená',note:''},{id:2,number:'OBJ2026070002',date:'2026-07-03',partnerId:3,partnerName:'Ján Malý - SHR',subject:'Servis strojov',total:350,state:'nová',note:'do konca júla'}],
    stock: [{id:1,code:'T001',name:'Tovar A',unit:'ks',price:23.80,vat:23,minStock:10,qty:65,avgPrice:12,value:780},{id:2,code:'T002',name:'Tovar B',unit:'ks',price:12.50,vat:23,minStock:5,qty:40,avgPrice:8,value:320}],
    dashboard: {overdueCount:2,overdueSum:767.45,incomingCount:0,incomingSum:0,iOwe:0,oweMe:767.45,income:476,expense:203.10,cashBal:342.10,bankBal:1080.80,stockValue:1100,profit:272.90,money:1422.90,partnersCount:3,
      lastDocs:[{number:'VF2026070098',type:'INO',total:480.55},{number:'DF2026060012',type:'INI',total:157.20},{number:'VF2026030097',type:'INO',total:238.00},{number:'VF2026020096',type:'INO',total:286.90}]},
    diary: {initial:1150,rows:[
      {src:'BAN',srcName:'Podnikateľský účet',type:'P',number:'BV2026040001',date:'2026-04-02',partnerName:'Harmónia plus, a.s.',text:'Úhrada faktúry VF2026030097',categoryName:'Úhrada pohľadávky',amount:238.00,balance:1388},
      {src:'BAN',srcName:'Podnikateľský účet',type:'V',number:'BV2026060002',date:'2026-06-25',partnerName:'Harmónia plus, a.s.',text:'Úhrada DF2026060012',categoryName:'Ostatné výdavky',amount:157.20,balance:1230.80},
      {src:'POK',srcName:'Hlavná pokladňa',type:'P',number:'PPD2026070001',date:'2026-07-02',partnerName:'Harmónia plus, a.s.',text:'Tržba za tovar',categoryName:'Predaj tovaru',amount:238.00,balance:1468.80},
      {src:'POK',srcName:'Hlavná pokladňa',type:'V',number:'VPD2026070001',date:'2026-07-06',partnerName:'',text:'Kancelárske potreby',categoryName:'Prevádzková réžia',amount:45.90,balance:1422.90}
    ]},
    closing: {year:'2026',
      income:[{code:'PT',name:'Predaj tovaru',tax:true,sum:238},{code:'PS',name:'Predaj výrobkov a služieb',tax:true,sum:0},{code:'OP',name:'Ostatné príjmy',tax:true,sum:0},{code:'DPHP',name:'DPH prijatá',tax:false,sum:0},{code:'VP',name:'Vklad podnikateľa',tax:false,sum:0},{code:'UP',name:'Úhrada pohľadávky',tax:true,sum:238}],
      expense:[{code:'NM',name:'Nákup materiálu',tax:true,sum:0},{code:'NT',name:'Nákup tovaru',tax:true,sum:0},{code:'MZ',name:'Mzdy',tax:true,sum:0},{code:'PO',name:'Poistné a odvody',tax:true,sum:0},{code:'PR',name:'Prevádzková réžia',tax:true,sum:45.90},{code:'OV',name:'Ostatné výdavky',tax:true,sum:157.20},{code:'DPHZ',name:'DPH zaplatená',tax:false,sum:0},{code:'OS',name:'Osobná spotreba',tax:false,sum:0}],
      incomeTotal:476,expenseTotal:203.10,incomeTax:476,expenseTax:203.10,profit:272.90},
    manager: {year:'2026',months:[
      {month:1,income:0,expense:0,profit:0},{month:2,income:0,expense:0,profit:0},{month:3,income:0,expense:0,profit:0},
      {month:4,income:238,expense:0,profit:238},{month:5,income:0,expense:0,profit:0},{month:6,income:0,expense:157.20,profit:-157.20},
      {month:7,income:238,expense:45.90,profit:192.10},{month:8,income:0,expense:0,profit:0},{month:9,income:0,expense:0,profit:0},
      {month:10,income:0,expense:0,profit:0},{month:11,income:0,expense:0,profit:0},{month:12,income:0,expense:0,profit:0}
    ]}
  };
  const origFetch = window.fetch;
  window.fetch = function(url, opts){
    const s = String(url);
    const i = s.indexOf('/api/');
    if (i < 0) return origFetch.apply(this, arguments);
    const rest = s.slice(i + 5);
    const [pathPart, query] = rest.split('?');
    const seg = pathPart.split('/');
    let body = null;
    if (seg[0] === 'invoices' && !seg[1]) {
      let rows = INV;
      const q = new URLSearchParams(query || '');
      if (q.get('type')) rows = rows.filter(r => r.type === q.get('type'));
      body = rows;
    } else if (data[seg[0]] !== undefined && !seg[1]) {
      body = data[seg[0]];
    } else if (opts && (opts.method === 'POST' || opts.method === 'PUT')) {
      body = Object.assign({id: 999}, JSON.parse(opts.body || '{}'));
      setTimeout(() => alert('DEMO režim: údaje sa neukladajú. Plná verzia beží cez "npm start".'), 50);
    } else {
      body = {ok: true};
    }
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
<title>účtoERP – DEMO (bez servera)</title>
<style>${css}</style>
${mock}
<script type="module">${js.replace(/<\/script>/g, '<\\/script>')}</`+`script>
</head>
<body>
<div id="root"></div>
</body>
</html>`;

fs.writeFileSync(path.join(__dirname, 'ukazka.html'), out, 'utf8');
console.log('OK ukazka.html', Math.round(out.length / 1024) + ' kB');

/* tour verzia */
const tourScript = `
<script>
(function(){
  const routes=['/','/faktury/vysle','/faktury/INO/nova','/partneri','/dennik','/pokladna','/banka','/sklad','/objednavky','/uzavierka','/manazer','/nastavenia'];
  let i=0;
  const badge=document.createElement('div');
  badge.style.cssText='position:fixed;bottom:8px;right:8px;background:#1d1d1b;color:#76b82a;padding:4px 10px;font:12px monospace;z-index:9999';
  window.addEventListener('DOMContentLoaded',()=>{document.body.appendChild(badge);show();});
  function show(){ badge.textContent='TOUR '+(i+1)+'/'+routes.length+' '+routes[i]; }
  setInterval(()=>{ i=(i+1)%routes.length; location.hash='#'+routes[i]; show(); },8000);
})();
</`+`script>`;
const tour = out.replace('</head>', tourScript + '\n</head>');
fs.writeFileSync(path.join(__dirname, 'ukazka-tour.html'), tour, 'utf8');
console.log('OK ukazka-tour.html');
