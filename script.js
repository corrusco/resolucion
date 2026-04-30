// =========================================
// CONFIGURACIÓN Y URLS DE TODAS LAS HOJAS
// =========================================
const BASE_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQVIJ3VfYy2BwRKgZ4bmXR_AXbANpsT31v7qyM1FOECv4GCpg9VEfiBR9557mYDIPXlQV1jeMmh3tgk/pub";

const ENDPOINTS = {
    fichas: `${BASE_URL}?gid=779876412&output=csv`,
    indice: `${BASE_URL}?gid=1965451569&output=csv`,
    desarrollo: `${BASE_URL}?gid=1989575496&output=csv`,
    contexto: `${BASE_URL}?gid=1657297745&output=csv`,
    barreras: `${BASE_URL}?gid=1499539681&output=csv`,
    curriculo: `${BASE_URL}?gid=668462564&output=csv`,
    metodologia: `${BASE_URL}?gid=2002680806&output=csv`,
    actividades: `${BASE_URL}?gid=760733333&output=csv`,
    medidas: `${BASE_URL}?gid=1338745614&output=csv`,
    instrumentos: `${BASE_URL}?gid=1337355697&output=csv`,
    bibliografia: `${BASE_URL}?gid=1637340083&output=csv`,
    // Hojas de contenido puro para la resolución final
    p1: `${BASE_URL}?gid=0&output=csv`, p2: `${BASE_URL}?gid=195232515&output=csv`, p3: `${BASE_URL}?gid=1223707292&output=csv`, p4: `${BASE_URL}?gid=436032444&output=csv`, p5: `${BASE_URL}?gid=1447159089&output=csv`
};

const AppState = {
    supuestos: {}, indiceMenu: [], desarrolloData: {}, contenidos: [], currentApartadoIndex: 0,
    db_contexto: {}, db_barreras: [], db_curriculo: {}, db_metodologia: {}, 
    db_actividades: {}, db_medidas: {}, db_instrumentos: {}, db_bibliografia: {}
};

// =========================================
// DECODIFICADOR Y PARSER
// =========================================
function decodificarHTML(html) {
    if (!html) return "";
    const txt = document.createElement("textarea");
    txt.innerHTML = html;
    let paso1 = txt.value;
    if (paso1.includes("&lt;") || paso1.includes("&gt;")) { txt.innerHTML = paso1; paso1 = txt.value; }
    return paso1.trim().replace(/\n/g, "<br>");
}

