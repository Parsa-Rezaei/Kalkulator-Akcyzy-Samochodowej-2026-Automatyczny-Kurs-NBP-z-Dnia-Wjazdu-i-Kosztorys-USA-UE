'use strict';

/* =====================================================================
 * KONFIGURACJA – uzupełnij przed publikacją (patrz README.md)
 * Nie wpisuj tutaj haseł ani kluczy API – ten plik jest publiczny.
 * ===================================================================== */
const CONFIG = {
  brand: 'Akcyzator',
  affiliate: {
    // Wklej tutaj swój link partnerski z panelu carVertical (musi zaczynać się od https://).
    baseUrl: 'https://www.carvertical.com/pl',
    // Nazwa parametru, w którym przekazywany jest VIN (potwierdź w panelu partnera). '' = bez VIN.
    vinParam: 'vin',
    prices: [
      { qty: '1 raport', price: '89,99 zł', note: '' },
      { qty: '2 raporty', price: '74,99 zł', note: 'za sztukę' },
      { qty: '3 raporty', price: '65,99 zł', note: 'za sztukę' },
    ],
  },
  lead: {
    // Adres formularza Formspree, np. 'https://formspree.io/f/abcdwxyz'.
    // Inny dostawca wymaga dopisania jego domeny do Content-Security-Policy (index.html i _headers).
    formEndpoint: '',
    email: '', // zapasowo: 'kontakt@twojadomena.pl' – otworzy program pocztowy klienta
    phone: '', // np. '+48 600 000 000' – pokaże przycisk „Zadzwoń”
  },
  owner: {
    name: '[uzupełnij: imię i nazwisko lub nazwa firmy, adres]',
    email: '[uzupełnij: adres e-mail]',
  },
};

const LEGAL_STATE = '24.10.2026';
const NBP_API = 'https://api.nbp.pl/api/exchangerates/rates/a';
const MAX_DAYS_BACK = 7; // najdłuższa przerwa w publikacji tabel NBP (np. 22–26.12.2029) to 5 dni
const NBP_FIRST_DAY = '2002-01-02'; // od tej daty API NBP udostępnia tabelę A
const PDFMAKE_SRC = 'assets/vendor/pdfmake-0.2.23.min.js';
const VFS_SRC = 'assets/vendor/vfs_fonts-0.2.23.js';
const US_DUTY_FROM = '2026-07-01';
const EXEMPTIONS_UNTIL = '2029-12-31';
// Limity wejścia – chronią przed wynikami typu „Infinity” i absurdalnymi kwotami
const MAX_AMOUNT = 100000000; // 100 mln w walucie lub zł
const MAX_CC = 20000;
const MAX_RATE = 1000;
// Ochrona formularza przed botami
const LEAD_MIN_FILL_MS = 3000;
const LEAD_COOLDOWN_MS = 60000;
const LEAD_MAX_PER_PAGE = 3;
const LEAD_LIMITS = { imie: 60, telefon: 20, email: 80, miasto: 60, wiadomosc: 600, kalkulacja: 1200 };

const COUNTRIES = {
  eu: [['DE', 'Niemcy', 'EUR'], ['FR', 'Francja', 'EUR'], ['BE', 'Belgia', 'EUR'], ['NL', 'Holandia', 'EUR'], ['AT', 'Austria', 'EUR'],
       ['IT', 'Włochy', 'EUR'], ['ES', 'Hiszpania', 'EUR'], ['LU', 'Luksemburg', 'EUR'], ['LT', 'Litwa', 'EUR'], ['SE', 'Szwecja', 'SEK'],
       ['DK', 'Dania', 'DKK'], ['CZ', 'Czechy', 'CZK'], ['XE', 'Inny kraj UE', 'EUR']],
  noneu: [['US', 'USA', 'USD'], ['CA', 'Kanada', 'CAD'], ['GB', 'Wielka Brytania', 'GBP'], ['CH', 'Szwajcaria', 'CHF'],
          ['NO', 'Norwegia', 'NOK'], ['XN', 'Inny kraj spoza UE', 'USD']],
};
const CURRENCIES = ['EUR', 'USD', 'CHF', 'GBP', 'SEK', 'NOK', 'DKK', 'CZK', 'CAD', 'PLN'];
const DRIVE_LABELS = {
  ice: 'Spalinowy', hev: 'Hybryda HEV / MHEV (bez wtyczki)', phev: 'Hybryda plug-in (PHEV)', bev: 'Elektryczny (BEV)', fcev: 'Wodorowy (FCEV)',
};
const FUEL_LABELS = { petrol: 'benzyna', lpg: 'benzyna + LPG/CNG', diesel: 'diesel' };

const $ = (id) => document.getElementById(id);

/* ---------------------------- daty ---------------------------- */
const DAY_NAMES = ['niedziela', 'poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota'];
const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;
function parseISO(s) { const [y, m, d] = s.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); }
function toISO(dt) { return dt.toISOString().slice(0, 10); }
function isValidISO(s) { return typeof s === 'string' && ISO_RE.test(s) && !isNaN(parseISO(s)) && toISO(parseISO(s)) === s; }
function addDays(s, n) { const d = parseISO(s); d.setUTCDate(d.getUTCDate() + n); return toISO(d); }
function weekday(s) { return parseISO(s).getUTCDay(); }
// Zwraca wyłącznie cyfry i kropki – bezpieczne do wstawienia w HTML
function fmtDate(s) { if (!isValidISO(s)) return '—'; const [y, m, d] = s.split('-'); return `${d}.${m}.${y}`; }
function fmtDateLong(s) { return isValidISO(s) ? `${fmtDate(s)} (${DAY_NAMES[weekday(s)]})` : '—'; }
function todayWarsaw() {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Warsaw', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  } catch (e) { return toISO(new Date()); }
}
function easterSunday(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return toISO(new Date(Date.UTC(y, month - 1, day)));
}
const holidayCache = {};
function polishHolidays(y) {
  if (holidayCache[y]) return holidayCache[y];
  const h = {};
  const fixed = [['01-01', 'Nowy Rok'], ['05-01', 'Święto Pracy'], ['05-03', 'Święto Konstytucji 3 Maja'], ['08-15', 'Wniebowzięcie NMP'],
                 ['11-01', 'Wszystkich Świętych'], ['11-11', 'Narodowe Święto Niepodległości'], ['12-25', 'Boże Narodzenie'],
                 ['12-26', 'drugi dzień Bożego Narodzenia']];
  fixed.forEach(([md, n]) => { h[`${y}-${md}`] = n; });
  if (y >= 2011) h[`${y}-01-06`] = 'Święto Trzech Króli';
  if (y >= 2025) h[`${y}-12-24`] = 'Wigilia Bożego Narodzenia';
  const e = easterSunday(y);
  h[e] = 'Wielkanoc';
  h[addDays(e, 1)] = 'Poniedziałek Wielkanocny';
  h[addDays(e, 49)] = 'Zielone Świątki';
  h[addDays(e, 60)] = 'Boże Ciało';
  holidayCache[y] = h;
  return h;
}
function holidayName(s) { return polishHolidays(+s.slice(0, 4))[s] || null; }
function nonBusinessReason(s) {
  const n = holidayName(s);
  if (n) return `święto (${n})`;
  const w = weekday(s);
  if (w === 6) return 'sobota';
  if (w === 0) return 'niedziela';
  return null;
}
// art. 12 § 5 Ordynacji podatkowej: termin w sobotę lub dzień ustawowo wolny przechodzi na następny dzień roboczy
function shiftDeadline(s) { let d = s; while (weekday(d) === 6 || weekday(d) === 0 || holidayName(d)) d = addDays(d, 1); return d; }
function penultimateWednesdayPrevMonth(s) {
  const d = parseISO(s);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 0)); // ostatni dzień poprzedniego miesiąca
  while (last.getUTCDay() !== 3) last.setUTCDate(last.getUTCDate() - 1);
  last.setUTCDate(last.getUTCDate() - 7);
  return toISO(last);
}

