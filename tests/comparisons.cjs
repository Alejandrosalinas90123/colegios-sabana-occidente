const assert = require('node:assert/strict'),
  C = require('../comparisons.js'),
  S = require('../state.js');
const annual = (score, n = 20) => ({
  score,
  total: score * 5,
  scores: [score, score, score, score, score],
  n,
});
const a = {
  id: 1,
  name: 'A',
  place: 0,
  town: 'X',
  department: 'D',
  score: 65,
  total: 325,
  scores: [65, 65, 65, 65, 65],
  students: 40,
  byYear: { 2021: annual(60), 2022: annual(70) },
};
const b = {
  id: 2,
  name: 'B',
  place: 0,
  town: 'X',
  department: 'D',
  score: 65,
  total: 325,
  scores: [65, 65, 65, 65, 65],
  students: 220,
  byYear: { 2021: annual(50, 200), 2023: annual(80) },
};
const c = {
  id: 3,
  name: 'C',
  place: 1,
  town: 'Y',
  department: 'D',
  score: 40,
  total: 200,
  scores: [40, 40, 40, 40, 40],
  students: 20,
  byYear: { 2024: annual(40) },
};
assert.equal(C.median([]), null);
assert.equal(C.median([9, 1, 5]), 5);
assert.equal(C.median([8, 2, 6, 4]), 5);
let result = C.against([a, b, c], 1, [2021, 2022, 2023], 'score');
assert.deepEqual(result[0].common, [2021]);
assert.equal(result[0].gap, -10);
assert.equal(result[0].wins, 0);
assert.equal(result[1].gap, null);
assert.equal(C.against([a, b], 1, [2021], 'total')[0].gap, -50);
assert.equal(C.against([a, { ...b, byYear: { 2021: annual(60) } }], 1, [2021], '4')[0].ties, 1);
assert.equal(C.against([a, b], 999, [2021], 'score').length, 0);
const context = C.context([a, b, c], 'score');
assert.equal(context.length, 2);
assert.equal(context[0].median, 65);
assert.equal(context[0].students, 260);
const data = {
  places: Array.from({ length: 1116 }, (_, id) => ({ id, department: id < 500 ? 'D' : 'E' })),
  years: [2021, 2022, 2023, 2024, 2025],
  schools: [{ id: 1 }, { id: 2 }],
};
const defaults = S.defaults([0]),
  state = {
    ...defaults,
    places: data.places.map((p) => p.id),
    selected: [1, 2],
    journey: { mode: 'compare', step: 'results', departments: ['D', 'E'], baseline: 2 },
  };
const hash = S.encode(state);
assert.ok(hash.length < 1000);
assert.deepEqual(S.decode(hash, data, defaults), state);
const legacy = '#' + encodeURIComponent(JSON.stringify(state));
assert.deepEqual(S.decode(legacy, data, defaults), state);
for (const range of ['0-9999999', '5-2', 'a', '0,0-1115', '1--2'])
  assert.throws(() =>
    S.decode(
      '#' + encodeURIComponent(JSON.stringify({ ...state, places: undefined, placeRanges: range })),
      data,
      defaults
    )
  );
console.log(
  'PASS: common-year differences, no-overlap, ties, metric scale, municipality medians, compact and legacy share URLs.'
);
