// =========================================
// CONFIGURACIÓN Y URLS
// =========================================
const BASE_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQVIJ3VfYy2BwRKgZ4bmXR_AXbANpsT31v7qyM1FOECv4GCpg9VEfiBR9557mYDIPXlQV1jeMmh3tgk/pub";
const ENDPOINTS = {
    fichas: `${BASE_URL}?gid=779876412&output=csv`,
    indice: `${BASE_URL}?gid=1965451569&output=csv`,
    p1: `${BASE_URL}?gid=0&output=csv`,
    p2: `${BASE_URL}?gid=195232515&output=csv`,
    p3: `${BASE_URL}?gid=1223707292&output=csv`,
    p45: `${BASE_URL}?gid=436032444&output=csv`
};

// =========================================
// ESTADO GLOBAL DE LA APP
// =========================================
const AppState = {
    supuestos: {}, 
    indiceMenu: [], 
    contenidos: [], 
    currentApartadoIndex: 0 
};

// =========================================
// PARSER CSV ROBUSTO 
// =========================================
function parseCSV(str) {
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

// =========================================
// MOTOR DE CARGA DE DATOS
// =========================================
async function initApp() {
    try {
        const [csvFichas, csvIndice, csvP1, csvP2, csvP3, csvP45] = await Promise.all([
            fetch(ENDPOINTS.fichas).then(r => r.text()),
            fetch(ENDPOINTS.indice).then(r => r.text()),
            fetch(ENDPOINTS.p1).then(r => r.text()),
            fetch(ENDPOINTS.p2).then(r => r.text()),
            fetch(ENDPOINTS.p3).then(r => r.text()),
            fetch(ENDPOINTS.p45).then(r => r.text())
        ]);

        procesarFichas(parseCSV(csvFichas));
        procesarIndice(parseCSV(csvIndice));
        
        AppState.contenidos = [
            ...parseCSV(csvP1),
            ...parseCSV(csvP2),
            ...parseCSV(csvP3),
            ...parseCSV(csvP45)
        ];

        document.getElementById('loader').classList.add('hidden');
        router('home');

    } catch (error) {
        console.error("Error cargando datos:", error);
        document.getElementById('loader').innerHTML = "⚠️ Error cargando los datos. Comprueba tu conexión o los enlaces del CSV.";
    }
}

// =========================================
// PROCESAMIENTO DE DATOS
// =========================================
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
            titulo: fila[0].trim(),
            desc: fila[1] ? fila[1].trim() : '',
            orden: fila[2] ? fila[2].trim() : '',
            justificacion: fila[3] ? fila[3].trim() : '',
            originalIndex: index
        });
    });
}

// =========================================
// ENRUTADOR Y RENDERIZADO DE VISTAS
// =========================================
function hideAllViews() {
    document.getElementById('view-home').classList.add('hidden');
    document.getElementById('view-indice').classList.add('hidden');
    document.getElementById('view-resolucion').classList.add('hidden');
    document.getElementById('view-detalle-apartado').classList.add('hidden');
    window.scrollTo(0,0);
}

function router(view, param = null) {
    hideAllViews();
    if (view === 'home') renderHome();
    else if (view === 'indice') renderIndice();
    else if (view === 'resolucion') renderResolucion(param);
    else if (view === 'detalle') renderDetalleApartado(param);
}

// --- VISTA 1: HOME (FICHAS) ---
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
            { label: "Área y Curso", keys: ["Área y Curso", "Área"] },
            { label: "Contexto", keys: ["Contexto"] },
            { label: "Barreras (Diagnóstico)", keys: ["Barreras (Diagnóstico)", "Barreras"] },
            { label: "Tarea Pedida", keys: ["Tarea Pedida (Tribunal)", "Tarea Pedidada", "Tarea Pedida"] },
            { label: "Actividad Estrella", keys: ["Actividad Estrella"] },
            { label: "Normativa Específica", keys: ["Normativa Específica"] },
            { label: "Autores Clave", keys: ["Autores Clave"] }
        ];

        campos.forEach(campo => {
            let valor = null;
            for (let k of campo.keys) {
                if (sup[k]) { valor = sup[k]; break; }
            }
            if (valor) {
                valor = valor.replace(/\n/g, '<br>');
                cardHtml += `
                    <div class="ficha-dato" style="margin-bottom: 0.8rem;">
                        <strong>${campo.label}:</strong><br>
                        <span style="font-size:0.9rem; color:#444;">${valor}</span>
                    </div>`;
            }
        });

        div.innerHTML = cardHtml;
        grid.appendChild(div);
    });
}

// --- VISTA 2: ÍNDICE ---
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

