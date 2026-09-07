/* A short entry path using the same verified engine as the advanced dashboard. */
const FamilyGuide = (() => {
  let ready = false;
  function towns() {
    const q = norm($('family-town-search').value.trim());
    const matches =
      q.length >= 2 ? data.places.filter((p) => norm(p.town + ' ' + p.department).includes(q)) : [];
    $('family-town-options').innerHTML = matches
      .slice(0, 8)
      .map(
        (p) =>
          `<button data-family-town="${p.id}"><strong>${esc(p.town)}</strong> · ${esc(p.department)}</button>`
      )
      .join('');
    $('family-town-help').textContent =
      q.length < 2
        ? 'Escribe al menos dos letras. Después pulsa tu municipio.'
        : matches.length > 8
          ? 'Hay más coincidencias. Escribe un poco más para encontrar tu municipio.'
          : matches.length
            ? 'Elige el municipio y revisa su departamento.'
            : 'No encontramos ese nombre. Prueba sin abreviaturas.';
  }
  function schools() {
    const q = norm($('family-school-search').value.trim());
    const matches = q.length >= 2 ? result.rows.filter((r) => norm(r.name).includes(q)) : [];
    $('family-school-options').innerHTML = matches
      .slice(0, 8)
      .map(
        (r) =>
          `<button data-family-school="${r.id}"><strong>${esc(r.name)}</strong><span>${esc(r.town)} · ${esc(r.department)}</span><span>Comparar con el mayor promedio de los municipios elegidos →</span></button>`
      )
      .join('');
    $('family-school-help').textContent =
      q.length < 2
        ? 'Escribe parte del nombre y pulsa el colegio.'
        : matches.length > 8
          ? 'Hay más coincidencias. Completa un poco el nombre.'
          : matches.length
            ? 'Elige el nombre que corresponda a tu colegio.'
            : 'No aparece con estos criterios. Revisa el nombre o permite años incompletos abajo.';
  }
  let pendingPlaces = [];
  function chosenTowns() {
    $('family-chosen-towns').innerHTML = pendingPlaces
      .map((id) => {
        const p = placeMap.get(id);
        return `<span class="chip"><span>✓ ${esc(p.town)} · ${esc(p.department)}</span><button data-family-remove="${id}" aria-label="Quitar ${esc(p.town)} de ${esc(p.department)}">×</button></span>`;
      })
      .join('');
    $('family-town-next').disabled = !pendingPlaces.length;
    $('family-town-next').textContent = pendingPlaces.length
      ? `Ver colegios de ${pendingPlaces.length} ${pendingPlaces.length === 1 ? 'municipio' : 'municipios'} →`
      : 'Añade al menos un municipio';
  }
  function chooseTown(id) {
    if (!pendingPlaces.includes(id)) pendingPlaces.push(id);
    $('family-town-search').value = '';
    towns();
    chosenTowns();
    $('family-town-search').focus();
    announce('Municipio añadido. Puedes buscar otro o continuar.');
  }
  function confirmTowns() {
    if (!pendingPlaces.length) return;
    $('family-school-search').value = '';
    change(
      {
        ...defaults,
        places: [...pendingPlaces],
        years: [...data.years],
        family: 'school',
        selected: [],
        complete: true,
        journey: {
          mode: 'compare',
          step: 'results',
          departments: [...new Set(pendingPlaces.map((id) => placeMap.get(id).department))],
          baseline: null,
        },
      },
      { controls: true }
    );
    $('family-title').focus();
  }
  function chooseSchool(id) {
    const leader = result.rows[0];
    if (!leader || !result.rows.some((r) => r.id === id)) return;
    change({
      family: 'compare',
      selected: [...new Set([id, leader.id])],
      view: 'compare',
      journey: { ...state.journey, mode: 'compare', step: 'results', baseline: leader.id },
      chartOptions: { ...state.chartOptions, panel: 'annual', scale: 'focused', highlight: null },
    });
    $('family-title').focus();
  }
  function refresh() {
    if (!ready) return;
    const active = ['town', 'school', 'compare'].includes(state.family);
    $('family-guide').hidden = !active;
    if (active && state.family === 'town') $('share').disabled = true;
    $('family-start').hidden = active;
    document.querySelector('.journey-shell').hidden = active;
    $('journey-back').parentElement.hidden = active;
    $('main').firstElementChild.hidden = active;
    document.querySelector('.tabs').hidden = active;
    if (!active) return;
    if (state.family === 'town') announce('Añade los municipios donde quieres buscar.');
    for (const id of ['departments', 'places', 'schools', 'priorities'])
      $('step-' + id).hidden = true;
    $('main').hidden = state.family !== 'compare';
    for (const step of ['town', 'school', 'compare'])
      $('family-' + step).hidden = state.family !== step;
    $('family-title').textContent =
      state.family === 'town'
        ? '¿En qué municipios buscas colegio?'
        : state.family === 'school'
          ? '¿Qué colegio estás considerando?'
          : 'Tu colegio frente al mayor promedio';
    $('family-position').textContent =
      `Paso ${['town', 'school', 'compare'].indexOf(state.family) + 1} de 3`;
    $('family-location').textContent =
      state.family === 'town'
        ? ''
        : state.places
            .map((id) => {
              const p = placeMap.get(id);
              return `${p.town} (${p.department})`;
            })
            .join(' · ');
    $('family-incomplete').checked = !state.complete;
    $('family-criteria').textContent =
      `${state.years.join('–').replace(/–.*–/, '–')} · ${state.weights.every((w) => Math.abs(w - state.weights[0]) < 1e-9) ? 'cinco materias con igual peso' : 'con tus pesos personalizados'} · jornadas diurnas · ${state.complete ? 'colegios con datos en todos los años' : 'incluye colegios con años incompletos'}.`;
    const leader = result.rows[0];
    $('family-leader').innerHTML = leader
      ? `<p>Mayor promedio entre ${result.rows.length} colegios que cumplen estos criterios:</p><strong>${esc(leader.name)}</strong><p>${esc(leader.town)} · ${esc(leader.department)}</p><p><strong>${fmt(leader.score)} /100</strong> · ${leader.coverage} años con datos${result.rows.filter((r) => Math.abs(r.score - leader.score) < 1e-9).length > 1 ? ' · primer puesto compartido' : ''}</p>`
      : '<p>No hay colegios con estos criterios. Puedes permitir años incompletos o cambiar de municipio.</p>';
    if (state.family === 'school') schools();
    if (state.family === 'compare') {
      const candidate = result.rows.find((r) => r.id === state.selected[0]);
      $('family-result').innerHTML =
        candidate && leader
          ? `<p><strong>${esc(candidate.name)}</strong></p><p>${candidate.id === leader.id ? 'El colegio que elegiste tiene el mayor promedio con estos criterios.' : `Su promedio es <strong>${fmt(candidate.score)}/100</strong>. ${Math.abs(leader.score - candidate.score) < 1e-9 ? 'Empata con' : `Está ${fmt(leader.score - candidate.score)} puntos por debajo de`} <strong>${esc(leader.name)}</strong> (${fmt(leader.score)}/100).`}</p><p class="hint">${state.complete ? 'La comparación usa los mismos años seleccionados.' : 'Los años disponibles pueden ser distintos: revisa la gráfica antes de concluir.'} Abajo puedes revisar su trayectoria o elegir otra comparación.</p>`
          : '<p>Revisa los colegios seleccionados y los filtros.</p>';
    }
  }
  function initialize() {
    ready = true;
    if (state.family === undefined)
      state.family = state.journey.step === 'departments' ? 'town' : null;
    pendingPlaces = state.family === 'town' ? [] : [...state.places];
    chosenTowns();
    $('family-town-next').onclick = confirmTowns;
    $('family-town-search').oninput = towns;
    $('family-school-search').oninput = schools;
    $('family-advanced').onclick = () => {
      change({ family: null });
      $('heading-' + state.journey.step).focus();
    };
    $('family-start').onclick = () => {
      pendingPlaces = [];
      chosenTowns();
      change({ family: 'town' });
      $('family-town-search').focus();
    };
    $('family-incomplete').onchange = (e) => change({ complete: !e.target.checked });
    document.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.familyTown !== undefined) chooseTown(Number(b.dataset.familyTown));
      if (b.dataset.familySchool !== undefined) chooseSchool(Number(b.dataset.familySchool));
      if (b.dataset.familyRemove !== undefined) {
        pendingPlaces = pendingPlaces.filter((id) => id !== Number(b.dataset.familyRemove));
        chosenTowns();
      }
      if (b.dataset.familyBack) {
        if (b.dataset.familyBack === 'town') {
          pendingPlaces = [...state.places];
          chosenTowns();
        }
        change({ family: b.dataset.familyBack });
        $('family-title').focus();
      }
    });
    document.querySelector('.skip').onclick = (e) => {
      e.preventDefault();
      (state.family ? $('family-title') : $('heading-' + state.journey.step)).focus();
    };
    towns();
  }
  function alignReference() {
    if (!ready || state.family !== 'compare' || !result.rows.length) return;
    const candidate = state.selected[0];
    if (!result.rows.some((r) => r.id === candidate)) return;
    state.selected = [...new Set([candidate, result.rows[0].id])];
    state.journey.baseline = result.rows[0].id;
  }
  return { initialize, refresh, alignReference };
})();
