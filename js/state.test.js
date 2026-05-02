(function () {
  var t = MUNDIAL.test;
  var S = MUNDIAL.state;

  t.suite('state: getDefault returns valid empty shape', function () {
    var d = S.getDefault();
    t.assertEqual(d.version, 1, 'version 1');
    t.assertEqual(typeof d.groupResults, 'object', 'groupResults object');
    t.assertEqual(Object.keys(d.groupResults).length, 12, '12 groups');
    t.assertEqual(d.groupResults.A.matches, {}, 'group A matches empty');
    t.assertEqual(d.groupResults.A.manualRanking, null, 'manualRanking null');
    t.assertEqual(d.thirdPlaceAdvancing, [], 'thirdPlaceAdvancing empty');
    t.assertEqual(typeof d.knockout.r32, 'object', 'knockout.r32 object');
  });

  t.suite('state: save then load returns equivalent object', function () {
    S.reset();
    var src = S.getDefault();
    src.groupResults.A.matches['can-mex'] = 'mex';
    src.thirdPlaceAdvancing = ['can'];
    S.save(src);
    var loaded = S.load();
    t.assertEqual(loaded.groupResults.A.matches['can-mex'], 'mex', 'pick preserved');
    t.assertEqual(loaded.thirdPlaceAdvancing, ['can'], 'array preserved');
  });

  t.suite('state: reset wipes storage', function () {
    var src = S.getDefault();
    src.groupResults.A.matches['can-mex'] = 'mex';
    S.save(src);
    S.reset();
    var d = S.load();
    t.assertEqual(d.groupResults.A.matches, {}, 'matches empty after reset');
  });
})();
