/* ═══════════════════════════════════════════════════════════════
   FAA Incidents Visualization — app.js
   Carga faa_incidents_clean.csv en memoria y actualiza todos los
   gráficos reactivamente según los filtros seleccionados.
════════════════════════════════════════════════════════════════ */

'use strict';

/* ─────────────────────────────────────────────────────────────
   CONSTANTES Y CONFIGURACIÓN
───────────────────────────────────────────────────────────── */
const DATA_PATH = 'data/faa_incidents_clean.csv';

// Traducciones de categorías (inglés → español)
const PHASE_LABELS = {
  'Approach/landing':     'Aproximación / aterrizaje',
  'Ground/taxi':          'Suelo / rodaje',
  'Cruise/descent':       'Crucero / descenso',
  'Takeoff/climb':        'Despegue / ascenso',
  'Maneuver/other flight':'Maniobras / otros vuelos',
  'Other/unknown':        'Otros / desconocido',
  'Unknown':              'Desconocido',
};

const SEVERITY_LABELS = {
  'Fatal':                  'Con fatalidades',
  'Injuries':               'Con lesiones',
  'Severe aircraft damage': 'Daño severo en aeronave',
  'Minor/no known damage':  'Daño menor o no conocido',
  'Unknown':                'Desconocido',
};

// Orden preferente para gráficos
const PHASE_ORDER = [
  'Approach/landing', 'Ground/taxi', 'Cruise/descent',
  'Takeoff/climb', 'Maneuver/other flight', 'Other/unknown', 'Unknown',
];

const SEVERITY_ORDER = [
  'Fatal', 'Injuries', 'Severe aircraft damage',
  'Minor/no known damage', 'Unknown',
];

// Colores por severidad
const SEV_COLORS = {
  'Fatal':                  '#dc2626',
  'Injuries':               '#f97316',
  'Severe aircraft damage': '#eab308',
  'Minor/no known damage':  '#22c55e',
  'Unknown':                '#94a3b8',
};

// Paleta base para fases
const PHASE_COLORS = [
  '#1d4ed8','#2563eb','#3b82f6','#60a5fa','#93c5fd','#bfdbfe','#dbeafe',
];

// Códigos de estados de EE. UU. válidos para el mapa coroplético
const US_STATES = new Set([
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA',
  'HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
  'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',
  'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY',
  'DC',
]);

// Configuración de layout de Plotly común
const PLOTLY_FONT = {
  family: "'Inter', 'Segoe UI', system-ui, sans-serif",
  size: 12,
  color: '#374151',
};

const PLOTLY_LAYOUT_BASE = {
  font: PLOTLY_FONT,
  paper_bgcolor: 'rgba(0,0,0,0)',
  plot_bgcolor:  'rgba(0,0,0,0)',
  margin: { t: 20, r: 20, b: 40, l: 50 },
  autosize: true,
  hoverlabel: {
    bgcolor: '#1e293b',
    bordercolor: '#334155',
    font: { color: '#f1f5f9', size: 13 },
  },
};

const PLOTLY_CONFIG = {
  responsive: true,
  displayModeBar: false,
  locale: 'es',
};

/* ─────────────────────────────────────────────────────────────
   ESTADO DE LA APLICACIÓN
───────────────────────────────────────────────────────────── */
const appState = {
  allData: [],       // dataset completo (~100k filas)
  filtered: [],      // dataset filtrado
  loaded: false,
  filters: {
    decade:   'all',
    severity: 'all',
    phase:    'all',
  },
  heatmapMode: 'pct',   // 'pct' | 'abs'
  sevScale:    'linear', // 'linear' | 'log'
};

/* ─────────────────────────────────────────────────────────────
   UTILIDADES
───────────────────────────────────────────────────────────── */
function fmt(n) {
  if (n === undefined || n === null || Number.isNaN(n)) return '—';
  return n.toLocaleString('es-ES');
}

function pct(val, total) {
  if (!total) return '0,0 %';
  return ((val / total) * 100).toFixed(1).replace('.', ',') + ' %';
}

function count(arr, key) {
  const map = {};
  for (const row of arr) {
    const v = row[key] || 'Unknown';
    map[v] = (map[v] || 0) + 1;
  }
  return map;
}

function sortedByValue(map, desc = true) {
  return Object.entries(map).sort((a, b) => desc ? b[1] - a[1] : a[1] - b[1]);
}

