const { JSDOM } = require('jsdom');
const fs = require('node:fs'),
  path = require('node:path'),
  assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const UI = require(root + '/ui.js');
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function waitFor(fn) {
  for (let i = 0; i < 150; i++) {
    if (fn()) return;
    await wait(20);
  }
  throw Error('DOM operation did not complete');
}
async function mount(failFirst = false) {
  const dom = new JSDOM(fs.readFileSync(root + '/index.html', 'utf8'), {
    url: 'https://example.org/colegios/',
    runScripts: 'outside-only',
    pretendToBeVisual: true,
  });
  const w = dom.window;
  Object.assign(w, {
    Blob,
    Response,
    DecompressionStream,
    AbortSignal,
    CSS: { escape: (s) => String(s) },
    matchMedia: () => ({ matches: false }),
  });
  let failed = false;
  w.fetch = async () => {
    if (failFirst && !failed) {
      failed = true;
      throw Error('Sin conexión de prueba');
    }
    return new Response(fs.readFileSync(root + '/data.json.gz'));
  };
  // jsdom has no native modal implementation. Tests cover our opener/focus logic,
  // not browser-provided focus containment or screen-reader announcements.
  w.HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  w.HTMLDialogElement.prototype.close = function () {
    this.open = false;
    this.dispatchEvent(new w.Event('close'));
  };
  const errors = [];
  w.addEventListener('error', (e) => errors.push(e.error));
  w.eval(
    [
      'engine.js',
      'state.js',
      'data-loader.js',
      'ui.js',
      'subject-guide.js',
      'comparisons.js',
      'journey.js',
      'chart-stats.js',
      'chart-lab.js',
      'family-guide.js',
      'app.js',
    ]
      .map((file) => fs.readFileSync(root + '/' + file, 'utf8'))
      .join('\n')
  );
  await waitFor(
    () =>
      !w.document.getElementById('app').hidden || !w.document.getElementById('load-error').hidden
  );
  return { dom, w, errors, $: (id) => w.document.getElementById(id) };
}
function contrast(a, b) {
  const linear = (c) => {
    c = parseInt(c, 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const lum = (s) =>
    0.2126 * linear(s.slice(1, 3)) +
    0.7152 * linear(s.slice(3, 5)) +
    0.0722 * linear(s.slice(5, 7));
  const x = lum(a),
    y = lum(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
(async () => {
  for (const value of ['', ' ', '-1', '0.1', 'NaN', '100001', 'Infinity'])
    assert.ok(UI.validateMinimum(value));
  for (const value of ['0', '20', '100000']) assert.equal(UI.validateMinimum(value), '');
  assert.equal(UI.tabDestination('ArrowRight', 0), 1);
  assert.equal(UI.tabDestination('ArrowLeft', 1), 0);
  assert.equal(UI.tabDestination('Home', 1), 0);
  assert.equal(UI.tabDestination('End', 0), 1);
  assert.equal(UI.tabDestination('Tab', 0), undefined);
  const { dom, w, $, errors } = await mount();
  assert.equal($('load-error').hidden, true, $('load-error-message').textContent);
  assert.equal($('family-town').hidden, false);
  for (const town of ['FUNZA', 'MOSQUERA']) {
    $('family-town-search').value = town;
    $('family-town-search').dispatchEvent(new w.Event('input'));
    $('family-town-options').querySelector('button').click();
  }
  assert.equal($('family-chosen-towns').querySelectorAll('.chip').length, 2);
  assert.equal($('family-town-search').value, '');
  $('family-town-next').click();
  assert.equal($('family-school').hidden, false);
  assert.match($('family-location').textContent, /FUNZA/);
  assert.match($('family-location').textContent, /MOSQUERA/);
  $('family-school-search').value = 'colegio';
  $('family-school-search').dispatchEvent(new w.Event('input'));
  const candidate = $('family-school-options').querySelector('button');
  assert.ok(candidate);
  candidate.click();
  assert.equal($('family-compare').hidden, false);
  assert.equal($('main').hidden, false);
  assert.match($('family-result').textContent, /promedio|puntos/);
  const familyState = JSON.parse(decodeURIComponent(w.location.hash.slice(1)));
  assert.equal(familyState.places.length, 2);
  assert.ok(familyState.selected.length >= 1 && familyState.selected.length <= 2);
  assert.equal(familyState.chartOptions.panel, 'annual');
  assert.equal($('mean-chart').closest('[data-comparison-panel]').hidden, false);
  $('family-advanced').click();
  $('journey-reset').click();

  assert.equal($('step-departments').hidden, false);
  // Add municipalities one at a time without losing earlier choices.
  $('clear-places').click();
  for (const town of ['FUNZA', 'MADRID', 'MOSQUERA', 'BOJACA', 'CHIA', 'COTA']) {
    $('place-search').value = town;
    $('place-search').dispatchEvent(new w.Event('input'));
    const box = $('places').querySelector('input');
    assert.ok(box, town);
    box.checked = true;
    box.dispatchEvent(new w.Event('change', { bubbles: true }));
    $('next-place-search').click();
    assert.equal($('place-search').value, '');
    assert.equal(w.document.activeElement, $('place-search'));
  }
  assert.equal($('place-selection-inline').querySelectorAll('.chip').length, 6);
  $('journey-reset').click();
  w.document.querySelector('[data-open-picker]').click();
  assert.equal($('step-schools').hidden, false);
  const option = $('school-picker').querySelectorAll('.school-option')[10];
  const manual = {
    id: option.querySelector('button').dataset.pick,
    name: option.querySelector('strong').textContent,
  };
  $('pick-school-search').value = manual.name;
  $('pick-school-search').dispatchEvent(new w.Event('input'));
  $('school-picker').querySelector(`[data-pick="${manual.id}"]`).click();
  $('next-school-search').click();
  assert.equal($('pick-school-search').value, '');
  assert.ok($('picker-selected').textContent.includes(manual.name));
  assert.ok($('picker-selected').querySelector(`[data-pick="${manual.id}"]`));
  $('journey-reset').click();

  assert.equal($('main').hidden, true);
  assert.match($('journey-summary').textContent, /4 municipios incluidos/);
  assert.equal($('chosen-places').querySelectorAll('[data-remove-place]').length, 4);
  $('national').click();
  assert.equal($('chosen-places').querySelectorAll('[data-remove-place]').length, 1116);
  assert.ok(w.location.hash.length < 3000, 'National share URL should use compact ranges');
  $('journey-reset').click();
  const cundi = $('departments-list').querySelector('[data-department="CUNDINAMARCA"]');
  cundi.checked = false;
  cundi.dispatchEvent(new w.Event('change', { bubbles: true }));
  assert.equal($('chosen-places').querySelectorAll('[data-remove-place]').length, 0);
  const antioquia = $('departments-list').querySelector('[data-department="ANTIOQUIA"]');
  antioquia.checked = true;
  antioquia.dispatchEvent(new w.Event('change', { bubbles: true }));
  assert.equal(
    $('chosen-places').querySelectorAll('[data-remove-place]').length,
    0,
    'Department selection must not add municipalities'
  );
  $('journey-next').click();
  assert.equal($('step-places').hidden, false);
  $('journey-next').click();
  assert.equal($('step-places').hidden, false);
  assert.equal($('step-error').hidden, false);
  assert.equal($('places').querySelectorAll('[data-place]').length, 0);
  $('browse-places').checked = true;
  $('browse-places').dispatchEvent(new w.Event('change'));
  const municipality = $('places').querySelector('[data-place]');
  municipality.checked = true;
  municipality.dispatchEvent(new w.Event('change', { bubbles: true }));
  assert.equal($('chosen-places').querySelectorAll('[data-remove-place]').length, 1);
  $('journey-reset').click();
  w.document.querySelector('[data-route=compare]').click();
  $('journey-next').click();
  $('journey-next').click();
  assert.equal($('step-schools').hidden, false);
  const schoolIds = [...$('school-picker').querySelectorAll('[data-pick]:not(:disabled)')]
    .slice(0, 2)
    .map((el) => el.dataset.pick);
  for (const id of schoolIds) $('school-picker').querySelector(`[data-pick="${id}"]`).click();
  assert.equal($('chosen-schools').querySelectorAll('[data-remove]').length, 2);
  $('journey-next').click();
  assert.equal($('step-priorities').hidden, false);
  const english = $('importance-4');
  english.value = '4';
  english.dispatchEvent(new w.Event('change', { bubbles: true }));
  assert.equal($('weight-4').value, '40');
  assert.match($('indicator-preview').textContent, /33,3/);
  $('journey-next').click();
  assert.equal($('main').hidden, false);
  assert.equal($('compare-view').hidden, false);
  assert.equal($('pair-table').querySelectorAll('tbody tr').length, 1);
  assert.ok($('pair-table').textContent.includes('2021'));
  assert.equal($('mean-table').querySelectorAll('tbody tr').length, 2);
  const fixedAnnualValues = $('mean-table').textContent;
  Object.defineProperty($('compare-view'), 'clientWidth', { value: 360, configurable: true });
  for (const panel of [
    'annual',
    'change',
    'scatter',
    'sensitivity',
    'trend',
    'subjects',
    'cohorts',
    'pairs',
  ]) {
    $('comparison-question').value = panel;
    $('comparison-question').dispatchEvent(new w.Event('change'));
    const visible = [...w.document.querySelectorAll('[data-comparison-panel]')].filter(
      (el) => !el.hidden
    );
    assert.equal(visible.length, 1);
    assert.equal(visible[0].dataset.comparisonPanel, panel);
    for (const svg of visible[0].querySelectorAll('svg')) {
      const width = Number(svg.getAttribute('viewBox').split(' ')[2]);
      assert.ok(width <= 360, 'Mobile chart must fit its viewport');
      for (const point of svg.querySelectorAll('circle')) {
        assert.ok(
          Number(point.getAttribute('cx')) >= 0 && Number(point.getAttribute('cx')) <= width
        );
      }
    }
  }
  $('comparison-question').value = 'annual';
  $('comparison-question').dispatchEvent(new w.Event('change'));
  $('chart-scale').value = 'full';
  $('chart-scale').dispatchEvent(new w.Event('change'));
  assert.equal($('mean-table').textContent, fixedAnnualValues);
  $('chart-scale').value = 'focused';
  $('chart-scale').dispatchEvent(new w.Event('change'));
  assert.equal($('mean-table').textContent, fixedAnnualValues);
  assert.equal($('change-table').closest('details').open, false);
  assert.ok($('scatter-table').querySelector('td').dataset.column);

  $('lab-metric').value = '4';
  $('lab-metric').dispatchEvent(new w.Event('change', { bubbles: true }));
  assert.equal(
    $('mean-table').textContent,
    fixedAnnualValues,
    'Selecting English must not replace the general annual chart'
  );
  assert.match($('change-description').textContent, /Inglés/);
  $('lab-year').value = '2021';
  $('lab-year').dispatchEvent(new w.Event('change', { bubbles: true }));
  assert.ok($('scatter-table').textContent.includes('2021'));
  const point = $('mean-chart').querySelector('[data-chart-point]');
  const pointedId = point.dataset.chartPoint;
  point.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  assert.equal($('chart-highlight').value, pointedId);
  assert.match($('chart-point-readout').textContent, /promedio general/);
  $('scenario-strength').value = '0';
  $('scenario-strength').dispatchEvent(new w.Event('input', { bubbles: true }));
  assert.equal($('scenario-percent').textContent, '0 %');
  $('apply-chart-scenario').click();
  assert.equal($('weight-4').value, '20');
  assert.equal(
    $('mean-table').textContent,
    fixedAnnualValues,
    'Applying different weights must leave annual general means unchanged'
  );
  assert.equal($('sensitivity-table').querySelectorAll('tbody tr').length, 2);
  $('lab-from').value = '2025';
  $('lab-to').value = '2021';
  $('lab-to').dispatchEvent(new w.Event('change', { bubbles: true }));
  assert.match($('change-chart').textContent, /Se necesitan dos años/);
  // Return to the original regional defaults for the existing interaction regression.
  $('journey-reset').click();
  $('journey-next').click();
  $('journey-next').click();
  $('journey-next').click();
  assert.equal($('loading').hidden, true);
  assert.equal($('ranking').rows.length, 20);
  assert.match($('stats').textContent, /66/);
  assert.equal($('explore-tab').getAttribute('aria-selected'), 'true');
  $('explore-tab').focus();
  $('explore-tab').dispatchEvent(
    new w.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })
  );
  assert.equal(w.document.activeElement.id, 'compare-tab');
  assert.equal($('compare-view').hidden, false);
  assert.equal($('explore-tab').tabIndex, -1);
  $('explore-tab').click();
  let add = $('ranking').querySelector('[data-add]');
  const id = add.dataset.add;
  add.focus();
  add.click();
  assert.equal(w.document.activeElement.dataset.add, id);
  assert.equal($('selection-count').textContent, '1');
  let opener = $('ranking').querySelector('[data-detail]');
  opener.focus();
  opener.click();
  assert.equal($('school-dialog').open, true);
  assert.equal(w.document.activeElement.className, 'close');
  assert.ok($('dialog-title').textContent);
  $('school-dialog').close();
  assert.equal(w.document.activeElement, opener);
  const invalid = $('minimum');
  invalid.value = '-2';
  invalid.dispatchEvent(new w.Event('input', { bubbles: true }));
  assert.equal(invalid.getAttribute('aria-invalid'), 'true');
  assert.match($('minimum-error').textContent, /último mínimo válido/);
  assert.equal($('share').disabled, true);
  invalid.value = '20';
  invalid.dispatchEvent(new w.Event('input', { bubbles: true }));
  assert.equal($('minimum-error').hidden, true);
  assert.equal($('share').disabled, false);
  $('reset').click();
  $('clear-places').click();
  assert.equal($('places-error').hidden, false);
  assert.equal($('share').disabled, true);
  $('sabana').click();
  assert.equal($('places-error').hidden, true);
  for (let i = 0; i < 5; i++) {
    const el = $('weight-' + i);
    el.value = '0';
    el.dispatchEvent(new w.Event('input', { bubbles: true }));
  }
  await wait(120);
  assert.equal($('weights-error').hidden, false);
  assert.equal($('reference').disabled, true);
  w.document.querySelector('[data-preset=equal]').click();
  assert.equal($('weights-error').hidden, true);
  $('top-four').click();
  assert.equal($('compare-view').hidden, false);
  assert.equal(w.document.activeElement.id, 'compare-tab');
  assert.equal($('trend-table').querySelectorAll('tbody tr').length, 4);
  assert.equal($('trend').querySelectorAll('[tabindex]').length, 0);
  // Reference integrity and names for generated form controls.
  for (const el of w.document.querySelectorAll(
    '[aria-labelledby],[aria-describedby],[aria-controls]'
  ))
    for (const attr of ['aria-labelledby', 'aria-describedby', 'aria-controls'])
      for (const id of (el.getAttribute(attr) || '').split(/\s+/).filter(Boolean))
        assert.ok($(id), `${attr} points to missing ${id}`);
  for (const el of w.document.querySelectorAll('input,select'))
    assert.ok(el.labels?.length || el.getAttribute('aria-label'), `Control lacks name: ${el.id}`);
  for (const el of w.document.querySelectorAll('input[type=checkbox]'))
    assert.ok(el.closest('label'), 'Checkbox needs an expanded label hit area');
  assert.equal(errors.length, 0);
  dom.window.close();
  const retry = await mount(true);
  assert.equal(retry.$('load-error').hidden, false);
  retry.$('retry').click();
  await waitFor(() => !retry.$('app').hidden);
  assert.equal(retry.$('load-error').hidden, true);
  assert.equal(retry.errors.length, 0);
  retry.dom.window.close();
  const css = fs.readFileSync(root + '/styles.css', 'utf8'),
    tokens = Object.fromEntries(
      [...css.matchAll(/--color-([\w-]+):\s*(#[0-9a-f]{6});/g)].map((m) => [m[1], m[2]])
    );
  const pairs = [
    ['text', 'surface'],
    ['text', 'background'],
    ['text', 'container'],
    ['text', 'accent'],
    ['muted', 'surface'],
    ['muted', 'background'],
    ['muted', 'container'],
    ['on-primary', 'primary'],
    ['on-primary', 'primary-hover'],
    ['on-primary', 'primary-active'],
    ['on-primary', 'text'],
    ['error', 'error-surface'],
    ['error', 'surface'],
    ['warning', 'warning-surface'],
    ['primary', 'container'],
    ['primary', 'surface'],
  ];
  const ratios = pairs.map(([a, b]) => ({
    pair: a + '/' + b,
    ratio: contrast(tokens[a], tokens[b]),
  }));
  for (const r of ratios) assert.ok(r.ratio >= 4.5, JSON.stringify(r));
  assert.match(css, /--target-size: 48px/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /forced-colors/);
  const report = {
    passed: true,
    domChecks: [
      'initial load',
      'family path: two municipalities, candidate search and automatic leader comparison',
      'general annual chart invariant under metric and weight changes',
      'chart point selection, year control and invalid endpoint interval',
      'weight scenario exploration and application',
      'department to municipality hierarchy',
      'visible 1116 municipality selection',
      'guided ranking and comparison paths',
      'importance guide weights',
      'common-year comparison table',
      'tab arrows and roving tabindex',
      'focus after list replacement',
      'dialog focus return',
      'live invalid minimum',
      'empty places',
      'zero weights',
      'comparison data table',
      'ARIA reference integrity',
      'labels and checkbox hit areas',
      'failed load and retry',
    ],
    minimumTextContrast: Math.min(...ratios.map((r) => r.ratio)),
    contrastPairs: ratios,
    limits:
      'DOM simulation and source-token checks. Does not measure browser geometry, native modal containment or actual screen-reader output; not a WCAG certification.',
  };
  fs.writeFileSync(__dirname + '/ui-check-results.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
