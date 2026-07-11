/* Import dát z keepi.eu do účtoERP db.json */
const fs = require('fs');

const PART = [
[37,"OBEC POLUVSIE Obecný úrad","00318418","","","","Pravenec","","","",""],
[9,"ZUŠ L.Stančeka v Prievidzi","3612993","","","","PRIEVIDZA","","","",""],
[55,"alžbeta Burska","","","","","Brodské","","","",""],
[29,"Anton Antokhov Warden Chartering s.r.o.","54765145","","SK2121780617","","Prievidza","","","",""],
[54,"Art kino Baník","42281636","","","","Prievidza","","","",""],
[52,"Centrum účelových zariadení - Prevádzka Maják Senec","42137004","","SK2022739697","","Piešťany","","","",""],
[28,"DHZ BOZPO","50642626","","","","PRIEVIDZA","","","",""],
[21,"Dominika Rybárová","","","","","Prievidza","","","",""],
[24,"DUKE s.r.o.","36338737","","SK2021888055","","Prievidza","","","",""],
[34,"dyera","55420036","","","","PRIEVIDZA","","","",""],
[1,"Helena Galbavá","","","","","Handlová","","","",""],
[49,"helena galbavá","","","","","handlová","","","",""],
[40,"Hronský. s,r,o,","50104845","","SK2120177455","","PRIEVIDZA","","","",""],
[10,"Ing. Miloš Kováčik - AZET","30424933","","","","Prievidza","","","",""],
[14,"Ing.Katarína Doničová BOZPO","34960015","","SK1020050581","","PRIEVIDZA","","","",""],
[32,"INSANE s. r. o.","48175064","","SK2120106219","","Bratislava","","","",""],
[50,"IRIS  IV. n,o,","45740429","","","","Skačany 3","","","",""],
[5,"Iveta Ragulíková","","","","","Prievidza","","","",""],
[38,"Jabloň spol. sr.o.","50527363","","SK2120360044","","Prievidza","","","",""],
[48,"JFP spol, s r,o,","51819627","","","","Banská Bystrica","","","",""],
[23,"JFP spol. s.r.o.","35184884","","","","Prievidza","","","",""],
[2,"Jozef Mihálik","","","","","Prievidza","","","",""],
[27,"JPF spol. s r.o.","51819627","","","","Banská Bystrica","","","",""],
[20,"Judr Robert Šorl","","","","","Handlová","","","",""],
[22,"K-2000 Združenie na podporu kultúry Hornej Nitry","36120537","","","","Prievidza","","","",""],
[25,"Kass príspevková org, mesta Prievidza","00516 988","","SK2021160317","","Prievidza","","","",""],
[31,"KLAK, s.r.o.","36 775 550","","SK2022380294","","Klačno","","","",""],
[26,"KreBul,o.p.s.","28553268","","","","Prachatice","","","",""],
[36,"Kroje M V  s,r.o","55102123","","","","Nitrianske Pravno","","","",""],
[51,"Kultúrne a spoločenské stredisko v Prievidzi","00516988","","SK2021160317","","Prievidza","","","",""],
[33,"Kultúrne centrum Bojnice príspevková organizáciamesta","42024960","","SK2022471330","","BOJNICE","","","",""],
[3,"Ladislav Brida","","","","","Banská Bystrica","","","",""],
[16,"M+M Nova","44872011","","SK2022857562","","Nováky","","","",""],
[30,"MD SLOVENSKO s,r,o,","48292061","","SK2120122543","","Prievidza","","","",""],
[43,"MDSK servis s.r.o.","52221792","","","","Poprad","","","",""],
[8,"MESTSKÝ ÚRAD","318442","","","","Prievidza","","","",""],
[47,"Mgr Alžbeta Búrska","","","","","Brodskě","","","",""],
[39,"MUDr. Peter Oulehle ORT-OF s.r.o.","36350150","","","","Prievidza","","","",""],
[41,"Múzeum VTEDY","51987040","","","","PRIEVIDZA","","","",""],
[11,"Občianske združenie Hornonitrie","31201822","","","","Nitrianske Pravno","","","",""],
[12,"Obecný úrad Malinová","00318281","","","","Nitrianske Pravno","","","",""],
[45,"oocr","","","","","","","","",""],
[6,"ORVA color s.r.o.","44786093","","SK2022821603","","Prievidza","","","",""],
[46,"RegiónHORNÁ NITRA BOJNICE oocr","","","","","BOJNICE","","","",""],
[13,"Rímskokatolícka cirkev - Farnosť Handlová","31938655","","","","Handlová","","","",""],
[19,"RKC Prievidza","34059113","","","","Prievidza","","","",""],
[35,"Slovenské národné múzeum","00164721","","SK2020603068","","Bratislava - staré mesto","","","",""],
[44,"Slovenský akvarel OZ","54197473","","","","Hviezdoslavov","","","",""],
[53,"Spoločnosť Joga v dennom živote - pobočka Prievidza","30231761","","","","Prievidza","","","",""],
[42,"Spoločnosť Joga v dennom živote, pobočka Prievidza","30231761","","","","Prievidza","","","",""],
[17,"Stober s.r.o.","31362249","","SK2020469231","","PRIEVIDZA","","","",""],
[7,"ŠPORTSTAV PRIEVIDZA spol.s r.o.","31578012","","","","","","","",""],
[18,"Športstav spol.s r.o","31578012","","","","Prievidza","","","",""],
[4,"Základná škola","31201725","","","","Prievidza","","","",""],
[15,"Zuš Ladislava Stančeka","3612993","","","","PRIEVIDZA","","","",""]
];

