'use strict';
const $ = (id) => document.getElementById(id),
  esc = (x) =>
    String(x).replace(
      /[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );
const fmt = (x, d = 2) =>
  Number.isFinite(x)
    ? x.toLocaleString('es-CO', { minimumFractionDigits: d, maximumFractionDigits: d })
    : '—';
const norm = (x) =>
  String(x)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
const subjects = [
  'Lectura crítica',
  'Matemáticas',
  'Sociales y ciudadanas',
  'Ciencias naturales',
  'Inglés',
];
const colors = ['#1a6152', '#ab5c2a', '#5865ad', '#ba487c', '#7b6a19', '#267c99'];
let data,
  state,
  result,
  defaults,
  schoolMap,
  placeMap,
  page = 0,
  rawLimit = 100,
  filtered = [],
  rawRows = [],
  renderTimer;
const metricValue = (r, m = state.metric) =>
  m === 'score' ? r.score : m === 'total' ? r.total : r.scores[Number(m)];
const metricName = (m = state.metric) =>
  m === 'score' ? 'Mis pesos' : m === 'total' ? 'TOTAL' : subjects[Number(m)];
const announce = (text) => {
  $('status').textContent = text;
};
let minimumError = '';
function validateFilters() {
  DashboardUI.fieldError(
    'places',
    'places-error',
    state.places.length ? '' : 'Selecciona al menos un municipio.'
  );
  DashboardUI.fieldError(
    'years',
    'years-error',
    state.years.length ? '' : 'Selecciona al menos un año.'
  );
  const weightsError = SchoolEngine.normalize(state.weights)
    ? ''
    : 'Asigna un peso mayor que cero a una materia o elige Equilibrado.';
  DashboardUI.fieldError('weights', 'weights-error', weightsError);
  subjects.forEach((_, i) =>
    $('weight-' + i).setAttribute('aria-invalid', String(Boolean(weightsError)))
  );
  $('share').disabled = Boolean(
    weightsError || minimumError || !state.places.length || !state.years.length
  );
  $('reference').disabled = Boolean(weightsError);
}
function save() {
  if (SchoolEngine.normalize(state.weights))
    history.replaceState(null, '', DashboardState.encode(state));
}
function shownPlaces() {
  const q = norm($('place-search').value),
    dep = $('department').value;
  return data.places.filter(
    (p) =>
      (!state.journey || state.journey.departments.includes(p.department)) &&
      (!dep || p.department === dep) &&
      norm(p.town + ' ' + p.department).includes(q)
  );
}
function renderPlaces() {
  if (state.journey) {
    const current = $('department').value;
    $('department').innerHTML =
      '<option value="">Todos los departamentos elegidos</option>' +
      state.journey.departments.map((dep) => `<option>${esc(dep)}</option>`).join('');
    $('department').value = state.journey.departments.includes(current) ? current : '';
  }
  const selected = new Set(state.places);
  $('places').innerHTML =
    (norm($('place-search').value) || $('browse-places').checked ? shownPlaces() : [])
      .map(
        (p) =>
          `<label class="check"><input type="checkbox" data-place="${p.id}" ${selected.has(p.id) ? 'checked' : ''}><span>${esc(p.town)}<small>${esc(p.department)}</small></span></label>`
      )
      .join('') ||
    '<p class="hint">' +
      (norm($('place-search').value)
        ? 'No hay coincidencias.'
        : 'Escribe un nombre para añadir un municipio.') +
      '</p>';
  $('place-count').textContent = `${fmt(state.places.length, 0)} municipios seleccionados`;
}
function syncControls() {
  SchoolJourney.ensure();
  $('years').innerHTML = data.years
    .map(
      (y) =>
        `<label><input type="checkbox" data-year="${y}" ${state.years.includes(y) ? 'checked' : ''}>${y}</label>`
    )
    .join('');
  for (const key of ['nature', 'session', 'aggregation']) $(key).value = state[key];
  $('complete').checked = state.complete;
  if (!minimumError) $('minimum').value = state.minStudents;
  $('school-search').value = state.search;
  $('metric').value = $('compare-metric').value = state.metric;
  subjects.forEach((s, i) => ($('weight-' + i).value = state.weights[i]));
  renderPlaces();
  renderWeights();
}
function renderWeights() {
  const w = SchoolEngine.normalize(state.weights);
  subjects.forEach((s, i) => {
    $('percent-' + i).textContent = w ? fmt(w[i] * 100, 1) + ' %' : '—';
    $('weight-' + i).setAttribute(
      'aria-valuetext',
      w ? `${fmt(w[i] * 100, 1)} por ciento` : 'Sin peso'
    );
  });
  const rw = SchoolEngine.normalize(state.reference);
  $('reference-label').textContent =
    'Referencia: ' + subjects.map((s, i) => `${s} ${fmt(rw[i] * 100, 1)} %`).join(' · ');
}
function change(patch, { controls = false } = {}) {
  clearTimeout(renderTimer);
  state = { ...state, ...patch };
  page = 0;
  rawLimit = 100;
  if (controls) syncControls();
  render();
}
function render() {
  const focus = DashboardUI.captureFocus();
  result = SchoolEngine.calculate(data, state, state.weights, state.reference);
  filtered = result.rows.filter((r) => norm(r.name).includes(norm(state.search)));
  const ps = new Set(state.places),
    ys = new Set(state.years),
    diurnal = new Set(['MAÑANA', 'TARDE', 'COMPLETA', 'ÚNICA']);
  rawRows = data.records.filter(
    (r) =>
      ps.has(schoolMap.get(r.id).place) &&
      ys.has(r.year) &&
      (state.nature === 'all' || r.nature === state.nature) &&
      (state.session === 'all' ||
        (state.session === 'diurnal' ? diurnal.has(r.session) : r.session === state.session))
  );
  const towns = state.places.map((id) => placeMap.get(id));
  const territory =
    towns.length === data.places.length
      ? 'Todos los municipios de la base'
      : towns.length <= 5
        ? towns.map((p) => `${p.town} (${p.department})`).join(' · ')
        : `${fmt(towns.length, 0)} municipios en ${new Set(towns.map((p) => p.department)).size} departamentos`;
  $('scope').textContent =
    `${territory || 'Sin municipios'} · ${state.years.join(', ') || 'Sin años'} · ${state.session === 'diurnal' ? 'Jornadas diurnas' : state.session === 'all' ? 'Todas las jornadas' : state.session} · ${state.aggregation === 'equal' ? 'Mismo peso por año' : 'Ponderado por evaluados'}`;
  $('stats').innerHTML =
    `<div class="stat"><strong>${fmt(result.rows.length, 0)}</strong><span>colegios que cumplen tus filtros</span></div><div class="stat"><strong>${fmt(
      result.rows.reduce((s, r) => s + r.students, 0),
      0
    )}</strong><span>evaluados acumulados · cohortes</span></div><div class="stat"><strong>${result.rows.length ? fmt(result.rows[0].score) : '—'}</strong><span>mayor promedio con tus pesos /100</span></div>`;
  $('selection-count').textContent = state.selected.length;
  $('selection').innerHTML = state.selected
    .map((id) => {
      const s = schoolMap.get(id),
        included = result.rows.some((r) => r.id === id);
      return `<span class="chip ${included ? '' : 'excluded'}"><span title="${esc(s.name)}">${esc(s.name)}${included ? '' : ' · fuera de filtros'}</span><button data-remove="${id}" aria-label="Quitar ${esc(s.name)}">×</button></span>`;
    })
    .join('');
  DashboardUI.tabs(state.view);
  renderRanking();
  renderComparison();
  renderWeights();
  $('raw-count').textContent = `${fmt(rawRows.length, 0)} registros originales disponibles.`;
  if (document.querySelector('.data-detail').open) renderRaw();
  validateFilters();
  announce(
    result.error || `${fmt(result.rows.length, 0)} colegios disponibles con los filtros actuales.`
  );
  SchoolJourney.refresh();
  ChartLab.render();
  DashboardUI.labelTables();
  save();
  DashboardUI.restoreFocus(focus);
}
function renderRanking() {
  const chartRows = [...filtered]
      .sort((a, b) => metricValue(b) - metricValue(a) || a.rank - b.rank)
      .slice(0, 10),
    max = state.metric === 'total' ? 500 : 100;
  $('bar-description').textContent =
    `Los primeros ${chartRows.length} por ${metricName().toLowerCase()} en tu búsqueda. Escala de 0 a ${max}. Pulsa un nombre para abrir su ficha.`;
  $('ranking-chart').innerHTML =
    chartRows
      .map(
        (r) =>
          `<div class="bar-row"><button class="bar-name" data-detail="${r.id}">${esc(r.name)}<small>${esc(r.town)}</small></button><div class="bar-track" aria-hidden="true"><div class="bar-fill" style="width:${(metricValue(r) / max) * 100}%"></div></div><strong>${fmt(metricValue(r))}</strong></div>`
      )
      .join('') ||
    '<div class="empty">No hay colegios con esta combinación. Prueba otros municipios, quita la búsqueda por nombre o permite historias incompletas.</div>';
  page = Math.max(0, Math.min(page, Math.ceil(filtered.length / 20) - 1));
  const m = state.metric === 'score' ? 'total' : state.metric;
  $('metric-heading').textContent = `${metricName(m)} /${m === 'total' ? 500 : 100}`;
  $('ranking').innerHTML =
    filtered
      .slice(page * 20, page * 20 + 20)
      .map(
        (r) =>
          `<tr><td>${r.rank}</td><td><button class="school-link" data-detail="${r.id}">${esc(r.name)}</button><small>${esc(r.town)} · ${esc(r.department)}</small>${r.minStudents < 20 ? '<span class="badge">Algún año con menos de 20 evaluados</span>' : ''}</td><td><strong>${fmt(r.score)}</strong></td><td>${fmt(metricValue(r, m))}</td><td class="${r.rankChange > 0 ? 'up' : r.rankChange < 0 ? 'down' : ''}">${r.rankChange > 0 ? '↑ ' + r.rankChange : r.rankChange < 0 ? '↓ ' + Math.abs(r.rankChange) : '— Sin cambio'}<small>Ref. ${r.referenceRank}</small></td><td>${fmt(r.students, 0)}<small>Mín. anual: ${fmt(r.minStudents, 0)}</small></td><td>${r.coverage}/${state.years.length}</td><td><button class="add ${state.selected.includes(r.id) ? 'active' : ''}" data-add="${r.id}" aria-label="${state.selected.includes(r.id) ? 'Quitar' : 'Añadir'} ${esc(r.name)} ${state.selected.includes(r.id) ? 'de' : 'a'} la comparación" aria-pressed="${state.selected.includes(r.id)}">${state.selected.includes(r.id) ? '✓ Añadido' : '＋ Añadir'}</button></td></tr>`
      )
      .join('') || '<tr><td colspan="8">Sin resultados para esta búsqueda.</td></tr>';
  $('page').textContent =
    `${filtered.length ? `${page * 20 + 1}–${Math.min(filtered.length, page * 20 + 20)} de` : ''} ${fmt(filtered.length, 0)} colegios`;
  $('prev').disabled = page === 0;
  $('next').disabled = (page + 1) * 20 >= filtered.length;
  $('top-four').disabled = !filtered.length;
}
function renderComparison() {
  const rows = state.selected.map((id) => result.rows.find((r) => r.id === id)).filter(Boolean);
  $('compare-empty').hidden = rows.length > 0;
  $('comparison-content').hidden = !rows.length;
  if (!rows.length) return;
  $('legend').innerHTML = rows
    .map(
      (r, i) =>
        `<span><i class="dot" style="background:${colors[state.selected.indexOf(r.id)]}"></i>${esc(r.name)} · ${esc(r.town)}</span>`
    )
    .join('');
  const years = [...state.years].sort(),
    max = state.metric === 'total' ? 500 : 100,
    W = Math.min(900, Math.max(240, ($('compare-view').clientWidth || 900) - 32)),
    H = 310,
    L = 48,
    R = 22,
    T = 20,
    B = 40;
  const bounds = ChartStats.domain(
    rows.flatMap((r) => years.map((yr) => (r.byYear[yr] ? metricValue(r.byYear[yr]) : null))),
    max,
    state.chartOptions?.scale === 'full'
  );
  const x = (y) =>
      years.length === 1 ? W / 2 : L + ((y - years[0]) / (years.at(-1) - years[0])) * (W - L - R),
    y = (v) => H - B - ((v - bounds.min) / (bounds.max - bounds.min)) * (H - T - B);
  let svg = `<svg class="trend-svg" viewBox="0 0 ${W} ${H}" aria-hidden="true"><title>Evolución anual de ${esc(metricName())}; valores exactos en las fichas de cada colegio</title>`;
  for (const v of bounds.ticks)
    svg += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="#e0e6db"/><text x="${L - 9}" y="${y(v) + 4}" text-anchor="end" font-size="14" fill="#576b64">${v}</text>`;
  for (const yr of years)
    svg += `<text x="${x(yr)}" y="${H - 12}" text-anchor="middle" font-size="14" fill="#173a35">${yr}</text>`;
  rows.forEach((r, i) => {
    let previous = null;
    for (const yr of years) {
      const a = r.byYear[yr];
      if (!a) {
        previous = null;
        continue;
      }
      const px = x(yr),
        py = y(metricValue(a));
      if (previous && yr - previous.year === 1)
        svg += `<line x1="${previous.x}" y1="${previous.y}" x2="${px}" y2="${py}" stroke="${colors[state.selected.indexOf(r.id)]}" stroke-width="2.5" stroke-dasharray="${['none', '8 4', '3 3', '12 4 3 4', '2 5', '14 6'][i]}"/>`;
      const label = `${r.name}, ${yr}: ${fmt(metricValue(a))}; ${a.n} evaluados`;
      svg += `<circle cx="${px}" cy="${py}" r="5" fill="${colors[state.selected.indexOf(r.id)]}" stroke="white" stroke-width="1.5" aria-label="${esc(label)}"><title>${esc(label)}</title></circle>`;
      previous = { x: px, y: py, year: yr };
    }
  });
  $('trend').innerHTML = svg + '</svg>';
  $('trend-table').innerHTML =
    `<table><caption>${esc(metricName())} por colegio y año</caption><thead><tr><th>Colegio</th>${years.map((y) => `<th>${y}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr><th>${esc(r.name)} · ${esc(r.town)}</th>${years.map((y) => `<td>${r.byYear[y] ? fmt(metricValue(r.byYear[y])) : 'Sin datos'}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  $('subjects').innerHTML =
    `<table class="heat"><thead><tr><th>Colegio</th>${subjects.map((s) => `<th>${s}</th>`).join('')}<th>Mis pesos</th><th>TOTAL</th></tr></thead><tbody>${rows.map((r) => `<tr><th><button class="school-link" data-detail="${r.id}">${esc(r.name)}</button></th>${r.scores.map((v) => `<td style="background:hsl(93 36% ${98 - v * 0.35}%)">${fmt(v)}</td>`).join('')}<td>${fmt(r.score)}</td><td>${fmt(r.total)}</td></tr>`).join('')}</tbody></table>`;
  const maxN = Math.max(...rows.flatMap((r) => Object.values(r.byYear).map((a) => a.n)), 1);
  $('cohorts').innerHTML =
    years
      .map(
        (yr) =>
          `<div class="cohort-year"><h4>${yr}</h4>${rows
            .map((r, i) => {
              const a = r.byYear[yr];
              return `<div class="bar-row"><button class="bar-name" data-detail="${r.id}">${esc(r.name)}</button><div class="bar-track" aria-hidden="true"><div class="bar-fill" style="background:${colors[state.selected.indexOf(r.id)]};width:${a ? (a.n / maxN) * 100 : 0}%"></div></div><strong title="${a && a.n < 20 ? 'Cohorte pequeña: menos de 20 evaluados' : ''}">${a ? fmt(a.n, 0) + (a.n < 20 ? ' *' : '') : '—'}</strong></div>`;
            })
            .join('')}</div>`
      )
      .join('') +
    '<p class="hint">* Menos de 20 evaluados. — Sin datos en ese año con estos filtros.</p>';
}
function toggleSchool(id) {
  if (state.selected.includes(id)) {
    state.selected = state.selected.filter((x) => x !== id);
  } else {
    if (state.selected.length >= 6) {
      announce(
        'Puedes comparar hasta 6 colegios. Quita uno de los seleccionados para añadir otro.'
      );
      return;
    }
    state.selected.push(id);
  }
  render();
}
function detail(id) {
  const r = result.rows.find((r) => r.id === id);
  if (!r) return;
  const missing = state.years.filter((y) => !r.byYear[y]);
  $('school-detail').innerHTML =
    `<span class="eyebrow">FICHA DEL COLEGIO</span><h2 id="dialog-title">${esc(r.name)}</h2><p>${esc(r.town)} · ${esc(r.department)}</p><div class="stats"><div class="stat"><strong>${fmt(r.score)}</strong><span>con tus pesos /100</span></div><div class="stat"><strong>${fmt(r.total)}</strong><span>TOTAL /500</span></div><div class="stat"><strong>${fmt(r.students, 0)}</strong><span>evaluados acumulados</span></div></div><div class="detail-actions"><button data-add="${r.id}">${state.selected.includes(r.id) ? 'Quitar de la comparación' : 'Añadir a comparación'}</button></div><p>Resultados según los años, el sector y las jornadas de tu búsqueda. ${missing.length ? 'Años sin datos incluidos en esta vista: ' + missing.join(', ') + '.' : 'Datos incluidos en todos los años seleccionados.'} ${r.minStudents < 20 ? 'Alguna cohorte tiene menos de 20 evaluados; considera su tamaño al interpretar el promedio.' : ''}</p><div class="table-wrap detail-table"><table><thead><tr><th>Año</th><th>Evaluados</th>${subjects.map((s) => `<th>${s}</th>`).join('')}<th>Mis pesos</th><th>TOTAL</th></tr></thead><tbody>${data.years
      .map((yr) => {
        const a = r.byYear[yr];
        return `<tr><th>${yr}</th>${a ? `<td>${fmt(a.n, 0)}</td>${a.scores.map((v) => `<td>${fmt(v)}</td>`).join('')}<td>${fmt(a.score)}</td><td>${fmt(a.total)}</td>` : `<td colspan="8">${state.years.includes(yr) ? 'Sin datos con estos filtros' : 'Año no seleccionado'}</td>`}</tr>`;
      })
      .join(
        ''
      )}</tbody></table></div><p>Los promedios anuales combinan las jornadas seleccionadas ponderando por evaluados. El TOTAL es la suma de las cinco materias; no equivale al global oficial del ICFES.</p>`;
  DashboardUI.labelTables($('school-dialog'));
  DashboardUI.openDialog();
}
const rawHeaders = [
  'FILA_EXCEL',
  'INSTITUCION',
  'MUNICIPIO',
  'DEPARTAMENTO',
  'PERIODO',
  'EVALUADOS',
  'PROMLECTURACRITICA',
  'PROMMATEMATICA',
  'PROMSOCIALESYCIUDADANAS',
  'PROMCIENCIASNATURALES',
  'PROMINGLES',
  'TOTAL',
  'NATURALEZA',
  'JORNADA',
  'CALENDARIO',
];
function rawCells(r) {
  const s = schoolMap.get(r.id);
  return [
    r.sourceRow,
    s.name,
    s.town,
    s.department,
    r.year,
    r.n,
    ...r.scores,
    r.scores.reduce((a, b) => a + b, 0),
    r.nature,
    r.session,
    r.calendar,
  ];
}
function renderRaw() {
  $('raw-table').innerHTML =
    `<table><thead><tr>${rawHeaders.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rawRows
      .slice(0, rawLimit)
      .map(
        (r) =>
          `<tr>${rawCells(r)
            .map((c) => `<td>${esc(c)}</td>`)
            .join('')}</tr>`
      )
      .join('')}</tbody></table>`;
  $('raw-count').textContent =
    `Mostrando ${Math.min(rawRows.length, rawLimit)} de ${fmt(rawRows.length, 0)} registros originales. La descarga incluye todos los registros de esta búsqueda.`;
  $('raw-more').hidden = rawLimit >= rawRows.length;
  DashboardUI.labelTables();
}
function download() {
  const cell = (x) => {
    let s = String(x);
    if (typeof x === 'string' && /^[=+@\-\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  };
  const csv =
    '\uFEFF' +
    [rawHeaders, ...rawRows.map(rawCells)].map((row) => row.map(cell).join(';')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })),
    a = document.createElement('a');
  a.href = url;
  a.download = 'colegios_datos_verificados_con_TOTAL.csv';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  announce(`Descarga preparada: ${fmt(rawRows.length, 0)} registros con TOTAL.`);
}
function bind() {
  $('department').onchange = renderPlaces;
  $('browse-places').onchange = renderPlaces;
  $('place-search').oninput = renderPlaces;
  $('next-place-search').onclick = () => {
    $('place-search').value = '';
    renderPlaces();
    $('place-search').focus();
  };
  $('places').onchange = (e) => {
    const id = Number(e.target.dataset.place);
    if (!Number.isInteger(id)) return;
    state.places = e.target.checked
      ? [...new Set([...state.places, id])]
      : state.places.filter((x) => x !== id);
    $('place-count').textContent = `${fmt(state.places.length, 0)} municipios seleccionados`;
    change({ places: state.places });
  };
  $('clear-places').onclick = () => change({ places: [] }, { controls: true });
  $('add-visible').onclick = () =>
    change(
      { places: [...new Set([...state.places, ...shownPlaces().map((p) => p.id)])] },
      { controls: true }
    );
  $('sabana').onclick = () => {
    $('department').value = 'CUNDINAMARCA';
    $('place-search').value = '';
    change({ places: defaults.places }, { controls: true });
  };
  $('national').onclick = () => {
    $('department').value = '';
    $('place-search').value = '';
    change({ places: data.places.map((p) => p.id) }, { controls: true });
  };
  $('reset').onclick = () => {
    minimumError = '';
    DashboardUI.fieldError('minimum', 'minimum-error', '');
    $('department').value = 'CUNDINAMARCA';
    $('place-search').value = '';
    state = DashboardState.defaults([...defaults.places]);
    syncControls();
    page = 0;
    render();
  };
  $('years').onchange = (e) => {
    const yr = Number(e.target.dataset.year);
    change({
      years: e.target.checked
        ? [...new Set([...state.years, yr])].sort()
        : state.years.filter((x) => x !== yr),
    });
  };
  $('complete').onchange = (e) => change({ complete: e.target.checked });
  for (const key of ['nature', 'session', 'aggregation'])
    $(key).onchange = (e) => change({ [key]: e.target.value });
  $('minimum').oninput = (e) => {
    minimumError = DashboardUI.validateMinimum(e.target.value);
    DashboardUI.fieldError(
      'minimum',
      'minimum-error',
      minimumError
        ? `${minimumError} Los resultados conservan el último mínimo válido: ${state.minStudents}.`
        : ''
    );
    if (!minimumError) change({ minStudents: Number(e.target.value) });
    validateFilters();
  };
  $('weights').oninput = (e) => {
    const i = Number(e.target.dataset.weight);
    if (!Number.isInteger(i)) return;
    state.weights[i] = Number(e.target.value);
    renderWeights();
    SchoolJourney.indicator();
    validateFilters();
    clearTimeout(renderTimer);
    renderTimer = setTimeout(() => change({ weights: state.weights }), 80);
  };
  document.querySelectorAll('[data-preset]').forEach(
    (b) =>
      (b.onclick = () =>
        change(
          {
            weights: {
              equal: [20, 20, 20, 20, 20],
              english: [10, 15, 10, 15, 50],
              stem: [15, 35, 10, 30, 10],
            }[b.dataset.preset],
          },
          { controls: true }
        ))
  );
  $('reference').onclick = () => {
    if (!SchoolEngine.normalize(state.weights)) {
      announce('Asigna al menos un peso positivo antes de guardar la referencia.');
      return;
    }
    change({ reference: [...state.weights] });
    announce(
      'Referencia guardada. Ahora cambia los pesos para ver cómo se mueve la clasificación.'
    );
  };
  $('school-search').oninput = (e) => {
    state.search = e.target.value;
    page = 0;
    filtered = result.rows.filter((r) => norm(r.name).includes(norm(state.search)));
    renderRanking();
    announce(`${filtered.length} colegios coinciden con el nombre.`);
    save();
  };
  for (const id of ['metric', 'compare-metric'])
    $(id).onchange = (e) => change({ metric: e.target.value }, { controls: true });
  $('explore-tab').onclick = () => change({ view: 'explore' });
  $('compare-tab').onclick = () => change({ view: 'compare' });
  document.querySelector('[role=tablist]').addEventListener('keydown', (e) => {
    if (e.target.getAttribute('role') !== 'tab') return;
    const names = ['explore', 'compare'];
    const destination = DashboardUI.tabDestination(e.key, names.indexOf(state.view));
    if (destination === undefined) return;
    e.preventDefault();
    change({ view: names[destination] });
    $(names[destination] + '-tab').focus();
  });
  DashboardUI.bindDialog();
  $('top-four').onclick = () => {
    change({ selected: filtered.slice(0, 4).map((r) => r.id), view: 'compare' });
    $('compare-tab').focus();
  };
  $('prev').onclick = () => {
    page--;
    renderRanking();
    announce($('page').textContent);
    if ($('prev').disabled) $('next').focus();
  };
  $('next').onclick = () => {
    page++;
    renderRanking();
    announce($('page').textContent);
    if ($('next').disabled) $('prev').focus();
  };
  document.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.detail !== undefined) detail(Number(b.dataset.detail));
    if (b.dataset.add !== undefined) {
      const id = Number(b.dataset.add);
      toggleSchool(id);
      if ($('school-dialog').open) {
        detail(id);
        $('school-detail').querySelector('[data-add]')?.focus();
      }
    }
    if (b.dataset.remove !== undefined) toggleSchool(Number(b.dataset.remove));
  });
  document.querySelector('.data-detail').ontoggle = (e) => {
    if (e.target.open) renderRaw();
  };
  $('raw-more').onclick = () => {
    rawLimit += 100;
    renderRaw();
    announce($('raw-count').textContent);
    if ($('raw-more').hidden) $('raw-table').focus();
  };
  $('download').onclick = () =>
    DashboardUI.busy($('download'), 'Preparando archivo…', download).catch(() =>
      announce('No se pudo preparar el archivo. Inténtalo de nuevo.')
    );
  $('share').onclick = () =>
    DashboardUI.busy($('share'), 'Copiando enlace…', async () => {
      if (!SchoolEngine.normalize(state.weights)) {
        announce('Asigna al menos un peso positivo antes de compartir.');
        return;
      }
      save();
      try {
        await navigator.clipboard.writeText(location.href);
        announce(
          'Enlace copiado: incluye municipios, años, pesos, referencia y colegios seleccionados.'
        );
      } catch {
        $('school-detail').innerHTML =
          '<h2 id="dialog-title">Comparte tu selección</h2><p>Copia este enlace. Conserva los municipios, años, pesos y colegios elegidos.</p><label for="share-link">Enlace</label><input id="share-link" readonly>';
        $('share-link').value = location.href;
        DashboardUI.openDialog();
        $('share-link').focus();
        $('share-link').select();
      }
    }).finally(validateFilters);
  window.addEventListener('hashchange', () => {
    try {
      state = DashboardState.decode(location.hash, data, defaults);
      syncControls();
      render();
    } catch (e) {
      announce(e.message);
    }
  });
}
async function start() {
  $('loading').hidden = false;
  $('loading').setAttribute('aria-busy', 'true');
  $('load-error').hidden = true;
  announce('Cargando la base verificada.');
  try {
    data = await SchoolData.load();
    schoolMap = new Map(data.schools.map((s) => [s.id, s]));
    placeMap = new Map(data.places.map((p) => [p.id, p]));
    const sabana = data.places
      .filter(
        (p) =>
          p.department === 'CUNDINAMARCA' &&
          ['funza', 'madrid', 'mosquera', 'bojaca'].includes(norm(p.town))
      )
      .map((p) => p.id);
    defaults = DashboardState.defaults(sabana);
    let linkError = '';
    try {
      state = DashboardState.decode(location.hash, data, defaults);
    } catch (e) {
      state = DashboardState.defaults(sabana);
      linkError = e.message + ' Se abrió Sabana de Occidente.';
    }
    $('department').innerHTML =
      '<option value="">Todos los departamentos</option>' +
      [...new Set(data.places.map((p) => p.department))]
        .sort()
        .map((d) => `<option>${esc(d)}</option>`)
        .join('');
    if (state.places.every((id) => placeMap.get(id).department === 'CUNDINAMARCA'))
      $('department').value = 'CUNDINAMARCA';
    $('weights').innerHTML = subjects
      .map(
        (s, i) =>
          `<div class="weight-label"><label for="weight-${i}">${s}</label><output id="percent-${i}" for="weight-${i}"></output></div><input class="weight" id="weight-${i}" data-weight="${i}" type="range" aria-describedby="weights-error" min="0" max="100" step="1" value="20">`
      )
      .join('');
    $('compare-metric').innerHTML = $('metric').innerHTML;
    bind();
    SchoolJourney.initialize(Boolean(location.hash && location.hash !== '#main'));
    ChartLab.initialize();
    syncControls();
    $('app').hidden = false;
    $('share').disabled = false;
    // Steps keep their essential controls expanded at every screen size.
    render();
    if (linkError) announce(linkError);
    $('loading').hidden = true;
    $('loading').setAttribute('aria-busy', 'false');
  } catch (e) {
    $('loading').hidden = true;
    $('loading').setAttribute('aria-busy', 'false');
    $('load-error').hidden = false;
    $('load-error-message').textContent =
      '⚠ ' +
      (e.name === 'TimeoutError'
        ? 'La descarga tardó demasiado. Revisa tu conexión y vuelve a intentarlo.'
        : e.message || 'No se pudo abrir el tablero. Inténtalo de nuevo.');
    announce('No se pudo cargar la base. Puedes reintentar.');
  }
}
$('retry').onclick = () =>
  DashboardUI.busy($('retry'), 'Cargando…', start).then(() => {
    if (!$('app').hidden) $('heading-' + state.journey.step).focus();
    else $('retry').focus();
  });
start();
