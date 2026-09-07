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
  const encode = (state) => '#' + encodeURIComponent(JSON.stringify(state));
  function decode(hash, data, fallback) {
    if (!hash || hash === '#') return JSON.parse(JSON.stringify(fallback));
    const o = JSON.parse(decodeURIComponent(hash.slice(1)));
    if (o.v !== 2) throw new Error('Versión de enlace no compatible.');
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
    return out;
  }
  return { defaults, encode, decode };
})();
if (typeof module !== 'undefined') module.exports = DashboardState;
