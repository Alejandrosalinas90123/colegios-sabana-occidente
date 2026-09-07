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

Fuente: https://www.gip.com.co/gipdata/icfes

Datos extraídos de «versión verificada 2.xlsx». La comparación es histórica y académica; no incluye costos, admisiones, transporte ni bienestar escolar.

## Publicación

Sitio estático. En GitHub, seleccionar **Settings → Pages → Deploy from a branch → main → / (root)**.

HTML, CSS y JavaScript estáticos; sin framework ni dependencias de gráficos. `data.json.gz` contiene la base completa, comprimida a aproximadamente 1 MB. Requiere un navegador moderno con DecompressionStream (Chrome, Edge, Firefox o Safari actuales). Las fuentes tipográficas tienen alternativas locales si Google Fonts no está disponible. No requiere servidor de aplicaciones ni claves privadas.

`verification.json` documenta recuentos y hashes SHA-256. La transformación conservó cada ubicación, año, puntaje, número de evaluados, sector, jornada y calendario. Se verificaron las 59.318 combinaciones colegio/año, la conservación de evaluados, los 66 historiales completos diurnos del tablero regional anterior, municipios homónimos y enlaces compartidos.

Los identificadores dependen de la versión 2 de la base, que permanece fija en 2021–2025. No se fusionan nombres distintos ni se rellenan años ausentes. Los evaluados acumulados son cohortes, no personas únicas. La marca de menos de 20 evaluados es informativa y no altera las posiciones.