/* ─────────────────────────────────────────────────────────────
   FILTRADO
───────────────────────────────────────────────────────────── */
function filterData() {
  const { decade, severity, phase } = appState.filters;
  appState.filtered = appState.allData.filter(row => {
    if (decade   !== 'all' && row.decade     !== decade)   return false;
    if (severity !== 'all' && row.severity_level !== severity) return false;
    if (phase    !== 'all' && row.flight_phase_group !== phase) return false;
    return true;
  });
}

/* ─────────────────────────────────────────────────────────────
   AGREGACIONES
───────────────────────────────────────────────────────────── */
function aggregateByYear(data) {
  const map = {};
  for (const row of data) {
    const y = row.year;
    if (y) map[y] = (map[y] || 0) + 1;
  }
  return map;
}

function aggregateByState(data) {
  const map = {};
  for (const row of data) {
    const s = row.event_state;
    if (s) map[s] = (map[s] || 0) + 1;
  }
  return map;
}

function aggregateByPhase(data) {
  const map = {};
  for (const phase of PHASE_ORDER) map[phase] = 0;
  for (const row of data) {
    const p = row.flight_phase_group || 'Unknown';
    map[p] = (map[p] || 0) + 1;
  }
  return map;
}

function aggregateBySeverity(data) {
  const map = {};
  for (const s of SEVERITY_ORDER) map[s] = 0;
  for (const row of data) {
    const s = row.severity_level || 'Unknown';
    map[s] = (map[s] || 0) + 1;
  }
  return map;
}

function aggregatePhaseXSeverity(data) {
  // map[phase][severity] = count
  const map = {};
  for (const p of PHASE_ORDER) {
    map[p] = {};
    for (const s of SEVERITY_ORDER) map[p][s] = 0;
  }
  for (const row of data) {
    const p = row.flight_phase_group || 'Unknown';
    const s = row.severity_level    || 'Unknown';
    if (!map[p]) map[p] = {};
    map[p][s] = (map[p][s] || 0) + 1;
  }
  return map;
}

function aggregateMakes(data, top = 10) {
  const map = count(data, 'aircraft_make');
  return sortedByValue(map).slice(0, top);
}

function aggregateFlightTypes(data, top = 10) {
  const map = count(data, 'primary_flight_type');
  return sortedByValue(map).slice(0, top);
}

/* ─────────────────────────────────────────────────────────────
   RENDER: KPIs
───────────────────────────────────────────────────────────── */
function renderKPIs(data) {
  const total    = data.length;
  const sevMap   = aggregateBySeverity(data);
  const fatal    = sevMap['Fatal']                  || 0;
  const injuries = sevMap['Injuries']               || 0;
  const severe   = sevMap['Severe aircraft damage'] || 0;
  const unknown  = sevMap['Unknown']                || 0;

  document.getElementById('kpi-total').textContent  = fmt(total);
  document.getElementById('kpi-fatal').textContent  = fmt(fatal);

  document.getElementById('sev-total').textContent   = fmt(total);
  document.getElementById('sev-fatal').textContent   = fmt(fatal);
  document.getElementById('sev-injuries').textContent= fmt(injuries);
  document.getElementById('sev-severe').textContent  = fmt(severe);
  document.getElementById('sev-unknown').textContent = fmt(unknown);
}

function renderSeverityShare(data) {
  const bar = document.getElementById('severity-share-bar');
  const legend = document.getElementById('severity-share-legend');
  if (!bar || !legend) return;

  const sevMap = aggregateBySeverity(data);
  const total = data.length || 1;

  bar.innerHTML = '';
  legend.innerHTML = '';

  for (const sev of SEVERITY_ORDER) {
    const value = sevMap[sev] || 0;
    const percentage = (value / total) * 100;
    const label = SEVERITY_LABELS[sev] || sev;
    const color = SEV_COLORS[sev] || '#94a3b8';

    const segment = document.createElement('div');
    segment.className = 'severity-share__segment';
    segment.style.width = `${percentage}%`;
    segment.style.background = color;
    segment.title = `${label}: ${fmt(value)} (${percentage.toFixed(1).replace('.', ',')} %)`;
    bar.appendChild(segment);

    const item = document.createElement('span');
    item.className = 'severity-share__item';
    item.innerHTML = `<span class="severity-share__swatch" style="background:${color}"></span>${label}: <strong>${percentage.toFixed(1).replace('.', ',')} %</strong>`;
    legend.appendChild(item);
  }
}