/* ------------------------ liczby i formaty ------------------------ */
function parseAmount(v, max) {
  let s = String(v == null ? '' : v).slice(0, 40).trim().replace(/[\s  ]/g, '').replace(/zł|pln|eur|usd/gi, '');
  if (!s) return 0;
  if (s.includes(',') && s.includes('.')) s = s.replace(/\./g, '').replace(',', '.');
  else if (s.includes(',')) s = s.replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  if (!/^\d*\.?\d*$/.test(s)) return 0;
  const n = parseFloat(s);
  if (!isFinite(n) || n <= 0) return 0;
  return Math.min(n, max || MAX_AMOUNT);
}
function parseRate(v) {
  const s = String(v == null ? '' : v).slice(0, 20).trim().replace(/[\s ]/g, '').replace(',', '.');
  if (!/^\d*\.?\d*$/.test(s)) return 0;
  const n = parseFloat(s);
  return isFinite(n) && n > 0 && n <= MAX_RATE ? n : 0;
}
// Ordynacja podatkowa art. 63 § 1: < 50 gr w dół, >= 50 gr w górę
function roundPLN(x) { const gr = Math.round(x * 100); return Math.floor((gr + 50) / 100); }
const nf2 = new Intl.NumberFormat('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nf0 = new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 0 });
const zl = (x) => nf2.format(x) + ' zł';
const zl0 = (x) => nf0.format(x) + ' zł';
const money = (x, c) => nf2.format(x) + ' ' + c;
const plain2 = (x) => x.toFixed(2).replace('.', ','); // do wklejenia w pola formularza (bez separatorów tysięcy)
const pct = (r) => (r * 100).toLocaleString('pl-PL', { maximumFractionDigits: 2 }) + '%';
const rate4 = (r) => Number(r).toLocaleString('pl-PL', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
function esc(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

/* ------------------------ bezpieczne adresy URL ------------------------ */
function safeHttpsUrl(raw) {
  try {
    const u = new URL(String(raw));
    return u.protocol === 'https:' ? u : null;
  } catch (e) { return null; }
}

/* ------------------------ stawki akcyzy ------------------------ */
function exciseRule(drive, cc) {
  if (drive === 'bev') return { rate: 0, exempt: true, label: '0% – zwolnienie (samochód elektryczny)', legal: 'art. 109a ustawy o podatku akcyzowym (zwolnienie do 31.12.2029 r.)' };
  if (drive === 'fcev') return { rate: 0, exempt: true, label: '0% – zwolnienie (samochód napędzany wodorem)', legal: 'art. 109a ustawy o podatku akcyzowym (zwolnienie do 31.12.2029 r.)' };
  if (drive === 'phev') {
    if (cc <= 2000) return { rate: 0, exempt: true, label: '0% – zwolnienie (PHEV do 2000 cm³)', legal: 'art. 163a ustawy o podatku akcyzowym (zwolnienie do 31.12.2029 r.)' };
    if (cc <= 3500) return { rate: 0.093, label: '9,3% – hybryda 2001–3500 cm³', legal: 'art. 105 ustawy o podatku akcyzowym' };
    return { rate: 0.186, label: '18,6% – hybryda powyżej 3500 cm³', legal: 'art. 105 ustawy o podatku akcyzowym' };
  }
  if (drive === 'hev') {
    if (cc <= 2000) return { rate: 0.0155, label: '1,55% – hybryda HEV/MHEV do 2000 cm³', legal: 'art. 105 ustawy o podatku akcyzowym' };
    if (cc <= 3500) return { rate: 0.093, label: '9,3% – hybryda 2001–3500 cm³', legal: 'art. 105 ustawy o podatku akcyzowym' };
    return { rate: 0.186, label: '18,6% – hybryda powyżej 3500 cm³', legal: 'art. 105 ustawy o podatku akcyzowym' };
  }
  if (cc <= 2000) return { rate: 0.031, label: '3,1% – silnik do 2000 cm³', legal: 'art. 105 ustawy o podatku akcyzowym' };
  return { rate: 0.186, label: '18,6% – silnik powyżej 2000 cm³', legal: 'art. 105 ustawy o podatku akcyzowym' };
}
const ALL_CATEGORIES = [
  { id: 'zev', name: 'Elektryczny / wodorowy', drive: 'bev', cc: 0 },
  { id: 'phev2000', name: 'PHEV do 2000 cm³', drive: 'phev', cc: 2000 },
  { id: 'hev2000', name: 'HEV / MHEV do 2000 cm³', drive: 'hev', cc: 2000 },
  { id: 'ice2000', name: 'Spalinowy do 2000 cm³', drive: 'ice', cc: 2000 },
  { id: 'hyb3500', name: 'Hybryda 2001–3500 cm³', drive: 'hev', cc: 2001 },
  { id: 'ice2001', name: 'Spalinowy powyżej 2000 cm³', drive: 'ice', cc: 2001 },
  { id: 'hyb3501', name: 'Hybryda powyżej 3500 cm³', drive: 'hev', cc: 3501 },
];
function categoryId(drive, cc) {
  if (drive === 'bev' || drive === 'fcev') return 'zev';
  if (drive === 'ice') return cc <= 2000 ? 'ice2000' : 'ice2001';
  if (cc <= 2000) return drive === 'phev' ? 'phev2000' : 'hev2000';
  return cc <= 3500 ? 'hyb3500' : 'hyb3501';
}
function cnHeading(drive, fuel, cc) {
  const diesel = fuel === 'diesel';
  if (drive === 'bev') return '8703 80 – wyłącznie silnik elektryczny';
  if (drive === 'fcev') return '8703 80 lub 8703 90 – napęd wodorowy (potwierdź w ISZTAR)';
  if (drive === 'phev') return diesel ? '8703 70 – hybryda plug-in, diesel' : '8703 60 – hybryda plug-in, benzyna';
  if (drive === 'hev') return diesel ? '8703 50 – hybryda bez ładowania z zewnątrz, diesel' : '8703 40 – hybryda bez ładowania z zewnątrz, benzyna';
  if (diesel) return cc <= 1500 ? '8703 31 – diesel do 1500 cm³' : cc <= 2500 ? '8703 32 – diesel 1500–2500 cm³' : '8703 33 – diesel powyżej 2500 cm³';
  return cc <= 1000 ? '8703 21 – benzyna do 1000 cm³' : cc <= 1500 ? '8703 22 – benzyna 1000–1500 cm³' : cc <= 3000 ? '8703 23 – benzyna 1500–3000 cm³' : '8703 24 – benzyna powyżej 3000 cm³';
}

/* ------------------------ API NBP ------------------------ */
const rateCache = new Map();
const NBP_NO_RE = /^\d{1,3}\/A\/NBP\/\d{4}$/;
async function fetchJSON(url, timeoutMs = 9000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, {
      headers: { Accept: 'application/json' }, signal: ctrl.signal, cache: 'no-cache',
      credentials: 'omit', referrerPolicy: 'no-referrer', redirect: 'error', mode: 'cors',
    });
    if (r.status === 404) return { notFound: true };
    if (r.status === 400) return { badRequest: true };
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return { data: await r.json() };
  } finally { clearTimeout(timer); }
}
// Ścisła walidacja odpowiedzi NBP – do strony trafiają wyłącznie liczby i daty w znanym formacie
function readNbpRate(data, code, expectedDate) {
  const r = data && Array.isArray(data.rates) ? data.rates[0] : null;
  const ok = r && typeof r.mid === 'number' && isFinite(r.mid) && r.mid > 0 && r.mid < MAX_RATE
    && typeof r.no === 'string' && NBP_NO_RE.test(r.no)
    && isValidISO(r.effectiveDate)
    && (!data.code || data.code === code)
    && (expectedDate ? r.effectiveDate === expectedDate : r.effectiveDate <= todayWarsaw());
  if (!ok) throw new Error('API NBP zwróciło nieoczekiwane dane – kurs odrzucono ze względów bezpieczeństwa.');
  return { mid: r.mid, no: r.no, effectiveDate: r.effectiveDate };
}

/* Art. 104 ust. 12–13: kurs z dnia powstania obowiązku, a gdy NBP go nie ogłosił – ostatni ogłoszony przed tym dniem. */
async function getNbpRate(code, dateISO) {
  if (!CURRENCIES.includes(code) || code === 'PLN') throw new Error('Nieobsługiwana waluta.');
  if (!isValidISO(dateISO)) throw new Error('Nieprawidłowa data.');
  const today = todayWarsaw();
  const trace = [];
  if (dateISO > today) {
    const res = await fetchJSON(`${NBP_API}/${code.toLowerCase()}/?format=json`);
    if (!res.data) throw new Error('API NBP nie zwróciło bieżącej tabeli.');
    const r = readNbpRate(res.data, code, null);
    trace.push({ date: r.effectiveDate, ok: true, no: r.no, note: 'ostatnia opublikowana tabela – data w przyszłości' });
    return { code, mid: r.mid, no: r.no, effectiveDate: r.effectiveDate, requestedDate: dateISO, trace, estimated: true };
  }
  let d = dateISO;
  let provisional = false;
  for (let i = 0; i <= MAX_DAYS_BACK && d >= NBP_FIRST_DAY; i++) {
    const key = code + '|' + d;
    let hit = rateCache.get(key);
    if (!hit) {
      const res = await fetchJSON(`${NBP_API}/${code.toLowerCase()}/${d}/?format=json`);
      if (res.data) {
        hit = Object.assign({ ok: true }, readNbpRate(res.data, code, d));
        rateCache.set(key, hit);
      } else if (res.notFound) {
        hit = { ok: false };
        if (d !== today) rateCache.set(key, hit);
      } else {
        throw new Error('API NBP odrzuciło zapytanie o datę ' + fmtDate(d) + '.');
      }
    }
    if (hit.ok) {
      trace.push({ date: d, ok: true, no: hit.no });
      return { code, mid: hit.mid, no: hit.no, effectiveDate: hit.effectiveDate, requestedDate: dateISO, trace, provisional };
    }
    const reason = nonBusinessReason(d);
    if (d === today && !reason) {
      provisional = true;
      trace.push({ date: d, ok: false, note: 'tabela na dziś jeszcze nieopublikowana (NBP publikuje ok. 11:45–12:15)' });
    } else {
      trace.push({ date: d, ok: false, note: reason ? `brak tabeli – ${reason}` : 'brak tabeli (dzień bez publikacji NBP)' });
    }
    d = addDays(d, -1);
  }
  throw new Error(`Nie znaleziono tabeli A NBP w ciągu ${MAX_DAYS_BACK} dni przed ${fmtDate(dateISO)}.`);
}
async function getCustomsRate(code, dateISO) {
  const ref = penultimateWednesdayPrevMonth(dateISO);
  const r = await getNbpRate(code, ref);
  return Object.assign({}, r, { kind: 'customs', customsRef: ref, requestedDate: dateISO });
}

/* ------------------------ stan formularza ------------------------ */
const rateState = { key: null, data: null, error: null, loading: false, eur: null, eurKey: null, token: 0 };

function radio(name) { const el = document.querySelector(`input[name="${name}"]:checked`); return el ? el.value : null; }
function readState() {
  const route = radio('route') === 'noneu' ? 'noneu' : 'eu';
  const drive = DRIVE_LABELS[$('drive').value] ? $('drive').value : 'ice';
  const needsEngine = drive === 'ice' || drive === 'hev' || drive === 'phev';
  const currency = CURRENCIES.includes($('currency').value) ? $('currency').value : 'EUR';
  const fuel = FUEL_LABELS[$('fuel').value] ? $('fuel').value : 'petrol';
  const duty = ['std', 'us', 'pref'].includes(radio('duty')) ? radio('duty') : 'std';
  const vin = normVin($('vin').value);
  return {
    route,
    clearance: route === 'noneu' ? (radio('clearance') === 'de' ? 'de' : 'pl') : null,
    country: $('country').value,
    countryName: $('country').selectedOptions[0] ? $('country').selectedOptions[0].textContent : '',
    currency,
    price: parseAmount($('price').value),
    transportBorder: route === 'noneu' ? parseAmount($('transportBorder').value) : 0,
    postBorder: route === 'noneu' ? parseAmount($('postBorder').value) : 0,
    date: $('date').value,
    drive,
    fuel: needsEngine ? fuel : null,
    cc: needsEngine ? Math.round(parseAmount($('cc').value, MAX_CC)) : 0,
    needsEngine,
    newVehicle: route === 'eu' && $('newVehicle').checked,
    duty: route === 'noneu' ? duty : null,
    manual: $('manualRateToggle').checked,
    manualRate: parseRate($('manualRate').value),
    regOn: $('regOn').checked, regAmount: parseAmount($('regAmount').value), customPlates: $('customPlates').checked,
    inspOn: $('inspOn').checked, inspAccident: $('inspAccident').checked,
    transOn: $('transOn').checked, transAmount: parseAmount($('transAmount').value),
    exportPlates: route === 'eu' ? parseAmount($('exportPlates').value) : 0,
    transportPL: route === 'eu' ? parseAmount($('transportPL').value) : 0,
    agency: route === 'noneu' ? parseAmount($('agency').value) : 0,
    otherCosts: parseAmount($('otherCosts').value),
    model: $('model').value.trim().slice(0, 80),
    vin: VIN_RE.test(vin) ? vin : '',
  };
}
function rateKind(st) { return st.route === 'noneu' && st.clearance === 'pl' ? 'customs' : 'nbp'; }
function rateKey(st) { return `${rateKind(st)}|${st.currency}|${st.date}`; }

/* ------------------------ obliczenia ------------------------ */
function effectiveRate(st) {
  if (st.currency === 'PLN') return { mid: 1, source: 'pln' };
  if (st.manual && st.manualRate > 0) return { mid: st.manualRate, source: 'manual' };
  if (rateState.data && rateState.key === rateKey(st)) return { mid: rateState.data.mid, source: 'api', info: rateState.data };
  return null;
}
function eurRate(st, R) {
  if (st.currency === 'EUR' && R) return R.mid;
  if (rateState.eur && rateState.eurKey === st.date) return rateState.eur.mid;
  return null;
}

function calculate(st) {
  const R = effectiveRate(st);
  const res = { st, R, warnings: [], notes: [], rows: [], costRows: [] };
  if (!st.price) { res.incomplete = 'Wpisz cenę zakupu.'; return res; }
  if (!isValidISO(st.date)) { res.incomplete = 'Wybierz datę.'; return res; }
  if (st.date < NBP_FIRST_DAY) { res.incomplete = 'Wybierz datę od 02.01.2002 r.'; return res; }
  if (st.needsEngine && !st.cc) { res.incomplete = 'Wpisz pojemność silnika (cm³).'; return res; }
  if (!R) { res.incomplete = rateState.loading ? 'Pobieram kurs z API NBP…' : 'Brak kursu – wpisz kurs ręcznie.'; return res; }

  const r = R.mid;
  const rule = exciseRule(st.drive, st.cc);
  res.rule = rule;
  const cur = st.currency;
  let duty = 0, dutyRate = 0, wc = 0, base, excise, vat = 0, vatBase = 0, vatRate = 0, vatLabel = '';

  if (st.route === 'eu') {
    const pricePLN = st.price * r;
    res.carPLN = pricePLN;
    base = roundPLN(pricePLN);
    excise = roundPLN(base * rule.rate);
    res.rows.push({ label: `Cena zakupu (${money(st.price, cur)}${cur !== 'PLN' ? ' × ' + rate4(r) : ''})`, value: zl(pricePLN) });
    res.rows.push({ label: 'Podstawa opodatkowania akcyzą (zaokrąglona)', value: zl0(base), sub: true });
    res.rows.push({ label: `Akcyza ${pct(rule.rate)}`, value: zl0(excise), strong: true });
    res.rows.push({ label: 'Cło (import z UE)', value: zl0(0), sub: true });
    if (st.newVehicle) {
      vatRate = 0.23;
      vatBase = roundPLN(pricePLN + excise);
      vat = roundPLN(vatBase * vatRate);
      vatLabel = 'VAT 23% od WNT nowego środka transportu';
      res.rows.push({ label: `${vatLabel} (podstawa ${zl0(vatBase)})`, value: zl0(vat) });
      res.notes.push('VAT od nowego środka transportu rozliczasz osobno (dla osób prywatnych – deklaracja VAT-23). Do podstawy VAT wlicza się akcyzę. Kurs i termin dla VAT mogą różnić się od akcyzowych – kwota orientacyjna.');
    } else {
      res.rows.push({ label: 'VAT (auto używane z UE)', value: zl0(0), sub: true });
    }
  } else {
    const wcCur = st.price + st.transportBorder;
    wc = wcCur * r;
    res.carPLN = wc;
    dutyRate = st.duty === 'std' ? 0.10 : 0;
    if (st.duty === 'us' && st.date < US_DUTY_FROM) {
      dutyRate = 0.10;
      res.warnings.push('Cło 0% dla aut pochodzenia amerykańskiego stosuje się od 1.07.2026 r. (rozporządzenie (UE) 2026/1455). Dla wcześniejszej daty przyjęto 10%.');
    }
    duty = roundPLN(wc * dutyRate);
    base = roundPLN(wc + duty);
    excise = roundPLN(base * rule.rate);
    res.rows.push({ label: `Cena zakupu (${money(st.price, cur)})`, value: zl(st.price * r), sub: true });
    res.rows.push({ label: `Koszty do granicy UE (${money(st.transportBorder, cur)})`, value: zl(st.transportBorder * r), sub: true });
    res.rows.push({ label: `Wartość celna (${money(wcCur, cur)}${cur !== 'PLN' ? ' × ' + rate4(r) : ''})`, value: zl(wc) });
    res.rows.push({ label: `Cło ${pct(dutyRate)}${st.clearance === 'de' ? ' – płatne w Niemczech' : ''}`, value: zl0(duty), strong: true });
    res.rows.push({ label: 'Podstawa akcyzy: wartość celna + cło (zaokr.)', value: zl0(base), sub: true });
    res.rows.push({ label: `Akcyza ${pct(rule.rate)}${st.clearance === 'de' ? ' – w Polsce (AKC-U/S)' : ''}`, value: zl0(excise), strong: true });
    if (st.clearance === 'pl') {
      vatRate = 0.23;
      vatBase = roundPLN(wc + duty + excise + st.postBorder);
      vatLabel = 'VAT importowy 23%';
      res.rows.push({ label: `Podstawa VAT: wartość celna + cło + akcyza${st.postBorder ? ' + koszty od portu' : ''}`, value: zl0(vatBase), sub: true });
    } else {
      vatRate = 0.19;
      vatBase = roundPLN(wc + duty + st.postBorder);
      vatLabel = 'Niemiecki VAT importowy (EUSt) 19%';
      res.rows.push({ label: `Podstawa EUSt: wartość celna + cło${st.postBorder ? ' + koszty od portu' : ''} (bez polskiej akcyzy)`, value: zl0(vatBase), sub: true });
      res.notes.push('Przy odprawie w Niemczech cło i VAT (EUSt) płacisz w euro po niemieckim kursie celnym – kwoty w złotych są orientacyjne. Urząd skarbowy może przyjąć inną podstawę akcyzy niż wartość celna z cłem; potwierdź ją z agencją celną przed złożeniem AKC-U/S.');
    }
    vat = roundPLN(vatBase * vatRate);
    res.rows.push({ label: vatLabel, value: zl0(vat), strong: true });
  }

  res.base = base; res.excise = excise; res.duty = duty; res.dutyRate = dutyRate; res.vat = vat; res.vatRate = vatRate;
  res.vatBase = vatBase; res.vatLabel = vatLabel; res.wc = wc;
  res.taxes = duty + excise + vat;

  // koszty dodatkowe
  const costs = [];
  if (st.route === 'noneu' && st.postBorder) costs.push(['Transport od portu UE do miejsca przeznaczenia', st.postBorder]);
  if (st.route === 'noneu' && st.agency) costs.push(['Agencja celna, spedycja, opłaty portowe', st.agency]);
  if (st.route === 'eu' && st.transportPL) costs.push(['Transport do Polski', st.transportPL]);
  if (st.route === 'eu' && st.exportPlates) {
    const er = eurRate(st, R);
    if (er) costs.push([`Tablice wywozowe (${money(st.exportPlates, 'EUR')} × ${rate4(er)})`, st.exportPlates * er]);
    else res.warnings.push('Brak kursu EUR – koszt tablic wywozowych nie został doliczony.');
  }
  if (st.regOn) costs.push(['Rejestracja w wydziale komunikacji', st.regAmount]);
  if (st.regOn && st.customPlates) costs.push(['Tablice indywidualne (dopłata)', 920]);
  if (st.inspOn) {
    costs.push(['Badanie techniczne', 149]);
    if (st.fuel === 'lpg') costs.push(['Badanie instalacji LPG/CNG', 96]);
    if (st.inspAccident) costs.push(['Badanie po wypadku / kolizji', 143]);
  }
  if (st.transOn) costs.push(['Tłumaczenie przysięgłe', st.transAmount]);
  if (st.otherCosts) costs.push(['Inne koszty', st.otherCosts]);
  res.costRows = costs;
  res.costsTotal = costs.reduce((a, c) => a + c[1], 0);
  res.total = res.carPLN + res.taxes + res.costsTotal;

  // terminy AKC-U/S
  res.aksus = st.route === 'eu' || st.clearance === 'de';
  if (res.aksus) {
    const d14 = addDays(st.date, 14), d30 = addDays(st.date, 30);
    res.deadlines = { decl: shiftDeadline(d14), declRaw: d14, pay: shiftDeadline(d30), payRaw: d30 };
  }

  // próg 2000 cm³
  if (st.needsEngine) {
    const lo = exciseRule(st.drive, 2000), hi = exciseRule(st.drive, 2001);
    const aLo = roundPLN(base * lo.rate), aHi = roundPLN(base * hi.rate);
    let extraVat = 0;
    if (st.route === 'noneu' && st.clearance === 'pl') extraVat = roundPLN((aHi - aLo) * 0.23);
    if (st.route === 'eu' && st.newVehicle) extraVat = roundPLN((aHi - aLo) * 0.23);
    res.threshold = { lo, hi, aLo, aHi, diff: aHi - aLo, extraVat, current: st.cc <= 2000 ? 'lo' : 'hi', over3500: st.cc > 3500 };
  }

  // ostrzeżenia merytoryczne
  if (rule.exempt && st.date > EXEMPTIONS_UNTIL) res.warnings.push('Zwolnienia dla aut elektrycznych, wodorowych i PHEV do 2000 cm³ obowiązują do 31.12.2029 r. – dla tej daty sprawdź aktualne przepisy.');
  if (rule.exempt) res.notes.push(`Podstawa zwolnienia: ${rule.legal}. Zachowaj dokumenty potwierdzające rodzaj napędu.`);
  if (st.drive === 'hev') res.notes.push('MHEV: interpretacja ogólna Ministra Finansów z 26.02.2026 r. (PAD6.8101.1.2026) potwierdza prawo do stawek 1,55% i 9,3%. Zachowaj dokumentację napędu hybrydowego.');
  if (st.route === 'noneu' && st.duty === 'us' && st.vin) {
    const reg = vinRegion(st.vin);
    if (reg && !reg.us) res.warnings.push(`VIN wskazuje producenta spoza USA (${reg.country}). Cło 0% przysługuje tylko autom pochodzenia amerykańskiego.`);
  }
  if (R.source === 'api' && R.info.provisional) res.warnings.push('Kurs wstępny: tabela NBP z dnia wjazdu nie jest jeszcze opublikowana. Odśwież wynik po 12:15.');
  if (R.source === 'api' && R.info.estimated) res.warnings.push('Data w przyszłości – użyto ostatniego opublikowanego kursu NBP jako szacunku.');
  if (st.price >= MAX_AMOUNT || st.regAmount >= MAX_AMOUNT) res.warnings.push('Kwota przekracza limit kalkulatora (100 mln) – sprawdź wpisane wartości.');
  res.notes.push('Jeśli zadeklarowana kwota znacznie odbiega od średniej wartości rynkowej auta bez uzasadnionej przyczyny, naczelnik urzędu skarbowego może określić podstawę opodatkowania na podstawie wartości rynkowej (art. 104 ustawy o podatku akcyzowym).');
  return res;
}

/* ------------------------ VIN ------------------------ */
function normVin(v) { return String(v || '').slice(0, 30).toUpperCase().replace(/[\s-]/g, ''); }
const VIN_RE = /^[A-HJ-NPR-Z0-9]{17}$/;
const VIN_MAP = { A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8, J: 1, K: 2, L: 3, M: 4, N: 5, P: 7, R: 9, S: 2, T: 3, U: 4, V: 5, W: 6, X: 7, Y: 8, Z: 9 };
const VIN_W = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];
function vinCheckDigitOk(v) {
  let s = 0;
  for (let i = 0; i < 17; i++) { const c = v[i]; s += (/\d/.test(c) ? +c : VIN_MAP[c]) * VIN_W[i]; }
  const r = s % 11;
  return v[8] === (r === 10 ? 'X' : String(r));
}
function vinRegion(v) {
  const c = v[0], c2 = v.slice(0, 2);
  if ('145'.includes(c)) return { country: 'USA', us: true };
  if (c === '2') return { country: 'Kanada' };
  if (c === '3') return { country: 'Meksyk' };
  if (c === 'J') return { country: 'Japonia' };
  if (c === 'K') return { country: 'Korea Południowa' };
  if (c === 'L') return { country: 'Chiny' };
  if (c === 'W') return { country: 'Niemcy' };
  if (c === 'Z') return { country: 'Włochy' };
  if (c === 'S' && c2 >= 'SA' && c2 <= 'SM') return { country: 'Wielka Brytania' };
  if (c === 'S' && c2 >= 'SU' && c2 <= 'SZ') return { country: 'Polska' };
  if (c === 'V' && c2 >= 'VF' && c2 <= 'VR') return { country: 'Francja' };
  if (c === 'V' && c2 >= 'VS' && c2 <= 'VW') return { country: 'Hiszpania' };
  if (c === 'Y' && c2 >= 'YS' && c2 <= 'YW') return { country: 'Szwecja' };
  return null;
}
function vinStatus(v) {
  if (!v) return { state: 'empty' };
  if (v.length !== 17) return { state: 'len' };
  if (!VIN_RE.test(v)) return { state: 'chars' };
  const reg = vinRegion(v);
  const na = '12345'.includes(v[0]);
  return { state: 'ok', reg, checkWarn: na && !vinCheckDigitOk(v) };
}
// Link partnerski: tylko https, VIN tylko po walidacji (same litery i cyfry)
const AFFILIATE_FALLBACK = 'https://www.carvertical.com/pl';
function affiliateUrl(vin) {
  const u = safeHttpsUrl(CONFIG.affiliate.baseUrl) || new URL(AFFILIATE_FALLBACK);
  if (vin && VIN_RE.test(vin) && /^[a-z0-9_-]{1,20}$/i.test(CONFIG.affiliate.vinParam || '')) u.searchParams.set(CONFIG.affiliate.vinParam, vin);
  return u.toString();
}

