# semestralni-prace02

Webová aplikace pro přehled a správu výsledků veslařských testů. Data se načítají a ukládají do Google Sheets pomocí Google API, výsledky jsou filtrovány a vizualizovány pomocí grafu (Chart.js).

## Funkce
- Přihlášení přes Google (OAuth) a práce s Google Sheets API.
- Načítání seznamu veslařů a jejich testů ze spreadsheetu.
- Filtrování podle kategorie, typu testu, sezóny a jména.
- Detail veslaře s historií testů a grafem výkonu.
- Přidání nového testu (ukládání do tabulky).
- Ukládání filtrů do `localStorage`.

## Podrobný popis kódu (co se kde děje)

### `index.html`
- **`<head>`** načítá:
  - `main.css` se stylem celé aplikace.
  - Chart.js z CDN pro grafy.
  - Google API skripty, které zavolají `gapiLoaded()` a `gsiLoaded()` po načtení.
- **`<header>`** obsahuje hlavní název a akční tlačítka:
  - `#btn-refresh` spouští ruční načtení dat.
  - `#btn-auth`/`#btn-signout` ovládají Google OAuth.
- **`<aside class="filters-panel">`**: filtry (kategorie, typ testu, sezóna, jméno) a tlačítka „Použít“/„Reset“.
- **`<section class="rowers-section">`**:
  - tabulka seznamu veslařů (`#rowers-tbody`).
  - loader `#rowers-loader` a chybová hláška `#rowers-error`.
- **`<section id="detail-panel">`**:
  - detail vybraného veslaře (statistiky, graf).
  - historie testů (`#history-tbody`).
  - formulář pro přidání testu (`#new-test-form`).
- Na konci je načten `main.js`.

### `Assets/css/main.css`
- Definuje barevné proměnné v `:root` a sjednocuje paletu celé aplikace (pozadí, panely, texty, akcenty).
- Nastavuje globální `box-sizing` a základní styl typografie.
- Vytváří layout přes CSS Grid (`.app-main`) a responzivní přepnutí na 1 sloupec v menších šířkách.
- Styluje filtry (`.filters-panel`), tabulky (`table`, `th`, `td`), detailní panel a formulář.
- Přidává helper třídu `.hidden`, kterou JS používá pro skrývání prvků (loader, chybové hlášky, přepínače).

### `Assets/js/main.js`

#### 1) Inicializace a modul
- Celý kód je zabalený v IIFE `App`, aby nezahlcoval globální scope.
- V globálu jsou vystaveny jen `gapiLoaded` a `gsiLoaded` (nutné pro Google skripty).
- Konstanta s API údaji:
  - `CLIENT_ID`, `API_KEY`, `SPREADSHEET_ID`, `SHEET_NAME`, `SCOPES`.
- Stav aplikace:
  - `allResults` (data z tabulky),
  - `currentRower` (aktuální veslař),
  - `chartInstance` (instance Chart.js grafu),
  - `isSignedIn`, `gapiInited`, `gisInited`.

#### 2) Pomocné funkce
- `getQueryParam(name)`: čte query param (používá se pro načtení detailu z URL).
- `parseTimeToSeconds(timeStr)` a `formatSeconds(sec)`: převody času (string ↔ sekundy) pro výpočty a zobrazení.
- `sortByNameAsc(a, b)`: řazení podle jména s českou lokalizací.
- `getUniqueRowers(results)`: z dat vytáhne unikátní veslaře a připraví je pro seznam.

#### 3) Filtry a localStorage
- `saveFiltersToLocalStorage()`/`loadFiltersFromLocalStorage()`:
  - ukládají a obnovují hodnoty filtrů.
- `getFilteredResults()`:
  - filtruje `allResults` podle hodnot z formuláře.
- `applyFilters()` a `resetFilters()`:
  - uložení filtrů + překreslení tabulky.

#### 4) Renderování UI
- `renderRowersTable()`:
  - generuje řádky v tabulce veslařů,
  - každý řádek má tlačítko **Detail**.
- `renderRowerDetail(rowerName)`:
  - vypíše info, statistiky a historii vybraného veslaře,
  - připraví data pro graf a zavolá `renderChartForRower()`.
- `renderChartForRower(tests)`:
  - filtruje testy podle checkboxů (2k/6k/sezóna),
  - vykreslí line chart přes Chart.js.
- `populateFormRowers()`:
  - naplní select s veslaři ve formuláři.

#### 5) Google API a autentizace
- `gapiLoaded()` a `gsiLoaded()`:
  - callbacky po načtení Google skriptů,
  - inicializují gapi klienta a OAuth token client.
- `maybeEnableAuth()`:
  - povolí tlačítko přihlášení, až jsou oba klienti připraveni.
- `handleAuthClick()`/`handleSignoutClick()`:
  - zahájení OAuth flow,
  - odhlášení a vyčištění dat.
- `updateAuthUi()`:
  - přepíná text tlačítek a viditelnost `#btn-signout`.

#### 6) Komunikace s Google Sheets (AJAX)
- `fetchResults()`:
  - hlavní async načtení dat ze Sheets API,
  - ukládá data do `allResults`,
  - překresluje tabulky a detail.
- `createResult(newResult)`:
  - přidá nový řádek do Sheets,
  - aktualizuje lokální stav a UI.

#### 7) Formulář pro nový test
- `handleFormSubmit(event)`:
  - validace vstupu (jméno, datum, čas),
  - sestavení `newResult`,
  - volá `createResult(newResult)`.
- `handleAddNewRowerToggle()`:
  - přepíná zobrazení pole „nový veslař“.

#### 8) Inicializace událostí
- `DOMContentLoaded`:
  - načte filtry z localStorage,
  - naváže event listenery na tlačítka a formulář,
  - připraví UI pro práci.

#### 9) Datový tok (od načtení po zobrazení)
1. Uživatel klikne na **Přihlásit** → spustí se OAuth.
2. Po přihlášení `fetchResults()` stáhne data z Google Sheets.
3. Data se normalizují (`parseTimeToSeconds`), uloží do `allResults`.
4. `renderRowersTable()` vykreslí seznam veslařů.
5. Vybraný veslař se uloží do URL (`rower=...`) a zobrazí se detail.
6. Formulář umožní přidat nový test, který se uloží do Sheets a UI se aktualizuje.

#### 10) Chybové stavy a UX
- Při načítání dat se zobrazuje loader `#rowers-loader`.
- Pokud dojde k chybě, zobrazí se `#rowers-error` s textem chyby.
- Formulář vrací validace i chybové hlášky do `#form-message`.

## Struktura projektu
```
www/spen00/SP02/
├─ index.html
└─ Assets/
   ├─ css/
   │  └─ main.css
   └─ js/
      └─ main.js
```

## Spuštění
1. Spusťte lokální statický server v kořeni repozitáře, např.:
   ```bash
   python3 -m http.server 8000
   ```
2. Otevřete `http://localhost:8000/www/spen00/SP02/` v prohlížeči.

## Konfigurace Google API
V `www/spen00/SP02/Assets/js/main.js` je nutné mít nastavené:
- `CLIENT_ID` (OAuth Client ID)
- `API_KEY` (API klíč)
- `SPREADSHEET_ID` (ID Google Sheets)
- `SHEET_NAME` (název listu)

V Google Cloud Console:
- povolte **Google Sheets API**,
- nastavte OAuth consent screen,
- přidejte povolené originy pro lokální vývoj (např. `http://localhost:8000`).

## Poznámky
- Aplikace používá knihovnu Chart.js načítanou z CDN.
- Po přihlášení lze data načíst a také přidávat nové záznamy do tabulky.