/* ─────────────────────────────────────────────────────────────
   RENDER: EVOLUCIÓN TEMPORAL
───────────────────────────────────────────────────────────── */
function renderTemporal(data) {
  const yearMap  = aggregateByYear(data);
  const years    = Object.keys(yearMap).map(Number).sort((a,b) => a-b);
  const counts   = years.map(y => yearMap[y]);

  const trace = {
    x: years,
    y: counts,
    type: 'scatter',
    mode: 'lines+markers',
    name: 'Incidentes registrados',
    line: {
      color: '#2563eb',
      width: 2.5,
      shape: 'spline',
      smoothing: 0.5,
    },
    marker: {
      color: '#2563eb',
      size: 5,
      opacity: 0.7,
    },
    fill: 'tozeroy',
    fillcolor: 'rgba(37,99,235,0.08)',
    hovertemplate:
      '<b>%{x}</b><br>Incidentes: %{y:,}<extra></extra>',
  };

  const layout = {
    ...PLOTLY_LAYOUT_BASE,
    margin: { t: 20, r: 20, b: 50, l: 70 },
    xaxis: {
      title: { text: 'Año', standoff: 12 },
      showgrid: false,
      zeroline: false,
      color: '#6b7280',
      tickfont: { size: 11 },
      dtick: 5,
    },
    yaxis: {
      title: { text: 'Incidentes registrados', standoff: 8 },
      showgrid: true,
      gridcolor: '#f3f4f6',
      zeroline: false,
      color: '#6b7280',
      tickfont: { size: 11 },
    },
    hovermode: 'x unified',
  };

  Plotly.react('chart-temporal', [trace], layout, PLOTLY_CONFIG);
}

/* ─────────────────────────────────────────────────────────────
   RENDER: MAPA COROPLÉTICO
───────────────────────────────────────────────────────────── */
function renderMap(data) {
  const stateMap = aggregateByState(data);

  // Filtrar solo estados válidos de EE. UU.
  const states  = [];
  const values  = [];
  const texts   = [];

  for (const [state, cnt] of Object.entries(stateMap)) {
    if (!US_STATES.has(state)) continue;
    states.push(state);
    values.push(cnt);
    texts.push(`<b>${state}</b><br>Incidentes registrados: ${fmt(cnt)}`);
  }

  const trace = {
    type: 'choropleth',
    locationmode: 'USA-states',
    locations: states,
    z: values,
    text: texts,
    hovertemplate: '%{text}<extra></extra>',
    colorscale: [
      [0,    '#eff6ff'],
      [0.15, '#bfdbfe'],
      [0.35, '#60a5fa'],
      [0.6,  '#2563eb'],
      [0.8,  '#1d4ed8'],
      [1,    '#1e3a8a'],
    ],
    colorbar: {
      title: { text: 'Incidentes', side: 'right' },
      thickness: 14,
      len: 0.7,
      tickfont: { size: 11 },
    },
    marker: { line: { color: '#ffffff', width: 0.8 } },
  };

  const layout = {
    ...PLOTLY_LAYOUT_BASE,
    geo: {
      scope: 'usa',
      showlakes: true,
      lakecolor: '#f0f9ff',
      showland: true,
      landcolor: '#f8fafc',
      showcoastlines: true,
      coastlinecolor: '#e2e8f0',
      showframe: false,
      bgcolor: 'rgba(0,0,0,0)',
    },
    margin: { t: 0, r: 0, b: 0, l: 0 },
    height: 500,
  };

  Plotly.react('chart-map', [trace], layout, PLOTLY_CONFIG);
}

