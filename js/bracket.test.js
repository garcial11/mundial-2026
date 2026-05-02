(function () {
  var t = MUNDIAL.test;
  var B = MUNDIAL.bracket;

  t.suite('bracket: buildR32 fills group winners/runners-up + thirds', function () {
    var rankings = {};
    ['A','B','C','D','E','F','G','H','I','J','K','L'].forEach(function (g) {
      rankings[g] = [g + '1', g + '2', g + '3', g + '4'];
    });
    // Thirds advance from groups A,B,C,D,E,F,G,H
    var thirds = ['A3','B3','C3','D3','E3','F3','G3','H3'];

    var r32 = B.buildR32(rankings, thirds);
    t.assertEqual(r32.length, 16, '16 R32 matches');

    var m73 = r32.find(function (m) { return m.id === 'm73'; });
    t.assertEqual([m73.teamA, m73.teamB], ['A2','B2'], 'm73 = 2A vs 2B');

    var m76 = r32.find(function (m) { return m.id === 'm76'; });
    t.assertEqual([m76.teamA, m76.teamB], ['C1','F2'], 'm76 = 1C vs 2F');
  });

  t.suite('bracket: advance() builds R16 from R32 winners', function () {
    var r32Picks = {
      m73: 'X1', m74: 'X2', m75: 'X3', m76: 'X4',
      m77: 'X5', m78: 'X6', m79: 'X7', m80: 'X8',
      m81: 'X9', m82: 'X10', m83: 'X11', m84: 'X12',
      m85: 'X13', m86: 'X14', m87: 'X15', m88: 'X16'
    };
    var r16 = B.advance('r16', { r32: r32Picks });
    t.assertEqual(r16.length, 8, '8 R16 matches');
    var m89 = r16.find(function (m) { return m.id === 'm89'; });
    t.assertEqual([m89.teamA, m89.teamB], ['X1','X2'], 'm89 = winners of m73 + m74');
  });

  t.suite('bracket: every R32 match has distinct teams (no duplicates across slots)', function () {
    var rankings = {};
    ['A','B','C','D','E','F','G','H','I','J','K','L'].forEach(function (g) {
      rankings[g] = [g + '1', g + '2', g + '3', g + '4'];
    });
    // Pick 8 thirds from a non-trivial mix to exercise the assignment solver
    var thirds = ['A3','B3','D3','E3','F3','H3','I3','J3'];
    var r32 = B.buildR32(rankings, thirds);
    var teams = [];
    r32.forEach(function (m) { teams.push(m.teamA); teams.push(m.teamB); });
    var unique = {};
    teams.forEach(function (t) { unique[t] = (unique[t] || 0) + 1; });
    var dupes = Object.keys(unique).filter(function (t) { return unique[t] > 1; });
    t.assertEqual(dupes, [], 'no team appears more than once');
    var nulls = teams.filter(function (t) { return !t; });
    t.assertEqual(nulls.length, 0, 'every slot resolved to a real team');
    t.assertEqual(teams.length, 32, '32 teams across 16 R32 matches');
  });

  t.suite('bracket: third-place match uses LOSERS of semifinals', function () {
    var sfMatches = [
      { id: 'm101', teamA: 'A', teamB: 'C' },
      { id: 'm102', teamA: 'B', teamB: 'D' }
    ];
    var sfPicks = { m101: 'A', m102: 'B' };
    var third = B.buildThirdPlace(sfMatches, sfPicks);
    t.assertEqual([third.teamA, third.teamB], ['C','D'], '3rd-place match = SF losers');
  });
})();
