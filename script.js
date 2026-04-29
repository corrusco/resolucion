// =========================================
// CONFIGURACIÓN Y URLS
// =========================================
const BASE_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQVIJ3VfYy2BwRKgZ4bmXR_AXbANpsT31v7qyM1FOECv4GCpg9VEfiBR9557mYDIPXlQV1jeMmh3tgk/pub";

const ENDPOINTS = {
    fichas: `${BASE_URL}?gid=779876412&output=csv`,
    indice: `${BASE_URL}?gid=1965451569&output=csv`,
    desarrollo: `${BASE_URL}?gid=1989575496&output=csv`, // Hoja 8
    p1: `${BASE_URL}?gid=0&output=csv`,
    p2: `${BASE_URL}?gid=195232515&output=csv`,
    p3: `${BASE_URL}?gid=1223707292&output=csv`,
    p4: `${BASE_URL}?gid=436032444&output=csv`,
    p5: `${BASE_URL}?gid=1447159089&output=csv`
};

const AppState = {
    supuestos: {}, 
    indiceMenu: [], 
    desarrolloData: {}, 
    contenidos: [], 
    currentApartadoIndex: 0 
};

// =========================================
// MOTOR DE DECODIFICACIÓN (MÁGICO)
// =========================================
function decodificarHTML(html) {
    if (!html) return "";
    
    // 1. Creamos un elemento temporal para "traducir" las entidades (&lt;, &gt;, etc)
    const txt = document.createElement("textarea");
    txt.innerHTML = html;
    let paso1 = txt.value;
    
    // 2. Si detectamos que sigue habiendo etiquetas codificadas, repetimos (doble codificación)
    if (paso1.includes("&lt;") || paso1.includes("&gt;")) {
        txt.innerHTML = paso1;
        paso1 = txt.value;
    }
    
    // 3. Limpieza final de saltos de línea del Excel para que no rompan el HTML
    return paso1.trim().replace(/\n/g, "<br>");
}

// =========================================
// PARSER Y CARGA
// =========================================
function parseCSV(str) {
    if (!str) return [];
    const arr = [];
    let quote = false;
    for (let row = 0, col = 0, c = 0; c < str.length; c++) {
        let cc = str[c], nc = str[c+1];
        arr[row] = arr[row] || [];
        arr[row][col] = arr[row][col] || '';
        if (cc == '"' && quote && nc == '"') { arr[row][col] += cc; ++c; continue; }
        if (cc == '"') { quote = !quote; continue; }
        if (cc == ',' && !quote) { ++col; continue; }
        if (cc == '\r' && nc == '\n' && !quote) { ++row; col = 0; ++c; continue; }
        if (cc == '\n' && !quote) { ++row; col = 0; continue; }
        if (cc == '\r' && !quote) { ++row; col = 0; continue; }
        arr[row][col] += cc;
    }
    return arr;
}

function normalizarTexto(txt) {
    if (!txt) return '';
    return String(txt).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, '');
}

async function fetchSafe(url) {
    try {
        const res = await fetch(url + "&cache=" + Date.now());
        if (!res.ok) return '';
        return await res.text();
    } catch(e) { return ''; }
}

async function initApp() {
    try {
        const [csvFichas, csvIndice, csvDes, csvP1, csvP2, csvP3, csvP4, csvP5] = await Promise.all([
            fetchSafe(ENDPOINTS.fichas), fetchSafe(ENDPOINTS.indice), fetchSafe(ENDPOINTS.desarrollo),
            fetchSafe(ENDPOINTS.p1), fetchSafe(ENDPOINTS.p2), fetchSafe(ENDPOINTS.p3),
            fetchSafe(ENDPOINTS.p4), fetchSafe(ENDPOINTS.p5)
        ]);

        procesarFichas(parseCSV(csvFichas));
        procesarIndice(parseCSV(csvIndice));
        procesarDesarrollo(parseCSV(csvDes));
        
        const allRows = [...parseCSV(csvP1), ...parseCSV(csvP2), ...parseCSV(csvP3), ...parseCSV(csvP4), ...parseCSV(csvP5)];
        const uniqueContenidos = [];
        const seen = new Set();
        allRows.forEach(row => {
            const rowStr = row.join('|');
            if(!seen.has(rowStr) && row.length > 0) { seen.add(rowStr); uniqueContenidos.push(row); }
        });
        AppState.contenidos = uniqueContenidos;

        document.getElementById('loader').classList.add('hidden');
        router('home');
    } catch (error) { console.error(error); }
}

