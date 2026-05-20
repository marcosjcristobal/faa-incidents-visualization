# Patrones de incidentes de aviación en Estados Unidos, 1978–2015

Visualización web interactiva de aproximadamente 100.000 incidentes de aviación registrados por la **FAA Accident and Incident Data System (ASIAS)** entre 1978 y 2015.

> **Nota metodológica importante:** esta visualización muestra el volumen de incidentes *registrados*, no tasas de riesgo. El dataset no incluye el número total de vuelos u operaciones por año, estado o fase de vuelo. Los resultados no deben interpretarse como probabilidades de incidente ni como peligrosidad relativa.

---

## Descripción

La visualización adopta un formato de **narrativa visual por secciones** (scrollytelling ligero). El usuario avanza por la página respondiendo progresivamente a cinco preguntas clave:

1. ¿Cómo han evolucionado los incidentes registrados entre 1978 y 2015?
2. ¿Dónde se concentran más incidentes registrados?
3. ¿En qué fases del vuelo se producen más incidentes?
4. ¿Qué nivel de severidad presentan los incidentes?
5. ¿Coinciden las fases con más incidentes con las fases de mayor severidad relativa?

Los gráficos son completamente interactivos y se actualizan en tiempo real según los filtros seleccionados (década, severidad, fase de vuelo).

---

## Fuente de datos

| Campo | Valor |
|---|---|
| **Fuente** | FAA / ASIAS — Accident and Incident Data System |
| **URL** | [faa.gov](https://www.faa.gov/data_research/accident_incident/) |
| **Periodo** | 1978-01-01 – 2015-12-18 |
| **Registros** | ~100.000 |
| **Tipo** | Todos clasificados como `INCIDENT` |

---

## Estructura del repositorio

```
faa-incidents-visualization/
├── index.html                   # Página principal
├── README.md                    # Este archivo
├── LICENSE                      # Licencia MIT
├── css/
│   └── styles.css               # Estilos completos
├── js/
│   └── app.js                   # Lógica de la aplicación
└── data/
    ├── faa_incidents_clean.csv  # Dataset limpio completo (~100k filas)
    ├── incidents_by_year.csv
    ├── incidents_by_decade.csv
    ├── incidents_by_state.csv
    ├── incidents_by_phase.csv
    ├── incidents_by_severity.csv
    └── phase_severity.csv
```

---

## Cómo ejecutar localmente

### Requisitos
- Python 3 instalado (para el servidor HTTP simple)
- Los archivos CSV en la carpeta `data/`

### Pasos

```bash
# 1. Clonar o descargar el repositorio
git clone [github.com](https://github.com/TU_USUARIO/faa-incidents-visualization.git)
cd faa-incidents-visualization

# 2. Iniciar servidor local
python -m http.server 8000

# 3. Abrir en el navegador
# [localhost](http://localhost:8000)
```

> **Importante:** la aplicación no puede abrirse directamente con `file://` porque PapaParse necesita un servidor HTTP para leer archivos CSV. Usa siempre el servidor Python o equivalente.

---

## Cómo publicar en GitHub Pages

```bash
# 1. Crear repositorio en GitHub
# 2. Subir todos los archivos
git init
git add .
git commit -m "Initial commit: FAA incidents visualization"
git branch -M main
git remote add origin [github.com](https://github.com/TU_USUARIO/faa-incidents-visualization.git)
git push -u origin main

# 3. Activar GitHub Pages
# - Ir a Settings → Pages
# - Source: Deploy from a branch
# - Branch: main / (root)
# - Guardar
```

La visualización estará disponible en:
`[tu_usuario.github.io](https://TU_USUARIO.github.io/faa-incidents-visualization/)`

---

## Preguntas de análisis principales

| # | Pregunta | Sección |
|---|---|---|
| 1 | ¿Cómo evolucionaron los registros entre 1978 y 2015? | Sección 01 |
| 2 | ¿Qué estados concentran más incidentes registrados? | Sección 02 |
| 3 | ¿En qué fases del vuelo se producen más incidentes? | Sección 03 |
| 4 | ¿Qué distribución de severidad presentan los registros? | Sección 04 |
| 5 | ¿Mayor volumen implica mayor severidad relativa? | Sección 05 |

---

## Hallazgos principales

- Los registros muestran una **reducción general** del volumen entre 1978 y 2015, especialmente pronunciada en los ochenta y noventa.
- **California, Texas y Florida** concentran el mayor número de registros absolutos.
- La **aproximación y el aterrizaje** acumulan más del 58 % de los incidentes registrados.
- La mayoría de registros son de **daño menor o severidad desconocida**; los incidentes fatales representan menos del 1 % del total.
- Las **maniobras** presentan una proporción relativamente mayor de fatalidades pese a tener menos registros totales.

---

## Limitaciones metodológicas

- El dataset recoge únicamente **incidentes** (no accidentes con denominador comparable).
- **No hay denominadores de exposición**: sin número de vuelos totales no es posible calcular tasas de riesgo.
- Algunas variables tienen **valores perdidos** relevantes (severidad, fase de vuelo).
- La reducción temporal puede reflejar **cambios en los criterios de registro**, no solo mejoras reales en seguridad.
- Los conteos por estado, fabricante o tipo de vuelo son **absolutos**, no indicadores de seguridad relativa.

---

## Tecnologías utilizadas

| Tecnología | Versión | Uso |
|---|---|---|
| HTML5 | — | Estructura semántica |
| CSS3 | — | Diseño responsive y animaciones |
| JavaScript ES2020 | — | Lógica de la aplicación |
| [Plotly.js](https://plotly.com/javascript/) | 2.30.0 | Gráficos interactivos |
| [PapaParse](https://www.papaparse.com/) | 5.4.1 | Parseo de archivos CSV |

No se usa ningún framework que requiera proceso de build. La web es completamente estática.

---

## Licencia

Código bajo licencia [MIT](LICENSE).  
Los datos pertenecen a la FAA y están sujetos a las condiciones de uso de datos gubernamentales de EE. UU.
