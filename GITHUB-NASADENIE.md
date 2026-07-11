# Nasadenie cez GitHub → Vercel

Projekt je pripravený ako git repozitár (pridaný `.gitignore`). Stačí ho nahrať na
GitHub a prepojiť s Vercelom — potom sa každá zmena nasadí automaticky pri `git push`.

## A. Vytvorenie repozitára a push (v priečinku `keepi-erp`)

**Najjednoduchšie — cez GitHub CLI (`gh`):**

```
cd keepi-erp
git init
git add .
git commit -m "uctoERP - initial commit"
gh repo create ucto-erp --private --source=. --remote=origin --push
```

**Alebo bez `gh`:** vytvor prázdny repozitár na github.com (napr. `ucto-erp`), potom:

```
cd keepi-erp
git init
git add .
git commit -m "uctoERP - initial commit"
git branch -M main
git remote add origin https://github.com/<tvoje-meno>/ucto-erp.git
git push -u origin main
```

## B. Prepojenie s Vercelom

1. Vo Vercel dashboarde: **Add New → Project → Import Git Repository**.
2. Vyber repozitár `ucto-erp` a daj **Deploy**. Vercel načíta `vercel.json` sám
   (zostaví klienta a nasadí API funkciu).

## C. Trvalé úložisko (Vercel KV) — nutné pre ukladanie dát

1. V projekte → **Storage → Create Database → Upstash for Redis** → priradiť k projektu.
2. Vercel pridá premenné (`KV_REST_API_URL`, `KV_REST_API_TOKEN`). Kód ich rozpozná.
3. **Redeploy** (alebo ďalší `git push`), aby sa premenné načítali.

Hotovo — appka beží na produkčnej adrese a dáta sa ukladajú natrvalo.

---

### Chceš, aby som to pushol ja z tejto appky?

Vtedy treba mať **GitHub konektor autorizovaný**. Teraz nie je prihlásený, a v tejto
session sa prihlásenie spustiť nedá. Autorizuj ho v nastaveniach konektorov
(claude.ai → Settings → Connectors, alebo `/mcp` v interaktívnej session) a potom ma
požiadaj znova — repozitár vytvorím a nahrám zaň.
