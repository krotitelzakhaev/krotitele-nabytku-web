# Krotitelé nábytku — web

Statický web s čistými adresami (bez .html). Struktura:

| Cesta | Co to je |
|---|---|
| `index.html` | úvodní stránka → krotitelenabytku.cz/ |
| `nabytek/`, `renovace/`, `vykup/`, `kontakt/` | podstránky → /nabytek/ atd. |
| `dekujeme/`, `soukromi/` | děkovačka formuláře, ochrana údajů |
| `nabytek.html` … (v kořeni) | přesměrovací pahýly ze starých adres — nemazat |
| `fotky/`, `fonts/` | obrázky a vlastní písma |
| `style.css`, `sitemap.xml`, `robots.txt`, `.nojekyll`, `CNAME` | zázemí |

**Lokální náhled:** web používá absolutní cesty (`/style.css`), takže otevření souboru
napřímo už nestačí. Ve složce spusťte `python3 -m http.server` a otevřete
http://localhost:8000 — nebo koukejte rovnou na živý web.

## Nasazení změn

Obsah této složky = obsah repozitáře (včetně podsložek). Soubor **CNAME
v repozitáři vždy zachovat** (drží doménu; obsahuje řádek `krotitelenabytku.cz`).
Přes Claude Code: „přepiš obsah repozitáře obsahem složky web, zachovej CNAME,
commitni a pushni". Ručně: GitHub → Add file → Upload files → přetáhnout obsah složky.

## Kusy a fotky

- Nový kus = zkopírovat kartu v `nabytek/index.html`. Prodané nemazat,
  jen přepnout štítek na `badge--prodano` — jsou to reference.
- Nová fotka: uložit do `fotky/` a vložit
  `<img src="/fotky/nazev.jpg" alt="popis kusu" class="foto">`.
- Čekající šablony v komentářích: karta stolu (nabytek), společná fotka
  (index, sekce Kdo jsme), fotka z práce (renovace), odkaz na Krotitele
  chaosu (index, patička).

## Po nasazení nové struktury

V Search Console požádat o indexaci čistých adres: `/`, `/nabytek/`,
`/renovace/`, `/vykup/`, `/kontakt/`. Staré .html adresy přesměrovávají
a mají canonical — Google se přelije sám.

## Vzhled a soukromí

Barvy a písma jsou ve `style.css`; písma hostujeme lokálně.
`analytics.js` zapíná GA4 `G-2W33CPWDF5` pouze na produkční doméně a po
výslovném souhlasu. Před souhlasem se Google tag vůbec nenačítá (basic consent).
Přijetí i odmítnutí platí 180 dní. Nastavení je dostupné v každé patičce.
Odvolání souhlasu smaže GA cookies a obnoví stránku bez analytiky.

Vlastní události: `contact_click` (method), `view_renovation_click`,
`lead_form_submit` (pokus o odeslání), `generate_lead` (návrat na děkovací
stránku do 30 minut po odeslání v téže kartě). `lead_type` rozlišuje
renovace/vykup/koupe/hledani/ostatni. Přímé otevření děkovací stránky ani
její obnovení nevytváří další lead. Nejde o serverové ověření doručení e-mailu.
Formulář je nadále nativně odesílán přes FormSubmit; analytika jej neblokuje.

V administraci GA4 ověřte tok dat po přijetí souhlasu, nastavte vlastní dimenze
`lead_type` a `method` v rozsahu události a označte `generate_lead` za klíčovou
událost. Doporučená retence uživatelských dat: 2 měsíce. Ponechte vypnuté
Google Signals a reklamní funkce; pro přehlednost vypněte automatické interakce
s formuláři, protože používáme vlastní rozlišení pokusu a návratu po odeslání.
Tyto administrativní kroky nejsou provedeny samotným nasazením kódu.

Stránka měří bez query stringů a fragmentů URL; referrer se omezuje na původ.
Podporované utm_source: firmy.cz, firmy, google_business, google, instagram,
facebook. Do analytiky se neposílá obsah ani kontaktní údaje z formuláře.
