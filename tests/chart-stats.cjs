const assert = require('node:assert/strict'),
  S = require('../chart-stats.js'),
  State = require('../state.js');
const annual = (scores, score = 0, n = 10) => ({
  scores,
  score,
  total: scores.reduce((a, b) => a + b, 0),
  n,
});
const a = {
  id: 1,
  name: 'A',
  scores: [10, 20, 30, 40, 100],
  byYear: {
    2021: annual([10, 20, 30, 40, 100], 100, 1),
    2023: annual([20, 30, 40, 50, 100], 100, 100),
  },
};
const b = {
  id: 2,
  name: 'B',
  scores: [60, 60, 60, 60, 20],
  byYear: { 2021: annual([60, 60, 60, 60, 20], 20, 20) },
};
assert.equal(S.mean(a.byYear[2021]), 40);
assert.equal(S.value(a.byYear[2021], 'score'), 100);
const series = S.annual([a], [2021, 2022, 2023]);
assert.deepEqual(
  series[0].points.map((p) => p.value),
  [40, null, 48]
);
const change = S.endpoints([a, b], 2021, 2023, 'mean');
assert.equal(change[0].change, 8);
assert.equal(change[1].change, null);
assert.deepEqual(S.blend([0, 0, 0, 0, 100], 0), [0.2, 0.2, 0.2, 0.2, 0.2]);
assert.deepEqual(S.blend([0, 0, 0, 0, 100], 100), [0, 0, 0, 0, 1]);
assert.equal(S.blend([0, 0, 0, 0, 0], 50), null);
assert.equal(S.ranked([a, b], [0, 0, 0, 0, 100], 0)[0].id, 2);
assert.equal(S.ranked([a, b], [0, 0, 0, 0, 100], 100)[0].id, 1);
const equal = { ...a, id: 3, name: 'C' };
assert.deepEqual(
  S.ranked([a, equal, b], [0, 0, 0, 0, 100], 100).map((r) => r.rank),
  [1, 1, 3]
);
assert.equal(
  S.sensitivity([a, b], [a], [20, 20, 20, 20, 20])[0].points[0].rank,
  2,
  'Ranks use all eligible peers, not selected rows'
);
const q = S.quality(
  [a],
  [
    { id: 1, scores: [0, 2, 3, 4, 5] },
    { id: 2, scores: [1, 1, 1, 1, 1] },
  ],
  [1, 9],
  [2021, 2022, 2023]
);
assert.deepEqual(q, { reportedZeroRows: 1, rawRows: 1, excluded: 1, smallAnnual: 1, missing: 1 });
const data = {
    places: [{ id: 0, department: 'D' }],
    schools: [{ id: 1 }],
    years: [2021, 2022, 2023, 2024, 2025],
  },
  state = {
    ...State.defaults([0]),
    selected: [1],
    chartOptions: {
      panel: 'annual',
      scale: 'focused',
      metric: 'mean',
      year: 2023,
      from: 2021,
      to: 2023,
      strength: 37,
      highlight: 1,
    },
  };
assert.deepEqual(State.decode(State.encode(state), data, State.defaults([0])), state);
console.log(
  'PASS: annual general mean remains unweighted; missing endpoints; scenario normalization, ties and peer ranks; zero/cohort flags; chart share-state roundtrip.'
);

for (const values of [
  [60, 65],
  [0, 0],
  [100, 100],
  [null, 60],
  [30, 90],
]) {
  const bounds = S.domain(values);
  for (const v of values.filter((v) => v !== null)) assert.ok(bounds.min <= v && bounds.max >= v);
  assert.ok(bounds.max > bounds.min);
}
assert.ok(S.domain([60, 65]).min > 50);
assert.equal(S.domain([60, 65], 100, true).min, 0);
assert.equal(S.domain([60, 65], 100, true).max, 100);
assert.equal(S.domain([null]).max, 100);
