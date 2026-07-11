# Nasadenie účtoERP na Vercel (s trvalým úložiskom Vercel KV)

Aplikácia je **pripravená na nasadenie**. Kód som prerobil tak, aby na Verceli
ukladal dáta do **Vercel KV** (trvalé úložisko typu kľúč–hodnota) namiesto súboru,
ktorý na serverless prostredí nefunguje. Lokálne (na tvojom počítači) appka naďalej
funguje so súborom `data/db.json` — prepne sa automaticky podľa toho, či existuje KV.

Čo som pridal / zmenil:

- `server/store.js` – úložisko: Vercel KV v produkcii, súbor lokálne
- `server/index.js` – prerobené na asynchrónne ukladanie (await), export appky pre serverless
- `api/index.js` – vstupný bod pre Vercel serverless funkciu
- `vercel.json` – build klienta + smerovanie `/api/*` na funkciu
- `package.json` – pridaná závislosť `@upstash/redis`

---

## Krok 1 — Nasadenie cez Vercel CLI (odporúčané)

V priečinku `keepi-erp` spusti v termináli:

```
npx vercel login        # jednorazovo, ak ešte nie si prihlásený
npx vercel --prod
```

Pri prvej otázke potvrď projekt (môžeš použiť existujúci **ucto-erp** alebo vytvoriť
nový). Vercel sám zostaví frontend a nahrá funkciu. Na konci vypíše živú adresu.

> Poznámka: predchádzajúce automatické pokusy vytvorili na Verceli projekt
> `ucto-erp` s neúspešnými buildmi (nástroj vie nahrať súbory len po malých častiach
> a celá appka sa doň nezmestila). CLI nahrá všetko naraz bez tohto obmedzenia.

---

## Krok 2 — Vytvorenie trvalého úložiska (Vercel KV / Redis)

Bez tohto kroku appka pobeží, ale dáta sa nebudú trvalo ukladať.

1. Vo Vercel dashboarde otvor projekt → záložka **Storage** → **Create Database**.
2. Vyber **Upstash for Redis** (alebo „KV"), potvrď a **priraď ho k projektu**.
3. Vercel automaticky pridá prístupové premenné (`KV_REST_API_URL`,
   `KV_REST_API_TOKEN`, prípadne `UPSTASH_REDIS_REST_URL/TOKEN`). Kód akceptuje oba varianty.
4. Znovu nasaď: `npx vercel --prod` (alebo v dashboarde **Redeploy**), aby sa premenné načítali.

Hotovo — appka teraz ukladá faktúry, partnerov, pokladňu atď. natrvalo.

---

## Alternatíva — nasadenie cez Git

Ak preferuješ automatické nasadzovanie: nahraj priečinok do GitHub repozitára a vo
Verceli daj **Add New → Project → Import** ten repozitár. Ďalšie zmeny sa budú
nasadzovať automaticky pri každom `git push`.

---

## Overené

- Produkčný build frontendu prebehne bez chýb.
- Serverová logika (ukladanie/čítanie) otestovaná v súborovom aj KV režime.