/* ------------------------ renderowanie ------------------------ */
let lastResult = null;

function renderRateCard(st) {
  const box = $('rateCard');
  const kind = rateKind(st);
  if (st.currency === 'PLN') {
    box.innerHTML = '<p class="text-sm text-slate-600">Kwota w złotych – przeliczenie nie jest potrzebne.</p>';
    return;
  }
  if (rateState.loading && rateState.key === rateKey(st)) {
    box.innerHTML = `<p class="text-sm text-slate-600"><span class="spin"></span> Pobieram ${kind === 'customs' ? 'kurs celny' : 'kurs średni'} ${esc(st.currency)} z API NBP…</p>`;
    return;
  }
  if (rateState.error && rateState.key === rateKey(st)) {
    box.innerHTML = `<div class="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-800"><b>Nie udało się pobrać kursu z API NBP.</b> ${esc(rateState.error)}<br>Wpisz kurs ręcznie poniżej – znajdziesz go na stronie nbp.pl (tabela A).
      <button type="button" class="copy mt-2" data-action="rate-refresh">Spróbuj ponownie</button></div>`;
    return;
  }
  const d = rateState.data;
  if (!d || rateState.key !== rateKey(st)) { box.innerHTML = '<p class="text-sm text-slate-500">Wybierz datę, aby pobrać kurs.</p>'; return; }
  const trace = d.trace.map((t) => `<li class="flex gap-2 items-start"><span class="mt-1.5 inline-block w-2 h-2 rounded-full ${t.ok ? 'bg-emerald-500' : 'bg-slate-300'} flex-none"></span><span><b>${esc(fmtDateLong(t.date))}</b> – ${t.ok ? 'Tabela nr ' + esc(t.no) + (t.note ? ' (' + esc(t.note) + ')' : '') : esc(t.note)}</span></li>`).join('');
  const head = kind === 'customs'
    ? `<p class="text-xs font-bold uppercase tracking-wider text-teal-700">Kurs celny (odprawa w Polsce)</p>`
    : `<p class="text-xs font-bold uppercase tracking-wider text-teal-700">Kurs średni NBP – art. 104 ust. 12–13</p>`;
  const customsInfo = kind === 'customs'
    ? `<p class="hint">Kurs celny ogłaszany przez NBP w przedostatnią środę miesiąca obowiązuje przez cały następny miesiąc. Dla odprawy ${esc(fmtDate(st.date))} punktem odniesienia jest środa ${esc(fmtDate(d.customsRef))}. Przed odprawą porównaj go z wykazem kursów celnych na podatki.gov.pl.</p>`
    : '';
  const used = st.manual && st.manualRate > 0;
  box.innerHTML = `
    <div class="rounded-xl border ${used ? 'border-slate-200 opacity-60' : 'border-teal-200 bg-teal-50/50'} p-4">
      ${head}
      <p class="text-2xl font-extrabold mt-1 tabular-nums">1 ${esc(d.code)} = ${esc(rate4(d.mid))} zł</p>
      <p class="text-sm font-semibold text-slate-700 mt-0.5">Tabela nr ${esc(d.no)} z dnia ${esc(fmtDate(d.effectiveDate))}</p>
      ${d.provisional ? '<p class="text-sm text-amber-700 mt-1 font-semibold">Wstępnie: tabela z dnia wjazdu nie jest jeszcze opublikowana. <button type="button" class="copy" data-action="rate-refresh">Odśwież kurs</button></p>' : ''}
      ${d.estimated ? '<p class="text-sm text-amber-700 mt-1 font-semibold">Szacunek: data jest w przyszłości.</p>' : ''}
      <ul class="mt-3 space-y-1 text-sm text-slate-600">${trace}</ul>
      ${customsInfo}
      ${used ? '<p class="text-sm font-semibold text-slate-700 mt-2">Używasz kursu wpisanego ręcznie.</p>' : ''}
    </div>`;
}