/* ─────────────────────────────────────────────────────────────
   RENDER: RANKING DE ESTADOS
───────────────────────────────────────────────────────────── */
function renderStatesBar(data) {
  const stateMap = aggregateByState(data);

  // Solo estados de EE. UU.
  const sorted = Object.entries(stateMap)
    .filter(([s]) => US_STATES.has(s))
    .sort((a,b) => b[1] - a[1])
    .slice(0, 15);

  if (!sorted.length) return;

  const stateNames = sorted.map(([s]) => s).reverse();
  const values     = sorted.map(([,v]) => v).reverse();
  const total      = data.length || 1;

  const trace = {
    x: values,
    y: stateNames,
    type: 'bar',
    orientation: 'h',
    marker: {
      color: values.map((v, i) => {
        const ratio = i / (values.length - 1);
        return `rgba(37,99,235,${0.3 + 0.65 * ratio})`;
      }),
      line: { color: 'transparent' },
    },
    hovertemplate:
      '<b>%{y}</b><br>Incidentes: %{x:,}<br>Del total filtrado: ' +
      values.map(v => pct(v, total)).reverse().map((_,i,a) => a[a.length-1-i]).join('|||')
        .split('|||').map((p,i) => p).join('') +
      '%<extra></extra>',
    // Simplificamos el hover con customdata
    customdata: values.map(v => pct(v, total)).reverse(),
  };

  // Reconstruimos el hover correctamente
  trace.hovertemplate =
    '<b>%{y}</b><br>Incidentes registrados: <b>%{x:,}</b><br>' +
    'Del total filtrado: <b>%{customdata}</b><extra></extra>';

  const layout = {
    ...PLOTLY_LAYOUT_BASE,
    margin: { t: 10, r: 30, b: 40, l: 50 },
    xaxis: {
      title: { text: 'Incidentes registrados' },
      showgrid: true,
      gridcolor: '#f3f4f6',
      zeroline: false,
      color: '#6b7280',
      tickfont: { size: 11 },
    },
    yaxis: {
      showgrid: false,
      zeroline: false,
      color: '#374151',
      tickfont: { size: 12, color: '#374151' },
    },
    height: 470,
    bargap: 0.3,
  };

  Plotly.react('chart-states-bar', [trace], layout, PLOTLY_CONFIG);
}

/* ─────────────────────────────────────────────────────────────
   RENDER: FASES DE VUELO
───────────────────────────────────────────────────────────── */
function renderPhases(data) {
  const phaseMap = aggregateByPhase(data);

  const entries = PHASE_ORDER
    .map(p => [p, phaseMap[p] || 0])
    .sort((a,b) => a[1] - b[1]); // ascendente para barras horizontales

  const labels = entries.map(([p]) => PHASE_LABELS[p] || p);
  const values = entries.map(([,v]) => v);
  const total  = values.reduce((a,b) => a+b, 0) || 1;

  const trace = {
    x: values,
    y: labels,
    type: 'bar',
    orientation: 'h',
    marker: {
      color: values.map((_, i) => {
        const idx = PHASE_ORDER.indexOf(entries[i][0]);
        return PHASE_COLORS[idx % PHASE_COLORS.length];
      }),
      line: { color: 'transparent' },
    },
    customdata: values.map(v => pct(v, total)),
    hovertemplate:
      '<b>%{y}</b><br>Incidentes: <b>%{x:,}</b><br>' +
      'Del total filtrado: <b>%{customdata}</b><extra></extra>',
  };

  const layout = {
    ...PLOTLY_LAYOUT_BASE,
    margin: { t: 10, r: 30, b: 40, l: 195 },
    xaxis: {
      title: { text: 'Incidentes registrados' },
      showgrid: true,
      gridcolor: '#f3f4f6',
      zeroline: false,
      color: '#6b7280',
      tickfont: { size: 11 },
    },
    yaxis: {
      showgrid: false,
      zeroline: false,
      color: '#374151',
      tickfont: { size: 12 },
      automargin: true,
    },
    height: 420,
    bargap: 0.35,
  };

  Plotly.react('chart-phases', [trace], layout, PLOTLY_CONFIG);
}

