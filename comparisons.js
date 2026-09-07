/* Descriptive comparisons of school aggregates. These are not significance tests:
   the database does not contain individual scores or repeated student samples. */
const SchoolComparisons = (() => {
  const value = (row, metric) =>
    metric === 'score' ? row.score : metric === 'total' ? row.total : row.scores[Number(metric)];
  function median(values) {
    if (!values.length) return null;
    const ordered = [...values].sort((a, b) => a - b),
      middle = Math.floor(ordered.length / 2);
    return ordered.length % 2 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2;
  }
  function against(rows, baselineId, years, metric) {
    const baseline = rows.find((row) => row.id === baselineId);
    if (!baseline) return [];
    return rows
      .filter((row) => row.id !== baselineId)
      .map((row) => {
        const common = [...years]
          .sort()
          .filter((year) => row.byYear[year] && baseline.byYear[year]);
        const differences = common.map((year) => ({
          year,
          gap: value(row.byYear[year], metric) - value(baseline.byYear[year], metric),
        }));
        return {
          id: row.id,
          name: row.name,
          common,
          differences,
          gap: common.length
            ? differences.reduce((sum, item) => sum + item.gap, 0) / common.length
            : null,
          wins: differences.filter((item) => item.gap > 1e-9).length,
          ties: differences.filter((item) => Math.abs(item.gap) <= 1e-9).length,
        };
      });
  }
  function context(rows, metric) {
    const groups = new Map();
    for (const row of rows) {
      if (!groups.has(row.place)) groups.set(row.place, []);
      groups.get(row.place).push(row);
    }
    return [...groups.values()].map((group) => ({
      place: group[0].place,
      town: group[0].town,
      department: group[0].department,
      schools: group.length,
      students: group.reduce((n, row) => n + row.students, 0),
      median: median(group.map((row) => value(row, metric))),
    }));
  }
  return { value, median, against, context };
})();
if (typeof module !== 'undefined') module.exports = SchoolComparisons;
