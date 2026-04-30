// =========================================
// CONFIGURACIÓN Y URLS
// =========================================
const BASE_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQVIJ3VfYy2BwRKgZ4bmXR_AXbANpsT31v7qyM1FOECv4GCpg9VEfiBR9557mYDIPXlQV1jeMmh3tgk/pub";

const ENDPOINTS = {
    fichas: `${BASE_URL}?gid=779876412&output=csv`,
    indice: `${BASE_URL}?gid=1965451569&output=csv`,
    desarrollo: `${BASE_URL}?gid=1989575496&output=csv`, // Hoja 8
    elementos: `${BASE_URL}?gid=1657297745&output=csv`,  // Hoja Elementos (Contexto)
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
    contextoData: {}, // Guardará los datos procesados del Contexto
    contenidos: [], 
    currentApartadoIndex: 0 
};

// =========================================
// MOTOR DE DECODIFICACIÓN
// =========================================
function decodificarHTML(html) {
    if (!html) return "";
    const txt = document.createElement("textarea");
    txt.innerHTML = html;
    let paso1 = txt.value;
    if (paso1.includes("&lt;") || paso1.includes("&gt;")) {
        txt.innerHTML = paso1;
        paso1 = txt.value;
    }
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
        const [csvFichas, csvIndice, csvDes, csvElementos, csvP1, csvP2, csvP3, csvP4, csvP5] = await Promise.all([
            fetchSafe(ENDPOINTS.fichas), fetchSafe(ENDPOINTS.indice), fetchSafe(ENDPOINTS.desarrollo),
            fetchSafe(ENDPOINTS.elementos), fetchSafe(ENDPOINTS.p1), fetchSafe(ENDPOINTS.p2), 
            fetchSafe(ENDPOINTS.p3), fetchSafe(ENDPOINTS.p4), fetchSafe(ENDPOINTS.p5)
        ]);

        procesarFichas(parseCSV(csvFichas));
        procesarIndice(parseCSV(csvIndice));
        procesarDesarrollo(parseCSV(csvDes));
        procesarContexto(parseCSV(csvElementos));
        
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
        const categoria = fila[1].trim();
        const contenido = fila[2].trim();

        if (!AppState.supuestos[id]) AppState.supuestos[id] = { id: id };
        AppState.supuestos[id][categoria] = contenido;
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

// PROCESAMIENTO PÁGINA CONTEXTO
function procesarContexto(filas) {
    AppState.contextoData = {};
    filas.forEach((fila, index) => {
        if (index === 0) return; // Saltamos la cabecera
        // Comprobamos que exista la sección en la Columna C (índice 2)
        if (fila.length < 3 || !fila[2] || !fila[2].trim()) return; 
        
        const seccion = fila[2].trim(); // Columna C (Sección)
        const titulo = fila[3] ? fila[3].trim() : ''; // Columna D (Elemento)
        const colE = fila[4] ? fila[4].trim() : '';   // Columna E (Ventaja / Estadio)
        const colF = fila[5] ? fila[5].trim() : '';   // Columna F (Limitación / Implicación)

        if (!AppState.contextoData[seccion]) {
            AppState.contextoData[seccion] = [];
        }
        AppState.contextoData[seccion].push({ titulo, colE, colF });
    });
}

// =========================================
// NAVEGACIÓN Y VISTAS
// =========================================
function router(view, param = null) {
    ['view-home', 'view-indice', 'view-desarrollo', 'view-elementos', 'view-contexto', 'view-resolucion', 'view-detalle-apartado'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });
    
    if (view === 'home') renderHome();
    else if (view === 'indice') renderIndice();
    else if (view === 'desarrollo') renderDesarrollo();
    else if (view === 'elementos') renderElementos();
    else if (view === 'contexto') renderContexto();
    else if (view === 'resolucion') renderResolucion(param);
    else if (view === 'detalle') renderDetalleApartado(param);
    
    window.scrollTo(0,0);
}

