# Akcyzator – Kalkulator Akcyzy Samochodowej 2026 z kursem NBP z dnia wjazdu

**[PL]** Darmowy kalkulator akcyzy za samochód sprowadzony z UE i spoza UE (USA, Kanada, Wielka Brytania, Szwajcaria). Sam pobiera kurs średni NBP z dnia wjazdu do Polski, a w weekend lub święto ostatni kurs ogłoszony przed tym dniem (art. 104 ust. 12–13 ustawy o podatku akcyzowym). Liczy cło, akcyzę i VAT, terminy AKC-U/S oraz koszty rejestracji i tworzy kosztorys PDF.

**[EN]** A free Polish car excise calculator for vehicles imported from the EU and from outside the EU. It fetches the NBP average exchange rate for the border-crossing date automatically and falls back to the last published rate on weekends and holidays. It also calculates customs duty, excise, VAT, AKC-U/S deadlines and registration costs, and exports an A4 PDF cost estimate.

> Stan prawny / legal status: **24.10.2026**. Wynik ma charakter informacyjny i nie stanowi doradztwa podatkowego.

---

## Opis po polsku (PL)

### Funkcje

- **Kurs NBP z dnia wjazdu.** Kalkulator pyta publiczne API NBP (`api.nbp.pl`, tabela A) o dzień wjazdu. Gdy tabeli nie ma (odpowiedź 404, czyli sobota, niedziela albo święto), cofa się dzień po dniu, maksymalnie 7 dni. Pokazuje numer tabeli (np. `207/A/NBP/2026`), kurs z 4 miejscami po przecinku i każdy sprawdzony dzień.
- **Kurs wstępny.** Jeśli liczysz w dniu wjazdu przed publikacją tabeli (NBP publikuje ok. 11:45–12:15), wynik jest oznaczony jako wstępny i można go odświeżyć.
- **Kurs celny.** Przy odprawie w Polsce kalkulator bierze kurs z przedostatniej środy poprzedniego miesiąca.
- **Kurs ręczny.** Gdy API NBP nie odpowiada, kurs można wpisać ręcznie.
- **Stawki akcyzy 2026:**
  - 0% – BEV i FCEV oraz PHEV do 2000 cm³ (zwolnienia do 31.12.2029),
  - 1,55% – HEV/MHEV do 2000 cm³,
  - 3,1% – auto spalinowe do 2000 cm³,
  - 9,3% – hybrydy 2001–3500 cm³,
  - 18,6% – pozostałe auta powyżej 2000 cm³.
- **Zaokrąglenia** do pełnych złotych (art. 63 § 1 Ordynacji podatkowej).
- **Import z UE:** cło 0 zł; VAT 23% tylko dla nowego środka transportu (do 6000 km lub do 6 miesięcy).
- **Import spoza UE** liczony kaskadowo: wartość celna → cło → akcyza → VAT.
  - Cło 10%, 0% dla aut pochodzenia USA od 1.07.2026 (rozporządzenie (UE) 2026/1455) albo 0% przy pochodzeniu preferencyjnym.
  - Odprawa w Polsce: VAT 23%.
  - Odprawa w Niemczech (Bremerhaven): niemiecki VAT importowy 19% od wartości celnej z cłem, a akcyza w Polsce przez AKC-U/S.
- **Ściągawka do AKC-U/S:**
  - wszystkie dane z przyciskiem „Kopiuj”, pozycja CN,
  - termin złożenia (14 dni) i zapłaty (30 dni), przesuwany z soboty lub święta na najbliższy dzień roboczy (art. 12 § 5 Ordynacji podatkowej).
- **Porównanie progu 2000 cm³** i tabela akcyzy dla wszystkich kategorii.
- **Kosztorys PDF (A4)** z biblioteką pdfmake, z polskimi znakami.
- **Moduł carVertical:** sprawdzanie VIN (17 znaków, bez I/O/Q, cyfra kontrolna dla VIN z Ameryki Płn., kraj producenta) i link partnerski z numerem VIN.
- **Formularz zapytań** „Kompleksowa Rejestracja Aut z Zagranicy i Deklaracje AKC-U/S (Łódź i Cała Polska)”. Działa przez Formspree albo e-mail.
- **SEO:**
  - schematy JSON-LD `SoftwareApplication` i `FAQPage`,
  - Open Graph, `og-image.png`,
  - `robots.txt`, `sitemap.xml`.

### Pliki

| Plik | Do czego służy |
|---|---|
| `index.html` | Cała aplikacja (HTML + Tailwind CSS z CDN + JavaScript) |
| `favicon.svg` | Ikona strony |
| `og-image.png` | Obrazek podglądu przy udostępnianiu linku (1200×630) |
| `robots.txt`, `sitemap.xml` | Pliki dla Google – wpisz w nich swoją domenę |
| `.nojekyll` | Każe GitHub Pages pokazać pliki bez przetwarzania |

### Konfiguracja (5 minut)