function setText(id, t) { const el = $(id); if (el) el.textContent = t; }

function renderResults(res) {
  lastResult = res;
  const st = res.st;
  const warnBox = $('resWarnings');
  if (res.incomplete) {
    setText('resExcise', '–'); setText('resTotal', '–'); setText('resTaxes', '–');
    setText('resExciseSub', res.incomplete);
    setText('mbarExcise', '–'); setText('mbarTotal', '–');
    warnBox.innerHTML = '';
    $('resBreakdown').innerHTML = '';
    $('cheatSheet').innerHTML = `<p class="text-sm text-slate-500">${esc(res.incomplete)}</p>`;
    $('threshold').innerHTML = ''; $('allRates').innerHTML = '';
    return;
  }
  setText('resKicker', st.route === 'noneu' && st.clearance === 'pl' ? 'Akcyza (w zgłoszeniu celnym)' : 'Akcyza do zapłaty (AKC-U/S)');
  setText('resExcise', zl0(res.excise));
  setText('resExciseSub', `${res.rule.label} · podstawa ${zl0(res.base)}`);
  setText('resTotal', zl0(Math.round(res.total)));
  setText('resTaxes', zl0(res.taxes));
  setText('mbarExcise', zl0(res.excise));
  setText('mbarTotal', zl0(Math.round(res.total)));

  warnBox.innerHTML = res.warnings.map((w) => `<div class="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-900">${esc(w)}</div>`).join('');

  let html = '<tbody>';
  html += res.rows.map((r) => `<tr class="${r.sub ? 'sub' : ''}"><td>${esc(r.label)}</td><td class="num">${esc(r.value)}</td></tr>`).join('');
  html += `<tr><td class="font-bold">Razem podatki i cło</td><td class="num">${esc(zl0(res.taxes))}</td></tr>`;
  if (res.costRows.length) {
    html += `<tr><th colspan="2" class="pt-3">Rejestracja i formalności</th></tr>`;
    html += res.costRows.map((c) => `<tr class="sub"><td>${esc(c[0])}</td><td class="num">${esc(zl(c[1]))}</td></tr>`).join('');
    html += `<tr><td class="font-bold">Razem koszty dodatkowe</td><td class="num">${esc(zl(res.costsTotal))}</td></tr>`;
  }
  html += `<tr class="sum"><td>SUMA – auto + podatki + koszty</td><td class="num">${esc(zl(res.total))}</td></tr>`;
  html += '</tbody>';
  if (res.notes.length) html += `<tbody><tr><td colspan="2" class="pt-3">${res.notes.map((n) => `<p class="hint">${esc(n)}</p>`).join('')}</td></tr></tbody>`;
  $('resBreakdown').innerHTML = html;

  renderCheatSheet(res);
  renderThreshold(res);
}

