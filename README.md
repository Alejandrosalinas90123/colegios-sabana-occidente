# Colegios de Sabana de Occidente

Tablero interactivo para comparar resultados académicos de Funza, Madrid, Mosquera y Bojacá entre 2021 y 2025.

## Contenido

- 476 registros publicados por GIP, correspondientes a 95 nombres institucionales.
- Filtros por municipio, año, naturaleza, jornada, cobertura histórica y mínimo de evaluados.
- Pesos ajustables por materia y comparación con un escenario de referencia.
- Evolución anual, evaluados por año y perfil de las cinco materias.
- Comparación simultánea de hasta seis colegios.

## Criterios de cálculo

Dentro de cada colegio y año, las jornadas elegidas se ponderan por estudiantes evaluados. Entre años se puede elegir igual peso anual o ponderación por evaluados. Los pesos de las materias se normalizan a 100 %.

El escenario se expresa sobre 100 puntos. TOTAL suma los cinco puntajes sin pesos por materia y se expresa sobre 500. Ninguno sustituye el puntaje global oficial del ICFES. No se imputan datos ausentes y se conservan separados los nombres institucionales distintos.

Fuente: https://www.gip.com.co/gipdata/icfes

Datos extraídos de «versión verificada 2.xlsx». La comparación es histórica y académica; no incluye costos, admisiones, transporte ni bienestar escolar.

## Publicación

Sitio estático. En GitHub, seleccionar **Settings → Pages → Deploy from a branch → main → / (root)**.

El archivo `index.html` contiene el tablero y sus datos. Las gráficas cargan D3 7.9.0 desde jsDelivr. No requiere servidor de aplicaciones ni claves privadas.
