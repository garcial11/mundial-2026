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

    // Always produce a valid ranking. When teams tie on points, the default
    // order is the team's index in the input `teams` array (which is the
    // group's draw order). The user can override within tied clusters via
    // manualRanking; cross-cluster moves are silently ignored — points
    // always dominate so a higher-points team can't be demoted.
    var manualIdx = {};
    if (manualRanking && manualRanking.length === 4) {
      manualRanking.forEach(function (t, i) { manualIdx[t] = i; });
    }
    var teamIdx = {};
    teams.forEach(function (t, i) { teamIdx[t] = i; });
    var ranked = teams.slice().sort(function (a, b) {
      if (points[a] !== points[b]) return points[b] - points[a];
      var ai = manualIdx[a] !== undefined ? manualIdx[a] : null;
      var bi = manualIdx[b] !== undefined ? manualIdx[b] : null;
      if (ai !== null && bi !== null && ai !== bi) return ai - bi;
      return teamIdx[a] - teamIdx[b];
    });
    return { ranked: ranked, tiedClusters: clusters, complete: complete, points: points };
  }

  return { computeGroup: computeGroup };
})();
