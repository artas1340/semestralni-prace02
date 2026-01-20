# semestralni-prace02

Webová aplikace pro přehled a správu výsledků veslařských testů. Data se načítají a ukládají do Google Sheets pomocí Google API, výsledky jsou filtrovány a vizualizovány pomocí grafu (Chart.js).

## Funkce
- Přihlášení přes Google (OAuth) a práce s Google Sheets API.
- Načítání seznamu veslařů a jejich testů ze spreadsheetu.
- Filtrování podle kategorie, typu testu, sezóny a jména.
- Detail veslaře s historií testů a grafem výkonu.
- Přidání nového testu (ukládání do tabulky).
- Ukládání filtrů do `localStorage`.

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