const INV = [
["VF2026070098","Slovenské národné múzeum","2026-07-02",480.55,0,"gray"],
["VF2026030097","Art kino Baník","2026-03-31",238,0,"red"],
["VF2026020096","Spoločnosť Joga v dennom živote - pobočka Prievidza","2026-02-16",286.9,0,"red"],
["VF2026010095","Centrum účelových zariadení - Prevádzka Maják Senec","2026-01-07",800,0,"red"],
["VF2025120094","Slovenské národné múzeum","2025-12-03",200,0,"red"],
["VF2025120093","Kultúrne a spoločenské stredisko v Prievidzi","2025-12-02",103.7,0,"red"],
["VF2025080092","IRIS  IV. n,o,","2025-08-15",90,0,"red"],
["VF2025080089","JPF spol. s r.o.","2025-08-06",97.66,0,"red"],
["VF2025090091","helena galbavá","2025-07-24",55,0,"red"],
["VF2025070088","dyera","2025-07-24",100,0,"red"],
["VF2025070090","Iveta Ragulíková","2025-07-12",15,15,"green"],
["VF2025060087","alžbeta Burska","2025-06-12",192,0,"red"],
["VF2025010086","K-2000 Združenie na podporu kultúry Hornej Nitry","2025-01-19",300,0,"red"],
["VF2024120085","RegiónHORNÁ NITRA BOJNICE oocr","2024-12-19",472,0,"red"],
["VF2024110084","Múzeum VTEDY","2024-11-12",32.08,0,"red"],
["VF2024110083","MDSK servis s.r.o.","2024-11-12",31,0,"red"],
["VF2024100082","RegiónHORNÁ NITRA BOJNICE oocr","2024-11-12",466.26,0,"red"],
["VF2024090081","Slovenský akvarel OZ","2024-09-24",32.78,0,"red"],
["VF2024080080","Spoločnosť Joga v dennom živote, pobočka Prievidza","2024-08-29",190,0,"red"],
["VF2024070079","MDSK servis s.r.o.","2024-07-28",29.22,0,"red"],
["VF2024070078","Múzeum VTEDY","2024-07-24",106.8,0,"red"],
["VF2024070077","Múzeum VTEDY","2024-07-24",151.83,0,"red"],
["VF2024070076","Múzeum VTEDY","2024-07-23",104.58,0,"red"],
["VF2024070075","Slovenské národné múzeum","2024-07-09",348.6,0,"red"],
["VF2024060074","Hronský. s,r,o,","2024-06-28",234.65,0,"red"],
["VF2024060073","MUDr. Peter Oulehle ORT-OF s.r.o.","2024-06-18",69.3,0,"red"],
["VF2024060072","K-2000 Združenie na podporu kultúry Hornej Nitry","2024-06-14",43.5,0,"red"],
["VF2024060071","dyera","2024-06-12",60,0,"red"],
["VF2024060070","MUDr. Peter Oulehle ORT-OF s.r.o.","2024-06-06",168.56,0,"red"],
["VF2024050069","dyera","2024-05-22",28.95,0,"red"],
["VF2024050068","dyera","2024-05-15",38.05,0,"red"],
["VF2024050067","ZUŠ L.Stančeka v Prievidzi","2024-05-10",23.63,0,"red"],
["VF2024040066","Jabloň spol. sr.o.","2024-04-23",215.18,0,"red"],
["VF2024030065","dyera","2024-03-03",275,0,"red"],
["VF2024030064","dyera","2024-03-03",98.73,0,"red"],
["VF2024020063","Stober s.r.o.","2024-02-29",199,0,"red"],
["VF2024020062","M+M Nova","2024-02-29",216,0,"red"],
["VF2024020061","JFP spol. s.r.o.","2024-02-22",159.71,0,"red"],
["VF2024010060","OBEC POLUVSIE Obecný úrad","2024-01-18",340.28,0,"red"],
["VF2023120059","Kroje M V  s,r.o","2023-12-12",313.04,0,"red"],
["VF2023100058","Slovenské národné múzeum","2023-10-26",694.63,0,"red"],
["VF2023100057","dyera","2023-10-23",196,0,"red"],
["VF2023080056","INSANE s. r. o.","2023-08-18",80,0,"red"],
["VF2023050049","DHZ BOZPO","2023-08-03",250,0,"red"],
["VF2023070055","K-2000 Združenie na podporu kultúry Hornej Nitry","2023-07-26",179.94,0,"red"],
["VF2023070053","Helena Galbavá","2023-07-19",350,0,"red"],
["VF2023060054","Kultúrne centrum Bojnice príspevková organizáciamesta","2023-06-22",282,0,"red"],
["VF2023050052","INSANE s. r. o.","2023-05-30",300,0,"red"],
["VF2023050051","MD SLOVENSKO s,r,o,","2023-05-28",480,0,"red"],
["VF2023050050","MD SLOVENSKO s,r,o,","2023-05-22",177.63,0,"red"],
["VF2023050048","Ladislav Brida","2023-05-05",177,0,"red"],
["VF2023040047","MD SLOVENSKO s,r,o,","2023-04-19",295.38,0,"red"],
["VF2023030046","KLAK, s.r.o.","2023-03-16",300,0,"red"],
["VF2023010045","MD SLOVENSKO s,r,o,","2023-01-29",279,0,"red"],
["VF2023010044","Anton Antokhov Warden Chartering s.r.o.","2023-01-17",88.67,0,"red"],
["VF2022110043","DHZ BOZPO","2022-11-15",764.81,0,"red"],
["VF2022100042","JPF spol. s r.o.","2022-10-15",389.48,0,"red"],
["VF2022070041","KreBul,o.p.s.","2022-07-09",188.54,0,"red"],
["VF2018120040","KreBul,o.p.s.","2022-07-09",477.46,0,"red"],
["VF2022050039","ZUŠ L.Stančeka v Prievidzi","2022-05-19",25.05,0,"red"],
["VF2022050038","Kass príspevková org, mesta Prievidza","2022-05-19",90,0,"red"],
["VF2022050037","DUKE s.r.o.","2022-05-19",107.38,0,"red"],
["VF2021120036","K-2000 Združenie na podporu kultúry Hornej Nitry","2021-12-31",229.3,0,"red"],
["VF2021090035","K-2000 Združenie na podporu kultúry Hornej Nitry","2021-09-23",360,0,"red"],
["VF2021090034","K-2000 Združenie na podporu kultúry Hornej Nitry","2021-09-23",200,0,"red"],
["VF2021090033","JFP spol. s.r.o.","2021-09-03",95.4,0,"red"],
["VF2021080032","K-2000 Združenie na podporu kultúry Hornej Nitry","2021-08-26",330,0,"red"],
["VF2021080031","K-2000 Združenie na podporu kultúry Hornej Nitry","2021-08-26",600,0,"red"],
["VF2021080030","Rímskokatolícka cirkev - Farnosť Handlová","2021-08-25",600,0,"red"],
["VF2020090029","Helena Galbavá","2020-09-16",946,0,"red"],
["VF2020090028","ORVA color s.r.o.","2020-09-04",373.51,0,"red"],
["VF2020070027","ORVA color s.r.o.","2020-07-08",211.45,0,"red"],
["VF2020020026","Ing. Miloš Kováčik - AZET","2020-02-20",28.97,0,"red"],
["VF2020020025","Judr Robert Šorl","2020-02-20",13.9,0,"red"],
["VF2020020024","Helena Galbavá","2020-02-12",400,0,"red"],
["VF2020020023","RKC Prievidza","2020-02-10",140,0,"red"],
["VF2020010022","Športstav spol.s r.o","2020-01-31",40.32,0,"red"],
["VF2020010021","Ladislav Brida","2020-01-23",210,0,"red"],
["VF2019120018","Zuš Ladislava Stančeka","2019-12-12",91.96,0,"red"],
["VF2019120020","Stober s.r.o.","2019-12-06",106.51,0,"red"],
["VF2019120019","M+M Nova","2019-12-06",106.08,0,"red"],
["VF2019120017","Ing.Katarína Doničová BOZPO","2019-12-06",69.77,0,"red"],
["VF2019110016","Rímskokatolícka cirkev - Farnosť Handlová","2019-11-11",560,0,"red"],
["VF2019080015","Obecný úrad Malinová","2019-08-15",19.18,0,"red"],
["VF2019070014","Dominika Rybárová","2019-08-08",70,0,"red"],
["VF2019070013","Občianske združenie Hornonitrie","2019-07-01",132.8,0,"red"],
["VF2019050012","Ing. Miloš Kováčik - AZET","2019-05-30",134.13,0,"red"],
["VF2019050011","ZUŠ L.Stančeka v Prievidzi","2019-05-26",9.04,0,"red"],
["VF2019050010","MESTSKÝ ÚRAD","2019-05-17",37.03,0,"red"],
["VF2019050009","Ladislav Brida","2019-05-03",281,0,"red"],
["VF2019040008","ŠPORTSTAV PRIEVIDZA spol.s r.o.","2019-04-16",60.36,0,"red"],
["VF2019030007","ORVA color s.r.o.","2019-03-11",111.02,0,"red"],
["VF2019030006","Ladislav Brida","2019-03-02",135,0,"red"],
["VF2019020005","Iveta Ragulíková","2019-02-28",135,0,"red"],
["VF2019020004","Základná škola","2019-02-19",20.79,0,"red"],
["VF2018120087","DUKE s.r.o.","2018-12-31",0,0,"green"],
["VF2018120003","Ladislav Brida","2018-12-20",247,0,"red"],
["VF2018120002","Jozef Mihálik","2018-12-03",110,0,"red"],
["VF2018110001","Helena Galbavá","2018-11-30",300,0,"red"]
];

