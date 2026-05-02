var MUNDIAL = MUNDIAL || {};

MUNDIAL.state = (function () {
  var KEY = 'mundial2026';

  function getDefault() {
    var groupResults = {};
    ['A','B','C','D','E','F','G','H','I','J','K','L'].forEach(function (g) {
      groupResults[g] = { matches: {}, manualRanking: null };
    });
    return {
      version: 1,
      groupResults: groupResults,
      thirdPlaceAdvancing: [],
      knockout: { r32: {}, r16: {}, qf: {}, sf: {}, final: { final: null, third: null } }
    };
  }

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return getDefault();
      var parsed = JSON.parse(raw);
      if (!parsed || parsed.version !== 1) return getDefault();
      return parsed;
    } catch (e) {
      return getDefault();
    }
  }

  function save(state) {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
      return true;
    } catch (e) {
      return false;
    }
  }

  function reset() {
    try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
  }

  function isStorageAvailable() {
    try {
      var probe = '__probe__';
      localStorage.setItem(probe, probe);
      localStorage.removeItem(probe);
      return true;
    } catch (e) { return false; }
  }

  return {
    getDefault: getDefault,
    load: load,
    save: save,
    reset: reset,
    isStorageAvailable: isStorageAvailable
  };
})();
