# Atlas de colegios · Saber 11

Tablero interactivo de resultados académicos de 2021 a 2025. Sabana de Occidente es la selección inicial; permite explorar todos los municipios presentes en la base.

## Contenido

- 72.686 registros publicados por GIP, 1.116 municipios en 33 territorios departamentales y 13.448 identidades institucionales por nombre exacto y ubicación.
- Filtros por municipio, año, naturaleza, jornada, cobertura histórica y mínimo de evaluados.
- Pesos ajustables por materia y comparación con un escenario de referencia.
- Evolución anual, evaluados por año y perfil de las cinco materias.
- Comparación simultánea de hasta seis colegios.
- Vistas Explorar y Comparar, búsqueda por nombre, fichas anuales, barras comparativas y tabla de materias.
- Enlaces compartidos que preservan filtros, colegios, pesos y referencia en el fragmento de la URL.
- Descarga CSV compatible con Excel de los registros de la búsqueda, con TOTAL y número de fila en el libro verificado. La tabla permite consultar todos los registros por bloques.

## Criterios de cálculo

Dentro de cada colegio y año, las jornadas elegidas se ponderan por estudiantes evaluados. Entre años se puede elegir igual peso anual o ponderación por evaluados. Los pesos de las materias se normalizan a 100 %.

El escenario se expresa sobre 100 puntos. TOTAL suma los cinco puntajes sin pesos por materia y se expresa sobre 500. Ninguno sustituye el puntaje global oficial del ICFES. No se imputan datos ausentes y se conservan separados los nombres institucionales distintos.

## Arquitectura y sistema de diseño

- `index.html`: estructura semántica, filtros, pestañas y diálogo nativo.
- `styles.css`: tokens de color, espaciado de 4/8 px, escala tipográfica y componentes responsive desde móvil. Cuerpo de 16 px, etiquetas de 14 px y metadatos de 12–13 px; sin fuentes externas.
- `ui.js`: validación, conservación/restauración del foco, pestañas con flechas/Home/End, estados de espera y regiones de tablas.
- `data-loader.js`: descarga con límite de 30 segundos, descompresión y controles de versión/recuento.
- `engine.js`: cálculos puros. `state.js`: validación y serialización de enlaces. `app.js`: coordinación y presentación.

Los controles tienen una zona objetivo mínima de 48 × 48 px. En casillas, la etiqueta completa amplía el área de pulsación. Los botones distinguen estados normal, hover, active, focus, disabled y loading. Los filtros inválidos muestran texto junto al campo y referencias ARIA; un mínimo de evaluados inválido conserva el último resultado válido, sin corregirlo silenciosamente. Las gráficas incluyen una tabla de valores exactos y no dependen exclusivamente del color.

El diseño contempla movimiento reducido y colores forzados. Se siguen los patrones de [pestañas de WAI-ARIA APG](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/) y criterios relevantes de [WCAG 2.2](https://www.w3.org/TR/WCAG22/), adaptando jerarquía de acciones y ergonomía al dashboard web. No utiliza ni pretende ser una implementación oficial de Material Design o Apple HIG.

## Desarrollo y comprobaciones

No necesita compilación: sirve la raíz con cualquier servidor estático, por ejemplo `python -m http.server 8765`. No abras el HTML mediante `file://`, porque la base se descarga con fetch.

Con Node.js 22 o posterior: `npm install` y `npm test`. Las dependencias son solo de desarrollo; no se envían al navegador. `npm run format:check` comprueba el formato común.

Las pruebas conservan los cálculos históricos y verifican interacciones en un DOM simulado: pestañas, foco, validación, etiquetas, referencias ARIA y reintento de carga. Comprueban también 16 combinaciones de tokens de texto/fondo, todas por encima de 4,5:1 (mínimo medido: 6,30:1). Esto no equivale a una certificación WCAG: queda pendiente una auditoría manual en navegadores, a 200 % de ampliación y con lectores de pantalla reales. La simulación no mide geometría táctil ni el comportamiento modal nativo del navegador.

Fuente: https://www.gip.com.co/gipdata/icfes

Datos extraídos de «versión verificada 2.xlsx». La comparación es histórica y académica; no incluye costos, admisiones, transporte ni bienestar escolar.

## Publicación

Sitio estático. En GitHub, seleccionar **Settings → Pages → Deploy from a branch → main → / (root)**.

HTML, CSS y JavaScript estáticos; sin framework ni dependencias de gráficos. `data.json.gz` contiene la base completa, comprimida a aproximadamente 1 MB. Requiere un navegador moderno con DecompressionStream y AbortSignal.timeout. Utiliza fuentes del sistema. No requiere servidor de aplicaciones ni claves privadas.

`verification.json` documenta recuentos y hashes SHA-256. La transformación conservó cada ubicación, año, puntaje, número de evaluados, sector, jornada y calendario. Se verificaron las 59.318 combinaciones colegio/año, la conservación de evaluados, los 66 historiales completos diurnos del tablero regional anterior, municipios homónimos y enlaces compartidos.

Los identificadores dependen de la versión 2 de la base, que permanece fija en 2021–2025. No se fusionan nombres distintos ni se rellenan años ausentes. Los evaluados acumulados son cohortes, no personas únicas. La marca de menos de 20 evaluados es informativa y no altera las posiciones.
