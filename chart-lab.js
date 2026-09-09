/* Native SVG charts plus equivalent HTML controls/tables. Charts never own data
   filters: all values come from the current verified SchoolEngine result. */
const ChartLab = (() => {
  let W = 900;
  const H = 320,
    L = 48,
    R = 32,
    T = 40,
    B = 64;
  let mounted = false,
    lastRows = [],
    lastYears = [];
  const options = () => state.chartOptions;
  const name = (metric) => (metric === 'mean' ? 'Promedio general' : metricName(metric));
  const color = (id) => colors[Math.max(0, state.selected.indexOf(id)) % colors.length];
  const seriesClass = (id) =>
    options().highlight !== null && options().highlight !== id
      ? 'chart-series muted'
      : 'chart-series';
  const tick = (v) => fmt(v, Number.isInteger(v) ? 0 : 1);
  const panels = [
    'annual',
    'year',
    'change',
    'scatter',
    'sensitivity',
    'trend',
    'subjects',
    'cohorts',
    'pairs',
  ];
  const domain = (values, max = 100) => ChartStats.domain(values, max, options().scale === 'full');
  function ensure() {
    if (!state.chartOptions)
      state.chartOptions = {
        metric: 'mean',
        year: state.years.at(-1) ?? 2025,
        from: state.years[0] ?? 2021,
        to: state.years.at(-1) ?? 2025,
        strength: 100,
        highlight: null,
      };
    const o = options();
    if (!panels.includes(o.panel)) o.panel = 'annual';
    if (!['focused', 'full'].includes(o.scale)) o.scale = 'focused';
    if (!state.years.includes(o.year)) o.year = state.years.at(-1) ?? 2025;
    if (!state.years.includes(o.from)) o.from = state.years[0] ?? 2021;
    if (!state.years.includes(o.to)) o.to = state.years.at(-1) ?? 2025;
    if (!state.selected.includes(o.highlight)) o.highlight = null;
  }
  function scales(xMin, xMax, yMin, yMax) {
    return {
      x: (v) => (xMax === xMin ? (L + W - R) / 2 : L + ((v - xMin) / (xMax - xMin)) * (W - L - R)),
      y: (v) =>
        yMax === yMin ? (T + H - B) / 2 : H - B - ((v - yMin) / (yMax - yMin)) * (H - T - B),
    };
  }
  function axes(xTicks, yTicks, scale, xTitle, yTitle) {
    return (
      `<svg class="lab-svg" viewBox="0 0 ${W} ${H}" aria-hidden="true"><text x="${L}" y="20" font-size="14" fill="#173a35">${esc(yTitle)}</text>` +
      yTicks
        .map(
          (v) =>
            `<line x1="${L}" x2="${W - R}" y1="${scale.y(v)}" y2="${scale.y(v)}" stroke="#ccd7cc"/><text x="${L - 12}" y="${scale.y(v) + 6}" text-anchor="end" font-size="14" fill="#455b53">${tick(v)}</text>`
        )
        .join('') +
      xTicks
        .map(
          (v) =>
            `<text x="${scale.x(v)}" y="${H - B + 28}" text-anchor="middle" font-size="14" fill="#455b53">${xTitle === 'Año' ? String(v) : tick(v)}</text>`
        )
        .join('') +
      `<text x="${(L + W - R) / 2}" y="${H - 8}" text-anchor="middle" font-size="14" fill="#173a35">${esc(xTitle)}</text>`
    );
  }
  function point(id, year, x, y, label, index) {
    return `<g class="${seriesClass(id)}" data-series="${id}"><circle cx="${x}" cy="${y}" r="9" fill="${color(id)}" stroke="white" stroke-width="2"/>${index !== undefined ? `<text x="${x + 12}" y="${y + 6}" font-size="14" fill="#173a35">${index + 1}</text>` : ''}<circle cx="${x}" cy="${y}" r="30" fill="transparent" pointer-events="${options().highlight === null || options().highlight === id ? 'all' : 'none'}" data-chart-point="${id}" data-chart-year="${year}" data-chart-label="${esc(label)}"><title>${esc(label)}</title></circle></g>`;
  }
  function table(headers, rows, caption) {
    return `<table><caption>${esc(caption)}</caption><thead><tr>${headers.map((s) => `<th>${esc(s)}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((value, i) => `<${i ? 'td' : 'th'}>${esc(value)}</${i ? 'td' : 'th'}>`).join('')}</tr>`).join('')}</tbody></table>`;
  }
  function inspect(id, year) {
    options().highlight = id;
    options().year = year;
    render();
    save();
  }
  function readout() {
    const o = options(),
      row = lastRows.find((row) => row.id === o.highlight),
      annual = row?.byYear[o.year];
    $('chart-point-readout').textContent = row
      ? annual
        ? `${row.name} · ${o.year}: promedio general ${fmt(ChartStats.mean(annual))}/100; con tus pesos ${fmt(annual.score)}/100; ${fmt(annual.n, 0)} evaluados.`
        : `${row.name}: sin datos en ${o.year} con los filtros actuales.`
      : 'Se muestran todos los colegios elegibles seleccionados. Resalta uno o pulsa un punto para consultar el detalle.';
  }
  function annualMean() {
    const years = lastYears,
      s = ChartStats.annual(lastRows, years),
      bounds = domain(s.flatMap((series) => series.points.map((p) => p.value))),
      scale = scales(years[0], years.at(-1), bounds.min, bounds.max);
    let svg = axes(years, bounds.ticks, scale, 'Año', 'Promedio general /100');
    for (const [index, series] of s.entries()) {
      let prev = null;
      for (const p of series.points) {
        if (p.value === null) {
          prev = null;
          continue;
        }
        if (prev && p.year - prev.year === 1)
          svg += `<line class="${seriesClass(series.id)}" x1="${scale.x(prev.year)}" y1="${scale.y(prev.value)}" x2="${scale.x(p.year)}" y2="${scale.y(p.value)}" stroke="${color(series.id)}" stroke-width="3" stroke-dasharray="${['none', '8 4', '3 3', '12 4 3 4', '2 5', '14 6'][index]}"/>`;
        svg += point(
          series.id,
          p.year,
          scale.x(p.year),
          scale.y(p.value),
          `${series.name}, ${p.year}: ${fmt(p.value)} /100; ${p.n} evaluados`
        );
        prev = p;
      }
    }
    $('mean-chart').innerHTML = svg + '</svg>';
    const legend = lastRows
      .map(
        (row, i) =>
          `<button data-chart-school="${row.id}" aria-pressed="${options().highlight === row.id}"><i class="dot" style="background:${color(row.id)}"></i><span>${i + 1}. ${esc(row.name)} · ${esc(row.town)}</span></button>`
      )
      .join('');
    $('mean-legend').innerHTML = legend;
    document.querySelectorAll('[data-local-legend]').forEach((el) => (el.innerHTML = legend));
    $('mean-table').innerHTML = table(
      ['Colegio', ...years],
      s.map((series) => [
        series.name,
        ...series.points.map((p) =>
          p.value === null ? 'Sin datos' : `${fmt(p.value)} · ${fmt(p.n, 0)} evaluados`
        ),
      ]),
      'Promedio simple de cinco materias por año /100'
    );
  }
  function changeChart() {
    const o = options(),
      valid = o.to > o.from,
      metric = o.metric,
      max = metric === 'total' ? 500 : 100;
    $('change-description').textContent = valid
      ? `${name(metric)}: ${o.from} → ${o.to}. Círculo abierto: inicio; círculo lleno: final. Cambio en puntos, no en porcentaje.`
      : 'Elige dos años distintos y coloca el año más antiguo en Desde.';
    const points = ChartStats.endpoints(lastRows, o.from, o.to, metric);
    const bounds = domain(
      points.flatMap((p) => [p.from, p.to]),
      max
    );
    const height = Math.max(160, lastRows.length * 72 + 70),
      x = (v) => L + ((v - bounds.min) / (bounds.max - bounds.min)) * (W - L - R);
    let svg = `<svg class="lab-svg" viewBox="0 0 ${W} ${height}" aria-hidden="true">`;
    for (const v of bounds.ticks)
      svg += `<line x1="${x(v)}" x2="${x(v)}" y1="20" y2="${height - 40}" stroke="#ccd7cc"/><text x="${x(v)}" y="${height - 12}" text-anchor="middle" font-size="14">${tick(v)}</text>`;
    points.forEach((p, i) => {
      const y = 42 + i * 72;
      svg += `<text x="30" y="${y + 6}" font-size="14">${i + 1}</text>`;
      if (!valid || p.change === null) {
        svg += `<text x="${L}" y="${y + 6}" font-size="14">${valid ? 'Falta alguno de los años' : 'Selecciona un intervalo válido'}</text>`;
        return;
      }
      svg += `<g class="${seriesClass(p.id)}"><line x1="${x(p.from)}" x2="${x(p.to)}" y1="${y}" y2="${y}" stroke="${color(p.id)}" stroke-width="4"/><circle cx="${x(p.from)}" cy="${y}" r="10" stroke="${color(p.id)}" stroke-width="3" fill="white"/></g>`;
      svg += point(
        p.id,
        o.to,
        x(p.to),
        y,
        `${p.name}: ${fmt(p.from)} en ${o.from}; ${fmt(p.to)} en ${o.to}; cambio ${fmt(p.change)} puntos`
      );
    });
    $('change-chart').innerHTML = valid
      ? svg + '</svg>'
      : '<p class="empty">Se necesitan dos años distintos para calcular el cambio.</p>';
    $('change-table').innerHTML = table(
      ['Colegio', String(o.from), String(o.to), 'Cambio (puntos)', 'Evaluados: inicio → final'],
      points.map((p, i) => [
        `${i + 1}. ${p.name}`,
        fmt(p.from),
        fmt(p.to),
        valid && p.change !== null ? (p.change > 0 ? '+' : '') + fmt(p.change) : 'No calculable',
        `${fmt(p.nFrom, 0)} → ${fmt(p.nTo, 0)}`,
      ]),
      name(metric)
    );
  }
  function scatter() {
    const o = options(),
      rows = lastRows.filter((row) => row.byYear[o.year]),
      maxN = Math.max(1, ...rows.map((row) => row.byYear[o.year].n)),
      metric = o.metric,
      max = metric === 'total' ? 500 : 100;
    const xMax = Math.max(20, Math.ceil(maxN / 20) * 20),
      bounds = domain(
        rows.map((row) => ChartStats.value(row.byYear[o.year], metric)),
        max
      ),
      scale = scales(0, xMax, bounds.min, bounds.max);
    let svg = axes(
      [0, xMax / 4, xMax / 2, xMax * 0.75, xMax],
      bounds.ticks,
      scale,
      'Evaluados en el año',
      `${name(metric)} /${max}`
    );
    rows.forEach((row) => {
      const a = row.byYear[o.year],
        index = lastRows.findIndex((r) => r.id === row.id);
      svg += point(
        row.id,
        o.year,
        scale.x(a.n),
        scale.y(ChartStats.value(a, metric)),
        `${row.name} · ${o.year}: ${fmt(ChartStats.value(a, metric))}; ${a.n} evaluados`,
        index
      );
    });
    $('cohort-scatter').innerHTML = rows.length
      ? svg + '</svg>'
      : '<p class="empty">No hay datos para este año.</p>';
    $('scatter-table').innerHTML = table(
      ['Colegio', 'Año', name(metric), 'Evaluados'],
      lastRows.map((row, i) => {
        const a = row.byYear[o.year];
        return [
          `${i + 1}. ${row.name}`,
          o.year,
          a ? fmt(ChartStats.value(a, metric)) : 'Sin datos',
          a ? fmt(a.n, 0) : 'Sin datos',
        ];
      }),
      `Cohortes de ${o.year}`
    );
  }
  function sensitivity() {
    const o = options(),
      series = ChartStats.sensitivity(result.rows, lastRows, state.weights),
      current = new Map(
        ChartStats.ranked(result.rows, state.weights, o.strength).map((row) => [row.id, row])
      );
    const ranks = [
        ...series.flatMap((s) => s.points.map((p) => p.rank)),
        ...lastRows.map((row) => current.get(row.id).rank),
      ],
      min = Math.min(...ranks),
      max = Math.max(...ranks),
      lo = min,
      hi = max === min ? max + 1 : max;
    const scale = scales(0, 100, hi, lo),
      ticks = [...new Set([lo, Math.round((lo + hi) / 2), hi])];
    let svg = axes(
      [0, 25, 50, 75, 100],
      ticks,
      scale,
      'Tus prioridades (%)',
      'Posición · menor es mejor'
    );
    series.forEach((s) => {
      s.points.forEach((p, i) => {
        if (i) {
          const before = s.points[i - 1];
          svg += `<line class="${seriesClass(s.id)}" x1="${scale.x(before.strength)}" y1="${scale.y(before.rank)}" x2="${scale.x(p.strength)}" y2="${scale.y(p.rank)}" stroke="${color(s.id)}" stroke-width="3"/>`;
        }
        svg += `<circle class="${seriesClass(s.id)}" cx="${scale.x(p.strength)}" cy="${scale.y(p.rank)}" r="6" fill="${color(s.id)}"><title>${esc(s.name)}: posición ${p.rank} al ${p.strength}%</title></circle>`;
      });
    });
    svg += `<line x1="${scale.x(o.strength)}" x2="${scale.x(o.strength)}" y1="${T}" y2="${H - B}" stroke="#173a35" stroke-dasharray="4 4"/>`;
    for (const row of lastRows)
      svg += `<circle class="${seriesClass(row.id)}" cx="${scale.x(o.strength)}" cy="${scale.y(current.get(row.id).rank)}" r="10" fill="white" stroke="${color(row.id)}" stroke-width="3"><title>${esc(row.name)}: posición exacta ${current.get(row.id).rank} al ${o.strength}%</title></circle>`;
    $('sensitivity-chart').innerHTML = svg + '</svg>';
    $('scenario-percent').textContent = `${o.strength} %`;
    $('scenario-strength').setAttribute(
      'aria-valuetext',
      `${o.strength} por ciento hacia tus prioridades`
    );
    const weights = ChartStats.blend(state.weights, o.strength);
    $('scenario-weights').innerHTML = weights
      .map((w, i) => `<span><strong>${fmt(w * 100, 1)} %</strong>${subjects[i]}</span>`)
      .join('');
    $('sensitivity-table').innerHTML = table(
      [
        'Colegio',
        'Iguales: posición',
        'Escenario explorado: posición',
        'Escenario: puntaje /100',
        'Tus pesos: posición',
      ],
      series.map((s) => [
        s.name,
        s.points[0].rank,
        current.get(s.id).rank,
        fmt(current.get(s.id).score),
        s.points.at(-1).rank,
      ]),
      `Escenario al ${o.strength}% · ${result.rows.length} colegios elegibles`
    );
    const equal = state.weights.every((w) => Math.abs(w - state.weights[0]) < 1e-9);
    $('sensitivity-description').textContent =
      `Las posiciones se calculan entre los ${result.rows.length} colegios elegibles de los municipios elegidos, no solo entre los seleccionados. El eje vertical abarca las posiciones observadas de estos colegios. Las líneas solo unen cinco escenarios muestreados: no se deben interpolar posiciones. Los círculos grandes y la tabla muestran el escenario exacto del control. ${equal ? 'Tus pesos ya son iguales: modifica las prioridades para explorar cambios.' : 'La estabilidad en este recorrido no garantiza estabilidad ante otras combinaciones de pesos.'}`;
  }
  function quality() {
    const q = ChartStats.quality(lastRows, rawRows, state.selected, lastYears);
    $('chart-quality').innerHTML =
      `<h3>Antes de interpretar las gráficas</h3><ul><li>${lastRows.length} colegios elegibles representados; ${q.excluded} seleccionados fuera de los filtros.</li><li>${q.missing} combinaciones colegio/año sin datos; no se rellenan.</li><li>${q.smallAnnual} cohortes anuales de menos de 20 evaluados. Sus promedios pueden variar más; no se penalizan automáticamente.</li><li>${q.reportedZeroRows} de ${q.rawRows} registros fuente de los colegios seleccionados contienen algún puntaje cero. Se conservan como fueron publicados; un cero no se trata automáticamente como dato ausente.</li></ul><p class="hint">Estos resultados describen cohortes, no el progreso de los mismos estudiantes. No prueban causalidad ni diferencias estadísticamente significativas.</p>`;
  }
  function render() {
    if (!mounted) return;
    ensure();
    $('chart-lab').hidden = state.view !== 'compare';
    if (state.view !== 'compare') return;
    lastRows = state.selected.map((id) => result.rows.find((row) => row.id === id)).filter(Boolean);
    lastYears = [...state.years].sort();
    if (!lastRows.some((row) => row.id === options().highlight)) options().highlight = null;
    W = Math.min(900, Math.max(240, ($('compare-view').clientWidth || 900) - 32));
    quality();
    $('chart-empty').hidden = lastRows.length > 0;
    $('chart-panels').hidden = !lastRows.length;
    if (!lastRows.length || !lastYears.length) return;
    $('chart-highlight').innerHTML =
      '<option value="">Todos los colegios</option>' +
      lastRows.map((row) => `<option value="${row.id}">${esc(row.name)}</option>`).join('');
    $('chart-highlight').value = options().highlight === null ? '' : String(options().highlight);
    for (const [id, key] of [
      ['chart-inspect-year', 'year'],
      ['lab-year', 'year'],
      ['lab-from', 'from'],
      ['lab-to', 'to'],
    ]) {
      $(id).innerHTML = lastYears
        .map((year) => `<option value="${year}">${year}</option>`)
        .join('');
      $(id).value = options()[key];
    }
    $('lab-metric').value = options().metric;
    $('scenario-strength').value = options().strength;
    $('comparison-year').innerHTML = lastYears
      .map((y) => `<option value="${y}">${y}</option>`)
      .join('');
    $('comparison-year').value = options().year;
    const yearRows = lastRows.map((row) => ({ row, a: row.byYear[options().year] }));
    $('single-year-bars').innerHTML = yearRows
      .map(
        ({ row, a }) =>
          `<div class="bar-row"><span>${esc(row.name)}</span><div class="bar-track" aria-hidden="true"><div class="bar-fill" style="background:${color(row.id)};width:${a ? ChartStats.value(a, options().metric) / (options().metric === 'total' ? 5 : 1) : 0}%"></div></div><strong>${a ? fmt(ChartStats.value(a, options().metric)) : 'Sin datos'}</strong></div>`
      )
      .join('');
    $('single-year-table').innerHTML = table(
      ['Colegio', ...subjects, 'Mis pesos', 'Evaluados'],
      yearRows.map(({ row, a }) => [
        row.name,
        ...subjects.map((_, i) => (a ? fmt(a.scores[i]) : 'Sin datos')),
        a ? fmt(a.score) : 'Sin datos',
        a ? fmt(a.n, 0) : 'Sin datos',
      ]),
      `Resultados de ${options().year}`
    );
    annualMean();
    changeChart();
    scatter();
    sensitivity();
    readout();
    $('chart-point-readout').hidden = options().highlight === null;
    showPanel();
    DashboardUI.labelTables($('chart-lab'));
  }
  function showPanel() {
    const panel = options().panel;
    $('comparison-question').value = panel;
    $('chart-scale').value = options().scale;
    document
      .querySelectorAll('[data-comparison-panel]')
      .forEach((el) => (el.hidden = el.dataset.comparisonPanel !== panel));
    $('compare-metric').closest('label').hidden = !['trend', 'pairs'].includes(panel);
    $('lab-metric-control').hidden = !['change', 'scatter', 'year'].includes(panel);
    $('chart-scale').parentElement.querySelector('label[for="chart-scale"]').hidden = ![
      'annual',
      'change',
      'scatter',
      'trend',
    ].includes(panel);
    $('chart-scale').hidden = !['annual', 'change', 'scatter', 'trend'].includes(panel);
    $('chart-scale').closest('details').hidden = $('chart-scale').hidden;
    $('scale-note').hidden = $('chart-scale').hidden;
    $('scale-note').textContent =
      options().scale === 'full'
        ? 'Escala completa del puntaje.'
        : 'Escala ajustada a los valores observados: el eje puede no empezar en cero.';
    $('comparison-content').hidden =
      !lastRows.length || !['trend', 'subjects', 'cohorts', 'pairs'].includes(panel);
  }
  function initialize() {
    ensure();
    mounted = true;
    $('comparison-question').insertAdjacentHTML(
      'beforeend',
      '<option value="year">Comparar en un solo año</option>'
    );
    $('chart-panels').insertAdjacentHTML(
      'beforeend',
      '<section class="card" data-comparison-panel="year" hidden><h3>Mis colegios en un año</h3><label for="comparison-year">Año</label><select id="comparison-year"></select><div id="single-year-bars" class="ranking-chart"></div><details><summary>Ver todas las materias y evaluados</summary><div id="single-year-table" class="table-wrap"></div></details></section>'
    );
    $('comparison-year').onchange = (e) => {
      options().year = Number(e.target.value);
      render();
      save();
    };
    for (const [id, key] of [
      ['comparison-question', 'panel'],
      ['chart-scale', 'scale'],
    ])
      $(id).onchange = (e) => {
        options()[key] = e.target.value;
        renderComparison();
        render();
        save();
      };
    let resizing;
    window.addEventListener('resize', () => {
      clearTimeout(resizing);
      resizing = setTimeout(() => {
        if (state.view === 'compare') {
          renderComparison();
          render();
        }
      }, 100);
    });
    for (const [id, key] of [
      ['chart-inspect-year', 'year'],
      ['lab-year', 'year'],
      ['lab-from', 'from'],
      ['lab-to', 'to'],
      ['lab-metric', 'metric'],
      ['chart-highlight', 'highlight'],
    ])
      $(id).onchange = (e) => {
        options()[key] =
          key === 'metric'
            ? e.target.value
            : key === 'highlight' && e.target.value === ''
              ? null
              : Number(e.target.value);
        render();
        save();
      };
    $('scenario-strength').oninput = (e) => {
      options().strength = Number(e.target.value);
      sensitivity();
      save();
    };
    $('apply-chart-scenario').onclick = () => {
      const weights = ChartStats.blend(state.weights, options().strength).map((w) => w * 100);
      options().strength = 100;
      change({ weights }, { controls: true });
      announce(
        'Escenario aplicado: el ranking y las comparaciones con pesos se actualizaron. El promedio general anual permanece sin pesos.'
      );
    };
    // Supplemental pointer interaction; selects and HTML tables expose the same
    // values without relying on SVG hit areas or hover-only information.
    $('chart-lab').addEventListener('click', (e) => {
      const legend = e.target.closest('[data-chart-school]');
      if (legend) {
        const id = Number(legend.dataset.chartSchool);
        options().highlight = options().highlight === id ? null : id;
        render();
        save();
        document
          .querySelector(`[data-comparison-panel="${options().panel}"] [data-chart-school="${id}"]`)
          ?.focus({ preventScroll: true });
      }
      const p = e.target.closest('[data-chart-point]');
      if (p) inspect(Number(p.dataset.chartPoint), Number(p.dataset.chartYear));
      const jump = e.target.closest('[data-chart-goto]');
      if (jump) $(jump.dataset.chartGoto).focus();
    });
    $('chart-lab').addEventListener('pointerover', (e) => {
      const p = e.target.closest('[data-chart-label]');
      if (p) $('chart-point-readout').textContent = p.dataset.chartLabel;
    });
  }
  return { initialize, render };
})();
