// === KONFIGURACE API =======================================

// TODO: nastav svou backend URL, která komunikuje s Google Sheets
// Očekávané endpointy:
const API_BASE_URL = 'https://script.google.com/macros/s/AKfycbwlTQg0802v9TIjZMRpQdhxb8UgEJCvH0_e6pD18zvke9dcekt9GwzGShjieW4PxVQJKw/exec';

// === STAV APLIKACE =========================================

let allResults = [];      // všechna data z API
let currentRower = null;  // aktuálně vybraný veslař (string: jméno)
let chartInstance = null; // Chart.js instance

// === POMOCNÉ FUNKCE ========================================

// Načtení parametrů z URL (kvůli History API / sdílení linku)
function getQueryParam(name) {
    const params = new URLSearchParams(window.location.search);
    return params.get(name);
}

// Uložení filtrů do localStorage
function saveFiltersToLocalStorage() {
    const filters = {
        category: document.getElementById('filter-category').value,
        testType: document.getElementById('filter-testType').value,
        season: document.getElementById('filter-season').value,
        name: document.getElementById('filter-name').value
    };
    localStorage.setItem('rowingFilters', JSON.stringify(filters));
}

// Načtení filtrů z localStorage
function loadFiltersFromLocalStorage() {
    const raw = localStorage.getItem('rowingFilters');
    if (!raw) return;
    try {
        const filters = JSON.parse(raw);
        document.getElementById('filter-category').value = filters.category || '';
        document.getElementById('filter-testType').value = filters.testType || '';
        document.getElementById('filter-season').value = filters.season || '';
        document.getElementById('filter-name').value = filters.name || '';
    } catch (e) {
        console.warn('Nepodařilo se načíst filtry z localStorage', e);
    }
}