Otwórz `index.html` i znajdź blok `const CONFIG = {` (na początku skryptu, na dole pliku):

```js
affiliate: {
  baseUrl: 'https://www.carvertical.com/pl', // ← wklej swój link partnerski z panelu carVertical
  vinParam: 'vin',                            // ← nazwa parametru VIN (potwierdź w panelu partnera)
},
lead: {
  formEndpoint: '', // ← adres formularza Formspree, np. 'https://formspree.io/f/abcdwxyz'
  email: '',        // ← albo Twój e-mail firmowy
  phone: '',        // ← numer telefonu (pokaże przycisk „Zadzwoń”)
},
owner: {
  name: '[uzupełnij…]',  // ← administrator danych (polityka prywatności)
  email: '[uzupełnij…]',
},
```

Po kupnie domeny zamień `https://TWOJA-DOMENA.pl` na swój adres w plikach `index.html`, `robots.txt` i `sitemap.xml`. W `robots.txt` usuń też znak `#` przed linią `Sitemap:`.

### Uruchomienie lokalne

Kliknij dwukrotnie `index.html` albo uruchom serwer:

```bash
python3 -m http.server 8000
# otwórz http://localhost:8000
```

### Publikacja na GitHub Pages

1. **Settings → Pages → Build and deployment → Source: Deploy from a branch**.
2. Wybierz gałąź z plikami (np. `main`) i folder `/ (root)`, a potem **Save**.
3. Po 1–2 minutach strona działa pod adresem `https://<login>.github.io/<nazwa-repozytorium>/`.
4. Własna domena: wpisz ją w **Settings → Pages → Custom domain**.
5. U rejestratora domeny dodaj rekordy DNS według [dokumentacji GitHub](https://docs.github.com/pages/configuring-a-custom-domain-for-your-github-pages-site).
6. Zaznacz **Enforce HTTPS**.

### Podstawa prawna i źródła

- Ustawa z 6 grudnia 2008 r. o podatku akcyzowym:
  - art. 104 ust. 12–13 – przeliczenie waluty,
  - art. 105 – stawki,
  - art. 109a i 163a – zwolnienia.
- Interpretacja ogólna Ministra Finansów z 26.02.2026 r., PAD6.8101.1.2026 (MHEV).
- Rozporządzenie (UE) 2026/1455 – cło 0% na towary pochodzenia USA, stosowane od 1.07.2026.
- Rozporządzenie Ministra Infrastruktury, Dz.U. 2025 poz. 1223 – opłaty za badania techniczne od 19.09.2025:
  - 149 zł za badanie podstawowe,
  - +96 zł za instalację LPG/CNG,
  - +143 zł za badanie po wypadku.
- Ordynacja podatkowa: art. 12 § 5 (terminy) i art. 63 § 1 (zaokrąglenia).
- Kursy walut: [API NBP](https://api.nbp.pl/).

---

## English summary (EN)

**What it is.** A single-page web app (`index.html`). It uses Tailwind CSS from a CDN, vanilla JavaScript, and pdfmake, which loads only when a PDF is requested. It needs no backend and no build step, so any static host works (GitHub Pages, Cloudflare Pages, Netlify).

**Key logic**

- **Exchange rate.** It queries `https://api.nbp.pl/api/exchangerates/rates/a/{code}/{date}/?format=json`. On HTTP 404 (weekend or holiday) it steps back one day at a time, for up to 7 days. Polish holidays are computed locally, including Easter-based dates and 24 December from 2025, so each skipped day can be labelled.
- **Customs clearance in Poland.** It uses the NBP table from the penultimate Wednesday of the previous month (the customs exchange rate).
- **Excise rates.**
  - 0%: BEV/FCEV, and PHEV ≤ 2000 cm³
  - 1.55%: HEV/MHEV ≤ 2000 cm³
  - 3.1%: combustion ≤ 2000 cm³
  - 9.3%: hybrids 2001–3500 cm³
  - 18.6%: everything else above 2000 cm³
  - The tax base and the tax are rounded half-up to whole PLN.
- **Imports from outside the EU.**
  - Customs value = price + costs to the EU border.
  - Duty = 10%, or 0% for US-origin cars from 1 July 2026 under Regulation (EU) 2026/1455, or 0% for preferential origin.
  - Excise = rate × (customs value + duty).
  - VAT = 23% × (customs value + duty + excise) when cleared in Poland.
  - When cleared in Germany: German import VAT = 19% × (customs value + duty), and the Polish excise goes on form AKC-U/S.
- **Deadlines.** File AKC-U/S within 14 days and pay within 30 days. A deadline that falls on a Saturday, Sunday or holiday moves to the next working day.

**Configuration.** Edit the `CONFIG` object in `index.html`: your carVertical affiliate link, the Formspree endpoint, email or phone for leads, and the data-controller details for the privacy policy. After you buy a domain, replace `https://TWOJA-DOMENA.pl` in `index.html`, `robots.txt` and `sitemap.xml`.

**Disclaimer.** For information only; this is not tax advice.