function cheatRows(res) {
  const st = res.st, R = res.R;
  const rows = [];
  rows.push(['Deklaracja', 'AKC-U/S – składana na puesc.gov.pl', null]);
  rows.push(['Data powstania obowiązku podatkowego', fmtDateLong(st.date), st.date]);
  rows.push(['Kraj nabycia', st.countryName + (st.clearance === 'de' ? ' (odprawa celna w Niemczech)' : ''), null]);
  if (st.model) rows.push(['Marka i model', st.model, st.model]);
  if (st.vin) rows.push(['Numer VIN', st.vin, st.vin]);
  rows.push(['Rodzaj napędu', DRIVE_LABELS[st.drive] + (st.fuel ? ', ' + FUEL_LABELS[st.fuel] : ''), null]);
  if (st.needsEngine) rows.push(['Pojemność skokowa silnika', st.cc + ' cm³', String(st.cc)]);
  rows.push(['Pozycja CN (4+2 cyfry)', cnHeading(st.drive, st.fuel, st.cc), null]);
  if (st.route === 'eu') rows.push(['Kwota z umowy / faktury', money(st.price, st.currency), plain2(st.price)]);
  else rows.push(['Wartość celna + cło (wg kalkulatora)', zl(res.wc + res.duty), plain2(res.wc + res.duty)]);
  if (st.currency !== 'PLN') {
    if (R.source === 'api') rows.push(['Kurs średni NBP', `${rate4(R.mid)} zł – Tabela nr ${R.info.no} z dnia ${fmtDate(R.info.effectiveDate)}`, rate4(R.mid)]);
    else rows.push(['Kurs (wpisany ręcznie)', rate4(R.mid) + ' zł', rate4(R.mid)]);
  }
  rows.push(['Podstawa opodatkowania', zl0(res.base), String(res.base)]);
  rows.push(['Stawka akcyzy', pct(res.rule.rate) + (res.rule.exempt ? ' (zwolnienie)' : ''), pct(res.rule.rate)]);
  rows.push(['Kwota akcyzy', zl0(res.excise), String(res.excise)]);
  if (res.deadlines) {
    rows.push(['Termin złożenia AKC-U/S', fmtDateLong(res.deadlines.decl) + ' – nie później niż w dniu rejestracji', res.deadlines.decl]);
    rows.push(['Termin zapłaty akcyzy', fmtDateLong(res.deadlines.pay) + ' – nie później niż w dniu rejestracji', res.deadlines.pay]);
  }
  return rows;
}

function deadlineBox(label, iso, raw, cls) {
  const moved = iso !== raw ? ' (przesunięty z ' + fmtDate(raw) + ')' : '';
  return `<div class="rounded-lg ${cls} p-3"><p class="text-[11px] uppercase font-bold">${esc(label)}</p><p class="font-extrabold text-lg">${esc(fmtDate(iso))}</p><p class="text-xs text-slate-600">${esc(DAY_NAMES[weekday(iso)] + moved)}</p></div>`;
}

function renderCheatSheet(res) {
  const st = res.st;
  const box = $('cheatSheet');
  if (!res.aksus) {
    setText('cheatTitle', 'Odprawa celna w Polsce – co z AKC-U/S?');
    setText('cheatIntro', 'Przy imporcie z odprawą w Polsce akcyzę, cło i VAT wykazuje się w zgłoszeniu celnym (zwykle robi to agencja celna). Deklaracji AKC-U/S nie składasz.');
    const items = [
      ['Wartość celna', zl(res.wc)],
      ['Cło ' + pct(res.dutyRate), zl0(res.duty)],
      ['Akcyza ' + pct(res.rule.rate), zl0(res.excise)],
      ['VAT 23%', zl0(res.vat)],
      ['Razem do zapłaty przy odprawie', zl0(res.taxes)],
      ['Pozycja CN', cnHeading(st.drive, st.fuel, st.cc)],
    ];
    box.innerHTML = `<table class="tbl"><tbody>${items.map((i) => `<tr><td>${esc(i[0])}</td><td class="num">${esc(i[1])}</td></tr>`).join('')}</tbody></table>
      <p class="hint mt-2">Do rejestracji przygotuj dokument potwierdzający dopuszczenie auta do obrotu i zapłatę należności. Pełny 8-cyfrowy kod CN potwierdź w systemie ISZTAR.</p>`;
    return;
  }
  setText('cheatTitle', 'Ściągawka do deklaracji PUESC AKC-U/S');
  setText('cheatIntro', 'Dane do przepisania w formularzu AKC-U/S na puesc.gov.pl. Kliknij „Kopiuj”, aby skopiować wartość.');
  const rows = cheatRows(res);
  const dl = res.deadlines;
  box.innerHTML = `
    ${dl ? `<div class="grid grid-cols-2 gap-2 mb-3">
      ${deadlineBox('Złóż AKC-U/S do', dl.decl, dl.declRaw, 'bg-teal-50 border border-teal-200 text-teal-900')}
      ${deadlineBox('Zapłać akcyzę do', dl.pay, dl.payRaw, 'bg-slate-50 border border-slate-200 text-slate-800')}
    </div>` : ''}
    <table class="tbl"><tbody>${rows.map((r) => `<tr><td class="text-slate-500 w-2/5">${esc(r[0])}</td><td class="font-semibold">${esc(r[1])}</td><td class="text-right">${r[2] != null ? `<button type="button" class="copy" data-copy="${esc(r[2])}">Kopiuj</button>` : ''}</td></tr>`).join('')}</tbody></table>
    <p class="hint mt-2">Terminy liczone od daty wjazdu: 14 dni (deklaracja) i 30 dni (zapłata), z przesunięciem z soboty lub dnia wolnego na najbliższy dzień roboczy (art. 12 § 5 Ordynacji podatkowej). Pełny 8-cyfrowy kod CN potwierdź w systemie ISZTAR.</p>`;
}