function procesarFichas(filas) {
    filas.forEach(fila => {
        if(fila.length < 3 || !fila[0]) return;
        const id = fila[0].trim();
        if (!AppState.supuestos[id]) AppState.supuestos[id] = { id: id };
        AppState.supuestos[id][fila[1].trim()] = fila[2].trim();
    });
}

function procesarIndice(filas) {
    filas.forEach((fila, index) => {
        if(fila.length < 1 || !fila[0]) return;
        AppState.indiceMenu.push({
            titulo: fila[0].trim(), desc: fila[1] ? fila[1].trim() : '',
            orden: fila[2] ? fila[2].trim() : '', justificacion: fila[3] ? fila[3].trim() : ''
        });
    });
}

function procesarDesarrollo(filas) {
    // CORRECCIÓN: No nos saltamos ninguna fila para pillar el punto 1
    filas.forEach((fila) => {
        if (fila.length < 1 || !fila[0].trim()) return; 
        const apartado = fila[0].trim();
        const numSupuesto = fila[1] ? fila[1].trim() : '';
        const contenidoHTML = fila[2] ? fila[2].trim() : '';

        if (!AppState.desarrolloData[apartado]) {
            AppState.desarrolloData[apartado] = { items: [] };
        }
        if (numSupuesto !== '' || contenidoHTML !== '') {
            AppState.desarrolloData[apartado].items.push({ num: numSupuesto, html: contenidoHTML });
        }
    });
}

// =========================================
// NAVEGACIÓN Y VISTAS
// =========================================
function router(view, param = null) {
    ['view-home', 'view-indice', 'view-desarrollo', 'view-resolucion', 'view-detalle-apartado'].forEach(id => {
        document.getElementById(id).classList.add('hidden');
    });
    if (view === 'home') renderHome();
    else if (view === 'indice') renderIndice();
    else if (view === 'desarrollo') renderDesarrollo();
    else if (view === 'resolucion') renderResolucion(param);
    else if (view === 'detalle') renderDetalleApartado(param);
    window.scrollTo(0,0);
}

function renderHome() {
    document.getElementById('view-home').classList.remove('hidden');
    const grid = document.getElementById('grid-fichas');
    grid.innerHTML = '';
    Object.values(AppState.supuestos).sort((a,b) => parseInt(a.id) - parseInt(b.id)).forEach(sup => {
        const div = document.createElement('div');
        div.className = 'card-ficha';
        div.onclick = () => router('resolucion', sup.id);
        div.innerHTML = `<div class="ficha-numero">Supuesto ${sup.id}</div><div class="ficha-dato"><strong>Curso:</strong> ${sup['Área y Curso'] || ''}</div>`;
        grid.appendChild(div);
    });
}

function renderIndice() {
    document.getElementById('view-indice').classList.remove('hidden');
    const grid = document.getElementById('grid-indice');
    grid.innerHTML = '';
    AppState.indiceMenu.forEach((item, index) => {
        const btn = document.createElement('button');
        btn.className = 'btn-indice';
        btn.textContent = item.titulo;
        btn.onclick = () => router('detalle', index);
        grid.appendChild(btn);
    });
}

// =========================================
// VISTA: DESARROLLO (VISOR INTEGRADO)
// =========================================
function renderDesarrollo() {
    const view = document.getElementById('view-desarrollo');
    view.classList.remove('hidden');
    const container = document.getElementById('lista-desarrollo');
    container.innerHTML = '';

    Object.keys(AppState.desarrolloData).forEach((apartado) => {
        const data = AppState.desarrolloData[apartado];
        const section = document.createElement('div');
        section.className = 'desarrollo-section';
        
        const titleDiv = document.createElement('div');
        titleDiv.className = 'desarrollo-titulo';
        titleDiv.innerHTML = decodificarHTML(apartado); // Aplicamos decodificador al título
        section.appendChild(titleDiv);
        
        if (data.items.length > 0) {
            const gridDiv = document.createElement('div');
            gridDiv.className = 'desarrollo-grid';
            
            const visorDiv = document.createElement('div');
            visorDiv.className = 'desarrollo-visor hidden';
            
            const btnClose = document.createElement('button');
            btnClose.className = 'btn-cerrar-visor';
            btnClose.innerHTML = '&times;';
            btnClose.onclick = () => { visorDiv.classList.add('hidden'); gridDiv.classList.remove('hidden'); };
            
            const visorContent = document.createElement('div');
            visorContent.className = 'visor-content';
            
            visorDiv.appendChild(btnClose);
            visorDiv.appendChild(visorContent);

            data.items.sort((a,b) => parseInt(a.num) - parseInt(b.num)).forEach((sup) => {
                const btn = document.createElement('button');
                btn.className = 'btn-grid';
                btn.textContent = sup.num || 'Info';
                btn.onclick = () => {
                    gridDiv.classList.add('hidden');
                    visorDiv.classList.remove('hidden');
                    // Inyectamos el HTML decodificado correctamente
                    visorContent.innerHTML = `<strong style="color:var(--primary-color); display:block; margin-bottom:10px; border-bottom:1px solid #ddd;">Supuesto ${sup.num}</strong>` + decodificarHTML(sup.html);
                };
                gridDiv.appendChild(btn);
            });
            section.appendChild(gridDiv);
            section.appendChild(visorDiv);
        }
        container.appendChild(section);
    });
}

