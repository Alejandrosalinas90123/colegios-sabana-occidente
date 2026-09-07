/* Pure chart data. Missing years stay absent; reported zeros remain numbers. */
const ChartStats = (() => {
  const mean = (row) => row.scores.reduce((sum, score) => sum + score, 0) / 5;
  const value = (row, metric) =>
    metric === 'mean'
      ? mean(row)
      : metric === 'score'
        ? row.score
        : metric === 'total'
          ? row.total
          : row.scores[Number(metric)];
  function annual(rows, years, metric = 'mean') {
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      points: [...years].sort().map((year) => {
        const a = row.byYear[year];
        return { year, value: a ? value(a, metric) : null, n: a?.n ?? null };
      }),
    }));
  }
  function endpoints(rows, from, to, metric) {
    return rows.map((row) => {
      const a = row.byYear[from],
        b = row.byYear[to];
      return {
        id: row.id,
        name: row.name,
        from: a ? value(a, metric) : null,
        to: b ? value(b, metric) : null,
        change: a && b ? value(b, metric) - value(a, metric) : null,
        nFrom: a?.n ?? null,
        nTo: b?.n ?? null,
      };
    });
  }
  function blend(weights, strength) {
    const sum = weights.reduce((a, b) => a + b, 0);
    if (sum <= 0) return null;
    const alpha = Math.max(0, Math.min(100, strength)) / 100;
    return weights.map((w) => (1 - alpha) * 0.2 + (alpha * w) / sum);
  }
  function ranked(rows, weights, strength) {
    const w = blend(weights, strength);
    if (!w) return [];
    const list = rows
      .map((row) => ({
        id: row.id,
        name: row.name,
        score: row.scores.reduce((sum, s, i) => sum + s * w[i], 0),
      }))
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'es') || a.id - b.id);
    let previous = null,
      rank = 0;
    return list.map((row, i) => {
      if (previous === null || Math.abs(row.score - previous) > 1e-9) rank = i + 1;
      previous = row.score;
      return { ...row, rank };
    });
  }
  function sensitivity(rows, selected, weights) {
    const samples = [0, 25, 50, 75, 100].map((strength) => ({
      strength,
      ranks: new Map(ranked(rows, weights, strength).map((row) => [row.id, row])),
    }));
    return selected.map((row) => ({
      id: row.id,
      name: row.name,
      points: samples.map((sample) => ({ strength: sample.strength, ...sample.ranks.get(row.id) })),
    }));
  }
  function quality(rows, rawRecords, selectedIds, years) {
    const ids = new Set(selectedIds),
      raw = rawRecords.filter((row) => ids.has(row.id));
    return {
      reportedZeroRows: raw.filter((row) => row.scores.some((s) => s === 0)).length,
      rawRows: raw.length,
      excluded: selectedIds.filter((id) => !rows.some((row) => row.id === id)).length,
      smallAnnual: rows.flatMap((row) => Object.values(row.byYear)).filter((a) => a.n < 20).length,
      missing: rows.reduce((sum, row) => sum + years.filter((year) => !row.byYear[year]).length, 0),
    };
  }
  return { mean, value, annual, endpoints, blend, ranked, sensitivity, quality };
})();
if (typeof module !== 'undefined') module.exports = ChartStats;