function renderThreshold(res) {
  const st = res.st;
  const box = $('threshold');
  if (!res.threshold) {
    box.innerHTML = '<p class="text-sm text-slate-600">Auta elektryczne i wodorowe są zwolnione z akcyzy niezależnie od mocy – próg 2000 cm³ ich nie dotyczy.</p>';
  } else {
    const t = res.threshold;
    const total = t.diff + t.extraVat;
    const vatTxt = t.extraVat ? ` (w tym ${esc(zl0(t.extraVat))} VAT od wyższej akcyzy)` : '';
    let msg;
    if (t.over3500) msg = `Silnik powyżej 3500 cm³ – stawka 18,6%. Wersja do 2000 cm³ kosztowałaby ${esc(zl0(t.aLo))} akcyzy.`;
    else if (t.current === 'lo') msg = `Twój silnik mieści się w progu. Wersja powyżej 2000 cm³ kosztowałaby Cię dodatkowo <b>${esc(zl0(total))}</b>${vatTxt}.`;
    else msg = `Gdyby silnik miał do 2000 cm³, akcyza byłaby niższa o <b>${esc(zl0(total))}</b>${vatTxt}.`;
    const actual = t.over3500 ? res.rule : t.hi;
    const aActual = t.over3500 ? res.excise : t.aHi;
    const max = Math.max(t.aLo, aActual, 1);
    const hiLabel = t.over3500 ? 'powyżej 3500 cm³' : (st.drive === 'ice' ? 'powyżej 2000 cm³' : '2001–3500 cm³');
    box.innerHTML = `
      <p class="text-sm text-slate-700">${msg}</p>
      <div class="mt-3 space-y-2 text-sm">
        <div><div class="flex justify-between"><span>do 2000 cm³ · ${esc(pct(t.lo.rate))}</span><b class="tabular-nums">${esc(zl0(t.aLo))}</b></div><div class="h-2 bg-slate-100 rounded"><div class="h-2 rounded bg-teal-600 bar" data-w="${(t.aLo / max) * 100}"></div></div></div>
        <div><div class="flex justify-between"><span>${esc(hiLabel)} · ${esc(pct(actual.rate))}</span><b class="tabular-nums">${esc(zl0(aActual))}</b></div><div class="h-2 bg-slate-100 rounded"><div class="h-2 rounded bg-rose-500 bar" data-w="${(aActual / max) * 100}"></div></div></div>
      </div>`;
    // szerokość ustawiana przez CSSOM – zgodne z Content-Security-Policy (bez atrybutów style)
    box.querySelectorAll('.bar').forEach((el) => { el.style.width = Math.max(0, Math.min(100, Number(el.dataset.w) || 0)) + '%'; });
  }
  const curId = categoryId(st.drive, st.cc);
  $('allRates').innerHTML = '<tbody>' + ALL_CATEGORIES.map((c) => {
    const rule = exciseRule(c.drive, c.cc);
    return `<tr class="${c.id === curId ? 'cur' : ''}"><td>${esc(c.name)}</td><td class="text-slate-500">${esc(pct(rule.rate))}</td><td class="num">${esc(zl0(roundPLN(res.base * rule.rate)))}</td></tr>`;
  }).join('') + '</tbody>';
}

/* ------------------------ PDF (pdfmake, pliki lokalne) ------------------------ */
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src; s.async = true;
    s.onload = resolve; s.onerror = () => reject(new Error('Nie udało się wczytać ' + src));
    document.head.appendChild(s);
  });
}
async function ensurePdfMake() {
  if (window.pdfMake && window.pdfMake.vfs) return;
  if (!window.pdfMake) await loadScript(PDFMAKE_SRC);
  if (!window.pdfMake.vfs) await loadScript(VFS_SRC);
}
function pdfTable(rows, widths) {
  return { table: { widths: widths || ['*', 'auto'], body: rows }, layout: 'lightHorizontalLines', margin: [0, 2, 0, 8] };
}
function buildPdf(res) {
  const st = res.st, R = res.R;
  const now = new Date();
  const stamp = now.toLocaleString('pl-PL', { timeZone: 'Europe/Warsaw' });
  const H = (t) => ({ text: t, style: 'h2' });
  const kv = (k, v, bold) => [{ text: String(k), color: '#475569' }, { text: String(v), alignment: 'right', bold: !!bold }];

  const vehicle = [
    kv('Kierunek importu', st.route === 'eu' ? 'Import z UE (nabycie wewnątrzwspólnotowe)' : (st.clearance === 'pl' ? 'Import spoza UE – odprawa w Polsce' : 'Import spoza UE – odprawa w Niemczech')),
    kv('Kraj zakupu', st.countryName),
    kv(st.route === 'noneu' && st.clearance === 'pl' ? 'Data odprawy celnej' : 'Data wjazdu do Polski', fmtDateLong(st.date)),
    kv('Rodzaj napędu', DRIVE_LABELS[st.drive] + (st.fuel ? ', ' + FUEL_LABELS[st.fuel] : '')),
  ];
  if (st.needsEngine) vehicle.push(kv('Pojemność silnika (P.1)', st.cc + ' cm³'));
  if (st.model) vehicle.push(kv('Marka i model', st.model));
  if (st.vin) vehicle.push(kv('VIN', st.vin));
  vehicle.push(kv('Pozycja CN', cnHeading(st.drive, st.fuel, st.cc)));

  const rateRows = [];
  if (st.currency === 'PLN') rateRows.push(kv('Waluta', 'PLN – bez przeliczenia'));
  else if (R.source === 'manual') rateRows.push(kv('Kurs wpisany ręcznie', `1 ${st.currency} = ${rate4(R.mid)} zł`, true));
  else {
    const d = R.info;
    rateRows.push(kv(d.kind === 'customs' ? 'Kurs celny (NBP, tabela A)' : 'Kurs średni NBP (tabela A)', `1 ${d.code} = ${rate4(d.mid)} zł`, true));
    rateRows.push(kv('Tabela', `nr ${d.no} z dnia ${fmtDate(d.effectiveDate)}`));
    d.trace.forEach((t) => rateRows.push(kv(fmtDateLong(t.date), t.ok ? 'Tabela nr ' + t.no : t.note)));
    if (d.kind === 'customs') rateRows.push(kv('Podstawa', `przedostatnia środa poprzedniego miesiąca: ${fmtDate(d.customsRef)}`));
    else rateRows.push(kv('Podstawa prawna', 'art. 104 ust. 12–13 ustawy o podatku akcyzowym'));
    if (d.provisional) rateRows.push(kv('Uwaga', 'kurs wstępny – tabela z dnia wjazdu nieopublikowana'));
    if (d.estimated) rateRows.push(kv('Uwaga', 'szacunek – data w przyszłości'));
  }

  const taxRows = res.rows.map((r) => kv(r.label, r.value, r.strong));
  taxRows.push(kv('Razem podatki i cło', zl0(res.taxes), true));
  const costRows = res.costRows.length ? res.costRows.map((c) => kv(c[0], zl(c[1]))) : [kv('Brak', zl(0))];
  costRows.push(kv('Razem koszty dodatkowe', zl(res.costsTotal), true));

  const content = [
    { text: 'Kosztorys Celno-Skarbowy Sprowadzenia Pojazdu i Dane do AKC-U/S', style: 'h1' },
    { text: `Wygenerowano: ${stamp} · stan prawny: ${LEGAL_STATE} · ${CONFIG.brand}`, style: 'muted', margin: [0, 0, 0, 10] },
    {
      table: { widths: ['*', '*', '*'], body: [[
        { stack: [{ text: 'AKCYZA', style: 'boxLbl' }, { text: zl0(res.excise), style: 'boxVal' }, { text: res.rule.label, style: 'boxSub' }], fillColor: '#f0fdfa' },
        { stack: [{ text: 'PODATKI I CŁO', style: 'boxLbl' }, { text: zl0(res.taxes), style: 'boxVal' }, { text: 'cło + akcyza + VAT', style: 'boxSub' }], fillColor: '#f8fafc' },
        { stack: [{ text: 'CAŁKOWITY KOSZT', style: 'boxLbl' }, { text: zl0(Math.round(res.total)), style: 'boxVal' }, { text: 'auto + podatki + koszty', style: 'boxSub' }], fillColor: '#f8fafc' },
      ]] },
      layout: { hLineColor: '#e2e8f0', vLineColor: '#e2e8f0', paddingTop: () => 8, paddingBottom: () => 8, paddingLeft: () => 8, paddingRight: () => 8 },
      margin: [0, 0, 0, 12],
    },
    H('1. Pojazd i zakup'), pdfTable(vehicle),
    H('2. Kurs waluty'), pdfTable(rateRows),
    H('3. Kalkulacja należności'), pdfTable(taxRows),
    H('4. Rejestracja i formalności w Polsce'), pdfTable(costRows),
    { table: { widths: ['*', 'auto'], body: [[
        { text: 'SUMA – auto + podatki + koszty', bold: true, color: '#ffffff', fillColor: '#0f172a', margin: [6, 6, 6, 6] },
        { text: zl(res.total), bold: true, color: '#ffffff', fillColor: '#0f172a', alignment: 'right', margin: [6, 6, 6, 6] },
      ]] }, layout: 'noBorders', margin: [0, 4, 0, 12] },
  ];

  if (res.aksus) {
    content.push(H('5. Dane do deklaracji AKC-U/S (PUESC)'));
    content.push(pdfTable(cheatRows(res).map((r) => kv(r[0], r[1]))));
  } else {
    content.push(H('5. Odprawa celna w Polsce'));
    content.push({ text: 'Akcyzę, cło i VAT wykazuje się w zgłoszeniu celnym – deklaracji AKC-U/S nie składasz.', margin: [0, 0, 0, 8] });
  }
  if (res.threshold) {
    const t = res.threshold;
    content.push(H('6. Porównanie progu 2000 cm³'));
    content.push(pdfTable([
      kv(`Do 2000 cm³ (${pct(t.lo.rate)})`, zl0(t.aLo)),
      kv(`Powyżej 2000 cm³ (${pct(t.hi.rate)})`, zl0(t.aHi)),
      kv('Różnica (z VAT od akcyzy, jeśli dotyczy)', zl0(t.diff + t.extraVat), true),
    ]));
  }
  const notes = res.warnings.concat(res.notes);
  if (notes.length) content.push({ ul: notes, style: 'small', margin: [0, 4, 0, 8] });
  content.push({ text: 'Zastrzeżenie: kosztorys ma charakter informacyjny i nie stanowi doradztwa podatkowego. Kwoty zaokrąglono do pełnych złotych zgodnie z art. 63 § 1 Ordynacji podatkowej. Przed złożeniem deklaracji zweryfikuj dane z dokumentami i aktualnymi przepisami.', style: 'small', color: '#64748b' });

  return {
    pageSize: 'A4',
    pageMargins: [40, 50, 40, 45],
    info: { title: 'Kosztorys Celno-Skarbowy Sprowadzenia Pojazdu i Dane do AKC-U/S', author: CONFIG.brand, subject: 'Akcyza, cło i VAT – kosztorys importu auta' },
    header: () => ({ text: CONFIG.brand + ' – Kalkulator Akcyzy Samochodowej 2026', margin: [40, 22, 40, 0], fontSize: 8, color: '#94a3b8' }),
    footer: (page, count) => ({ columns: [{ text: 'Kursy: API NBP (tabela A)', fontSize: 8, color: '#94a3b8' }, { text: `${page} / ${count}`, alignment: 'right', fontSize: 8, color: '#94a3b8' }], margin: [40, 12, 40, 0] }),
    content,
    styles: {
      h1: { fontSize: 15, bold: true, margin: [0, 0, 0, 3], color: '#0f172a' },
      h2: { fontSize: 11, bold: true, margin: [0, 6, 0, 2], color: '#0f766e' },
      muted: { fontSize: 8.5, color: '#64748b' },
      small: { fontSize: 8 },
      boxLbl: { fontSize: 7.5, bold: true, color: '#475569' },
      boxVal: { fontSize: 15, bold: true, margin: [0, 2, 0, 1] },
      boxSub: { fontSize: 7.5, color: '#64748b' },
    },
    defaultStyle: { fontSize: 9.5 },
  };
}
async function downloadPdf() {
  const res = lastResult;
  const status = $('pdfStatus');
  if (!res || res.incomplete) { status.textContent = 'Najpierw uzupełnij dane kalkulatora.'; return; }
  const btn = $('pdfBtn');
  btn.disabled = true;
  status.textContent = 'Przygotowuję PDF…';
  try {
    await ensurePdfMake();
    const name = `kosztorys-akcyza-AKC-US-${isValidISO(res.st.date) ? res.st.date : 'wynik'}.pdf`;
    window.pdfMake.createPdf(buildPdf(res)).download(name);
    status.textContent = 'Gotowe – plik ' + name + ' został pobrany.';
  } catch (e) {
    status.textContent = 'Nie udało się wygenerować PDF: ' + (e && e.message ? e.message : 'nieznany błąd');
  } finally { btn.disabled = false; }
}

