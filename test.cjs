const fs = require('node:fs'),
  zlib = require('node:zlib'),
  assert = require('node:assert/strict'),
  crypto = require('node:crypto');
const E = require('./engine.js'),
  S = require('./state.js');
const raw = zlib.gunzipSync(fs.readFileSync(__dirname + '/data.json.gz'));
const manifest = JSON.parse(fs.readFileSync(__dirname + '/verification.json'));
assert.equal(crypto.createHash('sha256').update(raw).digest('hex'), manifest.dataSha256);
const data = JSON.parse(raw);
data.records = data.records.map((r) => ({
  id: r[0],
  year: r[1],
  n: r[2],
  scores: r.slice(3, 8),
  nature: r[8],
  session: r[9],
  calendar: r[10],
  sourceRow: r[11],
}));
assert.equal(data.records.length, 72686);
assert.equal(data.places.length, 1116);
assert.equal(new Set(data.places.map((p) => p.department)).size, 33);
const sabana = data.places
  .filter(
    (p) =>
      p.department === 'CUNDINAMARCA' && ['FUNZA', 'MADRID', 'MOSQUERA', 'BOJACÁ'].includes(p.town)
  )
  .map((p) => p.id);
assert.equal(sabana.length, 4);
const state = S.defaults(sabana),
  close = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);
let r = E.calculate(data, state, state.weights, state.reference);
const expected = JSON.parse(fs.readFileSync(__dirname + '/tests/fixtures/regional-expected.json'));
assert.equal(r.rows.length, 66);
for (const e of expected) {
  const actual = r.rows.find(
    (s) => s.name === e.name && s.town.toLocaleLowerCase('es') === e.town.toLocaleLowerCase('es')
  );
  assert.ok(actual);
  close(actual.score, e.score);
  close(actual.total, e.total);
  assert.equal(actual.students, e.students);
  assert.equal(actual.rankChange, 0);
}
const nationwide = {
  ...state,
  places: data.places.map((p) => p.id),
  session: 'all',
  complete: false,
};
r = E.calculate(data, nationwide, state.weights, state.reference);
assert.equal(r.sourceCount, 72686);
assert.equal(r.rows.length, data.schools.length);
assert.equal(
  r.rows.reduce((s, r) => s + r.students, 0),
  data.records.reduce((s, r) => s + r.n, 0)
);
const groups = new Map();
for (const source of data.records) {
  const key = source.id + '|' + source.year;
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(source);
}
let annualChecks = 0;
for (const row of r.rows) {
  for (const a of Object.values(row.byYear)) {
    const sources = groups.get(row.id + '|' + a.year),
      n = sources.reduce((s, r) => s + r.n, 0);
    assert.equal(a.n, n);
    for (let j = 0; j < 5; j++)
      close(a.scores[j], sources.reduce((s, r) => s + r.n * r.scores[j], 0) / n);
    close(
      a.total,
      a.scores.reduce((a, b) => a + b, 0)
    );
    annualChecks++;
  }
}
const weighted = E.calculate(data, { ...nationwide, aggregation: 'students' }, [0, 0, 0, 0, 100]);
for (const row of weighted.rows) {
  const sources = Object.values(row.byYear);
  close(row.score, sources.reduce((s, r) => s + r.scores[4] * r.n, 0) / row.students);
}
assert.ok(E.calculate(data, state, [0, 0, 0, 0, 0]).error);
assert.ok(E.calculate(data, { ...state, places: [] }, state.weights).error);
assert.ok(E.calculate(data, { ...state, years: [] }, state.weights).error);
const minimum = E.calculate(data, { ...nationwide, minStudents: 20 }, state.weights);
assert.ok(minimum.rows.every((r) => r.minStudents >= 20));
const single = E.calculate(data, { ...state, years: [2025] }, state.weights);
assert.ok(single.rows.every((r) => r.coverage === 1 && r.change === null));
const shared = {
  ...nationwide,
  selected: r.rows.slice(0, 6).map((s) => s.id),
  view: 'compare',
  weights: [10, 15, 10, 15, 50],
  search: 'Colegio «niños» & + /',
};
assert.deepEqual(S.decode(S.encode(shared), data, state), shared);
assert.throws(() => S.decode('#%zz', data, state));
assert.throws(() => S.decode(S.encode({ ...shared, places: [-1] }), data, state));
assert.throws(() => S.decode(S.encode({ ...shared, weights: [0, 0, 0, 0, 0] }), data, state));
// Namesakes must stay in their own territory, including municipalities named MOSQUERA.
const namesakes = data.places.filter((p) => p.town === 'MOSQUERA');
assert.ok(namesakes.length >= 2);
for (const p of namesakes) {
  const selected = E.calculate(data, { ...nationwide, places: [p.id] }, state.weights);
  assert.ok(selected.rows.length);
  assert.ok(selected.rows.every((r) => r.department === p.department && r.place === p.id));
}
const html = fs.readFileSync(__dirname + '/index.html', 'utf8'),
  app = fs.readFileSync(__dirname + '/app.js', 'utf8');
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
assert.equal(new Set(ids).size, ids.length);
for (const m of app.matchAll(/\$\('([^']+)'\)/g)) {
  if (m[1] === 'share-link') continue;
  assert.ok(ids.includes(m[1]), 'Missing DOM target ' + m[1]);
}
console.log(
  JSON.stringify(
    {
      passed: true,
      records: 72686,
      municipalities: 1116,
      schools: data.schools.length,
      annualChecks,
      regionalGoldenHistories: 66,
      checks: [
        'source SHA256',
        'all annual subject values and TOTAL',
        'national cohorts conserved',
        'historical student weighting',
        'municipality namesakes',
        'invalid filters and weights',
        'share URL roundtrip and validation',
        'HTML target IDs',
      ],
    },
    null,
    2
  )
);
