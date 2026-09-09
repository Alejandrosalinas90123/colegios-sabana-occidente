/* Guided navigation composes the existing controls and results. It never changes
   ranking formulas; effective territory is always state.places. */
const SchoolJourney = (() => {
  const paths = {
    rank: ['departments', 'places', 'priorities', 'results'],
    compare: ['departments', 'places', 'schools', 'priorities', 'results'],
  };
  const titles = {
    departments: 'Departamentos',
    places: 'Municipios y años',
    schools: 'Colegios',
    priorities: 'Prioridades',
    results: 'Resultados',
  };
  let pickerPage = 0,
    ready = false;
  const route = () => paths[state.journey.mode];
  const included = () =>
    state.selected.map((id) => result.rows.find((row) => row.id === id)).filter(Boolean);
  const inferredDepartments = () => [
    ...new Set(state.places.map((id) => placeMap.get(id).department)),
  ];

  function ensure(shared = false) {
    if (!state.journey)
      state.journey = {
        mode: state.view === 'compare' ? 'compare' : 'rank',
        step: shared ? 'results' : 'departments',
        departments: inferredDepartments(),
        baseline: null,
      };
    state.journey.departments = [
      ...new Set([...state.journey.departments, ...inferredDepartments()]),
    ];
    if (!route().includes(state.journey.step)) state.journey.step = 'priorities';
  }
  function departments() {
    return [...new Set(data.places.map((p) => p.department))].sort();
  }
  function failure(step) {
    if (step === 'departments' && !state.journey.departments.length)
      return 'Selecciona al menos un departamento.';
    if (step === 'places') {
      if (!state.places.length) return 'Marca al menos un municipio para incluirlo en la búsqueda.';
      if (!state.years.length) return 'Elige al menos un año de resultados.';
      if (minimumError) return 'Corrige el mínimo de evaluados antes de continuar.';
    }
    if (step === 'schools' && included().length < 2)
      return 'Elige al menos dos colegios con datos que cumplan tus filtros.';
    if (step === 'priorities' && !SchoolEngine.normalize(state.weights))
      return 'Asigna un peso positivo a alguna materia o elige Equilibrado.';
    return '';
  }
  function go(step) {
    const steps = route(),
      target = steps.indexOf(step);
    if (target < 0) return;
    // Backtracking is always possible. Forward navigation validates prerequisites.
    let problem = '';
    if (target > steps.indexOf(state.journey.step)) {
      for (const prior of steps.slice(0, target)) {
        problem = failure(prior);
        if (problem) {
          step = prior;
          break;
        }
      }
    }
    state.journey.step = step;
    if (step === 'results') state.view = state.journey.mode === 'compare' ? 'compare' : 'explore';
    if (step === 'places') renderPlaces();
    render();
    $('step-error').hidden = !problem;
    $('step-error').textContent = problem ? '⚠ ' + problem : '';
    $('heading-' + step).focus();
    if (problem) announce(problem);
  }
  function renderDepartments() {
    const query = norm($('department-search').value);
    $('departments-list').innerHTML =
      departments()
        .filter((dep) => norm(dep).includes(query))
        .map(
          (dep, i) =>
            `<label class="check"><input type="checkbox" data-department="${esc(dep)}" ${state.journey.departments.includes(dep) ? 'checked' : ''}><span>${esc(dep)}<small>${data.places.filter((p) => p.department === dep).length} municipios disponibles</small></span></label>`
        )
        .join('') || '<p>Sin coincidencias.</p>';
    $('department-count').textContent =
      `${state.journey.departments.length} departamentos elegidos`;
    $('departments-error').hidden = Boolean(state.journey.departments.length);
    $('departments-error').textContent = state.journey.departments.length
      ? ''
      : '⚠ Elige un departamento para continuar.';
  }
  function chosenPlaces() {
    const query = norm($('chosen-place-search').value),
      open = new Set(
        [...$('chosen-places').querySelectorAll('details[open]')].map((el) => el.dataset.group)
      );
    const groups = new Map();
    for (const id of state.places) {
      const p = placeMap.get(id);
      if (!norm(p.town + ' ' + p.department).includes(query)) continue;
      if (!groups.has(p.department)) groups.set(p.department, []);
      groups.get(p.department).push(p);
    }
    $('chosen-places').innerHTML =
      [...groups]
        .sort(([a], [b]) => a.localeCompare(b, 'es'))
        .map(
          ([dep, places]) =>
            `<details data-group="${esc(dep)}" ${state.places.length <= 6 || query || open.has(dep) ? 'open' : ''}><summary>${esc(dep)} · ${places.length} municipios</summary><div class="selected-place-grid">${places
              .sort((a, b) => a.town.localeCompare(b.town, 'es'))
              .map(
                (p) =>
                  `<span class="chip"><span>✓ ${esc(p.town)}</span><button data-remove-place="${p.id}" aria-label="Quitar ${esc(p.town)} de ${esc(dep)} de la búsqueda">×</button></span>`
              )
              .join('')}</div></details>`
        )
        .join('') || '<p>No hay municipios seleccionados que coincidan con esta búsqueda.</p>';
  }
  function summary() {
    const ps = state.places.map((id) => placeMap.get(id)),
      deps = [...new Set(ps.map((p) => p.department))];
    $('journey-summary').textContent =
      `${state.journey.departments.length} departamentos habilitados · ${ps.length} municipios incluidos en ${deps.length} departamentos · ${state.years.length} años · ${state.selected.length} colegios elegidos para comparar.${ps.length && ps.length <= 6 ? ' Municipios incluidos: ' + ps.map((p) => p.town + ' (' + p.department + ')').join(', ') + '.' : ''}`;
    $('chosen-places-title').textContent = `Ver y quitar municipios seleccionados (${ps.length})`;
    chosenPlaces();
    $('inline-places-details').querySelector('summary').textContent =
      `Municipios añadidos (${ps.length})`;
    if (ps.length > 6) $('inline-places-details').open = false;
    $('place-selection-inline').innerHTML =
      ps
        .map(
          (p) =>
            `<span class="chip"><span>✓ ${esc(p.town)} · ${esc(p.department)}</span><button data-remove-place="${p.id}" aria-label="Quitar ${esc(p.town)} de ${esc(p.department)}">×</button></span>`
        )
        .join('') || '<p>Aún no has añadido municipios.</p>';
    $('chosen-schools').innerHTML = state.selected.length
      ? `<p><strong>Colegios elegidos</strong> · ${included().length} cumplen los filtros actuales.</p><div class="selection">${state.selected
          .map((id) => {
            const s = schoolMap.get(id),
              ok = result.rows.some((r) => r.id === id);
            return `<span class="chip ${ok ? '' : 'excluded'}"><span>${esc(s.name)} · ${esc(s.town)}${ok ? '' : ' · fuera de los filtros actuales'}</span><button data-remove="${id}" aria-label="Quitar ${esc(s.name)} de la comparación">×</button></span>`;
          })
          .join('')}</div>`
      : '<p class="hint">Todavía no has elegido colegios para comparar. El ranking incluye todos los que cumplan tus filtros, aunque no los hayas marcado.</p>';
  }
  function picker() {
    const places = new Set(state.places),
      query = norm($('pick-school-search').value),
      eligible = new Map(result.rows.map((r) => [r.id, r]));
    const schools = data.schools
      .filter((s) => places.has(s.place) && norm(s.name + ' ' + s.town).includes(query))
      .sort(
        (a, b) =>
          Number(eligible.has(b.id)) - Number(eligible.has(a.id)) ||
          a.name.localeCompare(b.name, 'es')
      );
    $('picker-selected').innerHTML =
      state.selected
        .map((id) => {
          const s = schoolMap.get(id);
          return `<span class="chip"><span>✓ ${esc(s.name)} · ${esc(s.town)}${eligible.has(id) ? '' : ' · fuera de filtros'}</span><button data-pick="${id}" aria-label="Quitar ${esc(s.name)}">×</button></span>`;
        })
        .join('') || '<p>Aún no has añadido colegios. Búscalos por nombre y pulsa Añadir.</p>';
    pickerPage = Math.max(0, Math.min(pickerPage, Math.ceil(schools.length / 20) - 1));
    $('picker-count').textContent =
      `${schools.length} colegios encontrados · ${included().length} seleccionados con datos suficientes`;
    $('school-picker').innerHTML =
      schools
        .slice(pickerPage * 20, pickerPage * 20 + 20)
        .map((s) => {
          const r = eligible.get(s.id);
          return `<article class="school-option"><div><strong>${esc(s.name)}</strong><p>${esc(s.town)} · ${esc(s.department)}</p><small>${r ? `${r.coverage}/${state.years.length} años · ${fmt(r.students, 0)} evaluados acumulados` : 'No cumple el sector, jornada, años completos o mínimo de evaluados elegidos.'}</small></div><button data-pick="${s.id}" class="${state.selected.includes(s.id) ? 'primary' : ''}" aria-pressed="${state.selected.includes(s.id)}" aria-label="${state.selected.includes(s.id) ? 'Quitar' : 'Añadir'} ${esc(s.name)}" ${!r && !state.selected.includes(s.id) ? 'disabled' : ''}>${state.selected.includes(s.id) ? '✓ Elegido' : r ? 'Añadir' : 'Fuera de filtros'}</button></article>`;
        })
        .join('') ||
      '<p class="empty">No hay coincidencias. Cambia el nombre o vuelve al paso de municipios.</p>';
    $('picker-page').textContent =
      `${schools.length ? pickerPage * 20 + 1 : 0}–${Math.min(schools.length, pickerPage * 20 + 20)} de ${schools.length}`;
    $('picker-prev').disabled = pickerPage === 0;
    $('picker-next').disabled = (pickerPage + 1) * 20 >= schools.length;
    $('schools-error').hidden = included().length >= 2;
    $('schools-error').textContent =
      included().length < 2 ? 'Elige al menos dos colegios para comparar sus resultados.' : '';
  }
  function indicator() {
    const w = SchoolEngine.normalize(state.weights);
    const content = w
      ? `<h3>Así se construye tu indicador</h3><div class="weight-breakdown">${subjects.map((name, i) => `<span><strong>${fmt(w[i] * 100, 1)} %</strong> ${name}</span>`).join('')}</div><p class="hint">Indicador /100 = suma de cada promedio por su porcentaje. Los pesos se dividen entre su suma: 40 y 20 significan el doble de importancia. Los porcentajes mostrados están redondeados; el cálculo usa los valores exactos.</p><p>${state.aggregation === 'equal' ? 'Cada año disponible pesa lo mismo.' : 'Los años pesan según el número de evaluados.'} Se ordenan todos los colegios que cumplen los filtros de tus ${state.places.length} municipios; no solo los elegidos para comparar.</p>`
      : '<p class="field-error">Asigna al menos un peso positivo para construir el indicador.</p>';
    $('indicator-preview').innerHTML = content;
    $('results-indicator').innerHTML = content;
    for (let i = 0; i < 5; i++) {
      const match = [0, 10, 20, 30, 40].indexOf(state.weights[i]);
      $('importance-' + i).value = match >= 0 ? String(match) : 'custom';
    }
  }
  function describeSubjects() {
    for (let i = 0; i < 5; i++) {
      const input = $('weight-' + i),
        label = input.previousElementSibling,
        card = document.createElement('article');
      card.className = 'subject-card';
      const item = SubjectGuide.items[i];
      card.innerHTML = `<h3>${item.name}</h3><details><summary>¿Qué evalúa ${item.name}?</summary><p>${item.description}</p></details><label for="importance-${i}">${item.question}</label><select id="importance-${i}" data-importance="${i}"><option value="custom" disabled>Pesos personalizados</option>${SubjectGuide.labels.map((label, j) => `<option value="${j}">${label}</option>`).join('')}</select><p class="hint">O ajusta directamente el peso relativo (0–100):</p>`;
      label.before(card);
      card.append(label, input);
      label.querySelector('label').textContent = 'Peso de ' + item.name;
    }
  }
  function comparisons() {
    const rows = included();
    if (!rows.some((row) => row.id === state.journey.baseline))
      state.journey.baseline = rows[0]?.id ?? null;
    $('baseline-school').innerHTML = rows
      .map((row) => `<option value="${row.id}">${esc(row.name)} · ${esc(row.town)}</option>`)
      .join('');
    $('baseline-school').value = String(state.journey.baseline);
    const comparisons = SchoolComparisons.against(
      rows,
      state.journey.baseline,
      state.years,
      state.metric
    );
    const magnitude = Math.max(1, ...comparisons.map((row) => Math.abs(row.gap ?? 0)));
    $('pair-chart').innerHTML =
      comparisons
        .map(
          (row) =>
            `<div class="gap-row"><span>${esc(row.name)}</span><div class="gap-track" aria-hidden="true"><span style="left:${row.gap >= 0 ? 50 : 50 + (row.gap / magnitude) * 50}%;width:${(Math.abs(row.gap ?? 0) / magnitude) * 50}%;background:${row.gap >= 0 ? '#174f42' : '#922315'}"></span></div><strong>${row.gap === null ? 'Sin años comunes' : (row.gap > 0 ? '+' : '') + fmt(row.gap)}</strong></div>`
        )
        .join('') || '<p>Selecciona al menos dos colegios para ver diferencias.</p>';
    $('pair-table').innerHTML =
      `<table><caption>Diferencias frente al colegio de referencia · ${esc(metricName())}</caption><thead><tr><th>Colegio</th><th>Años comunes</th><th>Diferencia media / ${state.metric === 'total' ? 500 : 100}</th><th>Años por encima</th><th>Empates</th></tr></thead><tbody>${comparisons.map((row) => `<tr><th>${esc(row.name)}</th><td>${row.common.join(', ') || 'Ninguno'}</td><td>${row.gap === null ? 'No calculable' : (row.gap > 0 ? '+' : '') + fmt(row.gap)}</td><td>${row.wins}/${row.common.length}</td><td>${row.ties}</td></tr>`).join('')}</tbody></table>`;
    const contexts = SchoolComparisons.context(result.rows, state.metric).sort(
      (a, b) => b.median - a.median
    );
    $('municipality-context').innerHTML =
      `<table><caption>${esc(metricName())} · mediana entre colegios elegibles</caption><thead><tr><th>Municipio</th><th>Colegios</th><th>Mediana</th><th>Evaluados acumulados</th></tr></thead><tbody>${contexts.map((row) => `<tr><th>${esc(row.town)} · ${esc(row.department)}</th><td>${row.schools}</td><td>${fmt(row.median)}</td><td>${fmt(row.students, 0)}</td></tr>`).join('')}</tbody></table>`;
  }
  function refresh() {
    if (!ready) return;
    ensure();
    const steps = route(),
      step = state.journey.step,
      index = steps.indexOf(step);
    for (const name of ['departments', 'places', 'schools', 'priorities'])
      $('step-' + name).hidden = name !== step;
    $('main').hidden = step !== 'results';
    $('journey-nav').innerHTML = steps
      .map(
        (name, i) =>
          `<button data-goto="${name}" ${name === step ? 'aria-current="step"' : ''}><span>${i + 1}</span> ${titles[name]}</button>`
      )
      .join('');
    document
      .querySelectorAll('[data-route]')
      .forEach((button) =>
        button.setAttribute('aria-pressed', String(button.dataset.route === state.journey.mode))
      );
    $('step-position').textContent = `Paso ${index + 1} de ${steps.length}`;
    $('journey-back').disabled = index === 0;
    $('journey-next').hidden = step === 'results';
    $('journey-next').textContent =
      steps[index + 1] === 'results' ? 'Ver mis resultados →' : 'Continuar →';
    $('step-error').hidden = true;
    renderDepartments();
    summary();
    picker();
    indicator();
    comparisons();
  }
  function initialize(shared) {
    ensure(shared);
    describeSubjects();
    ready = true;
    const skip = document.querySelector('.skip');
    skip.textContent = 'Ir al paso actual';
    skip.onclick = (event) => {
      event.preventDefault();
      $('heading-' + state.journey.step).focus();
    };
    $('journey-next').onclick = () => go(route()[route().indexOf(state.journey.step) + 1]);
    $('journey-back').onclick = () => go(route()[route().indexOf(state.journey.step) - 1]);
    $('journey-reset').onclick = () => {
      $('reset').click();
      $('heading-departments').focus();
    };
    $('department-search').oninput = () => {
      $('department-options').open = Boolean($('department-search').value);
      renderDepartments();
    };
    $('chosen-place-search').oninput = chosenPlaces;
    $('next-school-search').onclick = () => {
      $('pick-school-search').value = '';
      $('school-options').open = false;
      pickerPage = 0;
      picker();
      $('pick-school-search').focus();
    };
    $('pick-school-search').oninput = () => {
      $('school-options').open = Boolean($('pick-school-search').value);
      pickerPage = 0;
      picker();
    };
    $('picker-prev').onclick = () => {
      pickerPage--;
      picker();
      if ($('picker-prev').disabled) $('picker-next').focus();
    };
    $('picker-next').onclick = () => {
      pickerPage++;
      picker();
      if ($('picker-next').disabled) $('picker-prev').focus();
    };
    $('all-departments').onclick = () =>
      change({ journey: { ...state.journey, departments: departments() } }, { controls: true });
    $('departments-list').onchange = (e) => {
      const dep = e.target.dataset.department;
      if (!dep) return;
      const chosen = e.target.checked
        ? [...new Set([...state.journey.departments, dep])]
        : state.journey.departments.filter((d) => d !== dep);
      const places = state.places.filter((id) => chosen.includes(placeMap.get(id).department)),
        removed = state.places.length - places.length;
      change({ places, journey: { ...state.journey, departments: chosen } }, { controls: true });
      if (removed)
        announce(
          `Se quitaron ${removed} municipios al desmarcar ${dep}. Revisa el resumen de selección.`
        );
    };
    for (const [id, places] of [
      ['sabana', defaults.places],
      ['national', data.places.map((p) => p.id)],
    ])
      $(id).onclick = () => {
        $('department').value = '';
        $('place-search').value = '';
        change(
          {
            places: [...places],
            journey: {
              ...state.journey,
              departments: [...new Set(places.map((id) => placeMap.get(id).department))],
              step: 'places',
            },
          },
          { controls: true }
        );
        $('heading-places').focus();
      };
    $('choose-more-schools').onclick = () => {
      state.journey.mode = 'compare';
      go('schools');
    };
    $('baseline-school').onchange = (e) => {
      state.journey.baseline = Number(e.target.value);
      render();
    };
    document.addEventListener('change', (e) => {
      if (e.target.dataset.importance === undefined) return;
      const weights = [...state.weights];
      weights[Number(e.target.dataset.importance)] = Number(e.target.value) * 10;
      change({ weights }, { controls: true });
    });
    document.addEventListener('click', (e) => {
      const button = e.target.closest('button');
      if (!button) return;
      if (button.dataset.openPicker !== undefined) {
        state.journey.mode = 'compare';
        go('schools');
      }
      if (button.dataset.goto) go(button.dataset.goto);
      if (button.dataset.route) {
        const next = { ...state.journey, mode: button.dataset.route };
        if (!paths[next.mode].includes(next.step)) next.step = 'priorities';
        change({ journey: next });
        if (next.mode === 'compare') go('schools');
      }
      if (button.dataset.removePlace !== undefined) {
        const id = Number(button.dataset.removePlace);
        change({ places: state.places.filter((p) => p !== id) }, { controls: true });
      }
      if (button.dataset.pick !== undefined) toggleSchool(Number(button.dataset.pick));
    });
  }
  return { initialize, refresh, go, indicator, ensure };
})();