/* ------------------------ pobieranie kursów ------------------------ */
let rateTimer = null;
function scheduleRates() { clearTimeout(rateTimer); rateTimer = setTimeout(refreshRates, 250); }
async function refreshEur(st) {
  if (st.route !== 'eu' || st.currency === 'EUR' || !isValidISO(st.date) || st.date < NBP_FIRST_DAY || rateState.eurKey === st.date) return;
  try {
    const eur = await getNbpRate('EUR', st.date);
    rateState.eur = eur; rateState.eurKey = st.date;
    recalc();
  } catch (e) { /* koszt tablic wywozowych pokaże ostrzeżenie */ }
}
async function refreshRates(force) {
  const st = readState();
  refreshEur(st);
  if (st.currency === 'PLN' || !isValidISO(st.date) || st.date < NBP_FIRST_DAY) { rateState.data = null; rateState.key = null; recalc(); return; }
  const key = rateKey(st);
  if (force !== true && rateState.key === key && (rateState.data || rateState.loading)) { recalc(); return; }
  const token = ++rateState.token;
  rateState.key = key; rateState.data = null; rateState.error = null; rateState.loading = true;
  recalc();
  try {
    const data = rateKind(st) === 'customs' ? await getCustomsRate(st.currency, st.date) : await getNbpRate(st.currency, st.date);
    if (token !== rateState.token) return;
    rateState.data = Object.assign({ kind: 'nbp' }, data);
  } catch (e) {
    if (token !== rateState.token) return;
    rateState.error = e && e.name === 'AbortError' ? 'Przekroczono czas oczekiwania na odpowiedź.' : ((e && e.message) || 'Błąd połączenia.');
    if (!$('manualRateToggle').checked) { $('manualRateToggle').checked = true; $('manualRateWrap').hidden = false; }
  } finally {
    if (token === rateState.token) { rateState.loading = false; recalc(); }
  }
}

/* ------------------------ UI ------------------------ */
function fillCountries(route) {
  const sel = $('country');
  sel.textContent = '';
  COUNTRIES[route].forEach(([code, name, cur]) => {
    const o = document.createElement('option');
    o.value = code; o.textContent = name; o.dataset.cur = cur;
    sel.appendChild(o);
  });
}
function syncRouteUI() {
  const st = readState();
  document.querySelectorAll('[data-show]').forEach((el) => { el.hidden = el.getAttribute('data-show') !== st.route; });
  const lbl = $('dateLabel'), hint = $('dateHint');
  if (st.route === 'noneu' && st.clearance === 'pl') {
    lbl.textContent = 'Data odprawy celnej w Polsce (przyjęcia zgłoszenia celnego)';
    hint.textContent = 'Wartość celną przelicza się po kursie celnym: kurs NBP z przedostatniej środy poprzedniego miesiąca, obowiązujący przez cały miesiąc odprawy.';
  } else if (st.route === 'noneu') {
    lbl.textContent = 'Data wjazdu auta do Polski (po odprawie w Niemczech)';
    hint.textContent = 'Dzień powstania obowiązku podatkowego w akcyzie. Kurs NBP z tego dnia, a w weekend lub święto – ostatni kurs ogłoszony przed tym dniem.';
  } else {
    lbl.textContent = 'Data przekroczenia granicy Polski (wjazdu do kraju)';
    hint.textContent = 'Co do zasady to dzień powstania obowiązku podatkowego. Kurs NBP pobierzemy z tego dnia, a jeśli NBP nie opublikował tabeli (weekend, święto) – z ostatniego dnia publikacji przed nim.';
  }
  $('fuelWrap').hidden = !st.needsEngine;
  $('ccWrap').hidden = !st.needsEngine;
  document.querySelectorAll('span[data-cur]').forEach((el) => { el.textContent = st.currency; });
}
function syncVinUI() {
  const v = normVin($('vinCv').value);
  const s = vinStatus(v);
  $('vinCounter').textContent = `${v.length}/17`;
  const info = $('vinInfo');
  $('vinCv').setAttribute('aria-invalid', s.state === 'len' || s.state === 'chars' ? 'true' : 'false');
  if (s.state === 'empty') info.textContent = '– wpisz VIN, aby sprawdzić historię auta.';
  else if (s.state === 'len') info.textContent = `– VIN musi mieć dokładnie 17 znaków (masz ${v.length}).`;
  else if (s.state === 'chars') info.textContent = '– VIN zawiera niedozwolone znaki (litery I, O, Q nie występują w VIN).';
  else info.textContent = `– poprawny format${s.reg ? ' · producent: ' + s.reg.country : ''}${s.checkWarn ? ' · uwaga: cyfra kontrolna (9. znak) się nie zgadza – sprawdź VIN' : ''}.`;
  $('cvBtn').href = affiliateUrl(s.state === 'ok' ? v : '');
  // podpowiedź cła na podstawie VIN
  const hintEl = $('vinDutyHint');
  if (s.state === 'ok' && s.reg && radio('route') === 'noneu') {
    hintEl.hidden = false;
    hintEl.textContent = s.reg.us
      ? 'VIN wskazuje producenta z USA – sprawdź, czy przysługuje cło 0% (potrzebny dowód pochodzenia).'
      : `VIN wskazuje producenta: ${s.reg.country}. Cło 0% dla aut z USA tego auta nie obejmuje.`;
  } else hintEl.hidden = true;
}
function renderPrices() {
  $('cvPrices').innerHTML = CONFIG.affiliate.prices.map((p, i) => `
    <div class="rounded-lg border ${i === 2 ? 'border-blue-300 bg-blue-50' : 'border-slate-200'} p-2 text-center">
      <p class="text-[11px] font-bold text-slate-500 uppercase">${esc(p.qty)}</p>
      <p class="font-extrabold text-slate-900">${esc(p.price)}</p>
      <p class="text-[11px] text-slate-500">${p.note ? esc(p.note) : '&nbsp;'}</p>
    </div>`).join('');
}
function renderOwner() {
  document.querySelectorAll('[data-owner]').forEach((el) => { el.textContent = CONFIG.owner[el.getAttribute('data-owner')] || ''; });
  setText('legalDate', LEGAL_STATE);
  const phone = String(CONFIG.lead.phone || '').replace(/[^\d+]/g, '');
  if (/^\+?\d{9,15}$/.test(phone)) {
    const b = $('leadPhoneBtn');
    b.hidden = false;
    b.href = 'tel:' + phone;
    b.textContent = 'Zadzwoń: ' + CONFIG.lead.phone;
  }
}
function recalc() {
  const st = readState();
  renderRateCard(st);
  renderResults(calculate(st));
}
function summaryText(res) {
  if (!res || res.incomplete) return '';
  const st = res.st;
  return [
    `Kierunek: ${st.route === 'eu' ? 'UE' : 'spoza UE (' + (st.clearance === 'pl' ? 'odprawa PL' : 'odprawa DE') + ')'}, kraj: ${st.countryName}`,
    `Data: ${fmtDate(st.date)}, cena: ${money(st.price, st.currency)}`,
    `Napęd: ${DRIVE_LABELS[st.drive]}${st.needsEngine ? ', ' + st.cc + ' cm³' : ''}`,
    `Akcyza: ${zl0(res.excise)}, podatki razem: ${zl0(res.taxes)}, koszt całkowity: ${zl0(Math.round(res.total))}`,
    st.vin ? `VIN: ${st.vin}` : '',
  ].filter(Boolean).join('\n');
}