const norm = s => String(s||'').toLowerCase().replace(/[\r\n]/g,' ').replace(/\s+/g,' ').trim();

const partners = PART.map(p => ({
  id: p[0], name: String(p[1]).replace(/\s+/g,' ').trim(),
  ico: p[2], dic: p[3], icdph: p[4], street: p[5], city: p[6], zip: p[7],
  country: p[1] === 'KreBul,o.p.s.' ? 'Česko' : 'Slovensko',
  iban: p[8], email: p[9], phone: p[10]
}));
const byName = new Map(partners.map(p => [norm(p.name), p.id]));
let nextPid = Math.max(...partners.map(p => p.id)) + 1;

function addDays(d, n) {
  const t = new Date(d + 'T12:00:00');
  t.setDate(t.getDate() + n);
  return t.toISOString().slice(0, 10);
}

const seq = {};
const invoices = INV.map((r, i) => {
  const [num, pn, d1, tot, paid, sem] = r;
  let pid = byName.get(norm(pn));
  if (!pid) {
    pid = nextPid++;
    partners.push({ id: pid, name: pn, ico:'', dic:'', icdph:'', street:'', city:'', zip:'', country:'Slovensko', iban:'', email:'', phone:'' });
    byName.set(norm(pn), pid);
  }
  const year = num.slice(2, 6);
  const suffix = Number(num.slice(-4));
  seq['VF' + year] = Math.max(seq['VF' + year] || 0, suffix);
  const paidFinal = sem === 'green' ? tot : paid;
  return {
    id: i + 1, type: 'INO', number: num, vs: num.replace(/\D/g, ''),
    partnerId: pid, issueDate: d1, deliveryDate: d1, dueDate: addDays(d1, 14),
    currency: 'EUR',
    items: [{ name: 'Fakturované služby', qty: 1, unit: 'ks', price: tot, vat: 0 }],
    total: tot, paid: paidFinal,
    note: 'Import z keepi.eu (' + new Date().toISOString().slice(0,10) + ')'
  };
});