/* ─────────────────────────────────────────────────────────────
   RENDER: SEVERIDAD
───────────────────────────────────────────────────────────── */
function renderSeverity(data) {
  const sevMap = aggregateBySeverity(data);
  const isLog  = appState.sevScale === 'log';

  const labels = SEVERITY_ORDER.map(s => SEVERITY_LABELS[s] || s);
  const values = SEVERITY_ORDER.map(s => sevMap[s] || 0);
  const total  = values.reduce((a,b) => a+b, 0) || 1;

  const trace = {
    x: labels,
    y: values,
    type: 'bar',
    marker: {
      color: SEVERITY_ORDER.map(s => SEV_COLORS[s]),
      line: { color: 'transparent' },
    },
    customdata: values.map(v => pct(v, total)),
    hovertemplate:
      '<b>%{x}</b><br>Incidentes: <b>%{y:,}</b><br>' +
      'Del total filtrado: <b>%{customdata}</b><extra></extra>',
  };

  const layout = {
    ...PLOTLY_LAYOUT_BASE,
    margin: { t: 20, r: 20, b: 80, l: 70 },
    xaxis: {
      showgrid: false,
      zeroline: false,
      color: '#374151',
      tickfont: { size: 11 },
      tickangle: -20,
      automargin: true,
    },
    yaxis: {
      title: { text: isLog ? 'Incidentes (escala logarítmica)' : 'Incidentes registrados' },
      type:  isLog ? 'log' : 'linear',
      showgrid: true,
      gridcolor: '#f3f4f6',
      zeroline: false,
      color: '#6b7280',
      tickfont: { size: 11 },
    },
    height: 420,
    bargap: 0.4,
  };

  // Nota de escala
  document.getElementById('sev-scale-note').textContent =
    isLog ? '(escala logarítmica: las diferencias visuales son proporcionales)' : '';

  Plotly.react('chart-severity', [trace], layout, PLOTLY_CONFIG);
}

/* ─────────────────────────────────────────────────────────────
   RENDER: HEATMAP FASE × SEVERIDAD
───────────────────────────────────────────────────────────── */
function renderHeatmap(data) {
  const matrix = aggregatePhaseXSeverity(data);
  const mode   = appState.heatmapMode; // 'pct' | 'abs'

  const phases     = PHASE_ORDER.filter(p => p !== 'Unknown');
  const severities = SEVERITY_ORDER;

  // Construir z, text y customdata
  const zMatrix    = [];
  const textMatrix = [];
  const customdata = [];

  for (const sev of severities) {
    const zRow    = [];
    const tRow    = [];
    const cdRow   = [];

    for (const phase of phases) {
      const abs   = (matrix[phase] && matrix[phase][sev]) || 0;
      const total = Object.values(matrix[phase] || {}).reduce((a,b)=>a+b, 0) || 1;
      const p     = (abs / total) * 100;

      if (mode === 'pct') {
        zRow.push(p);
        tRow.push(`${p.toFixed(1)} %`);
      } else {
        zRow.push(abs);
        tRow.push(fmt(abs));
      }
      cdRow.push({ abs, pct: p.toFixed(1) });
    }
    zMatrix.push(zRow);
    textMatrix.push(tRow);
    customdata.push(cdRow);
  }

  const yLabels = severities.map(s => SEVERITY_LABELS[s] || s);
  const xLabels = phases.map(p => PHASE_LABELS[p] || p);

  const trace = {
    type: 'heatmap',
    z: zMatrix,
    x: xLabels,
    y: yLabels,
    text: textMatrix,
    customdata: customdata,
    texttemplate: '%{text}',
    colorscale: mode === 'pct'
      ? [
          [0,    '#f0f9ff'],
          [0.15, '#bae6fd'],
          [0.4,  '#38bdf8'],
          [0.7,  '#0284c7'],
          [1,    '#075985'],
        ]
      : [
          [0,    '#f0fdf4'],
          [0.15, '#bbf7d0'],
          [0.4,  '#4ade80'],
          [0.7,  '#16a34a'],
          [1,    '#14532d'],
        ],
    hovertemplate:
      '<b>Fase:</b> %{x}<br><b>Severidad:</b> %{y}<br>' +
      'Incidentes: <b>%{customdata.abs:,}</b><br>' +
      'Porcentaje dentro de la fase: <b>%{customdata.pct} %</b>' +
      '<extra></extra>',
    showscale: true,
    colorbar: {
      title: { text: mode === 'pct' ? '% dentro fase' : 'Incidentes' },
      thickness: 14,
      tickfont: { size: 10 },
    },
    xgap: 2,
    ygap: 2,
  };

  const layout = {
    ...PLOTLY_LAYOUT_BASE,
    margin: { t: 20, r: 100, b: 120, l: 190 },
    xaxis: {
      color: '#374151',
      tickfont: { size: 10 },
      tickangle: -30,
      automargin: true,
    },
    yaxis: {
      color: '#374151',
      tickfont: { size: 11 },
      automargin: true,
    },
    height: 520,
  };

  Plotly.react('chart-heatmap', [trace], layout, PLOTLY_CONFIG);
}

