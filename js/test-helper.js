var MUNDIAL = MUNDIAL || {};
MUNDIAL.test = (function () {
  var passed = 0, failed = 0, failures = [];

  function assert(cond, msg) {
    if (cond) { passed++; }
    else { failed++; failures.push(msg || 'assertion failed'); console.error('FAIL: ' + msg); }
  }

  function assertEqual(actual, expected, msg) {
    var a = JSON.stringify(actual), e = JSON.stringify(expected);
    assert(a === e, (msg || 'assertEqual') + '\n  expected: ' + e + '\n  actual:   ' + a);
  }

  function summary() {
    var sumEl = document.getElementById('summary');
    var total = passed + failed;
    sumEl.textContent = passed + '/' + total + ' passed' + (failed ? ' — ' + failed + ' FAILED' : '');
    sumEl.style.color = failed ? '#ff5252' : '#4caf50';
    if (failed) {
      var ul = document.getElementById('failures');
      failures.forEach(function (f) {
        var li = document.createElement('li');
        li.textContent = f;
        ul.appendChild(li);
      });
    }
  }

  function suite(name, fn) {
    console.log('— suite: ' + name);
    fn();
  }

  return { assert: assert, assertEqual: assertEqual, summary: summary, suite: suite };
})();
