# účtoERP — jednoduché účtovníctvo (systém v štýle keepi.eu)

Webová aplikácia React + Node.js pre jednoduché účtovníctvo:

- **Faktúry** — vyšlé aj došlé, položky s DPH, automatické číslovanie (VF/DF), úhrady, tlač faktúry
- **Partneri** — adresár odberateľov a dodávateľov
- **Peňažný denník** — tvorí sa automaticky z pokladničných a bankových dokladov, stĺpce JÚ (predaj tovaru, služby, réžia, mzdy…)
- **Pokladňa** — viac pokladní, príjmové/výdavkové doklady (PPD/VPD)
- **Banka** — viac účtov, bankové pohyby (BV), párovanie úhrad faktúr
- **Sklad** — skladové karty, príjemky/výdajky, stav zásob s priemernou cenou, stráženie minimálnej zásoby
- **Objednávky** — evidencia so stavmi (nová / potvrdená / vybavená / zrušená)
- **Uzávierka** — ročný prehľad príjmov a výdavkov po druhoch, základ dane (zisk/strata)
- **Manažérske informácie** — mesačný graf príjmov/výdajov, zisk, peniaze, pohľadávky/záväzky
- **Nastavenia** — údaje o firme (dodávateľ na faktúrach), účtovné obdobie

Dáta sa ukladajú do súboru `data/db.json` (netreba databázový server).

## Rýchle vyskúšanie bez inštalácie

Otvorte **`ukazka-erp.html`** (v tomto priečinku) dvojklikom — demo s ukážkovými
dátami priamo v prehliadači. V demo režime sa zmeny neukladajú.

## Plná verzia — spustenie

Potrebujete [Node.js](https://nodejs.org) (verzia 18+).

```
cd keepi-erp
npm install
npm start
```

Aplikácia beží na **http://localhost:3000** (frontend je už zostavený v `client/dist`).

## Úprava frontendu (voliteľné)

```
cd keepi-erp/client
npm install
npm run dev        # vývojový server s automatickým obnovením
npm run build      # nové zostavenie do client/dist
```

## Štruktúra

```
keepi-erp/
├── package.json          # server (Express)
├── server/index.js       # API + servírovanie frontendu
├── data/db.json          # databáza (vytvorí sa automaticky)
├── client/               # React frontend (Vite)
│   ├── src/pages/        # moduly (faktúry, denník, pokladňa, …)
│   └── dist/             # zostavený frontend
└── make-preview.js       # generátor demo súboru ukazka.html
```

## Poznámky

- Vizuál je inšpirovaný keepi.eu (metro dlaždice, zelené tabuľky, tmavá lišta).
- Výpočty uzávierky sú informatívne — nenahrádzajú daňové priznanie.
- Zálohovanie: stačí kopírovať súbor `data/db.json`.