// Parsování času "MM:SS", "HH:MM:SS", "M:SS,ms" → sekundy (Number)
function parseTimeToSeconds(timeStr) {
    if (!timeStr) return null;
    // nahraď čárku za tečku
    const cleaned = timeStr.trim().replace(',', '.');
    const parts = cleaned.split(':').map(p => parseFloat(p));
    if (parts.some(isNaN)) return null;

    let seconds = 0;
    if (parts.length === 3) {
        seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else if (parts.length === 2) {
        seconds = parts[0] * 60 + parts[1];
    } else if (parts.length === 1) {
        seconds = parts[0];
    }
    return seconds;
}

// Formátování sekund zpět na "M:SS,0"
function formatSeconds(sec) {
    if (sec == null || isNaN(sec)) return '–';
    const totalSeconds = Math.round(sec * 10) / 10; // jedna desetinná
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds - minutes * 60;
    const secondsInt = Math.floor(seconds);
    const decimals = Math.round((seconds - secondsInt) * 10);
    const secStr = String(secondsInt).padStart(2, '0');
    return `${minutes}:${secStr}${decimals ? ',' + decimals : ''}`;
}

// Seřadí podle jména
function sortByNameAsc(a, b) {
    return a.name.localeCompare(b.name, 'cs');
}

// Vrátí unikátní seznam jmen veslařů z allResults
function getUniqueRowers(results) {
    const map = new Map();
    results.forEach(r => {
        const key = r.name;
        if (!map.has(key)) {
            map.set(key, {
                name: r.name,
                club: r.club,
                category: r.category
            });
        }
    });
    return Array.from(map.values()).sort(sortByNameAsc);
}

// Filtruje celkové výsledky podle filtrů v UI
function getFilteredResults() {
    const category = document.getElementById('filter-category').value;
    const testType = document.getElementById('filter-testType').value;
    const season = document.getElementById('filter-season').value;
    const name = document.getElementById('filter-name').value.toLowerCase();

    return allResults.filter(r => {
        if (category && r.category !== category) return false;
        if (testType && r.testType !== testType) return false;
        if (season) {
            // předpoklad: date ve formátu "YYYY-MM-DD"
            if (!r.date || !r.date.startsWith(season)) return false;
        }
        if (name && !r.name.toLowerCase().includes(name)) return false;
        return true;
    });
}

// === RENDER FUNKCE =========================================

// Tabulka veslařů vpravo nahoře
function renderRowersTable() {
    const tbody = document.getElementById('rowers-tbody');
    tbody.innerHTML = '';

    const filtered = getFilteredResults();
    const rowers = getUniqueRowers(filtered);

    if (rowers.length === 0) {
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = 5;
        td.textContent = 'Nebyli nalezeni žádní veslaři pro dané filtry.';
        td.style.textAlign = 'center';
        tr.appendChild(td);
        tbody.appendChild(tr);
        return;
    }

    rowers.forEach(rower => {
        const testsForRower = filtered.filter(r => r.name === rower.name);
        const tr = document.createElement('tr');

        const tdName = document.createElement('td');
        tdName.textContent = rower.name;

        const tdClub = document.createElement('td');
        tdClub.textContent = rower.club || '–';

        const tdCat = document.createElement('td');
        tdCat.textContent = rower.category || '–';

        const tdCount = document.createElement('td');
        tdCount.textContent = testsForRower.length.toString();

        const tdAction = document.createElement('td');
        const btnDetail = document.createElement('button');
        btnDetail.textContent = 'Detail';
        btnDetail.addEventListener('click', () => {
            selectRower(rower.name);
        });
        tdAction.appendChild(btnDetail);

        tr.appendChild(tdName);
        tr.appendChild(tdClub);
        tr.appendChild(tdCat);
        tr.appendChild(tdCount);
        tr.appendChild(tdAction);

        tbody.appendChild(tr);
    });
}

// Detail veslaře: info + historie + graf
function renderRowerDetail(rowerName) {
    const detailName = document.getElementById('detail-name');
    const detailClub = document.getElementById('detail-club');
    const detailCategory = document.getElementById('detail-category');
    const detailBest2k = document.getElementById('detail-best-2k');
    const detailBest6k = document.getElementById('detail-best-6k');
    const detailLastTest = document.getElementById('detail-last-test');

    const historyTbody = document.getElementById('history-tbody');
    historyTbody.innerHTML = '';

    if (!rowerName) {
        detailName.textContent = '–';
        detailClub.textContent = '–';
        detailCategory.textContent = '–';
        detailBest2k.textContent = '–';
        detailBest6k.textContent = '–';
        detailLastTest.textContent = '–';
        if (chartInstance) {
            chartInstance.destroy();
            chartInstance = null;
        }
        return;
    }

    const tests = allResults
        .filter(r => r.name === rowerName)
        .sort((a, b) => (a.date || '').localeCompare(b.date || ''));

    if (tests.length === 0) {
        detailName.textContent = rowerName;
        detailClub.textContent = '–';
        detailCategory.textContent = '–';
        detailBest2k.textContent = '–';
        detailBest6k.textContent = '–';
        detailLastTest.textContent = 'Žádné testy.';
        if (chartInstance) {
            chartInstance.destroy();
            chartInstance = null;
        }
        return;
    }

    const first = tests[0];
    detailName.textContent = first.name;
    detailClub.textContent = first.club || '–';
    detailCategory.textContent = first.category || '–';

    // BEST 2k
    const tests2k = tests.filter(t => t.testType === '2k');
    if (tests2k.length) {
        const best2k = tests2k.reduce((best, curr) => {
            const currSec = curr.timeSeconds ?? parseTimeToSeconds(curr.time);
            const bestSec = best.timeSeconds ?? parseTimeToSeconds(best.time);
            if (currSec == null) return best;
            if (bestSec == null || currSec < bestSec) return curr;
            return best;
        }, tests2k[0]);
        const sec = best2k.timeSeconds ?? parseTimeToSeconds(best2k.time);
        detailBest2k.textContent = sec != null ? formatSeconds(sec) : (best2k.time || '–');
    } else {
        detailBest2k.textContent = '–';
    }

    // BEST 6k
    const tests6k = tests.filter(t => t.testType === '6k');
    if (tests6k.length) {
        const best6k = tests6k.reduce((best, curr) => {
            const currSec = curr.timeSeconds ?? parseTimeToSeconds(curr.time);
            const bestSec = best.timeSeconds ?? parseTimeToSeconds(best.time);
            if (currSec == null) return best;
            if (bestSec == null || currSec < bestSec) return curr;
            return best;
        }, tests6k[0]);
        const sec = best6k.timeSeconds ?? parseTimeToSeconds(best6k.time);
        detailBest6k.textContent = sec != null ? formatSeconds(sec) : (best6k.time || '–');
    } else {
        detailBest6k.textContent = '–';
    }

    // Last test (podle data)
    const last = tests[tests.length - 1];
    detailLastTest.textContent = last.date
        ? `${last.date} – ${last.testType} – ${last.time || formatSeconds(last.timeSeconds)}`
        : `${last.testType} – ${last.time || formatSeconds(last.timeSeconds)}`;

    // Historie tabulka
    tests.forEach(t => {
        const tr = document.createElement('tr');

        const tdDate = document.createElement('td');
        tdDate.textContent = t.date || '–';

        const tdType = document.createElement('td');
        tdType.textContent = t.testType || '–';

        const tdTime = document.createElement('td');
        tdTime.textContent = t.time || formatSeconds(t.timeSeconds) || '–';

        const tdNote = document.createElement('td');
        tdNote.textContent = t.note || '';

        tr.appendChild(tdDate);
        tr.appendChild(tdType);
        tr.appendChild(tdTime);
        tr.appendChild(tdNote);

        historyTbody.appendChild(tr);
    });

    renderChartForRower(tests);
}

// Naplnění dropdownu ve formuláři seznamem veslařů
function populateFormRowers() {
    const select = document.getElementById('form-rower');
    select.innerHTML = '';

    const rowers = getUniqueRowers(allResults);

    rowers.forEach(r => {
        const opt = document.createElement('option');
        opt.value = r.name;
        opt.textContent = r.name;
        select.appendChild(opt);
    });

    if (currentRower) {
        select.value = currentRower;
    }
}

// === CHART.JS ==================================================

function renderChartForRower(tests) {
    const ctx = document.getElementById('performance-chart');
    if (!ctx) return;

    const show2k = document.getElementById('chart-2k').checked;
    const show6k = document.getElementById('chart-6k').checked;
    const currentSeasonOnly = document.getElementById('chart-current-season').checked;

    const currentYear = new Date().getFullYear().toString();

    // připrav datasets
    const dataset2k = [];
    const dataset6k = [];

    tests.forEach(t => {
        if (currentSeasonOnly && (!t.date || !t.date.startsWith(currentYear))) {
            return;
        }
        const sec = t.timeSeconds ?? parseTimeToSeconds(t.time);
        if (sec == null) return;
        const label = t.date || '';
        if (t.testType === '2k') {
            dataset2k.push({ x: label, y: sec });
        } else if (t.testType === '6k') {
            dataset6k.push({ x: label, y: sec });
        }
    });

    const dataSets = [];
    if (show2k && dataset2k.length) {
        dataSets.push({
            label: '2 km',
            data: dataset2k,
            tension: 0.2
        });
    }
    if (show6k && dataset6k.length) {
        dataSets.push({
            label: '6 km',
            data: dataset6k,
            tension: 0.2
        });
    }

    if (chartInstance) {
        chartInstance.destroy();
    }

    if (dataSets.length === 0) {
        chartInstance = null;
        ctx.getContext && ctx.getContext('2d').clearRect(0, 0, ctx.width, ctx.height);
        return;
    }

    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            datasets: dataSets
        },
        options: {
            parsing: false,
            scales: {
                x: {
                    type: 'category',
                    title: {
                        display: true,
                        text: 'Datum'
                    }
                },
                y: {
                    reverse: true, // lepší čas = menší hodnota
                    title: {
                        display: true,
                        text: 'Čas (s)'
                    }
                }
            },
            plugins: {
                legend: {
                    labels: {
                        color: '#e6eef7'
                    }
                }
            }
        }
    });
}