/* ------------------------ formularz zapytań ------------------------ */
const PAGE_LOADED_AT = Date.now();
const leadState = { sent: 0, lastAt: 0, busy: false };
// usuwa znaki sterujące (np. ukryte nowe linie w polach jednowierszowych) i przycina długość
function cleanText(v, max, multiline) {
  let s = String(v == null ? '' : v);
  s = multiline ? s.replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, '') : s.replace(/[\u0000-\u001F\u007F]/g, ' ');
  return s.trim().slice(0, max);
}
async function submitLead(e) {
  e.preventDefault();
  const msg = $('leadMsg');
  const f = e.currentTarget;
  msg.className = 'text-sm text-red-700';
  if (leadState.busy) return;
  // pułapki na boty: ukryte pole i zbyt szybkie wysłanie – udajemy sukces, nic nie wysyłamy
  if (f.elements._gotcha.value || Date.now() - PAGE_LOADED_AT < LEAD_MIN_FILL_MS) {
    msg.className = 'text-sm text-emerald-700 font-semibold';
    msg.textContent = 'Dziękujemy! Oddzwonimy najszybciej, jak to możliwe.';
    return;
  }
  if (leadState.sent >= LEAD_MAX_PER_PAGE) { msg.textContent = 'Wysłano już kilka zapytań. Odczekaj chwilę lub zadzwoń.'; return; }
  if (Date.now() - leadState.lastAt < LEAD_COOLDOWN_MS) { msg.textContent = 'Zapytanie zostało już wysłane. Kolejne możesz wysłać za minutę.'; return; }
  const name = cleanText($('leadName').value, LEAD_LIMITS.imie);
  const phone = cleanText($('leadPhone').value, LEAD_LIMITS.telefon);
  const email = cleanText($('leadEmail').value, LEAD_LIMITS.email);
  if (!name || !/^[+\d][\d\s()-]{7,19}$/.test(phone) || phone.replace(/\D/g, '').length < 9) { msg.textContent = 'Podaj imię i poprawny numer telefonu (min. 9 cyfr).'; return; }
  if (email && !/^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']{2,}$/.test(email)) { msg.textContent = 'Sprawdź adres e-mail.'; return; }
  if (!$('leadConsent').checked) { msg.textContent = 'Zaznacz zgodę na przetwarzanie danych.'; return; }
  const payload = {
    imie: name, telefon: phone, email,
    miasto: cleanText($('leadCity').value, LEAD_LIMITS.miasto),
    wiadomosc: cleanText($('leadMsgText').value, LEAD_LIMITS.wiadomosc, true),
    kalkulacja: $('leadAttach').checked ? cleanText(summaryText(lastResult), LEAD_LIMITS.kalkulacja, true) : '',
    zgoda: 'tak – zgoda na kontakt i przekazanie danych agencji partnerskiej (' + new Date().toISOString() + ')',
    _subject: 'Zapytanie: rejestracja auta / AKC-U/S',
  };
  const endpoint = CONFIG.lead.formEndpoint ? safeHttpsUrl(CONFIG.lead.formEndpoint) : null;
  if (endpoint) {
    leadState.busy = true;
    msg.className = 'text-sm text-slate-600'; msg.textContent = 'Wysyłam…';
    try {
      const r = await fetch(endpoint.toString(), {
        method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload), credentials: 'omit', redirect: 'error',
      });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      leadState.sent += 1; leadState.lastAt = Date.now();
      msg.className = 'text-sm text-emerald-700 font-semibold';
      msg.textContent = 'Dziękujemy! Oddzwonimy najszybciej, jak to możliwe.';
      f.reset(); $('leadCity').value = 'Łódź';
    } catch (err) {
      msg.textContent = 'Nie udało się wysłać formularza. Spróbuj ponownie lub zadzwoń.';
    } finally { leadState.busy = false; }
    return;
  }
  const mail = String(CONFIG.lead.email || '');
  if (/^[^\s@<>"'?&]+@[^\s@<>"'?&]+\.[a-z]{2,}$/i.test(mail)) {
    const body = Object.entries(payload).filter(([k, v]) => v && k !== '_subject').map(([k, v]) => `${k}: ${v}`).join('\n');
    leadState.sent += 1; leadState.lastAt = Date.now();
    window.location.href = `mailto:${mail}?subject=${encodeURIComponent(payload._subject)}&body=${encodeURIComponent(body)}`;
    msg.className = 'text-sm text-slate-600';
    msg.textContent = 'Otworzyliśmy Twój program pocztowy – wyślij przygotowaną wiadomość.';
    return;
  }
  msg.textContent = 'Formularz nie jest jeszcze skonfigurowany. Spróbuj później.';
}
async function copyValue(btn) {
  const v = btn.getAttribute('data-copy');
  try {
    await navigator.clipboard.writeText(v);
  } catch (e) {
    const ta = document.createElement('textarea');
    ta.value = v; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch (e2) { /* brak schowka */ }
    ta.remove();
  }
  const old = btn.textContent;
  btn.textContent = 'Skopiowano';
  setTimeout(() => { btn.textContent = old; }, 1200);
}

function init() {
  fillCountries('eu');
  $('date').value = todayWarsaw();
  $('date').max = addDays(todayWarsaw(), 366);
  renderPrices();
  renderOwner();
  syncRouteUI();
  syncVinUI();

  document.querySelectorAll('input[name="route"]').forEach((el) => el.addEventListener('change', () => {
    fillCountries(radio('route') === 'noneu' ? 'noneu' : 'eu');
    const c = $('country').selectedOptions[0];
    if (c) $('currency').value = c.dataset.cur;
    syncRouteUI(); syncVinUI(); scheduleRates();
  }));
  document.querySelectorAll('input[name="clearance"]').forEach((el) => el.addEventListener('change', () => { syncRouteUI(); scheduleRates(); }));
  $('country').addEventListener('change', () => {
    const c = $('country').selectedOptions[0];
    if (c) $('currency').value = c.dataset.cur;
    syncRouteUI(); scheduleRates();
  });
  $('currency').addEventListener('change', () => { syncRouteUI(); scheduleRates(); });
  $('date').addEventListener('change', scheduleRates);
  $('drive').addEventListener('change', () => { syncRouteUI(); recalc(); });
  $('manualRateToggle').addEventListener('change', () => { $('manualRateWrap').hidden = !$('manualRateToggle').checked; recalc(); });
  // Enter w polu kalkulatora nie przeładowuje strony
  $('calc-form').addEventListener('submit', (e) => e.preventDefault());
  $('calc-form').addEventListener('input', (e) => {
    if (e.target.id === 'date') return;
    if (e.target.id === 'vin') { $('vinCv').value = e.target.value; syncVinUI(); }
    recalc();
  });
  $('calc-form').addEventListener('change', (e) => { if (e.target.type === 'checkbox' || e.target.type === 'radio') recalc(); });
  $('vinCv').addEventListener('input', () => { $('vin').value = $('vinCv').value; syncVinUI(); recalc(); });
  $('cvBtn').addEventListener('click', (e) => {
    const v = normVin($('vinCv').value);
    const s = vinStatus(v);
    if (s.state === 'len' || s.state === 'chars') {
      e.preventDefault();
      $('vinCv').focus();
      $('vinInfo').textContent = '– popraw VIN (17 znaków, bez liter I, O, Q), aby sprawdzić historię auta.';
    }
  });
  $('pdfBtn').addEventListener('click', downloadPdf);
  $('leadForm').addEventListener('submit', submitLead);
  document.addEventListener('click', (e) => {
    const b = e.target.closest('.copy');
    if (!b) return;
    if (b.dataset.action === 'rate-refresh') refreshRates(true);
    else if (b.hasAttribute('data-copy')) copyValue(b);
  });

  refreshRates();
}
document.addEventListener('DOMContentLoaded', init);