// --- RESOLUCIÓN Y DETALLE (Usando decodificador) ---
function renderResolucion(supuestoId) {
    document.getElementById('view-resolucion').classList.remove('hidden');
    const sup = AppState.supuestos[supuestoId];
    document.getElementById('resolucion-header').innerHTML = `<h2>Resolución Supuesto ${supuestoId}</h2><p class="desc-seccion">${decodificarHTML(sup['Contexto'] || '')}</p>`;
    const contentDiv = document.getElementById('resolucion-content');
    contentDiv.innerHTML = '';
    let currentMainPoint = ""; 

    AppState.indiceMenu.forEach(itemIndice => {
        const normTituloIndice = normalizarTexto(itemIndice.titulo);
        const bloques = AppState.contenidos.filter(row => {
            const target = row[1] !== '' ? row[1] : row[0];
            const normTarget = normalizarTexto(target);
            if (normTarget !== '' && (normTarget.includes(normTituloIndice) || normTituloIndice.includes(normTarget))) {
                const supStr = row[2] ? String(row[2]).trim().toLowerCase() : '';
                if (supStr === "" || supStr.includes("todo") || supStr.split(/[\s,]+/).includes(supuestoId.toString())) return true;
            }
            return false;
        });

        if (bloques.length > 0) {
            const mainPoint = bloques[0][0];
            if (mainPoint && mainPoint !== currentMainPoint) {
                contentDiv.innerHTML += `<h2 class="main-point-title">${decodificarHTML(mainPoint)}</h2>`;
                currentMainPoint = mainPoint; 
            }
            let html = `<div class="notebook-wrapper"><h3 class="sub-point-title">${itemIndice.titulo}</h3><div class="notebook-container">`;
            bloques.forEach(row => {
                html += `<div class="notebook-row"><div class="notebook-terms">${decodificarHTML(row[3])}</div><div class="notebook-content">${decodificarHTML(row[4] || row[3])}</div></div>`;
            });
            contentDiv.innerHTML += html + `</div></div>`;
        }
    });
}

function renderDetalleApartado(idx) {
    document.getElementById('view-detalle-apartado').classList.remove('hidden');
    AppState.currentApartadoIndex = idx;
    const item = AppState.indiceMenu[idx];
    document.getElementById('detalle-header').innerHTML = `<h2>${item.titulo}</h2><p>${item.desc}</p>`;
    const contentDiv = document.getElementById('detalle-content');
    contentDiv.innerHTML = '';
    
    const bloques = AppState.contenidos.filter(row => {
        const target = normalizarTexto(row[1] !== '' ? row[1] : row[0]);
        return target !== '' && (target.includes(normalizarTexto(item.titulo)) || normalizarTexto(item.titulo).includes(target));
    });

    if (bloques.length > 0) {
        let html = `<div class="notebook-wrapper"><div class="notebook-container">`;
        bloques.forEach(row => {
            html += `<div class="notebook-row"><div class="notebook-terms"><span class="badge">Supuestos: ${row[2] || 'Todos'}</span><br>${decodificarHTML(row[3])}</div><div class="notebook-content">${decodificarHTML(row[4] || row[3])}</div></div>`;
        });
        contentDiv.innerHTML = html + `</div></div>`;
    }
}

function nextApartado() {
    let next = AppState.currentApartadoIndex + 1;
    if (next >= AppState.indiceMenu.length) next = 0; 
    router('detalle', next);
}

window.onload = initApp;