const orders = [{
  id: 1, number: 'OB2025000001', date: '2025-12-27',
  partnerId: byName.get(norm('Centrum účelových zariadení - Prevádzka Maják Senec')),
  subject: 'Hudobná produkcia a technické zabezpečenie - 31.12.2025 / prevádzka Maják Senec',
  total: 800, state: 'potvrdená', note: 'Zákaznícke č.: 31.12.2025'
}];
seq['OBJ2025'] = 1;

const db = {
  settings: {
    company: { name: 'Eva Sičová LEONARDO', ico: '', dic: '', icdph: '', street: '', city: '', zip: '', iban: '', phone: '', email: 'evasicova@gmail.com' },
    year: 2026
  },
  partners, invoices,
  cashboxes: [{ id: 1, name: 'Hlavná pokladňa', initial: 0 }],
  cashdocs: [],
  bankaccounts: [{ id: 1, name: 'Podnikateľský účet', iban: '', initial: 0 }],
  bankmoves: [],
  products: [], stockmoves: [], orders, seq
};

fs.writeFileSync('/tmp/db.json', JSON.stringify(db, null, 2), 'utf8');
const unpaid = invoices.filter(i => i.total - i.paid > 0.004);
console.log('partneri:', partners.length, '| faktúry:', invoices.length, '| neuhradené:', unpaid.length,
  '| suma neuhradených:', Math.round(unpaid.reduce((s,i)=>s+i.total-i.paid,0)*100)/100, '| objednávky:', orders.length);