// === API VOLÁNÍ ================================================

async function fetchResults() {
    const loader = document.getElementById('rowers-loader');
    const errorEl = document.getElementById('rowers-error');
    loader.classList.remove('hidden');
    errorEl.classList.add('hidden');
    errorEl.textContent = '';

    try {
        const resp = await fetch('https://script.google.com/macros/s/TVŮJ_ID/exec?resource=results');
        if (!resp.ok) {
            throw new Error(`HTTP ${resp.status}`);
        }
        const data = await resp.json();

        // Předpokládaná struktura položky:
        // {
        //   id: string,
        //   name: string,
        //   club: string,
        //   category: string,
        //   testType: '2k'|'6k'|'AT'|'Jiný',
        //   date: 'YYYY-MM-DD',
        //   time: '6:45,3'    (volitelné)
        //   timeSeconds: 405.3 (volitelné)
        //   note: string
        // }
        allResults = data.map(item => ({
            ...item,
            // fallback: dopočítej timeSeconds pokud chybí
            timeSeconds:
                typeof item.timeSeconds === 'number'
                    ? item.timeSeconds
                    : parseTimeToSeconds(item.time)
        }));

        allResults.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'cs'));

        renderRowersTable();
        populateFormRowers();

        // pokud v URL je ?rower=..., zobraz ho
        const urlRower = getQueryParam('rower');
        if (urlRower) {
            selectRower(urlRower);
        } else if (!currentRower && allResults.length) {
            selectRower(allResults[0].name);
        }
    } catch (err) {
        console.error(err);
        errorEl.textContent =
            'Nepodařilo se načíst data z API. ' +
            'Zkontroluj API_BASE_URL nebo si připrav jednoduchý backend.';
        errorEl.classList.remove('hidden');

        // fallback demo data, aby to aspoň něco ukazovalo při lokálním běhu
        allResults = getDemoData();
        renderRowersTable();
        populateFormRowers();
        if (!currentRower && allResults.length) {
            selectRower(allResults[0].name);
        }
    } finally {
        loader.classList.add('hidden');
    }
}