/* ─────────────────────────────────────────────────────────────
   RENDER: EXPLORACIÓN SECUNDARIA
───────────────────────────────────────────────────────────── */
function renderMakes(data) {
  const top = aggregateMakes(data);
  if (!top.length) return;

  const labels = top.map(([m]) => m || '(desconocido)').reverse();
  const values = top.map(([,v]) => v).reverse();

  const trace = {
    x: values,
    y: labels,
    type: 'bar',
    orientation: 'h',
    marker: { color: '#3b82f6', opacity: 0.8 },
    hovertemplate: '<b>%{y}</b><br>Incidentes: %{x:,}<extra></extra>',
  };

  const layout = {
    ...PLOTLY_LAYOUT_BASE,
    margin: { t: 10, r: 20, b: 40, l: 100 },
    xaxis: { showgrid: true, gridcolor: '#f3f4f6', zeroline: false, tickfont: { size: 10 } },
    yaxis: { showgrid: false, zeroline: false, tickfont: { size: 10 }, automargin: true },
    height: 320,
    bargap: 0.3,
  };

  Plotly.react('chart-makes', [trace], layout, PLOTLY_CONFIG);
}

function renderFlightTypes(data) {
  const top = aggregateFlightTypes(data);
  if (!top.length) return;

  const labels = top.map(([t]) => t || '(desconocido)').reverse();
  const values = top.map(([,v]) => v).reverse();

  const trace = {
    x: values,
    y: labels,
    type: 'bar',
    orientation: 'h',
    marker: { color: '#60a5fa', opacity: 0.8 },
    hovertemplate: '<b>%{y}</b><br>Incidentes: %{x:,}<extra></extra>',
  };

  const layout = {
    ...PLOTLY_LAYOUT_BASE,
    margin: { t: 10, r: 20, b: 40, l: 110 },
    xaxis: { showgrid: true, gridcolor: '#f3f4f6', zeroline: false, tickfont: { size: 10 } },
    yaxis: { showgrid: false, zeroline: false, tickfont: { size: 10 }, automargin: true },
    height: 320,
    bargap: 0.3,
  };

  Plotly.react('chart-flight-types', [trace], layout, PLOTLY_CONFIG);
}

/* ─────────────────────────────────────────────────────────────
   RENDER ALL
───────────────────────────────────────────────────────────── */
function renderAll() {
  const data = appState.filtered;

  // Control de estado vacío
  const isEmpty = data.length === 0;
  document.getElementById('empty-state').hidden = !isEmpty;
  document.getElementById('main-content')
    .querySelectorAll('.viz-section')
    .forEach(s => { s.style.opacity = isEmpty ? '0.2' : '1'; });

  renderKPIs(data);
  renderSeverityShare(data);
  renderTemporal(data);
  renderMap(data);
  renderStatesBar(data);
  renderPhases(data);
  renderSeverity(data);
  renderHeatmap(data);
  renderMakes(data);
  renderFlightTypes(data);
}

