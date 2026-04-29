// =========================================
// CONFIGURACIÓN Y URLS
// =========================================
const BASE_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQVIJ3VfYy2BwRKgZ4bmXR_AXbANpsT31v7qyM1FOECv4GCpg9VEfiBR9557mYDIPXlQV1jeMmh3tgk/pub";

const ENDPOINTS = {
    // Hoja 7 - Fichas Resumen
    fichas: `${BASE_URL}?gid=779876412&output=csv`,
    // Hoja 2 - Índice Transversal
    indice: `${BASE_URL}?gid=1965451569&output=csv`,
    // Hoja 8 - Desarrollo Especial Interactivo
    desarrollo: `${BASE_URL}?gid=1989575496&output=csv`,
    // Hojas de contenido puro
    p1: `${BASE_URL}?gid=0&output=csv`,
    p2: `${BASE_URL}?gid=195232515&output=csv`,
    p3: `${BASE_URL}?gid=1223707292&output=csv`,
    p4: `${BASE_URL}?gid=436032444&output=csv`,
    p5: `${BASE_URL}?gid=1447159089&output=csv`
};

const AppState = {
    supuestos: {}, 
    indiceMenu: [], 
    desarrolloData: {}, // Agrupado por Apartado A (Hoja 8)
    contenidos: [], 
    currentApartadoIndex: 0 
};

// =========================================
// PARSER CSV ROBUSTO 
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

// =========================================
// MOTOR DE CARGA DE DATOS
// =========================================
async function fetchSafe(url) {
    try {
        const res = await fetch(url);
        if (!res.ok) return '';
        return await res.text();
    } catch(e) {
        return ''; 
    }
}