async function createResult(newResult) {
    const formMessage = document.getElementById('form-message');
    formMessage.textContent = '';
    try {
        const resp = await fetch('https://script.google.com/macros/s/TVŮJ_ID/exec?resource=results', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(newResult)
        });

        if (!resp.ok) {
            throw new Error(`HTTP ${resp.status}`);
        }

        const created = await resp.json();

        // Doplnit do allResults a překreslit
        const record = {
            ...created,
            timeSeconds:
                typeof created.timeSeconds === 'number'
                    ? created.timeSeconds
                    : parseTimeToSeconds(created.time)
        };
        allResults.push(record);

        renderRowersTable();
        populateFormRowers();
        selectRower(record.name);

        formMessage.style.color = '#4caf50';
        formMessage.textContent = 'Test byl úspěšně uložen.';
    } catch (err) {
        console.error(err);
        formMessage.style.color = '#ff6b6b';
        formMessage.textContent =
            'Nepodařilo se uložit test přes API. Zkontroluj backend / konzoli.';
    }
}

// === DEMO DATA (fallback, když API není nastavené) =============

function getDemoData() {
    return [
        {
            id: '1',
            name: 'Novák Jan',
            club: 'VK Smíchov',
            category: 'U23',
            testType: '2k',
            date: '2025-02-01',
            time: '6:45,3',
            timeSeconds: parseTimeToSeconds('6:45,3'),
            note: 'Kontrolní test'
        },
        {
            id: '2',
            name: 'Novák Jan',
            club: 'VK Smíchov',
            category: 'U23',
            testType: '2k',
            date: '2025-03-01',
            time: '6:42,8',
            timeSeconds: parseTimeToSeconds('6:42,8'),
            note: ''
        },
        {
            id: '3',
            name: 'Novák Jan',
            club: 'VK Smíchov',
            category: 'U23',
            testType: '6k',
            date: '2025-02-15',
            time: '21:30,0',
            timeSeconds: parseTimeToSeconds('21:30,0'),
            note: '6k test'
        },
        {
            id: '4',
            name: 'Dvořák Petr',
            club: 'ČVK Praha',
            category: 'U19',
            testType: '2k',
            date: '2025-02-10',
            time: '7:05,0',
            timeSeconds: parseTimeToSeconds('7:05,0'),
            note: ''
        },
        {
            id: '5',
            name: 'Dvořák Petr',
            club: 'ČVK Praha',
            category: 'U19',
            testType: '6k',
            date: '2025-02-20',
            time: '22:00,0',
            timeSeconds: parseTimeToSeconds('22:00,0'),
            note: ''
        }
    ];
}