/* ─────────────────────────────────────────────────────────────
   FILTROS: EVENTOS
───────────────────────────────────────────────────────────── */
function initFilters() {
  // Radios
  document.querySelectorAll('input[name="decade"]').forEach(input => {
    input.addEventListener('change', () => {
      appState.filters.decade = input.value;
      update();
    });
  });

  document.querySelectorAll('input[name="severity"]').forEach(input => {
    input.addEventListener('change', () => {
      appState.filters.severity = input.value;
      update();
    });
  });

  document.querySelectorAll('input[name="phase"]').forEach(input => {
    input.addEventListener('change', () => {
      appState.filters.phase = input.value;
      update();
    });
  });

  // Resetear filtros
  const resetFn = () => {
    appState.filters = { decade: 'all', severity: 'all', phase: 'all' };
    document.querySelectorAll('input[name="decade"][value="all"]').forEach(i => i.checked = true);
    document.querySelectorAll('input[name="severity"][value="all"]').forEach(i => i.checked = true);
    document.querySelectorAll('input[name="phase"][value="all"]').forEach(i => i.checked = true);
    update();
  };
  document.getElementById('btn-reset').addEventListener('click', resetFn);
  document.getElementById('btn-reset-empty').addEventListener('click', resetFn);

  // Toggle severidad escala
  document.getElementById('sev-scale-linear').addEventListener('click', () => {
    appState.sevScale = 'linear';
    document.getElementById('sev-scale-linear').classList.add('toggle-btn--active');
    document.getElementById('sev-scale-linear').setAttribute('aria-pressed', 'true');
    document.getElementById('sev-scale-log').classList.remove('toggle-btn--active');
    document.getElementById('sev-scale-log').setAttribute('aria-pressed', 'false');
    renderSeverity(appState.filtered);
  });

  document.getElementById('sev-scale-log').addEventListener('click', () => {
    appState.sevScale = 'log';
    document.getElementById('sev-scale-log').classList.add('toggle-btn--active');
    document.getElementById('sev-scale-log').setAttribute('aria-pressed', 'true');
    document.getElementById('sev-scale-linear').classList.remove('toggle-btn--active');
    document.getElementById('sev-scale-linear').setAttribute('aria-pressed', 'false');
    renderSeverity(appState.filtered);
  });

  // Toggle heatmap
  document.getElementById('heatmap-pct').addEventListener('click', () => {
    appState.heatmapMode = 'pct';
    document.getElementById('heatmap-pct').classList.add('toggle-btn--active');
    document.getElementById('heatmap-pct').setAttribute('aria-pressed', 'true');
    document.getElementById('heatmap-abs').classList.remove('toggle-btn--active');
    document.getElementById('heatmap-abs').setAttribute('aria-pressed', 'false');
    renderHeatmap(appState.filtered);
  });

  document.getElementById('heatmap-abs').addEventListener('click', () => {
    appState.heatmapMode = 'abs';
    document.getElementById('heatmap-abs').classList.add('toggle-btn--active');
    document.getElementById('heatmap-abs').setAttribute('aria-pressed', 'true');
    document.getElementById('heatmap-pct').classList.remove('toggle-btn--active');
    document.getElementById('heatmap-pct').setAttribute('aria-pressed', 'false');
    renderHeatmap(appState.filtered);
  });
}

/* ─────────────────────────────────────────────────────────────
   UPDATE PIPELINE
───────────────────────────────────────────────────────────── */
function update() {
  filterData();
  renderAll();
}

/* ─────────────────────────────────────────────────────────────
   REVEAL ANIMATION (IntersectionObserver)
───────────────────────────────────────────────────────────── */
function initReveal() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('revealed');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });

  document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
}

/* ─────────────────────────────────────────────────────────────
   BACK TO TOP
───────────────────────────────────────────────────────────── */
function initBackToTop() {
  const btn = document.getElementById('back-to-top');
  window.addEventListener('scroll', () => {
    btn.hidden = window.scrollY < 600;
  }, { passive: true });
  btn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

/* ─────────────────────────────────────────────────────────────
   PARSEO DE DATOS
───────────────────────────────────────────────────────────── */
function parseRow(row) {
  // Convertir campos numéricos
  row.year              = parseInt(row.year, 10)              || null;
  row.decade_start      = parseInt(row.decade_start, 10)      || null;
  row.total_fatalities  = parseFloat(row.total_fatalities)    || 0;
  row.total_injuries    = parseFloat(row.total_injuries)      || 0;
  return row;
}

/* ─────────────────────────────────────────────────────────────
   CARGA INICIAL
───────────────────────────────────────────────────────────── */
function showFiltersReady() {
  document.getElementById('filters-loading').style.display = 'none';
  const filtersBody = document.getElementById('filters-body');
  filtersBody.removeAttribute('aria-hidden');
}

function initApp() {
  initReveal();
  initBackToTop();
  initFilters();

  Papa.parse(DATA_PATH, {
    download: true,
    header: true,
    skipEmptyLines: true,
    worker: false,
    step: null,
    complete(results) {
      appState.allData   = results.data.map(parseRow);
      appState.filtered  = appState.allData;
      appState.loaded    = true;

      showFiltersReady();
      update();

      // Trigger reveals que ya estaban en pantalla
      setTimeout(() => {
        document.querySelectorAll('.reveal:not(.revealed)').forEach(el => {
          const rect = el.getBoundingClientRect();
          if (rect.top < window.innerHeight * 0.9) {
            el.classList.add('revealed');
          }
        });
      }, 100);
    },
    error(err) {
      console.error('Error cargando el CSV:', err);
      document.getElementById('filters-loading').innerHTML =
        '<p style="color:#dc2626;font-size:0.85rem;text-align:center;">' +
        'Error al cargar los datos.<br>Comprueba que el archivo existe en <code>data/</code>.' +
        '</p>';
    },
  });
}

/* ─────────────────────────────────────────────────────────────
   ARRANQUE
───────────────────────────────────────────────────────────── */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

