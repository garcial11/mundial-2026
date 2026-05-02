var MUNDIAL = MUNDIAL || {};

MUNDIAL.standings = (function () {
  function matchKey(a, b) { return a < b ? a + '-' + b : b + '-' + a; }

  function computeGroup(teams, matches, manualRanking) {
    var points = {};
    teams.forEach(function (t) { points[t] = 0; });

    var pickedCount = 0;
    for (var i = 0; i < teams.length; i++) {
      for (var j = i + 1; j < teams.length; j++) {
        var k = matchKey(teams[i], teams[j]);
        var v = matches[k];
        if (v === undefined || v === null) continue;
        pickedCount++;
        if (v === 'draw') {
          points[teams[i]] += 1;
          points[teams[j]] += 1;
        } else if (v === teams[i]) {
          points[teams[i]] += 3;
        } else if (v === teams[j]) {
          points[teams[j]] += 3;
        }
      }
    }
    var complete = pickedCount === 6;

    var sorted = teams.slice().sort(function (x, y) { return points[y] - points[x]; });

    var clusters = [];
    var i = 0;
    while (i < sorted.length) {
      var j = i + 1;
      while (j < sorted.length && points[sorted[j]] === points[sorted[i]]) j++;
      if (j - i > 1) clusters.push(sorted.slice(i, j));
      i = j;
    }

    if (clusters.length === 0) {
      return { ranked: sorted, tiedClusters: [], complete: complete, points: points };
    }
    if (manualRanking && manualRanking.length === 4) {
      // Sort by points first; manualRanking only resolves order within tied clusters.
      // Guarantees a higher-points team can never end up below a lower-points team,
      // even if a stale manualRanking from before the points changed says otherwise.
      var manualIdx = {};
      manualRanking.forEach(function (t, i) { manualIdx[t] = i; });
      var resolved = teams.slice().sort(function (a, b) {
        if (points[a] !== points[b]) return points[b] - points[a];
        var ai = manualIdx[a] === undefined ? 99 : manualIdx[a];
        var bi = manualIdx[b] === undefined ? 99 : manualIdx[b];
        return ai - bi;
      });
      return { ranked: resolved, tiedClusters: [], complete: complete, points: points };
    }
    return { ranked: null, tiedClusters: clusters, complete: complete, points: points };
  }

  return { computeGroup: computeGroup };
})();