// === INTERAKCE / EVENT LISTENERY ==============================

function applyFilters() {
    saveFiltersToLocalStorage();
    renderRowersTable();
}

function resetFilters() {
    document.getElementById('filter-category').value = '';
    document.getElementById('filter-testType').value = '';
    document.getElementById('filter-season').value = '';
    document.getElementById('filter-name').value = '';
    saveFiltersToLocalStorage();
    renderRowersTable();
}

// volá se při kliknutí na "Detail"
function selectRower(name) {
    currentRower = name;
    // update URL (History API)
    const url = new URL(window.location.href);
    url.searchParams.set('rower', name);
    window.history.pushState({ rower: name }, '', url.toString());

    renderRowerDetail(name);

    // předvyplň formulář
    const select = document.getElementById('form-rower');
    if (select.options.length) {
        select.value = name;
    }
}

// odeslání formuláře nového testu
function handleFormSubmit(event) {
    event.preventDefault();

    const formMessage = document.getElementById('form-message');
    formMessage.textContent = '';

    const addNewRower = document.getElementById('form-add-new-rower').checked;
    const selectRower = document.getElementById('form-rower');
    const newRowerInput = document.getElementById('form-new-rower');
    const testType = document.getElementById('form-testType').value;
    const date = document.getElementById('form-date').value;
    const timeStr = document.getElementById('form-time').value;
    const note = document.getElementById('form-note').value;

    let name;
    if (addNewRower) {
        name = newRowerInput.value.trim();
        if (!name) {
            formMessage.style.color = '#ff6b6b';
            formMessage.textContent = 'Zadej jméno nového veslaře.';
            return;
        }
    } else {
        name = selectRower.value;
    }

    if (!date) {
        formMessage.style.color = '#ff6b6b';
        formMessage.textContent = 'Zadej datum testu.';
        return;
    }

    const sec = parseTimeToSeconds(timeStr);
    if (sec == null) {
        formMessage.style.color = '#ff6b6b';
        formMessage.textContent =
            'Zadej čas ve formátu HH:MM:SS nebo MM:SS (lze i s desetinou).';
        return;
    }

    // Najdi existujícího veslaře kvůli klubu/kategorii (nebo nech prázdné)
    const known = allResults.find(r => r.name === name);
    const category = known ? known.category : '';
    const club = known ? known.club : '';

    const newResult = {
        name,
        club,
        category,
        testType,
        date,
        time: timeStr,
        timeSeconds: sec,
        note
    };

    createResult(newResult);
}

// přepínání "Přidat nového veslaře"
function handleAddNewRowerToggle() {
    const checkbox = document.getElementById('form-add-new-rower');
    const row = document.getElementById('form-new-rower-row');
    const select = document.getElementById('form-rower');

    if (checkbox.checked) {
        row.style.display = 'flex';
        select.disabled = true;
    } else {
        row.style.display = 'none';
        select.disabled = false;
    }
}

// === INIT =====================================================

document.addEventListener('DOMContentLoaded', () => {
    // načti uložené filtry z localStorage
    loadFiltersFromLocalStorage();

    // event listenery filtrů
    document.getElementById('btn-apply-filters').addEventListener('click', applyFilters);
    document.getElementById('btn-reset-filters').addEventListener('click', resetFilters);
    document.getElementById('btn-refresh').addEventListener('click', fetchResults);

    // graf – při změně checkboxů překreslit
    document.getElementById('chart-2k').addEventListener('change', () => {
        if (currentRower) {
            renderRowerDetail(currentRower);
        }
    });
    document.getElementById('chart-6k').addEventListener('change', () => {
        if (currentRower) {
            renderRowerDetail(currentRower);
        }
    });
    document.getElementById('chart-current-season').addEventListener('change', () => {
        if (currentRower) {
            renderRowerDetail(currentRower);
        }
    });

    // formulář
    document.getElementById('new-test-form').addEventListener('submit', handleFormSubmit);
    document.getElementById('form-add-new-rower').addEventListener('change', handleAddNewRowerToggle);

    // první načtení dat
    fetchResults();
});
