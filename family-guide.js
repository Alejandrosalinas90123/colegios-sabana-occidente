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
  let schoolPage = 0;
  function schools() {
    const q = norm($('family-school-search').value.trim());
    const matches = result.rows.filter((r) => norm(r.name + ' ' + r.town).includes(q));
    schoolPage = Math.max(0, Math.min(schoolPage, Math.ceil(matches.length / 8) - 1));
    $('family-school-options').innerHTML = matches
      .slice(schoolPage * 8, schoolPage * 8 + 8)
      .map(
        (r) =>
          `<button data-family-school="${r.id}" aria-pressed="${state.selected.includes(r.id)}" ${state.selected.length >= 6 && !state.selected.includes(r.id) ? 'disabled' : ''}><strong>${esc(r.name)}</strong><span>${esc(r.town)} · ${fmt(r.score)}/100 · ${r.coverage}/${state.years.length} años</span><span>${state.selected.includes(r.id) ? '✓ Elegido · quitar' : 'Añadir a mi comparación'}</span></button>`
      )
      .join('');
    $('family-school-help').textContent = matches.length
      ? `${matches.length} colegios · ordenados por tu indicador. Mostrando ${schoolPage * 8 + 1}–${Math.min(matches.length, schoolPage * 8 + 8)}.`
      : 'No hay coincidencias. Cambia la búsqueda o permite años incompletos.';
    $('family-school-prev').disabled = schoolPage === 0;
    $('family-school-next').disabled = (schoolPage + 1) * 8 >= matches.length;
    $('family-selected').innerHTML = state.selected
      .map(
        (id) =>
          `<span class="chip"><span>${esc(schoolMap.get(id).name)}${result.rows.some((r) => r.id === id) ? '' : ' · fuera de filtros'}</span><button data-family-school="${id}" aria-label="Quitar ${esc(schoolMap.get(id).name)}">×</button></span>`
      )
      .join('');
    const n = state.selected.filter((id) => result.rows.some((r) => r.id === id)).length;
    $('family-compare-next').disabled = n < 2;
    $('family-compare-next').textContent =
      n < 2 ? 'Elige al menos 2 colegios' : `Comparar mis ${n} colegios →`;
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
        selected: state.selected.filter((id) => pendingPlaces.includes(schoolMap.get(id).place)),
        weights: [...state.weights],
        reference: [...state.reference],
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
    toggleSchool(id);
  }
  function compareSelected() {
    if (state.selected.filter((id) => result.rows.some((r) => r.id === id)).length < 2) return;
    change({
      family: 'compare',
      view: 'compare',
      journey: { ...state.journey, mode: 'compare', step: 'results' },
      chartOptions: { ...state.chartOptions, panel: 'annual', scale: 'focused', highlight: null },
    });
    $('family-title').focus();
  }
  function refresh() {
    if (!ready) return;
    const active = ['town', 'school', 'weights', 'compare'].includes(state.family);
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
    $('step-priorities').hidden = state.family !== 'weights';
    $('family-weights').hidden = state.family !== 'weights';
    $('main').hidden = state.family !== 'compare';
    for (const step of ['town', 'school', 'compare'])
      $('family-' + step).hidden = state.family !== step;
    $('family-title').textContent =
      state.family === 'town'
        ? '¿En qué municipios buscas colegio?'
        : state.family === 'school'
          ? 'Descubre y elige tus colegios'
          : state.family === 'weights'
            ? '¿Qué materias te importan más?'
            : 'Compara los colegios que elegiste';
    $('family-position').textContent =
      state.family === 'weights'
        ? 'Personaliza tu indicador'
        : `Paso ${['town', 'school', 'compare'].indexOf(state.family) + 1} de 3`;
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
    if (state.family === 'school') schools();
    if (state.family === 'compare')
      $('family-result').innerHTML =
        `<p>${state.selected.length} colegios elegidos por ti. Selecciona abajo qué quieres comparar.</p>`;
  }

  function initialize() {
    ready = true;
    if (state.family === undefined)
      state.family = state.journey.step === 'departments' ? 'town' : null;
    pendingPlaces = state.family === 'town' ? [] : [...state.places];
    chosenTowns();
    $('family-town-next').onclick = confirmTowns;
    $('family-town-search').oninput = towns;
    $('family-school-search').oninput = () => {
      schoolPage = 0;
      schools();
    };
    $('family-school-prev').onclick = () => {
      schoolPage--;
      schools();
    };
    $('family-school-next').onclick = () => {
      schoolPage++;
      schools();
    };
    $('family-compare-next').onclick = compareSelected;
    document.querySelectorAll('[data-family-weights]').forEach(
      (b) =>
        (b.onclick = () => {
          change({ family: 'weights' });
          $('family-title').focus();
        })
    );
    $('family-weights-done').onclick = () => {
      if (!SchoolEngine.normalize(state.weights)) {
        announce('Asigna peso a al menos una materia.');
        return;
      }
      change({ family: 'school' });
      $('family-title').focus();
    };
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
  return { initialize, refresh };
})();
