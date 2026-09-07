# Atlas de colegios · Saber 11

Tablero interactivo de resultados académicos de 2021 a 2025. Sabana de Occidente es la selección inicial; permite explorar todos los municipios presentes en la base.

## Contenido

### Recorridos guiados

- **Crear mi ranking:** departamentos → municipios y años → prioridades → resultados.
- **Comparar colegios que conozco:** departamentos → municipios y años → colegios → prioridades → resultados.

Un resumen visible identifica los municipios incluidos por nombre y departamento, permite buscar dentro de la selección y quitar municipios, y muestra los colegios elegidos. Seleccionar un departamento habilita sus municipios, pero no los añade automáticamente. Desmarcarlo elimina sus municipios y anuncia cuántos se quitaron. Los colegios seleccionados que dejan de cumplir los filtros se conservan señalados y no se incorporan a comparaciones incompatibles.

Las preguntas de preferencias son orientativas, creadas para esta aplicación. Las descripciones de las materias se basan en [¿Qué se evalúa en Saber 11? del ICFES](https://www.icfes.gov.co/caja-de-herramientas-saber-11/que-se-evalua/) y en su [guía oficial](https://www.icfes.gov.co/evaluaciones-icfes/saber-11/guia-de-orientacion-examen-saber-11/), consultadas el 7 de septiembre de 2026. Se utiliza Saber 11, correspondiente a colegios, en lugar de Saber Pro, que corresponde a educación superior y tiene componentes diferentes.

Las respuestas de importancia se traducen a pesos relativos 0, 10, 20, 30 y 40. El usuario puede modificarlos directamente entre 0 y 100. Se normalizan dividiendo cada peso por la suma; si todos son cero, la interfaz impide avanzar. Son prioridades del usuario, no coeficientes oficiales del ICFES.

### Laboratorio de gráficas

Se conserva la evolución anual original con selector de materias/indicador y se añade una gráfica **fija del promedio general por colegio y año**: la media simple de las cinco materias, después de combinar jornadas por evaluados. Cambiar pesos, materia o promedio histórico no redefine esa media anual. Los años ausentes permanecen vacíos y no se conectan años no consecutivos.

El laboratorio añade segmentos entre dos años elegidos (inicio, final y cambio en puntos), dispersión de puntaje frente a evaluados en un año, y sensibilidad de posiciones al mezclar pesos iguales con los pesos del usuario. Esta última mantiene fijo el conjunto completo de colegios elegibles y aplica posiciones de competencia para empates. Las líneas unen cinco escenarios muestreados, sin interpolar posiciones; los círculos grandes y la tabla calculan el porcentaje exacto del control. Aplicar el escenario actualiza el ranking, pero conserva el promedio general anual.

Todos los valores se ofrecen también en tablas. Los puntos permiten consultar un colegio/año con ratón o toque, y los selectores nativos ofrecen esa función por teclado. Se pueden resaltar colegios y cambiar años e indicadores. La configuración se conserva en los enlaces compartidos.

Inspiración: [Python Graph Gallery](https://python-graph-gallery.com/), especialmente [líneas](https://python-graph-gallery.com/line-chart/), [dispersión](https://python-graph-gallery.com/scatter-plot/) y [segmentos con puntos](https://python-graph-gallery.com/lollipop-plot/). Implementación propia en SVG/JavaScript, sin ejecutar Python en el navegador ni importar datos de los ejemplos.

La revisión de la base completa encontró 3.613 registros con algún puntaje cero y 28.731 registros con menos de 20 evaluados (registros fuente de jornadas, no necesariamente colegios/años ya combinados). Los ceros se conservan; no se convierten automáticamente en ausencias. El laboratorio calcula para la selección los registros con cero, los años ausentes, las cohortes anuales pequeñas y los colegios fuera de los filtros. No se muestran intervalos de confianza, significancia ni causalidad que los agregados no permitan sostener.

### Comparaciones descriptivas

Además de trayectoria anual, materias y cohortes, se incluye un colegio de referencia seleccionable: diferencia media del indicador en años comunes, número de años por encima y empates. Cada año común pesa igual, independientemente del método de promedio histórico elegido para el ranking; así se evita comparar periodos distintos. Si no existen años comunes, no se calcula la diferencia. Se conservan valores exactos en tablas accesibles.

El contexto municipal muestra la mediana entre los colegios elegibles de cada municipio, dando el mismo peso a cada colegio. No es un promedio de todos sus estudiantes. Estas comparaciones no son pruebas inferenciales: la base agregada no permite evaluar significancia de diferencias entre estudiantes ni efectos causales de los colegios.

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
- `journey.js`: recorridos, selección visible, preguntas y navegación. `subject-guide.js`: resúmenes y fuentes oficiales. `comparisons.js`: comparaciones descriptivas puras.
- `chart-stats.js`: datos puros para las gráficas, sensibilidad y revisión de cobertura. `chart-lab.js`: controles, dibujos SVG, tablas y consultas de valores.

Los enlaces nuevos compactan selecciones grandes de municipios en intervalos de identificadores, manteniendo la versión fija de los datos. El decodificador sigue aceptando los enlaces anteriores. El recorrido, los departamentos habilitados y el colegio de referencia también se conservan al compartir.

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


## Presentación simplificada (v7)

- Una comparación visible por vez, elegida desde «¿Qué quieres comparar?». Se conservan las ocho vistas y los datos descargables.
- Municipios buscados de uno en uno; listas completas, tablas y explicaciones bajo controles desplegables. Colegios elegidos permanecen disponibles para revisión.
- SVG ajustados al ancho de su contenedor y redibujados al cambiar el tamaño. Tablas de comparación presentadas como fichas con etiquetas en pantallas pequeñas.
- Líneas y puntos usan por defecto un dominio que incluye todos los valores observados, con margen y aviso de escala ajustada. La escala completa sigue disponible. Barras mantienen su origen en cero.
- Leyendas locales y colores consistentes por colegio. El promedio general permanece independiente de los pesos personalizados.
- Pruebas de dominios, extremos cero/cien, invariancia numérica, una vista visible y coordenadas SVG en un ancho simulado de 360 píxeles. La simulación DOM no reemplaza una auditoría en dispositivos reales.

Referencias de presentación: [Datawrapper: gráficos de líneas](https://academy.datawrapper.de/article/129-what-to-consider-when-creating-line-charts) y [NN/g: información progresiva](https://www.nngroup.com/articles/progressive-disclosure/).


## Recorrido directo para familias (v8)

La entrada inicial permite añadir municipios por nombre, elegir un colegio y compararlo automáticamente con el de mayor promedio entre todos los municipios elegidos. Cada municipio se confirma con su departamento para distinguir nombres repetidos. La referencia usa los mismos filtros y el mismo motor del tablero; no es el primero de cada municipio por separado.

El recorrido comienza con 2021–2025, materias y años con igual peso, jornadas diurnas y registros en todos los años. Se pueden permitir historias incompletas con una advertencia sobre comparabilidad. La elección del colegio puede ser cualquiera de los elegibles, no solo un finalista predefinido. Empates y selección del propio líder se explican. No se infieren costos ni calidad integral a partir de Saber 11.

`family-guide.js` compone este recorrido y conserva el acceso avanzado. La búsqueda al escribir filtra catálogos locales; no vuelve a descargar datos ni recalcula el ranking por cada tecla. Prueba de interacción: añadir Funza y Mosquera, elegir un colegio, generar la comparación, conservar ambos municipios y volver a la búsqueda avanzada.
