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
    desarrolloData: {}, // Agrupado por Apartado A
    contenidos: [], 
    currentApartadoIndex: 0 
};

// ... (Mantener la función parseCSV y normalizarTexto igual) ...

async function initApp() {
    try {
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
        
        // ... (Mantener la lógica de contenidos/uniqueContenidos igual) ...

        document.getElementById('loader').classList.add('hidden');
        router('home');
    } catch (error) {
        console.error("Error cargando datos:", error);
    }
}

function procesarDesarrollo(filas) {
    filas.forEach((fila, index) => {
        if (index === 0 || fila.length < 3) return; // Saltar cabecera
        const apartado = fila[0].trim();
        const numSupuesto = fila[1].trim();
        const contenido = fila[2].trim();

        if (!apartado) return;
        if (!AppState.desarrolloData[apartado]) AppState.desarrolloData[apartado] = [];
        
        AppState.desarrolloData[apartado].push({
            num: numSupuesto,
            texto: contenido
        });
    });
}

function router(view, param = null) {
    hideAllViews();
    if (view === 'home') renderHome();
    else if (view === 'indice') renderIndice();
    else if (view === 'desarrollo') renderDesarrollo();
    else if (view === 'resolucion') renderResolucion(param);
    else if (view === 'detalle') renderDetalleApartado(param);
}

function hideAllViews() {
    ['view-home', 'view-indice', 'view-desarrollo', 'view-resolucion', 'view-detalle-apartado'].forEach(id => {
        document.getElementById(id).classList.add('hidden');
    });
    window.scrollTo(0,0);
}

function renderDesarrollo() {
    const view = document.getElementById('view-desarrollo');
    view.classList.remove('hidden');
    const container = document.getElementById('lista-desarrollo');
    container.innerHTML = '';

    Object.keys(AppState.desarrolloData).forEach((apartado, idx) => {
        const section = document.createElement('div');
        section.className = 'desarrollo-section';
        
        let html = `<h3 class="desarrollo-titulo">${apartado}</h3>`;
        html += `<div class="desarrollo-grid">`;
        
        AppState.desarrolloData[apartado].forEach((sup, sIdx) => {
            const uniqueId = `des-${idx}-${sIdx}`;
            html += `
                <div class="des-item">
                    <button class="btn-grid" onclick="toggleDesarrollo('${uniqueId}')">${sup.num}</button>
                    <div id="${uniqueId}" class="des-content hidden">${sup.texto.replace(/\n/g, '<br>')}</div>
                </div>`;
        });

        html += `</div>`;
        section.innerHTML = html;
        container.appendChild(section);
    });
}

function toggleDesarrollo(id) {
    const el = document.getElementById(id);
    if (el.classList.contains('hidden')) {
        el.classList.remove('hidden');
    } else {
        el.classList.add('hidden');
    }
}

// ... (Mantener el resto de funciones renderHome, renderIndice, etc. igual) ...
window.onload = initApp;