async function initApp() {
    try {
        // Cargar todo en paralelo para ganar velocidad
        const [csvFichas, csvIndice, csvDes, csvP1, csvP2, csvP3, csvP4, csvP5] = await Promise.all([
            fetchSafe(ENDPOINTS.fichas),
            fetchSafe(ENDPOINTS.indice),
            fetchSafe(ENDPOINTS.desarrollo),
            fetchSafe(ENDPOINTS.p1),
            fetchSafe(ENDPOINTS.p2),
            fetchSafe(ENDPOINTS.p3),
            fetchSafe(ENDPOINTS.p4),
            fetchSafe(ENDPOINTS.p5)
        ]);

        procesarFichas(parseCSV(csvFichas));
        procesarIndice(parseCSV(csvIndice));
        procesarDesarrollo(parseCSV(csvDes));
        
        const allRows = [
            ...parseCSV(csvP1), ...parseCSV(csvP2), ...parseCSV(csvP3), 
            ...parseCSV(csvP4), ...parseCSV(csvP5)
        ];
        
        // Limpieza de duplicados y filas vacías
        const uniqueContenidos = [];
        const seen = new Set();
        allRows.forEach(row => {
            const rowStr = row.join('|');
            if(!seen.has(rowStr) && row.length > 0) {
                seen.add(rowStr);
                uniqueContenidos.push(row);
            }
        });
        AppState.contenidos = uniqueContenidos;

        document.getElementById('loader').classList.add('hidden');
        router('home');

    } catch (error) {
        console.error("Error cargando datos:", error);
        document.getElementById('loader').innerHTML = "⚠️ Error cargando los datos. Revisa la consola.";
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

// CORRECCIÓN: Ahora lee desde la primera fila para no perder ningún apartado
function procesarDesarrollo(filas) {
    filas.forEach((fila) => {
        // Evitamos procesar filas completamente vacías
        if (fila.length < 1 || !fila[0].trim()) return; 

        const apartado = fila[0].trim();
        const numSupuesto = fila[1] ? fila[1].trim() : '';
        // Guardamos el HTML tal cual viene de la Columna C
        const contenidoHTML = fila[2] ? fila[2].trim() : '';

        if (!AppState.desarrolloData[apartado]) {
            AppState.desarrolloData[apartado] = { items: [] };
        }
        
        // Solo guardamos si hay un supuesto y contenido
        if (numSupuesto !== '' || contenidoHTML !== '') {
            AppState.desarrolloData[apartado].items.push({
                num: numSupuesto,
                html: contenidoHTML
            });
        }
    });
}

// =========================================
// ENRUTADOR Y RENDERIZADO DE VISTAS
// =========================================
function hideAllViews() {
    document.getElementById('view-home').classList.add('hidden');
    document.getElementById('view-indice').classList.add('hidden');
    document.getElementById('view-desarrollo').classList.add('hidden');
    document.getElementById('view-resolucion').classList.add('hidden');
    document.getElementById('view-detalle-apartado').classList.add('hidden');
    window.scrollTo(0,0);
}

function router(view, param = null) {
    hideAllViews();
    if (view === 'home') renderHome();
    else if (view === 'indice') renderIndice();
    else if (view === 'desarrollo') renderDesarrollo();
    else if (view === 'resolucion') renderResolucion(param);
    else if (view === 'detalle') renderDetalleApartado(param);
}

// --- VISTA 1: HOME ---
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
                valor = valor.replace(/\n/g, '<br>');
                cardHtml += `<div class="ficha-dato" style="margin-bottom:0.8rem;"><strong>${campo.l}:</strong><br><span style="font-size:0.9rem;color:#444;">${valor}</span></div>`;
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

// =========================================
// NUEVA VISTA 3: DESARROLLO (MODAL INTERACTIVO)
// =========================================
function renderDesarrollo() {
    const view = document.getElementById('view-desarrollo');
    view.classList.remove('hidden');
    const container = document.getElementById('lista-desarrollo');
    container.innerHTML = '';

    // Generar apartados
    Object.keys(AppState.desarrolloData).forEach((apartado) => {
        const data = AppState.desarrolloData[apartado];
        
        const section = document.createElement('div');
        section.className = 'desarrollo-section';
        
        // Título del Apartado A Unificado
        let htmlSection = `<div class="desarrollo-titulo">${apartado}</div>`;
        
        // Solo inyectamos rejilla si hay supuestos asociados a este apartado
        if (data.items.length > 0) {
            htmlSection += `<div class="desarrollo-grid">`;
            
            // Ordenamos los supuestos por número (1, 2, 3...)
            data.items.sort((a,b) => parseInt(a.num) - parseInt(b.num));
            
            data.items.forEach((sup) => {
                const btnText = sup.num || 'Info';
                const btn = document.createElement('button');
                btn.className = 'btn-grid';
                btn.textContent = btnText;
                
                // Al hacer clic, abrimos la ventana emergente centrada (Modal)
                btn.onclick = (e) => {
                    e.stopPropagation();
                    showModalDesarrollo(apartado, sup.num, sup.html);
                };
                
                const tempDiv = document.createElement('div');
                tempDiv.className = 'temp-btn-holder'; 
                tempDiv.appendChild(btn);
                htmlSection += tempDiv.innerHTML;
            });
            htmlSection += `</div>`;
        }

        section.innerHTML = htmlSection;
        container.appendChild(section);
    });
}

// Función para mostrar la ventana emergente centrada (Modal)
function showModalDesarrollo(tituloApartado, numSupuesto, contenidoHTML) {
    // 1. Evitar duplicados (borramos si ya hay una abierta)
    const existingModal = document.querySelector('.desarrollo-modal-backdrop');
    if (existingModal) existingModal.remove();

    // 2. Crear el fondo oscurecido
    const backdrop = document.createElement('div');
    backdrop.className = 'desarrollo-modal-backdrop';
    backdrop.onclick = closeModalDesarrollo; // Cierra al pulsar fuera

    // 3. Crear el contenedor del contenido
    const modalContent = document.createElement('div');
    modalContent.className = 'desarrollo-modal-content';
    modalContent.onclick = (e) => e.stopPropagation(); // Evita cerrar al pulsar dentro

    // 4. Crear el botón X de cierre
    const closeBtn = document.createElement('button');
    closeBtn.className = 'desarrollo-modal-close';
    closeBtn.innerHTML = '&times;';
    closeBtn.onclick = closeModalDesarrollo;

    // 5. Crear el título (Apartado + Supuesto)
    const title = document.createElement('h3');
    title.className = 'modal-titulo';
    title.innerHTML = `Supuesto ${numSupuesto || 'Común'} - ${tituloApartado}`;

    // 6. Crear el cuerpo del contenido (Interpretando HTML)
    const body = document.createElement('div');
    body.className = 'modal-body';
    // Reemplazamos saltos de línea por <br> y asignamos el HTML que viene de Google Sheets
    body.innerHTML = contenidoHTML.replace(/\n/g, '<br>'); 

    // 7. Ensamblar la ventana
    modalContent.appendChild(closeBtn);
    modalContent.appendChild(title);
    modalContent.appendChild(body);
    backdrop.appendChild(modalContent);
    document.body.appendChild(backdrop);
    
    // Bloquear el scroll del body principal mientras el modal está abierto
    document.body.style.overflow = 'hidden';
}

function closeModalDesarrollo() {
    const backdrop = document.querySelector('.desarrollo-modal-backdrop');
    if (backdrop) {
        backdrop.style.opacity = '0'; 
        setTimeout(() => {
            backdrop.remove();
            document.body.style.overflow = ''; // Restaurar scroll
        }, 300);
    }
}

// --- VISTA 4: RESOLUCIÓN ---
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
        const normTituloIndice = normalizarTexto(itemIndice.titulo);
        
        const bloquesEncontrados = AppState.contenidos.filter(row => {
            if (row.length < 2) return false;
            const mainPunto = row[0] ? String(row[0]).trim() : '';
            const subPunto = row[1] ? String(row[1]).trim() : '';
            const supuestosStr = row[2] ? String(row[2]).trim().toLowerCase() : '';
            
            const targetPunto = subPunto !== '' ? subPunto : mainPunto;
            const normTarget = normalizarTexto(targetPunto);
            
            let matchTitulo = false;
            if (normTarget !== '' && (normTarget.includes(normTituloIndice) || normTituloIndice.includes(normTarget))) {
                matchTitulo = true;
            }

            if (matchTitulo) {
                if (supuestosStr === "" || supuestosStr.includes("todo")) return true;
                const regex = /\d+/g;
                let match;
                const idsArray = [];
                while ((match = regex.exec(supuestosStr)) !== null) {
                    idsArray.push(match[0]);
                }
                return idsArray.includes(supuestoId.toString());
            }
            return false;
        });

        if (bloquesEncontrados.length > 0) {
            let htmlBloque = "";

            const mainPoint = bloquesEncontrados[0][0] ? String(bloquesEncontrados[0][0]).trim() : "";
            const subPoint = bloquesEncontrados[0][1] ? String(bloquesEncontrados[0][1]).trim() : "";

            if (mainPoint && mainPoint !== currentMainPoint) {
                htmlBloque += `
                    <h2 style="color: var(--primary-color); border-bottom: 3px solid var(--accent-color); padding-bottom: 0.5rem; margin-top: 3rem; margin-bottom: 1.5rem; font-size: 2rem;">
                        ${mainPoint}
                    </h2>`;
                currentMainPoint = mainPoint; 
            }

            htmlBloque += `<div class="notebook-wrapper">`;
            
            if (subPoint !== "") {
                htmlBloque += `<h3 style="color: var(--primary-color); margin-top:0;">${itemIndice.titulo}</h3>`;
            }

            if (itemIndice.desc) {
                htmlBloque += `<p class="desc-seccion" style="font-size:0.9rem; margin-bottom: 1rem;">${itemIndice.desc}</p>`;
            }
            
            htmlBloque += `<div class="notebook-container">`;

            bloquesEncontrados.forEach(row => {
                let terminos = row[3] ? String(row[3]).replace(/\n/g, '<br>') : '';
                let textoHtml = row[4] ? String(row[4]) : '';
                
                if (!textoHtml && terminos) {
                    textoHtml = terminos;
                    terminos = "Contenido";
                }

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

function renderDetalleApartado(indexIndice) {
    document.getElementById('view-detalle-apartado').classList.remove('hidden');
    AppState.currentApartadoIndex = indexIndice;
    const item = AppState.indiceMenu[indexIndice];
    const normTituloIndice = normalizarTexto(item.titulo);

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
        const regex = /\d+/g;
        let match;
        while ((match = regex.exec(item.orden)) !== null) {
            ordenIds.push(match[0]);
        }
    }

    let bloques = AppState.contenidos.filter(row => {
        if (row.length < 2) return false;
        const mainPunto = row[0] ? String(row[0]).trim() : '';
        const subPunto = row[1] ? String(row[1]).trim() : '';
        
        const targetPunto = subPunto !== '' ? subPunto : mainPunto;
        const normTarget = normalizarTexto(targetPunto);
        
        return normTarget !== '' && (normTarget.includes(normTituloIndice) || normTituloIndice.includes(normTarget));
    });
    
    let bloquesMostrados = [];

    if (ordenIds.length > 0) {
        ordenIds.forEach(id => {
            const bloqueParaId = bloques.find(row => {
                const supuestosStr = row[2] ? String(row[2]).trim().toLowerCase() : '';
                if (supuestosStr === "" || supuestosStr.includes("todo")) return true;
                
                const regex = /\d+/g;
                let match;
                const idsArray = [];
                while ((match = regex.exec(supuestosStr)) !== null) {
                    idsArray.push(match[0]);
                }
                return idsArray.includes(id);
            });
            
            if (bloqueParaId && !bloquesMostrados.includes(bloqueParaId)) {
                 bloquesMostrados.push({ id: id, data: bloqueParaId });
            }
        });
    } else {
        bloques.forEach(b => bloquesMostrados.push({ id: b[2] || "Todos / Común", data: b }));
    }

    if (bloquesMostrados.length > 0) {
        let htmlBloque = `<div class="notebook-wrapper"><div class="notebook-container">`;

        bloquesMostrados.forEach(itemInfo => {
            const row = itemInfo.data;
            const supuestosRef = itemInfo.id || row[2] || "Bloque Fijo"; 
            let terminos = row[3] ? String(row[3]).replace(/\n/g, '<br>') : '';
            let textoHtml = row[4] ? String(row[4]) : '';
            
            if (!textoHtml && terminos) {
                textoHtml = terminos;
                terminos = "Contenido";
            }
            
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
        contentDiv.innerHTML = "<p>No hay bloques de contenido registrados para este apartado.</p>";
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