function renderHome() {
    document.getElementById('view-home').classList.remove('hidden');
    const grid = document.getElementById('grid-fichas');
    grid.innerHTML = '';

    const supuestosArr = Object.values(AppState.supuestos).sort((a,b) => parseInt(a.id) - parseInt(b.id));

    supuestosArr.forEach(sup => {
        const div = document.createElement('div');
        div.className = 'card-ficha';
        div.onclick = () => router('resolucion', sup.id);
        
        let cardHtml = `<div class="ficha-numero">Supuesto ${sup.id}</div>`;

        const campos = [
            { l: "Área y Curso", k: ["Área y Curso", "Área"] },
            { l: "Contexto", k: ["Contexto"] },
            { l: "Barreras", k: ["Barreras (Diagnóstico)", "Barreras"] },
            { l: "Tarea", k: ["Tarea Pedida (Tribunal)", "Tarea Pedidada", "Tarea Pedida"] },
            { l: "Actividad Estrella", k: ["Actividad Estrella"] },
            { l: "Normativa", k: ["Normativa Específica"] },
            { l: "Autores", k: ["Autores Clave"] }
        ];

        campos.forEach(campo => {
            let valor = "";
            for (let i = 0; i < campo.k.length; i++) {
                if (sup[campo.k[i]]) { valor = String(sup[campo.k[i]]); break; }
            }
            if (valor) {
                valor = decodificarHTML(valor); 
                cardHtml += `<div class="ficha-dato" style="margin-bottom:0.8rem;"><strong>${campo.l}:</strong><br><span style="font-size:0.9rem;color:#444;">${valor}</span></div>`;
            }
        });

        div.innerHTML = cardHtml;
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

// Menú intermedio Elementos
function renderElementos() {
    document.getElementById('view-elementos').classList.remove('hidden');
}

// VISTA: CONTEXTO
function renderContexto() {
    document.getElementById('view-contexto').classList.remove('hidden');
    const cont = document.getElementById('contenedor-contexto');
    cont.innerHTML = '';

    Object.keys(AppState.contextoData).forEach(seccion => {
        const items = AppState.contextoData[seccion];
        
        let html = `
        <div class="elemento-grupo">
            <div class="elemento-grupo-titulo">${decodificarHTML(seccion)}</div>
        `;
        
        items.forEach(i => {
            // Lógica inteligente para cambiar los títulos de la tarjeta según la sección
            let tituloE = "Ventajas Pedagógicas";
            let tituloF = "Limitaciones / Barreras";
            
            if (seccion.toLowerCase().includes("psicoevolutivas") || seccion.toLowerCase().includes("desarrollo")) {
                tituloE = "Estadio Cognitivo";
                tituloF = "Implicación Metodológica";
            }

            html += `
            <div class="elemento-card">
                <h4>${decodificarHTML(i.titulo)}</h4>
                <div class="elemento-grid">
                    <div class="elemento-col col-pros">
                        <strong>${tituloE}</strong>
                        ${decodificarHTML(i.colE)}
                    </div>
                    <div class="elemento-col col-cons">
                        <strong>${tituloF}</strong>
                        ${decodificarHTML(i.colF)}
                    </div>
                </div>
            </div>`;
        });
        
        html += `</div>`;
        cont.innerHTML += html;
    });
}

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
        titleDiv.innerHTML = decodificarHTML(apartado); 
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
                contentDiv.innerHTML += `<h2 class="main-point-title" style="color:var(--primary-color); border-bottom:3px solid var(--accent-color); padding-bottom:0.5rem; margin-top:3rem;">${decodificarHTML(mainPoint)}</h2>`;
                currentMainPoint = mainPoint; 
            }
            let html = `<div class="notebook-wrapper"><h3 class="sub-point-title" style="color:var(--primary-color); margin-top:0;">${itemIndice.titulo}</h3><div class="notebook-container">`;
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
            html += `<div class="notebook-row"><div class="notebook-terms"><span class="badge" style="background:var(--hover-color); padding: 2px 6px; border-radius: 4px; font-size:0.8rem; margin-bottom:5px; display:inline-block;">Supuestos: ${row[2] || 'Todos'}</span><br>${decodificarHTML(row[3])}</div><div class="notebook-content">${decodificarHTML(row[4] || row[3])}</div></div>`;
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