// --- VISTA 3: RESOLUCIÓN (Un supuesto entero) ---
function renderResolucion(supuestoId) {
    document.getElementById('view-resolucion').classList.remove('hidden');
    const sup = AppState.supuestos[supuestoId];
    
    let headerHtml = `<h2>Resolución del Supuesto ${supuestoId}</h2>`;
    const area = sup['Área y Curso'] || sup['Área'] || '';
    const contexto = sup['Contexto'] || '';
    if(area || contexto) {
        headerHtml += `<p class="desc-seccion">${area} - ${contexto}</p>`;
    }
    document.getElementById('resolucion-header').innerHTML = headerHtml;

    const contentDiv = document.getElementById('resolucion-content');
    contentDiv.innerHTML = '';

    let currentMainPoint = ""; 

    AppState.indiceMenu.forEach(itemIndice => {
        const tituloBloque = itemIndice.titulo;
        
        const bloquesEncontrados = AppState.contenidos.filter(row => {
            if (row.length < 3) return false; 
            const mainPunto = row[0] ? row[0].trim() : '';
            const subPunto = row[1] ? row[1].trim() : '';
            const supuestosStr = row[2] ? row[2].toString().trim() : '';
            
            // EL FIX: Si la columna B (subPunto) está vacía, usamos la Columna A (mainPunto)
            const nombreDelBloque = subPunto !== '' ? subPunto : mainPunto;
            
            if (nombreDelBloque === tituloBloque) {
                const idsArray = supuestosStr.split(',').map(s => s.trim());
                return idsArray.includes(supuestoId.toString()) || idsArray.includes("Todos") || supuestosStr === "";
            }
            return false;
        });

        if (bloquesEncontrados.length > 0) {
            let htmlBloque = "";

            const mainPoint = bloquesEncontrados[0][0] ? bloquesEncontrados[0][0].trim() : "";
            if (mainPoint && mainPoint !== currentMainPoint) {
                htmlBloque += `
                    <h2 style="color: var(--primary-color); border-bottom: 3px solid var(--accent-color); padding-bottom: 0.5rem; margin-top: 3rem; margin-bottom: 1.5rem; font-size: 2rem;">
                        ${mainPoint}
                    </h2>`;
                currentMainPoint = mainPoint; 
            }

            htmlBloque += `
                <div class="notebook-wrapper">
                    <h3 style="color: var(--primary-color); margin-top:0;">${tituloBloque}</h3>
                    <p class="desc-seccion" style="font-size:0.9rem; margin-bottom: 1rem;">${itemIndice.desc}</p>
                    <div class="notebook-container">
            `;

            bloquesEncontrados.forEach(row => {
                const terminos = row[3] ? row[3].replace(/\n/g, '<br>') : '';
                const textoHtml = row[4] ? row[4] : '';
                
                htmlBloque += `
                    <div class="notebook-row">
                        <div class="notebook-terms">${terminos}</div>
                        <div class="notebook-content">${textoHtml}</div>
                    </div>
                `;
            });

            htmlBloque += `</div></div>`;
            contentDiv.innerHTML += htmlBloque;
        }
    });
}

// --- VISTA 4: DETALLE APARTADO (Horizontal) ---
function renderDetalleApartado(indexIndice) {
    document.getElementById('view-detalle-apartado').classList.remove('hidden');
    AppState.currentApartadoIndex = indexIndice;
    const item = AppState.indiceMenu[indexIndice];

    let headerHtml = `
        <h2>${item.titulo}</h2>
        <p class="desc-seccion">${item.desc}</p>
    `;
    if (item.justificacion) {
        headerHtml += `<div class="justificacion-seccion"><strong>Estrategia de Ordenación:</strong><br> ${item.justificacion.replace(/\n/g, '<br>')}</div>`;
    }
    document.getElementById('detalle-header').innerHTML = headerHtml;

    const contentDiv = document.getElementById('detalle-content');
    contentDiv.innerHTML = '';

    let ordenIds = [];
    if (item.orden) {
        ordenIds = item.orden.split(',').map(s => s.trim());
    }

    let bloques = AppState.contenidos.filter(row => {
        if (row.length < 3) return false;
        const mainPunto = row[0] ? row[0].trim() : '';
        const subPunto = row[1] ? row[1].trim() : '';
        
        // EL FIX TAMBIÉN APLICADO AQUÍ
        const nombreDelBloque = subPunto !== '' ? subPunto : mainPunto;
        
        return nombreDelBloque === item.titulo;
    });
    
    let bloquesMostrados = [];

    if (ordenIds.length > 0) {
        ordenIds.forEach(id => {
            const bloqueParaId = bloques.find(row => {
                const supuestosStr = row[2] ? row[2].toString().trim() : '';
                const idsArray = supuestosStr.split(',').map(s => s.trim());
                return idsArray.includes(id);
            });
            
            if (bloqueParaId && !bloquesMostrados.includes(bloqueParaId)) {
                 bloquesMostrados.push({ id: id, data: bloqueParaId });
            }
        });
    } else {
        bloques.forEach(b => bloquesMostrados.push({ id: b[2], data: b }));
    }

    if (bloquesMostrados.length > 0) {
        let htmlBloque = `<div class="notebook-wrapper"><div class="notebook-container">`;

        bloquesMostrados.forEach(itemInfo => {
            const row = itemInfo.data;
            const supuestosRef = itemInfo.id || row[2]; 
            const terminos = row[3] ? row[3].replace(/\n/g, '<br>') : '';
            const textoHtml = row[4] ? row[4] : '';
            
            htmlBloque += `
                <div class="notebook-row">
                    <div class="notebook-terms">
                        <span style="background:var(--hover-color); padding: 2px 6px; border-radius: 4px; font-size:0.8rem; margin-bottom:5px; display:inline-block;">Supuestos: ${supuestosRef}</span><br>
                        ${terminos}
                    </div>
                    <div class="notebook-content">${textoHtml}</div>
                </div>
            `;
        });

        htmlBloque += `</div></div>`;
        contentDiv.innerHTML = htmlBloque;
    } else {
        contentDiv.innerHTML = "<p>No hay bloques de contenido específicos registrados para este apartado.</p>";
    }
}

function nextApartado() {
    let nextIndex = AppState.currentApartadoIndex + 1;
    if (nextIndex >= AppState.indiceMenu.length) {
        nextIndex = 0; 
    }
    router('detalle', nextIndex);
}

// =========================================
// INICIO
// =========================================
window.onload = initApp;