function parseCSV(str) {
    if (!str) return [];
    const arr = []; let quote = false;
    for (let row = 0, col = 0, c = 0; c < str.length; c++) {
        let cc = str[c], nc = str[c+1];
        arr[row] = arr[row] || []; arr[row][col] = arr[row][col] || '';
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

function normalizarTexto(txt) { return txt ? String(txt).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, '') : ''; }

async function fetchSafe(url) {
    try { const res = await fetch(url + "&cache=" + Date.now()); return res.ok ? await res.text() : ''; } catch(e) { return ''; }
}

// =========================================
// INICIALIZACIÓN PARALELA
// =========================================
async function initApp() {
    try {
        const fetches = Object.values(ENDPOINTS).map(url => fetchSafe(url));
        const results = await Promise.all(fetches);
        
        const [
            csvFichas, csvIndice, csvDes, csvContx, csvBarr, csvCurr, csvMetod, csvActiv, csvMedidas, csvInstru, csvBiblio,
            csvP1, csvP2, csvP3, csvP4, csvP5
        ] = results;

        procesarFichas(parseCSV(csvFichas));
        procesarIndice(parseCSV(csvIndice));
        procesarDesarrollo(parseCSV(csvDes));
        
        procesarContexto(parseCSV(csvContx));
        procesarBarreras(parseCSV(csvBarr));
        procesarCurriculo(parseCSV(csvCurr));
        
        // Uso de procesadores inteligentes según si tienen cabeceras por sección o no
        procesarConCabecerasPropias(parseCSV(csvMetod), AppState.db_metodologia, 1, 2, [3,4]); 
        procesarConCabecerasPropias(parseCSV(csvActiv), AppState.db_actividades, 1, 2, [3,4,5,6]); 
        
        procesarGenerico(parseCSV(csvMedidas), AppState.db_medidas, 2, null, [3,4], true); 
        procesarGenerico(parseCSV(csvInstru), AppState.db_instrumentos, 2, null, [3,4], true); 
        
        procesarBibliografia(parseCSV(csvBiblio));

        const allRows = [...parseCSV(csvP1), ...parseCSV(csvP2), ...parseCSV(csvP3), ...parseCSV(csvP4), ...parseCSV(csvP5)];
        const uniqueContenidos = []; const seen = new Set();
        allRows.forEach(row => { const rowStr = row.join('|'); if(!seen.has(rowStr) && row.length > 0) { seen.add(rowStr); uniqueContenidos.push(row); }});
        AppState.contenidos = uniqueContenidos;

        document.getElementById('loader').classList.add('hidden');
        router('home');
    } catch (error) { console.error(error); document.getElementById('loader').innerHTML="Error cargando datos.";}
}

// =========================================
// FUNCIONES DE PROCESAMIENTO (DATA PARSING)
// =========================================
function procesarFichas(filas) { filas.forEach(f => { if(f.length<3||!f[0])return; const id=f[0].trim(); if(!AppState.supuestos[id])AppState.supuestos[id]={id:id}; AppState.supuestos[id][f[1].trim()]=f[2].trim(); });}
function procesarIndice(filas) { filas.forEach((f,i) => { if(f.length<1||!f[0])return; AppState.indiceMenu.push({titulo:f[0].trim(), desc:f[1]?f[1].trim():'', orden:f[2]?f[2].trim():'', justificacion:f[3]?f[3].trim():''}); });}
function procesarDesarrollo(filas) { filas.forEach(f => { if(f.length<1||!f[0].trim())return; const ap=f[0].trim(); if(!AppState.desarrolloData[ap])AppState.desarrolloData[ap]={items:[]}; if((f[1]&&f[1].trim())||(f[2]&&f[2].trim())) AppState.desarrolloData[ap].items.push({num:f[1]?f[1].trim():'', html:f[2]?f[2].trim():''}); });}

function procesarContexto(filas) {
    AppState.db_contexto = {}; let lastSec = "Contexto Genérico";
    filas.forEach((f, i) => {
        if (i===0) return; 
        if (f[2] && f[2].trim()) lastSec = f[2].trim(); 
        if (!f[3] || !f[3].trim()) return; 
        if (!AppState.db_contexto[lastSec]) AppState.db_contexto[lastSec] = [];
        AppState.db_contexto[lastSec].push({ t: f[3]?f[3].trim():'', p: f[4]?f[4].trim():'', c: f[5]?f[5].trim():'' });
    });
}

function procesarBarreras(filas) {
    AppState.db_barreras = [];
    if(filas.length > 0) AppState.cabecerasBarreras = filas[0]; 
    filas.forEach((f, i) => {
        if (i===0 || !f[1] || !f[1].trim()) return; 
        AppState.db_barreras.push(f); 
    });
}

function procesarCurriculo(filas) {
    AppState.db_curriculo = {}; let lastSec = "Área Curricular";
    filas.forEach((f, i) => {
        if (i===0) return;
        if (f[2] && f[2].trim()) lastSec = f[2].trim(); 
        if (!f[3] || !f[3].trim()) return; 
        if (!AppState.db_curriculo[lastSec]) AppState.db_curriculo[lastSec] = [];
        AppState.db_curriculo[lastSec].push({ comp: f[3]?f[3].trim():'', def: f[4]?f[4].trim():'', sab: f[5]?f[5].trim():'', crit: f[6]?f[6].trim():'', inst: f[7]?f[7].trim():'' });
    });
}

// PROCESADOR INTELIGENTE (Metodología y Actividades): Convierte la fila 1 de cada bloque en etiquetas
function procesarConCabecerasPropias(filas, db, agruparIndex, tituloIndex, dataIndexes) {
    let lastGroup = null;
    filas.forEach((f, i) => {
        if (i === 0 && (!f[agruparIndex] || !f[agruparIndex].trim())) return; 
        
        let isHeaderRow = false;
        if (f[agruparIndex] && f[agruparIndex].trim()) {
            lastGroup = f[agruparIndex].trim();
            if (!db[lastGroup]) {
                db[lastGroup] = { headers: {}, items: [] };
                isHeaderRow = true; // La primera fila donde se define el grupo, asumimos que tiene los títulos
            }
        }
        if (!lastGroup) return;

        if (isHeaderRow) {
            db[lastGroup].headers.t = tituloIndex !== null ? f[tituloIndex].trim() : "";
            db[lastGroup].headers.d = dataIndexes.map(idx => f[idx] ? f[idx].trim() : "");
        } else {
            const checkIndex = tituloIndex !== null ? tituloIndex : dataIndexes[0];
            if (!f[checkIndex] || !f[checkIndex].trim()) return; // Fila vacía
            let obj = { t: tituloIndex !== null ? f[tituloIndex].trim() : "", d: [] };
            dataIndexes.forEach(idx => { obj.d.push(f[idx] ? f[idx].trim() : ""); });
            db[lastGroup].items.push(obj);
        }
    });
}

function procesarGenerico(filas, db, agruparIndex, tituloIndex, dataIndexes, omitirFila1 = false) {
    let lastGroup = "Sección";
    filas.forEach((f, i) => {
        if (omitirFila1 && i === 0) return;
        if (agruparIndex !== null && f[agruparIndex] && f[agruparIndex].trim()) lastGroup = f[agruparIndex].trim();
        const checkIndex = tituloIndex !== null ? tituloIndex : dataIndexes[0];
        if (!f[checkIndex] || !f[checkIndex].trim()) return; 

        if (!db[lastGroup]) db[lastGroup] = [];
        let obj = { t: tituloIndex !== null ? f[tituloIndex].trim() : "", d: [] };
        dataIndexes.forEach(idx => { if (f[idx]) obj.d.push(f[idx].trim()); });
        db[lastGroup].push(obj);
    });
}

// CORRECCIÓN: Doble agrupación para Bibliografía (Agrupa autores dentro de su Área)
function procesarBibliografia(filas) {
    AppState.db_bibliografia = {};
    let lastSec = "Normativa";
    let lastArea = "General";
    
    filas.forEach((f, i) => {
        if (i===0) return;
        if (f[1] && f[1].trim()) lastSec = f[1].trim(); 
        if (f[2] && f[2].trim()) lastArea = f[2].trim(); 
        
        if (!f[3] || !f[3].trim()) return; 
        
        if (!AppState.db_bibliografia[lastSec]) AppState.db_bibliografia[lastSec] = {};
        if (!AppState.db_bibliografia[lastSec][lastArea]) AppState.db_bibliografia[lastSec][lastArea] = [];
        
        AppState.db_bibliografia[lastSec][lastArea].push(f);
    });
}

// =========================================
// ENRUTADOR PRINCIPAL
// =========================================
function router(view, param = null) {
    ['view-home', 'view-indice', 'view-desarrollo', 'view-elementos', 
        'view-contexto', 'view-barreras', 'view-curriculo', 'view-metodologia', 
        'view-actividades', 'view-medidas', 'view-instrumentos', 'view-bibliografia', 
        'view-resolucion', 'view-detalle-apartado'].forEach(id => {
        const el = document.getElementById(id); if (el) el.classList.add('hidden');
    });
    
    if (view === 'home') renderHome();
    else if (view === 'indice') renderIndice();
    else if (view === 'desarrollo') renderDesarrollo();
    else if (view === 'elementos') document.getElementById('view-elementos').classList.remove('hidden');
    else if (view === 'contexto') renderContexto();
    else if (view === 'barreras') renderBarreras();
    else if (view === 'curriculo') renderCurriculo();
    else if (view === 'metodologia') renderConCabecerasPropias('view-metodologia', 'contenedor-metodologia', AppState.db_metodologia);
    else if (view === 'actividades') renderConCabecerasPropias('view-actividades', 'contenedor-actividades', AppState.db_actividades);
    else if (view === 'medidas') renderGenerico('view-medidas', 'contenedor-medidas', AppState.db_medidas);
    else if (view === 'instrumentos') renderGenerico('view-instrumentos', 'contenedor-instrumentos', AppState.db_instrumentos);
    else if (view === 'bibliografia') renderBibliografia();
    else if (view === 'resolucion') renderResolucion(param);
    else if (view === 'detalle') renderDetalleApartado(param);
    
    window.scrollTo(0,0);
}

// =========================================
// RENDERIZADORES DE VISTAS
// =========================================

// RENDERIZADOR INTELIGENTE: Pinta la información usando los Títulos Extraídos
function renderConCabecerasPropias(viewId, containerId, db) {
    document.getElementById(viewId).classList.remove('hidden');
    const cont = document.getElementById(containerId); cont.innerHTML = '';
    if(Object.keys(db).length === 0) { cont.innerHTML = '<p style="text-align:center; padding: 20px;">Cargando o no hay datos.</p>'; return; }

    Object.keys(db).forEach(sec => {
        let html = `<div class="elemento-grupo"><div class="elemento-grupo-titulo">${decodificarHTML(sec)}</div><div class="notebook-wrapper" style="padding:15px; margin-bottom:0;">`;
        const headers = db[sec].headers;
        
        db[sec].items.forEach(i => {
            html += `<div class="curriculo-row">`;
            if (i.t) {
                // Imprimimos el título de la columna antes del dato
                html += `<div style="margin-bottom:8px; border-bottom:1px solid #eee; padding-bottom:5px;">
                            <span style="font-size:0.8rem; color:#666; text-transform:uppercase;">${decodificarHTML(headers.t)}</span><br>
                            <strong style="color:var(--accent-color); font-size:1.05rem;">${decodificarHTML(i.t)}</strong>
                         </div>`;
            }
            i.d.forEach((dato, idx) => { 
                if(dato) {
                    // Imprimimos el título de la columna (si existe) antes de las características
                    const headerText = headers.d[idx] ? `<strong style="display:block; font-size:0.8rem; color:var(--primary-color); margin-top:8px;">${decodificarHTML(headers.d[idx])}</strong>` : '';
                    html += `${headerText}<div style="margin-bottom:5px; font-size:0.95rem;">${decodificarHTML(dato)}</div>`; 
                }
            });
            html += `</div>`;
        });
        cont.innerHTML += html + `</div></div>`;
    });
}

// CORRECCIÓN: Renderizador agrupado por Áreas para la Bibliografía
function renderBibliografia() {
    document.getElementById('view-bibliografia').classList.remove('hidden');
    const cont = document.getElementById('contenedor-bibliografia'); cont.innerHTML = '';
    if(Object.keys(AppState.db_bibliografia).length === 0) { cont.innerHTML = '<p style="text-align:center; padding: 20px;">Cargando o no hay datos.</p>'; return; }

    Object.keys(AppState.db_bibliografia).forEach((sec, sIdx) => {
        let html = `<div class="elemento-grupo"><div class="elemento-grupo-titulo">${decodificarHTML(sec)}</div>`;
        
        Object.keys(AppState.db_bibliografia[sec]).forEach((area, aIdx) => {
            const idColapso = `biblio-${sIdx}-${aIdx}`;
            let contentHtml = "";
            
            // Recorremos todos los autores/ítems dentro de esta Área
            AppState.db_bibliografia[sec][area].forEach(f => {
                if (sec.includes("5.1")) { 
                    contentHtml += `<div style="margin-bottom:10px;">${decodificarHTML(f[3])}</div>`; 
                } 
                else if (sec.includes("5.2")) { 
                    contentHtml += `<div style="margin-bottom:15px; border-bottom:1px solid #eee; padding-bottom:10px;">
                                        <strong style="color:var(--primary-color);">${decodificarHTML(f[3])}</strong><br>${decodificarHTML(f[4])}
                                    </div>`; 
                } 
                else { 
                    contentHtml += `<div style="margin-bottom:15px; border-bottom:1px solid #eee; padding-bottom:10px;">
                                        <strong style="color:var(--primary-color); font-size:1.05rem;">${decodificarHTML(f[3])}</strong><br>
                                        ${decodificarHTML(f[4])}<br>
                                        <em style="font-size:0.85rem; color:#555;">${decodificarHTML(f[5])}</em>
                                    </div>`; 
                }
            });
            
            html += `<button class="acordeon-btn" style="border-left-color:#666;" onclick="toggleAcordeon('${idColapso}', this)">${decodificarHTML(area)} <span style="font-size:0.8rem">▼</span></button>
                     <div id="${idColapso}" class="acordeon-content">${contentHtml}</div>`;
        });
        cont.innerHTML += html + `</div>`;
    });
}

function renderGenerico(viewId, containerId, db) {
    document.getElementById(viewId).classList.remove('hidden');
    const cont = document.getElementById(containerId); cont.innerHTML = '';
    if(Object.keys(db).length === 0) { cont.innerHTML = '<p style="text-align:center; padding: 20px;">Cargando o no hay datos.</p>'; return; }

    Object.keys(db).forEach(sec => {
        let html = `<div class="elemento-grupo">`;
        if(sec !== "Sección") html += `<div class="elemento-grupo-titulo">${decodificarHTML(sec)}</div>`;
        html += `<div class="notebook-wrapper" style="padding:15px; margin-bottom:0;">`;
        db[sec].forEach(i => {
            html += `<div class="curriculo-row">`;
            if (i.t) html += `<strong style="width:100%; display:block; margin-bottom:5px; color:var(--accent-color); border-bottom:1px solid #ddd;">${decodificarHTML(i.t)}</strong>`;
            i.d.forEach(dato => { if(dato) html += `<div style="margin-bottom:5px; font-size:0.9rem;">${decodificarHTML(dato)}</div>`; });
            html += `</div>`;
        });
        cont.innerHTML += html + `</div></div>`;
    });
}

function renderContexto() {
    document.getElementById('view-contexto').classList.remove('hidden');
    const cont = document.getElementById('contenedor-contexto'); cont.innerHTML = '';
    if(Object.keys(AppState.db_contexto).length === 0) { cont.innerHTML = '<p style="text-align:center; padding: 20px;">Cargando o no hay datos.</p>'; return; }

    Object.keys(AppState.db_contexto).forEach(sec => {
        let html = `<div class="elemento-grupo"><div class="elemento-grupo-titulo">${decodificarHTML(sec)}</div>`;
        AppState.db_contexto[sec].forEach(i => {
            let tE = "Ventajas Pedagógicas", tF = "Limitaciones / Barreras";
            if (sec.toLowerCase().includes("psicoevolutivas") || sec.toLowerCase().includes("desarrollo")) { tE = "Estadio Cognitivo"; tF = "Implicación Metodológica"; }
            html += `<div class="elemento-card"><h4>${decodificarHTML(i.t)}</h4><div class="elemento-grid"><div class="elemento-col col-pros"><strong>${tE}</strong>${decodificarHTML(i.p)}</div><div class="elemento-col col-cons"><strong>${tF}</strong>${decodificarHTML(i.c)}</div></div></div>`;
        });
        cont.innerHTML += html + `</div>`;
    });
}

function renderBarreras() {
    document.getElementById('view-barreras').classList.remove('hidden');
    const cont = document.getElementById('contenedor-barreras'); const cabeceras = AppState.cabecerasBarreras || []; cont.innerHTML = '';
    if(AppState.db_barreras.length === 0) { cont.innerHTML = '<p style="text-align:center; padding: 20px;">Cargando o no hay datos.</p>'; return; }
    
    AppState.db_barreras.forEach((f, index) => {
        const idColapso = `barrera-${index}`; let contentHtml = "";
        for(let j=2; j<=11; j++) {
            if(f[j] && f[j].trim()) {
                const tituloBloque = cabeceras[j] ? cabeceras[j] : 'Detalle';
                contentHtml += `<div class="badge-tit">${decodificarHTML(tituloBloque)}</div><div style="margin-bottom:10px;">${decodificarHTML(f[j])}</div>`;
            }
        }
        cont.innerHTML += `<div class="elemento-grupo" style="margin-bottom:10px;"><button class="acordeon-btn" onclick="toggleAcordeon('${idColapso}', this)">${decodificarHTML(f[1])} <span style="font-size:0.8rem">▼</span></button><div id="${idColapso}" class="acordeon-content">${contentHtml}</div></div>`;
    });
}

function renderCurriculo() {
    document.getElementById('view-curriculo').classList.remove('hidden');
    const cont = document.getElementById('contenedor-curriculo'); cont.innerHTML = '';
    if(Object.keys(AppState.db_curriculo).length === 0) { cont.innerHTML = '<p style="text-align:center; padding: 20px;">Cargando o no hay datos.</p>'; return; }

    Object.keys(AppState.db_curriculo).forEach(sec => {
        let html = `<div class="elemento-grupo"><div class="elemento-grupo-titulo">${decodificarHTML(sec)}</div><div class="notebook-wrapper" style="margin-bottom:0; padding:15px;">`;
        AppState.db_curriculo[sec].forEach(i => {
            html += `<div class="curriculo-row" style="margin-bottom:15px; background:#fafafa;"><div style="margin-bottom:8px; border-bottom:2px solid var(--primary-color); padding-bottom:5px;"><strong style="color:var(--accent-color); width:auto;">${decodificarHTML(i.comp)}</strong> <span style="font-size:0.9rem;">${decodificarHTML(i.def)}</span></div>${i.sab ? `<div class="curriculo-row"><strong>Saberes Básicos</strong><div class="curriculo-content">${decodificarHTML(i.sab)}</div></div>` : ''}${i.crit ? `<div class="curriculo-row"><strong>Criterios de Ev.</strong><div class="curriculo-content">${decodificarHTML(i.crit)}</div></div>` : ''}${i.inst ? `<div class="curriculo-row"><strong>Instrumentos</strong><div class="curriculo-content">${decodificarHTML(i.inst)}</div></div>` : ''}</div>`;
        });
        cont.innerHTML += html + `</div></div>`;
    });
}

function toggleAcordeon(id, btn) {
    const el = document.getElementById(id);
    if(el.classList.contains('show')) { el.classList.remove('show'); btn.classList.remove('activo'); btn.innerHTML = btn.innerHTML.replace('▲', '▼'); } 
    else { el.classList.add('show'); btn.classList.add('activo'); btn.innerHTML = btn.innerHTML.replace('▼', '▲'); }
}

// =========================================
// VISTAS ORIGINALES (Fichas, Desarrollo...)
// =========================================
function renderHome() {
    document.getElementById('view-home').classList.remove('hidden'); const grid = document.getElementById('grid-fichas'); grid.innerHTML = '';
    const supuestosArr = Object.values(AppState.supuestos).sort((a,b) => parseInt(a.id) - parseInt(b.id));
    supuestosArr.forEach(sup => {
        const div = document.createElement('div'); div.className = 'card-ficha'; div.onclick = () => router('resolucion', sup.id);
        let cardHtml = `<div class="ficha-numero">Supuesto ${sup.id}</div>`;
        const campos = [{ l: "Área y Curso", k: ["Área y Curso", "Área"] }, { l: "Contexto", k: ["Contexto"] }, { l: "Barreras", k: ["Barreras (Diagnóstico)", "Barreras"] }, { l: "Tarea", k: ["Tarea Pedida (Tribunal)", "Tarea Pedidada", "Tarea Pedida"] }, { l: "Actividad Estrella", k: ["Actividad Estrella"] }];
        campos.forEach(c => { let v = ""; for(let i=0; i<c.k.length; i++) { if(sup[c.k[i]]) {v=String(sup[c.k[i]]); break;} } if(v) cardHtml += `<div class="ficha-dato"><strong>${c.l}:</strong><br><span style="font-size:0.9rem;color:#444;">${decodificarHTML(v)}</span></div>`; });
        div.innerHTML = cardHtml; grid.appendChild(div);
    });
}

function renderIndice() { document.getElementById('view-indice').classList.remove('hidden'); const grid = document.getElementById('grid-indice'); grid.innerHTML = ''; AppState.indiceMenu.forEach((item, index) => { const btn = document.createElement('button'); btn.className = 'btn-indice'; btn.textContent = item.titulo; btn.onclick = () => router('detalle', index); grid.appendChild(btn); });}

function renderDesarrollo() {
    const view = document.getElementById('view-desarrollo'); view.classList.remove('hidden');
    const container = document.getElementById('lista-desarrollo'); container.innerHTML = '';
    Object.keys(AppState.desarrolloData).forEach((apartado) => {
        const data = AppState.desarrolloData[apartado]; const section = document.createElement('div'); section.className = 'desarrollo-section';
        const titleDiv = document.createElement('div'); titleDiv.className = 'desarrollo-titulo'; titleDiv.innerHTML = decodificarHTML(apartado); section.appendChild(titleDiv);
        if (data.items.length > 0) {
            const gridDiv = document.createElement('div'); gridDiv.className = 'desarrollo-grid';
            const visorDiv = document.createElement('div'); visorDiv.className = 'desarrollo-visor hidden';
            const btnClose = document.createElement('button'); btnClose.className = 'btn-cerrar-visor'; btnClose.innerHTML = '&times;'; btnClose.onclick = () => { visorDiv.classList.add('hidden'); gridDiv.classList.remove('hidden'); };
            const visorContent = document.createElement('div'); visorContent.className = 'visor-content';
            visorDiv.appendChild(btnClose); visorDiv.appendChild(visorContent);
            data.items.sort((a,b) => parseInt(a.num) - parseInt(b.num)).forEach((sup) => {
                const btn = document.createElement('button'); btn.className = 'btn-grid'; btn.textContent = sup.num || 'Info';
                btn.onclick = () => { gridDiv.classList.add('hidden'); visorDiv.classList.remove('hidden'); visorContent.innerHTML = `<strong style="color:var(--primary-color); display:block; margin-bottom:10px; border-bottom:1px solid #ddd;">Supuesto ${sup.num}</strong>` + decodificarHTML(sup.html); };
                gridDiv.appendChild(btn);
            });
            section.appendChild(gridDiv); section.appendChild(visorDiv);
        }
        container.appendChild(section);
    });
}

function renderResolucion(supuestoId) {
    document.getElementById('view-resolucion').classList.remove('hidden'); const sup = AppState.supuestos[supuestoId];
    document.getElementById('resolucion-header').innerHTML = `<h2>Resolución Supuesto ${supuestoId}</h2><p class="desc-seccion">${decodificarHTML(sup['Contexto'] || '')}</p>`;
    const contentDiv = document.getElementById('resolucion-content'); contentDiv.innerHTML = ''; let currentMainPoint = ""; 
    AppState.indiceMenu.forEach(itemIndice => {
        const normTituloIndice = normalizarTexto(itemIndice.titulo);
        const bloques = AppState.contenidos.filter(row => {
            const target = row[1] !== '' ? row[1] : row[0]; const normTarget = normalizarTexto(target);
            if (normTarget !== '' && (normTarget.includes(normTituloIndice) || normTituloIndice.includes(normTarget))) {
                const supStr = row[2] ? String(row[2]).trim().toLowerCase() : '';
                if (supStr === "" || supStr.includes("todo") || supStr.split(/[\s,]+/).includes(supuestoId.toString())) return true;
            } return false;
        });
        if (bloques.length > 0) {
            const mainPoint = bloques[0][0];
            if (mainPoint && mainPoint !== currentMainPoint) { contentDiv.innerHTML += `<h2 class="main-point-title" style="color:var(--primary-color); border-bottom:3px solid var(--accent-color); padding-bottom:0.5rem; margin-top:3rem;">${decodificarHTML(mainPoint)}</h2>`; currentMainPoint = mainPoint; }
            let html = `<div class="notebook-wrapper"><h3 class="sub-point-title" style="color:var(--primary-color); margin-top:0;">${itemIndice.titulo}</h3><div class="notebook-container">`;
            bloques.forEach(row => { html += `<div class="notebook-row"><div class="notebook-terms">${decodificarHTML(row[3])}</div><div class="notebook-content">${decodificarHTML(row[4] || row[3])}</div></div>`; });
            contentDiv.innerHTML += html + `</div></div>`;
        }
    });
}

function renderDetalleApartado(idx) {
    document.getElementById('view-detalle-apartado').classList.remove('hidden'); AppState.currentApartadoIndex = idx; const item = AppState.indiceMenu[idx];
    document.getElementById('detalle-header').innerHTML = `<h2>${item.titulo}</h2><p>${item.desc}</p>`; const contentDiv = document.getElementById('detalle-content'); contentDiv.innerHTML = '';
    const bloques = AppState.contenidos.filter(row => { const target = normalizarTexto(row[1] !== '' ? row[1] : row[0]); return target !== '' && (target.includes(normalizarTexto(item.titulo)) || normalizarTexto(item.titulo).includes(target)); });
    if (bloques.length > 0) {
        let html = `<div class="notebook-wrapper"><div class="notebook-container">`;
        bloques.forEach(row => { html += `<div class="notebook-row"><div class="notebook-terms"><span class="badge" style="background:var(--hover-color); padding: 2px 6px; border-radius: 4px; font-size:0.8rem; margin-bottom:5px; display:inline-block;">Supuestos: ${row[2] || 'Todos'}</span><br>${decodificarHTML(row[3])}</div><div class="notebook-content">${decodificarHTML(row[4] || row[3])}</div></div>`; });
        contentDiv.innerHTML = html + `</div></div>`;
    }
}

function nextApartado() { let next = AppState.currentApartadoIndex + 1; if (next >= AppState.indiceMenu.length) next = 0; router('detalle', next); }
window.onload = initApp;
