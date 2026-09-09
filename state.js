const DashboardState = (() => {
  const defaults = (places) => ({
    v: 2,
    places,
    years: [2021, 2022, 2023, 2024, 2025],
    nature: 'all',
    session: 'diurnal',
    complete: true,
    minStudents: 0,
    aggregation: 'equal',
    weights: [20, 20, 20, 20, 20],
    reference: [20, 20, 20, 20, 20],
    selected: [],
    view: 'explore',
    metric: 'score',
    search: '',
  });
  // Compact large territorial selections without a server or a URL shortener.
  const encode = (state) => {
    const packed = { ...state };
    if (state.places.length > 20) {
      const ids = [...new Set(state.places)].sort((a, b) => a - b),
        ranges = [];
      for (let i = 0; i < ids.length; i++) {
        const first = ids[i];
        let last = first;
        while (ids[i + 1] === last + 1) last = ids[++i];
        ranges.push(first === last ? String(first) : `${first}-${last}`);
      }
      packed.placeRanges = ranges.join(',');
      delete packed.places;
    }
    return '#' + encodeURIComponent(JSON.stringify(packed));
  };
  function decode(hash, data, fallback) {
    if (!hash || hash === '#') return JSON.parse(JSON.stringify(fallback));
    const o = JSON.parse(decodeURIComponent(hash.slice(1)));
    if (o.v !== 2) throw new Error('Versión de enlace no compatible.');
    if (o.places === undefined && typeof o.placeRanges === 'string') {
      const ids = [];
      if (o.placeRanges.length > 16000) throw new Error('Selección territorial demasiado larga.');
      for (const range of o.placeRanges.split(',')) {
        if (!/^\d+(?:-\d+)?$/.test(range)) throw new Error('Selección territorial no válida.');
        const [first, last = first] = range.split('-').map(Number);
        if (first > last || last >= data.places.length)
          throw new Error('Selección territorial fuera de la base.');
        for (let id = first; id <= last; id++) ids.push(id);
        if (ids.length > data.places.length) throw new Error('Selección territorial repetida.');
      }
      o.places = ids;
    }
    const valid = (a, values) => Array.isArray(a) && a.every((x) => values.has(x));
    if (
      !valid(o.places, new Set(data.places.map((p) => p.id))) ||
      !valid(o.years, new Set(data.years)) ||
      !valid(o.selected, new Set(data.schools.map((s) => s.id))) ||
      o.selected.length > 6
    )
      throw new Error('El enlace contiene una selección no válida.');
    for (const key of ['weights', 'reference'])
      if (
        !Array.isArray(o[key]) ||
        o[key].length !== 5 ||
        o[key].some((x) => !Number.isFinite(x) || x < 0 || x > 100) ||
        o[key].reduce((a, b) => a + b, 0) <= 0
      )
        throw new Error('Los pesos del enlace no son válidos.');
    const out = {
      ...fallback,
      places: [...new Set(o.places)],
      years: [...new Set(o.years)],
      selected: [...new Set(o.selected)],
      weights: o.weights,
      reference: o.reference,
    };
    for (const [key, values] of Object.entries({
      nature: ['all', 'OFICIAL', 'NO OFICIAL'],
      session: [
        'all',
        'diurnal',
        'MAÑANA',
        'TARDE',
        'COMPLETA',
        'ÚNICA',
        'NOCTURNA',
        'FIN DE SEMANA',
      ],
      aggregation: ['equal', 'students'],
      view: ['explore', 'compare'],
      metric: ['score', 'total', '0', '1', '2', '3', '4'],
    }))
      if (values.includes(o[key])) out[key] = o[key];
    out.complete = typeof o.complete === 'boolean' ? o.complete : fallback.complete;
    out.minStudents = Number.isFinite(o.minStudents)
      ? Math.max(0, Math.min(100000, Math.floor(o.minStudents)))
      : 0;
    out.search = typeof o.search === 'string' ? o.search.slice(0, 200) : '';
    if (o.journey && typeof o.journey === 'object') {
      const departments = new Set(data.places.map((p) => p.department));
      if (!valid(o.journey.departments, departments))
        throw new Error('Departamento no válido en el enlace.');
      out.journey = {
        mode: o.journey.mode === 'compare' ? 'compare' : 'rank',
        step: ['departments', 'places', 'schools', 'priorities', 'results'].includes(o.journey.step)
          ? o.journey.step
          : 'departments',
        departments: [
          ...new Set([
            ...o.journey.departments,
            ...out.places.map((id) => data.places.find((p) => p.id === id).department),
          ]),
        ],
        baseline: out.selected.includes(o.journey.baseline) ? o.journey.baseline : null,
      };
    }
    if (o.chartOptions && typeof o.chartOptions === 'object') {
      const chart = o.chartOptions;
      out.chartOptions = {
        panel: [
          'annual',
          'year',
          'change',
          'scatter',
          'sensitivity',
          'trend',
          'subjects',
          'cohorts',
          'pairs',
        ].includes(chart.panel)
          ? chart.panel
          : 'annual',
        scale: chart.scale === 'full' ? 'full' : 'focused',
        metric: ['mean', 'score', 'total', '0', '1', '2', '3', '4'].includes(chart.metric)
          ? chart.metric
          : 'mean',
        year: out.years.includes(chart.year) ? chart.year : (out.years.at(-1) ?? 2025),
        from: out.years.includes(chart.from) ? chart.from : (out.years[0] ?? 2021),
        to: out.years.includes(chart.to) ? chart.to : (out.years.at(-1) ?? 2025),
        strength: Number.isFinite(chart.strength)
          ? Math.max(0, Math.min(100, chart.strength))
          : 100,
        highlight: out.selected.includes(chart.highlight) ? chart.highlight : null,
      };
    }
    if ('family' in o)
      out.family = ['town', 'school', 'weights', 'compare'].includes(o.family) ? o.family : null;
    return out;
  }
  return { defaults, encode, decode };
})();
if (typeof module !== 'undefined') module.exports = DashboardState;
