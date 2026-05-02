(function () {
  var t = MUNDIAL.test;
  var compute = MUNDIAL.standings.computeGroup;
  var key = MUNDIAL.data.matchKey;

  t.suite('standings: clean wins (one team sweeps)', function () {
    var teams = ['a', 'b', 'c', 'd'];
    var matches = {};
    matches[key('a','b')] = 'a';
    matches[key('a','c')] = 'a';
    matches[key('a','d')] = 'a';
    matches[key('b','c')] = 'b';
    matches[key('b','d')] = 'b';
    matches[key('c','d')] = 'c';
    var r = compute(teams, matches, null);
    t.assertEqual(r.ranked, ['a', 'b', 'c', 'd'], 'a sweeps');
    t.assertEqual(r.tiedClusters, [], 'no ties');
    t.assertEqual(r.complete, true, '6 of 6 picked');
  });

  t.suite('standings: all draws -> 4-way tie', function () {
    var teams = ['a', 'b', 'c', 'd'];
    var matches = {};
    ['a-b','a-c','a-d','b-c','b-d','c-d'].forEach(function (k) { matches[k] = 'draw'; });
    var r = compute(teams, matches, null);
    t.assertEqual(r.tiedClusters, [['a','b','c','d']], '4-way tie at 3 pts');
    t.assertEqual(r.ranked, null, 'no ranking until manual');
  });

  t.suite('standings: 4-way tie resolved by manualRanking', function () {
    var teams = ['a', 'b', 'c', 'd'];
    var matches = {};
    ['a-b','a-c','a-d','b-c','b-d','c-d'].forEach(function (k) { matches[k] = 'draw'; });
    var r = compute(teams, matches, ['c','a','d','b']);
    t.assertEqual(r.ranked, ['c','a','d','b'], 'manualRanking applied');
    t.assertEqual(r.tiedClusters, [], 'cluster resolved');
  });

  t.suite('standings: 2-way tie at top', function () {
    var teams = ['a', 'b', 'c', 'd'];
    var matches = {};
    matches[key('a','b')] = 'draw';
    matches[key('a','c')] = 'a';
    matches[key('a','d')] = 'a';
    matches[key('b','c')] = 'b';
    matches[key('b','d')] = 'b';
    matches[key('c','d')] = 'c';
    var r = compute(teams, matches, null);
    t.assertEqual(r.tiedClusters, [['a','b']], 'a and b tied at 7');
    t.assertEqual(r.ranked, null, 'awaiting manual rank');
  });

  t.suite('standings: incomplete (missing matches)', function () {
    var teams = ['a','b','c','d'];
    var matches = {};
    matches[key('a','b')] = 'a';
    var r = compute(teams, matches, null);
    t.assertEqual(r.complete, false, 'not complete');
  });
})();
