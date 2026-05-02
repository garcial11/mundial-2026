# Mundial 2026 Bracket Picker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a mobile-friendly static web page where a kid predicts the entire 2026 FIFA World Cup — picks every group-stage match result, manually advances 8 best third-place teams, then picks winners through R32 → R16 → QF → SF → Final + 3rd-place match. Runs locally; deploys to GitHub Pages.

**Architecture:** Single-page static site, vanilla HTML/CSS/JS with no build step. State held as one object in `localStorage`, derived data (standings, bracket pairings) recomputed on render. Pure functions (`standings`, `bracket`, `state`) are TDD'd with a tiny browser-based assertion harness; UI rendering is verified manually on desktop + mobile.

**Tech Stack:** HTML5, CSS3 (Grid + Flexbox + media queries), vanilla JavaScript (ES2015+, traditional `<script>` tags with `MUNDIAL.*` namespace so it runs from `file://`), `localStorage` for persistence, `flagcdn.com` for flag images. **DOM is built exclusively with `document.createElement` + `textContent`. No use of `innerHTML` anywhere** — clearing containers uses `while (node.firstChild) node.removeChild(node.firstChild)`.

---

## File Structure

```
mundial/
├── index.html              # Main page — hero, nav, sections, script tags
├── tests.html              # Manual test harness — runs assertions in browser
├── css/
│   └── style.css           # Dark theme, gold accents, responsive
├── js/
│   ├── data.js             # MUNDIAL.data — TEAMS, GROUPS, R32_PAIRINGS, KNOCKOUT_CHAIN
│   ├── state.js            # MUNDIAL.state — load/save/reset/getDefault
│   ├── standings.js        # MUNDIAL.standings — computeGroup() pure function
│   ├── bracket.js          # MUNDIAL.bracket — buildR32(), advance()
│   ├── dom.js              # MUNDIAL.dom — el(), clear() DOM helpers (no innerHTML)
│   └── app.js              # MUNDIAL.app — entry point, render, event wiring
└── README.md               # Run locally + deploy to GitHub Pages
```

**Module pattern:** every JS file starts with `var MUNDIAL = MUNDIAL || {};` and assigns its exports onto that namespace. No ES modules, so the page works when opened directly via `file://` (no local server needed for the kid to play with it). Tests work the same way.

**Match key convention:** within a group, a match key is the two team ids joined with `-`, sorted ascending alphabetically by id (e.g. `'can-mex'`, never `'mex-can'`). Documented in `data.js` and used by `standings.js`.

---

## Task 1: Project Scaffold + Git

**Files:**
- Create: `index.html`, `css/style.css`, `js/data.js`, `js/state.js`, `js/standings.js`, `js/bracket.js`, `js/dom.js`, `js/app.js`, `tests.html`, `README.md`, `.gitignore`

- [ ] **Step 1: Create directory structure and stub files**

```bash
cd "/Users/luisgarcia/Documents/Claude Code/Personal - Mundial"
mkdir -p css js
touch index.html tests.html README.md .gitignore
touch css/style.css
touch js/data.js js/state.js js/standings.js js/bracket.js js/dom.js js/app.js
```

- [ ] **Step 2: Write minimal `index.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <title>Mundial 2026 — Your Bracket</title>
  <link rel="stylesheet" href="css/style.css">
</head>
<body>
  <h1>Mundial 2026</h1>
  <script src="js/dom.js"></script>
  <script src="js/data.js"></script>
  <script src="js/state.js"></script>
  <script src="js/standings.js"></script>
  <script src="js/bracket.js"></script>
  <script src="js/app.js"></script>
</body>
</html>
```

- [ ] **Step 3: Write `.gitignore`**

```
.DS_Store
.vscode/
*.log
```

- [ ] **Step 4: Initialize git and commit**

```bash
git init
git add -A
git commit -m "chore: scaffold project structure"
```

Expected: `git status` shows clean working tree.

---

## Task 2: DOM Helpers (no innerHTML)

**Files:**
- Modify: `js/dom.js`

- [ ] **Step 1: Implement `MUNDIAL.dom` with `el()` and `clear()`**

```js
// js/dom.js
var MUNDIAL = MUNDIAL || {};

MUNDIAL.dom = (function () {
  // el(tag, attrs?, children?)
  //   attrs: { class, dataset: {k:v}, on: {event:handler}, attr: value, ... }
  //   children: array of strings (rendered as text), elements, or null/undefined (skipped)
  // Intentionally has NO `html`/`innerHTML` option. Use children for content.
  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (k === 'class') node.className = v;
        else if (k === 'dataset') Object.keys(v).forEach(function (d) { node.dataset[d] = v[d]; });
        else if (k === 'on') Object.keys(v).forEach(function (e) { node.addEventListener(e, v[e]); });
        else if (v === false || v === null || v === undefined) { /* skip */ }
        else if (v === true) node.setAttribute(k, '');
        else node.setAttribute(k, v);
      });
    }
    (children || []).forEach(function (c) {
      if (c === null || c === undefined || c === false) return;
      if (typeof c === 'string' || typeof c === 'number') {
        node.appendChild(document.createTextNode(String(c)));
      } else {
        node.appendChild(c);
      }
    });
    return node;
  }

  function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  return { el: el, clear: clear };
})();
```

- [ ] **Step 2: Quick smoke check in browser console**

Open `index.html`, console:
```js
var n = MUNDIAL.dom.el('div', { class: 'x' }, ['hi']);
n.outerHTML       // '<div class="x">hi</div>'
MUNDIAL.dom.clear(n);
n.children.length // 0
```

- [ ] **Step 3: Commit**

```bash
git add js/dom.js
git commit -m "feat(dom): el/clear helpers (no innerHTML)"
```

---

## Task 3: Static Team & Group Data

**Files:**
- Modify: `js/data.js`

**Note before starting:** the 2026 World Cup draw places 48 teams into 12 groups (A–L). Some intercontinental playoff slots may still be TBD as of implementation time. Fetch the official draw from FIFA or Wikipedia (`https://en.wikipedia.org/wiki/2026_FIFA_World_Cup`) and populate the actual draw. For any unconfirmed playoff team, use a placeholder id like `tbd_a4` with `name: 'TBD A4'` and `code: 'un'` (UN flag, neutral placeholder).

- [ ] **Step 1: Write the IIFE skeleton + TEAMS in `js/data.js`**

```js
// js/data.js
var MUNDIAL = MUNDIAL || {};

MUNDIAL.data = (function () {
  // ISO 3166-1 alpha-2 codes used for flagcdn.com URLs.
  // Placeholder code 'un' renders a neutral globe; used for unconfirmed playoff slots.
  var TEAMS = {
    'can': { name: 'Canada',        code: 'ca' },
    'mex': { name: 'Mexico',        code: 'mx' },
    'usa': { name: 'United States', code: 'us' }
    // ... populate the remaining 45 teams from the official 2026 draw
    // Use 'tbd_<group><slot>' ids for unconfirmed playoff teams,
    // e.g. 'tbd_b4' with { name: 'TBD B4', code: 'un' }
  };

  function matchKey(idA, idB) {
    return idA < idB ? idA + '-' + idB : idB + '-' + idA;
  }

  function flagUrl(teamId) {
    var team = TEAMS[teamId];
    if (!team) return 'https://flagcdn.com/w160/un.png';
    return 'https://flagcdn.com/w160/' + team.code + '.png';
  }

  // Placeholder GROUPS, R32_PAIRINGS, KNOCKOUT_CHAIN added in next steps
  var GROUPS = {};
  var R32_PAIRINGS = [];
  var KNOCKOUT_CHAIN = {};

  return {
    TEAMS: TEAMS,
    GROUPS: GROUPS,
    R32_PAIRINGS: R32_PAIRINGS,
    KNOCKOUT_CHAIN: KNOCKOUT_CHAIN,
    matchKey: matchKey,
    flagUrl: flagUrl
  };
})();
```

- [ ] **Step 2: Add the GROUPS object inside the IIFE (replace the empty placeholder)**

```js
// Populated from the official 2026 FIFA draw. Each group has exactly 4 team ids.
// IMPORTANT: replace placeholders with the real qualified teams from the official 2026 draw.
// Hosts are pre-assigned per FIFA (verify against current Wikipedia article at
// implementation time; host group/slot assignments may have been revised).
var GROUPS = {
  A: ['mex', 'tbd_a2', 'tbd_a3', 'tbd_a4'],
  B: ['can', 'tbd_b2', 'tbd_b3', 'tbd_b4'],
  C: ['usa', 'tbd_c2', 'tbd_c3', 'tbd_c4'],
  D: ['tbd_d1', 'tbd_d2', 'tbd_d3', 'tbd_d4'],
  E: ['tbd_e1', 'tbd_e2', 'tbd_e3', 'tbd_e4'],
  F: ['tbd_f1', 'tbd_f2', 'tbd_f3', 'tbd_f4'],
  G: ['tbd_g1', 'tbd_g2', 'tbd_g3', 'tbd_g4'],
  H: ['tbd_h1', 'tbd_h2', 'tbd_h3', 'tbd_h4'],
  I: ['tbd_i1', 'tbd_i2', 'tbd_i3', 'tbd_i4'],
  J: ['tbd_j1', 'tbd_j2', 'tbd_j3', 'tbd_j4'],
  K: ['tbd_k1', 'tbd_k2', 'tbd_k3', 'tbd_k4'],
  L: ['tbd_l1', 'tbd_l2', 'tbd_l3', 'tbd_l4']
};
```

- [ ] **Step 3: Smoke check in browser console**

Open `index.html`, console:
```js
MUNDIAL.data.TEAMS['mex'].name           // 'Mexico'
MUNDIAL.data.matchKey('mex', 'can')      // 'can-mex'
MUNDIAL.data.flagUrl('mex')              // 'https://flagcdn.com/w160/mx.png'
Object.keys(MUNDIAL.data.GROUPS).length  // 12
```

- [ ] **Step 4: Commit**

```bash
git add js/data.js
git commit -m "feat(data): TEAMS, GROUPS, flagUrl, matchKey"
```

---

## Task 4: R32 Pairings + Knockout Chain Tables

**Files:**
- Modify: `js/data.js`

- [ ] **Step 1: Add `R32_PAIRINGS` array (replace empty placeholder)**

```js
// Source: FIFA 2026 knockout bracket (Wikipedia: "2026 FIFA World Cup knockout stage").
// slotA / slotB use one of:
//   '1X' / '2X'    — winner / runner-up of group X (X in A..L)
//   '3rd-of-XYZ…'  — best 3rd-place team from the listed groups (FIFA allocation table)
var R32_PAIRINGS = [
  { id: 'm73', slotA: '2A', slotB: '2B' },
  { id: 'm74', slotA: '1E', slotB: '3rd-of-ABCDF' },
  { id: 'm75', slotA: '1F', slotB: '2C' },
  { id: 'm76', slotA: '1C', slotB: '2F' },
  { id: 'm77', slotA: '1I', slotB: '3rd-of-CDFGH' },
  { id: 'm78', slotA: '2E', slotB: '2I' },
  { id: 'm79', slotA: '1A', slotB: '3rd-of-CEFHI' },
  { id: 'm80', slotA: '1L', slotB: '3rd-of-EHIJK' },
  { id: 'm81', slotA: '1D', slotB: '3rd-of-BEFIJ' },
  { id: 'm82', slotA: '1G', slotB: '3rd-of-AEHIJ' },
  { id: 'm83', slotA: '2K', slotB: '2L' },
  { id: 'm84', slotA: '1H', slotB: '2J' },
  { id: 'm85', slotA: '1B', slotB: '3rd-of-EFGIJ' },
  { id: 'm86', slotA: '1J', slotB: '2H' },
  { id: 'm87', slotA: '1K', slotB: '3rd-of-DEIJL' },
  { id: 'm88', slotA: '2D', slotB: '2G' }
];
```

- [ ] **Step 2: Add the deterministic `KNOCKOUT_CHAIN`**

```js
// IDs continue sequentially: R16 = m89..m96, QF = m97..m100, SF = m101..m102,
// 3rd-place match = m103, Final = m104.
// Verify the R16 pairings against Wikipedia's "2026 FIFA World Cup knockout stage"
// at implementation time; chain below pairs R32 matches sequentially (73↔74, 75↔76, …).
var KNOCKOUT_CHAIN = {
  r16: [
    { id: 'm89', slotA: 'winner-of-m73', slotB: 'winner-of-m74' },
    { id: 'm90', slotA: 'winner-of-m75', slotB: 'winner-of-m76' },
    { id: 'm91', slotA: 'winner-of-m77', slotB: 'winner-of-m78' },
    { id: 'm92', slotA: 'winner-of-m79', slotB: 'winner-of-m80' },
    { id: 'm93', slotA: 'winner-of-m81', slotB: 'winner-of-m82' },
    { id: 'm94', slotA: 'winner-of-m83', slotB: 'winner-of-m84' },
    { id: 'm95', slotA: 'winner-of-m85', slotB: 'winner-of-m86' },
    { id: 'm96', slotA: 'winner-of-m87', slotB: 'winner-of-m88' }
  ],
  qf: [
    { id: 'm97',  slotA: 'winner-of-m89', slotB: 'winner-of-m90' },
    { id: 'm98',  slotA: 'winner-of-m91', slotB: 'winner-of-m92' },
    { id: 'm99',  slotA: 'winner-of-m93', slotB: 'winner-of-m94' },
    { id: 'm100', slotA: 'winner-of-m95', slotB: 'winner-of-m96' }
  ],
  sf: [
    { id: 'm101', slotA: 'winner-of-m97', slotB: 'winner-of-m98' },
    { id: 'm102', slotA: 'winner-of-m99', slotB: 'winner-of-m100' }
  ],
  third: { id: 'm103', slotA: 'loser-of-m101',  slotB: 'loser-of-m102' },
  final: { id: 'm104', slotA: 'winner-of-m101', slotB: 'winner-of-m102' }
};
```

- [ ] **Step 3: Smoke check in console**

```js
MUNDIAL.data.R32_PAIRINGS.length              // 16
MUNDIAL.data.KNOCKOUT_CHAIN.r16.length        // 8
MUNDIAL.data.KNOCKOUT_CHAIN.final.id          // 'm104'
```

- [ ] **Step 4: Commit**

```bash
git add js/data.js
git commit -m "feat(data): R32 pairings + knockout chain tables"
```

---

## Task 5: Tiny Test Harness

**Files:**
- Create: `tests.html`, `js/test-helper.js`

- [ ] **Step 1: Write `js/test-helper.js`**

```js
// js/test-helper.js
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
```

- [ ] **Step 2: Write `tests.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Mundial 2026 — Tests</title>
  <style>
    body { font-family: system-ui, sans-serif; padding: 20px; background: #0a0e1a; color: #eee; }
    #summary { font-size: 24px; font-weight: bold; }
    #failures { color: #ff5252; }
  </style>
</head>
<body>
  <h1>Mundial 2026 — Tests</h1>
  <p id="summary">running…</p>
  <ul id="failures"></ul>
  <script src="js/test-helper.js"></script>
  <script src="js/dom.js"></script>
  <script src="js/data.js"></script>
  <script src="js/state.js"></script>
  <script src="js/standings.js"></script>
  <script src="js/bracket.js"></script>
  <!-- additional test files added in later tasks -->
  <script>
    MUNDIAL.test.suite('harness', function () {
      MUNDIAL.test.assert(true, 'true is true');
      MUNDIAL.test.assertEqual(1 + 1, 2, '1+1=2');
    });
    MUNDIAL.test.summary();
  </script>
</body>
</html>
```

- [ ] **Step 3: Run tests**

Open `tests.html` in a browser. Expected on page: `2/2 passed` in green. Console: `— suite: harness`, no errors.

- [ ] **Step 4: Commit**

```bash
git add tests.html js/test-helper.js
git commit -m "test: tiny in-browser assertion harness"
```

---

## Task 6: Standings Logic with Tests

**Files:**
- Modify: `js/standings.js`
- Create: `js/standings.test.js`
- Modify: `tests.html`

- [ ] **Step 1: Write the failing test file `js/standings.test.js`**

```js
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
```

- [ ] **Step 2: Add the test script to `tests.html`** (just before the inline `<script>` that calls `summary()`)

```html
<script src="js/standings.test.js"></script>
```

- [ ] **Step 3: Run tests, confirm they fail**

Open `tests.html`. Expected: red summary with errors like `Cannot read properties of undefined (reading 'computeGroup')`.

- [ ] **Step 4: Implement `standings.js`**

```js
// js/standings.js
var MUNDIAL = MUNDIAL || {};

MUNDIAL.standings = (function () {
  function matchKey(a, b) { return a < b ? a + '-' + b : b + '-' + a; }

  // teams: [4 ids]
  // matches: { 'a-b': winnerId | 'draw', ... }
  // manualRanking: [4 ids in chosen order] | null
  // Returns: { ranked: [4 ids] | null, tiedClusters: [[ids], …], complete: bool, points: {id: n} }
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
      return { ranked: manualRanking.slice(), tiedClusters: [], complete: complete, points: points };
    }
    return { ranked: null, tiedClusters: clusters, complete: complete, points: points };
  }

  return { computeGroup: computeGroup };
})();
```

- [ ] **Step 5: Run tests, confirm all pass**

Open `tests.html`. Expected: green summary, total includes the 7 new assertions plus the 2 from the harness suite.

- [ ] **Step 6: Commit**

```bash
git add js/standings.js js/standings.test.js tests.html
git commit -m "feat(standings): compute group standings with manual tiebreaker"
```

---

## Task 7: State Management with Tests

**Files:**
- Modify: `js/state.js`
- Create: `js/state.test.js`
- Modify: `tests.html`

- [ ] **Step 1: Write the failing tests `js/state.test.js`**

```js
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
```

- [ ] **Step 2: Add the test script to `tests.html`**

```html
<script src="js/state.test.js"></script>
```

- [ ] **Step 3: Run, confirm failures**

Errors: `MUNDIAL.state` undefined.

- [ ] **Step 4: Implement `state.js`**

```js
// js/state.js
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
```

- [ ] **Step 5: Run, confirm pass**

- [ ] **Step 6: Commit**

```bash
git add js/state.js js/state.test.js tests.html
git commit -m "feat(state): localStorage-backed state with versioning + reset"
```

---

## Task 8: Bracket Logic with Tests

**Files:**
- Modify: `js/bracket.js`
- Create: `js/bracket.test.js`
- Modify: `tests.html`

- [ ] **Step 1: Write failing tests `js/bracket.test.js`**

```js
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
```

- [ ] **Step 2: Add the test script to `tests.html`**

```html
<script src="js/bracket.test.js"></script>
```

- [ ] **Step 3: Run, confirm failures**

- [ ] **Step 4: Implement `js/bracket.js`**

```js
// js/bracket.js
var MUNDIAL = MUNDIAL || {};

MUNDIAL.bracket = (function () {
  function getData() { return MUNDIAL.data; }

  function resolveSlot(slot, groupRankings, thirdsByGroup) {
    if (slot[0] === '1' || slot[0] === '2') {
      var pos = slot[0] === '1' ? 0 : 1;
      var grp = slot.slice(1);
      var ranking = groupRankings[grp];
      return ranking ? ranking[pos] : null;
    }
    if (slot.indexOf('3rd-of-') === 0) {
      var groups = slot.slice('3rd-of-'.length).split('');
      for (var i = 0; i < groups.length; i++) {
        if (thirdsByGroup[groups[i]]) return thirdsByGroup[groups[i]];
      }
      return null;
    }
    return null;
  }

  function buildR32(groupRankings, thirdPlaceAdvancing) {
    var thirdsByGroup = {};
    Object.keys(groupRankings).forEach(function (g) {
      var thirdId = groupRankings[g] && groupRankings[g][2];
      if (thirdPlaceAdvancing.indexOf(thirdId) !== -1) {
        thirdsByGroup[g] = thirdId;
      }
    });

    return getData().R32_PAIRINGS.map(function (p) {
      return {
        id: p.id,
        teamA: resolveSlot(p.slotA, groupRankings, thirdsByGroup),
        teamB: resolveSlot(p.slotB, groupRankings, thirdsByGroup)
      };
    });
  }

  // round in {'r16','qf','sf','final'}
  // picks: { r32: {...}, r16: {...}, qf: {...}, sf: {...} }
  function advance(round, picks) {
    var chain = getData().KNOCKOUT_CHAIN;
    function winnerOf(matchId) {
      var rounds = ['r32','r16','qf','sf'];
      for (var i = 0; i < rounds.length; i++) {
        var p = picks[rounds[i]];
        if (p && p[matchId]) return p[matchId];
      }
      return null;
    }
    var template;
    if (round === 'r16') template = chain.r16;
    else if (round === 'qf') template = chain.qf;
    else if (round === 'sf') template = chain.sf;
    else if (round === 'final') template = [chain.final];
    else throw new Error('unknown round: ' + round);

    return template.map(function (m) {
      var aId = m.slotA.replace('winner-of-', '');
      var bId = m.slotB.replace('winner-of-', '');
      return { id: m.id, teamA: winnerOf(aId), teamB: winnerOf(bId) };
    });
  }

  function buildThirdPlace(sfMatches, sfPicks) {
    function loserOf(match, winner) {
      if (match.teamA === winner) return match.teamB;
      if (match.teamB === winner) return match.teamA;
      return null;
    }
    var chain = getData().KNOCKOUT_CHAIN;
    var sf1 = sfMatches.find(function (m) { return m.id === 'm101'; });
    var sf2 = sfMatches.find(function (m) { return m.id === 'm102'; });
    return {
      id: chain.third.id,
      teamA: sf1 ? loserOf(sf1, sfPicks.m101) : null,
      teamB: sf2 ? loserOf(sf2, sfPicks.m102) : null
    };
  }

  return {
    buildR32: buildR32,
    advance: advance,
    buildThirdPlace: buildThirdPlace,
    resolveSlot: resolveSlot
  };
})();
```

- [ ] **Step 5: Run, confirm pass**

- [ ] **Step 6: Commit**

```bash
git add js/bracket.js js/bracket.test.js tests.html
git commit -m "feat(bracket): R32 builder + advance through rounds + 3rd-place"
```

---

## Task 9: Page Skeleton + Dark/Gold Theme

**Files:**
- Modify: `index.html`, `css/style.css`

- [ ] **Step 1: Replace `index.html` body with full structure**

```html
<body>
  <header class="hero">
    <h1>MUNDIAL 2026</h1>
    <p class="subtitle">YOUR BRACKET</p>
    <button id="reset-btn" class="btn-secondary" type="button">Reset bracket</button>
  </header>

  <nav class="sticky-nav" aria-label="Sections">
    <a href="#groups">Groups</a>
    <a href="#thirds">3rd Place</a>
    <a href="#r32">R32</a>
    <a href="#r16">R16</a>
    <a href="#qf">QF</a>
    <a href="#sf">SF</a>
    <a href="#final">Final</a>
  </nav>

  <main>
    <section id="groups" aria-labelledby="groups-h">
      <h2 id="groups-h">Groups</h2>
      <div id="groups-container"></div>
    </section>

    <section id="thirds" aria-labelledby="thirds-h" class="locked">
      <h2 id="thirds-h">Best Third-Place Teams</h2>
      <p class="lock-note">Complete all groups to unlock.</p>
      <div id="thirds-container"></div>
    </section>

    <section id="r32"   aria-labelledby="r32-h"   class="locked"><h2 id="r32-h">Round of 32</h2><div id="r32-container"></div></section>
    <section id="r16"   aria-labelledby="r16-h"   class="locked"><h2 id="r16-h">Round of 16</h2><div id="r16-container"></div></section>
    <section id="qf"    aria-labelledby="qf-h"    class="locked"><h2 id="qf-h">Quarterfinals</h2><div id="qf-container"></div></section>
    <section id="sf"    aria-labelledby="sf-h"    class="locked"><h2 id="sf-h">Semifinals</h2><div id="sf-container"></div></section>
    <section id="final" aria-labelledby="final-h" class="locked"><h2 id="final-h">Final &amp; 3rd Place</h2><div id="final-container"></div></section>

    <section id="champion" hidden aria-labelledby="champion-h">
      <h2 id="champion-h">Champion</h2>
      <div id="champion-container"></div>
    </section>
  </main>

  <div id="storage-warning" hidden class="banner">
    Picks won't be saved — enable browser storage to persist your bracket.
  </div>

  <script src="js/dom.js"></script>
  <script src="js/data.js"></script>
  <script src="js/state.js"></script>
  <script src="js/standings.js"></script>
  <script src="js/bracket.js"></script>
  <script src="js/app.js"></script>
</body>
```

- [ ] **Step 2: Write the dark/gold theme in `css/style.css`**

```css
:root {
  --bg: #0a0e1a;
  --bg-card: #141a2c;
  --bg-card-hi: #1c2440;
  --text: #e8ecf5;
  --text-dim: #8993ad;
  --gold: #d4a017;
  --gold-hi: #f0c040;
  --red: #ff5252;
  --green: #4caf50;
  --border: #2a3354;
  --radius: 10px;
  --tap: 44px;
}

* { box-sizing: border-box; }

html, body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font-family: 'Inter', system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
  font-size: 16px;
  line-height: 1.4;
}

.hero {
  text-align: center;
  padding: 32px 16px 24px;
  background: linear-gradient(180deg, #0e1428 0%, var(--bg) 100%);
  border-bottom: 2px solid var(--gold);
}
.hero h1 {
  margin: 0;
  font-size: clamp(28px, 6vw, 44px);
  letter-spacing: 0.08em;
  color: var(--gold);
  font-weight: 800;
}
.hero .subtitle {
  margin: 4px 0 16px;
  color: var(--text-dim);
  letter-spacing: 0.2em;
  font-size: 12px;
}

.sticky-nav {
  position: sticky; top: 0; z-index: 10;
  display: flex; gap: 8px;
  overflow-x: auto;
  padding: 10px 12px;
  background: rgba(10,14,26,0.95);
  backdrop-filter: blur(8px);
  border-bottom: 1px solid var(--border);
  -webkit-overflow-scrolling: touch;
}
.sticky-nav a {
  flex: 0 0 auto;
  color: var(--text-dim);
  text-decoration: none;
  padding: 10px 14px;
  border-radius: var(--radius);
  font-size: 14px;
  min-height: var(--tap);
  display: inline-flex;
  align-items: center;
  border: 1px solid transparent;
}
.sticky-nav a:hover, .sticky-nav a:focus { color: var(--gold); border-color: var(--border); }

main { padding: 16px; max-width: 1100px; margin: 0 auto; }

section { margin-bottom: 40px; scroll-margin-top: 70px; }
section h2 {
  font-size: clamp(20px, 3.5vw, 28px);
  letter-spacing: 0.05em;
  color: var(--gold);
  border-bottom: 1px solid var(--border);
  padding-bottom: 8px;
  margin-bottom: 16px;
}
section.locked { opacity: 0.45; pointer-events: none; }
section.locked .lock-note { color: var(--text-dim); font-style: italic; }

.btn-secondary {
  background: transparent;
  color: var(--text);
  border: 1px solid var(--border);
  padding: 10px 18px;
  border-radius: var(--radius);
  cursor: pointer;
  min-height: var(--tap);
  font-size: 14px;
}
.btn-secondary:hover { border-color: var(--gold); color: var(--gold); }

.banner {
  position: fixed;
  bottom: 16px; left: 16px; right: 16px;
  background: var(--red);
  color: white;
  padding: 12px;
  border-radius: var(--radius);
  text-align: center;
  z-index: 100;
}

@media (min-width: 600px) {
  #groups-container { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
}
@media (min-width: 900px) {
  #groups-container { grid-template-columns: 1fr 1fr 1fr; }
}
```

- [ ] **Step 3: Smoke check**

Open `index.html`. Expected: dark page with gold "MUNDIAL 2026" heading, sticky nav, section headers visible (most sections greyed-out due to `.locked`).

- [ ] **Step 4: Commit**

```bash
git add index.html css/style.css
git commit -m "feat(ui): hero, sticky nav, dark + gold theme, section scaffolds"
```

---

## Task 10: Render Group Cards with Match Pickers

**Files:**
- Modify: `js/app.js`, `css/style.css`

- [ ] **Step 1: Implement initial `js/app.js` with the render scaffold**

```js
// js/app.js
var MUNDIAL = MUNDIAL || {};

MUNDIAL.app = (function () {
  var data = MUNDIAL.data;
  var state = MUNDIAL.state;
  var standings = MUNDIAL.standings;
  var dom = MUNDIAL.dom;
  var el = dom.el, clear = dom.clear;
  var current; // live state object

  function teamLabel(teamId) {
    var team = data.TEAMS[teamId];
    return team ? team.name : teamId;
  }

  function flagImg(teamId) {
    return el('img', {
      src: data.flagUrl(teamId),
      alt: '',
      class: 'flag',
      loading: 'lazy',
      width: 32,
      height: 22
    });
  }

  // Determines whether changing a pick at `round` would invalidate later picks.
  // Order: groups, r32, r16, qf, sf, final.
  function hasDownstream(round) {
    var order = ['groups','r32','r16','qf','sf','final'];
    var idx = order.indexOf(round);
    for (var i = idx + 1; i < order.length; i++) {
      var r = order[i];
      if (r === 'final') {
        if (current.knockout.final.final || current.knockout.final.third) return true;
      } else if (r !== 'groups') {
        var p = current.knockout[r];
        if (Object.keys(p).some(function (k) { return p[k]; })) return true;
      }
    }
    return false;
  }

  function clearAllAfter(round) {
    var order = ['groups','r32','r16','qf','sf','final'];
    var idx = order.indexOf(round);
    for (var i = idx + 1; i < order.length; i++) {
      var r = order[i];
      if (r === 'final') current.knockout.final = { final: null, third: null };
      else if (r !== 'groups') current.knockout[r] = {};
    }
  }

  // Returns true if the change should proceed (either no downstream, or user confirmed).
  function confirmIfDownstream(round) {
    if (!hasDownstream(round)) return true;
    return window.confirm('This will clear your later picks. Continue?');
  }

  function renderMatchPicker(group, teamA, teamB) {
    var key = data.matchKey(teamA, teamB);
    var currentPick = current.groupResults[group].matches[key];

    function row(value, label, teamId) {
      var selected = currentPick === value;
      return el('button', {
        type: 'button',
        class: 'match-row' + (selected ? ' selected' : ''),
        on: {
          click: function () {
            var next = (currentPick === value) ? undefined : value;
            if (next === currentPick) return;
            if (!confirmIfDownstream('groups')) return;
            if (next === undefined) delete current.groupResults[group].matches[key];
            else current.groupResults[group].matches[key] = next;
            current.groupResults[group].manualRanking = null;
            clearAllAfter('groups');
            state.save(current);
            renderAll();
          }
        }
      }, [
        teamId ? flagImg(teamId) : null,
        el('span', { class: 'match-row-label' }, [label])
      ]);
    }

    return el('div', { class: 'match' }, [
      row(teamA, teamLabel(teamA) + ' wins', teamA),
      row('draw', 'Draw', null),
      row(teamB, teamLabel(teamB) + ' wins', teamB)
    ]);
  }

  function renderGroup(group) {
    var teams = data.GROUPS[group];
    var pairs = [];
    for (var i = 0; i < teams.length; i++) {
      for (var j = i + 1; j < teams.length; j++) pairs.push([teams[i], teams[j]]);
    }
    return el('article', { class: 'group-card', dataset: { group: group } }, [
      el('h3', null, ['Group ' + group]),
      el('ul', { class: 'team-list' }, teams.map(function (t) {
        return el('li', null, [flagImg(t), el('span', null, [teamLabel(t)])]);
      })),
      el('div', { class: 'matches' }, pairs.map(function (p) { return renderMatchPicker(group, p[0], p[1]); }))
      // standings + tiebreaker added in later tasks
    ]);
  }

  function renderGroups() {
    var container = document.getElementById('groups-container');
    clear(container);
    Object.keys(data.GROUPS).forEach(function (g) {
      container.appendChild(renderGroup(g));
    });
  }

  function renderAll() {
    renderGroups();
    // renderThirdPlace() / renderKnockouts() / renderChampion() added in later tasks
  }

  function init() {
    if (!state.isStorageAvailable()) {
      document.getElementById('storage-warning').hidden = false;
    }
    current = state.load();
    document.getElementById('reset-btn').addEventListener('click', function () {
      if (window.confirm('Reset the entire bracket? This will delete all picks.')) {
        state.reset();
        current = state.load();
        renderAll();
      }
    });
    renderAll();
  }

  document.addEventListener('DOMContentLoaded', init);

  return { renderAll: renderAll };
})();
```

- [ ] **Step 2: Add group + match styles to `css/style.css`**

```css
.group-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 14px;
}
.group-card h3 {
  margin: 0 0 10px;
  color: var(--gold);
  font-size: 18px;
  letter-spacing: 0.05em;
}
.team-list {
  list-style: none; margin: 0 0 12px; padding: 0;
  display: flex; flex-wrap: wrap; gap: 6px 12px; font-size: 14px;
}
.team-list li { display: inline-flex; align-items: center; gap: 6px; }

.flag {
  width: 24px; height: 16px; object-fit: cover;
  border-radius: 2px; border: 1px solid rgba(255,255,255,0.08);
}

.match {
  display: grid; grid-template-columns: 1fr; gap: 4px;
  margin-bottom: 10px; padding: 8px;
  background: var(--bg-card-hi); border-radius: 8px;
}
.match-row {
  display: flex; align-items: center; gap: 10px;
  background: transparent; color: var(--text);
  border: 1px solid var(--border);
  padding: 8px 10px; border-radius: 6px;
  min-height: var(--tap);
  font: inherit; text-align: left; cursor: pointer;
}
.match-row .flag { width: 28px; height: 18px; }
.match-row.selected {
  border-color: var(--gold);
  background: rgba(212,160,23,0.12);
  color: var(--gold-hi);
}
.match-row:focus { outline: 2px solid var(--gold); outline-offset: 1px; }
```

- [ ] **Step 3: Smoke test**

Open `index.html`. Expected: 12 group cards (one per row on phone, 2/3-up on wider). Each shows 4 teams + 6 match rows. Tapping a row highlights gold. Refresh → selection persists.

- [ ] **Step 4: Commit**

```bash
git add js/app.js css/style.css
git commit -m "feat(ui): group cards with tap-to-pick match rows + persistence"
```

---

## Task 11: Live Standings Table per Group

**Files:**
- Modify: `js/app.js`, `css/style.css`

- [ ] **Step 1: Add `renderStandingsTable(group, s)` and integrate into `renderGroup`**

In `js/app.js`, add inside the IIFE (before `renderGroup`):

```js
function computeWdl(group) {
  var teams = data.GROUPS[group];
  var matches = current.groupResults[group].matches;
  var wdl = {};
  teams.forEach(function (t) { wdl[t] = { w: 0, d: 0, l: 0 }; });
  for (var i = 0; i < teams.length; i++) {
    for (var j = i + 1; j < teams.length; j++) {
      var k = data.matchKey(teams[i], teams[j]);
      var v = matches[k];
      if (!v) continue;
      if (v === 'draw') { wdl[teams[i]].d++; wdl[teams[j]].d++; }
      else if (v === teams[i]) { wdl[teams[i]].w++; wdl[teams[j]].l++; }
      else if (v === teams[j]) { wdl[teams[j]].w++; wdl[teams[i]].l++; }
    }
  }
  return wdl;
}

function renderStandingsTable(group, s) {
  var teams = data.GROUPS[group];
  var wdl = computeWdl(group);

  var thead = el('thead', null, [el('tr', null,
    ['#','Team','W','D','L','Pts'].map(function (h) { return el('th', null, [h]); })
  )]);

  var displayOrder = s.ranked
    ? s.ranked
    : teams.slice().sort(function (a, b) { return s.points[b] - s.points[a]; });

  var rows = displayOrder.map(function (t, idx) {
    var pos = idx + 1;
    var cls = pos <= 2 ? 'standings-advance' : (pos === 3 ? 'standings-third' : '');
    return el('tr', { class: cls }, [
      el('td', null, [String(pos)]),
      el('td', { class: 'standings-team' }, [flagImg(t), el('span', null, [' ' + teamLabel(t)])]),
      el('td', null, [String(wdl[t].w)]),
      el('td', null, [String(wdl[t].d)]),
      el('td', null, [String(wdl[t].l)]),
      el('td', null, [String(s.points[t])])
    ]);
  });

  var children = [el('table', { class: 'standings' }, [thead, el('tbody', null, rows)])];
  if (s.tiedClusters.length > 0) {
    children.push(el('p', { class: 'tie-note' }, ['Tie detected — set the order below to continue.']));
  }
  return el('div', { class: 'standings-wrap' }, children);
}
```

- [ ] **Step 2: Modify `renderGroup` to compute `s` once and pass it to the standings render**

Replace the existing `renderGroup` body:

```js
function renderGroup(group) {
  var teams = data.GROUPS[group];
  var gr = current.groupResults[group];
  var s = standings.computeGroup(teams, gr.matches, gr.manualRanking);

  var pairs = [];
  for (var i = 0; i < teams.length; i++) {
    for (var j = i + 1; j < teams.length; j++) pairs.push([teams[i], teams[j]]);
  }

  return el('article', { class: 'group-card', dataset: { group: group } }, [
    el('h3', null, ['Group ' + group]),
    el('ul', { class: 'team-list' }, teams.map(function (t) {
      return el('li', null, [flagImg(t), el('span', null, [teamLabel(t)])]);
    })),
    el('div', { class: 'matches' }, pairs.map(function (p) { return renderMatchPicker(group, p[0], p[1]); })),
    renderStandingsTable(group, s)
    // tiebreaker widget added in next task
  ]);
}
```

- [ ] **Step 3: Add standings styles to `css/style.css`**

```css
.standings { width: 100%; margin-top: 12px; border-collapse: collapse; font-size: 13px; }
.standings th, .standings td { padding: 6px 4px; border-bottom: 1px solid var(--border); text-align: center; }
.standings th { color: var(--text-dim); font-weight: 600; letter-spacing: 0.05em; font-size: 11px; text-transform: uppercase; }
.standings .standings-team { text-align: left; }
.standings tr.standings-advance { color: var(--gold-hi); font-weight: 600; }
.tie-note { color: var(--gold); font-size: 13px; margin-top: 6px; }
```

- [ ] **Step 4: Smoke test**

Open `index.html`. Pick a few group matches in any group. Expected: standings table updates immediately with W/D/L/Pts. Top 2 rows show in gold. If you create a 4-way tie (all draws), the "Tie detected" note appears.

- [ ] **Step 5: Commit**

```bash
git add js/app.js css/style.css
git commit -m "feat(ui): live standings table per group"
```

---

## Task 12: Tiebreaker Widget

**Files:**
- Modify: `js/app.js`, `css/style.css`

- [ ] **Step 1: Implement `renderTiebreaker(group, s, teams)`**

Inside the IIFE, after `renderStandingsTable`:

```js
function renderTiebreaker(group, s, teams) {
  if (s.tiedClusters.length === 0) return null;
  // Initial proposed order: existing manualRanking, otherwise points desc with alphabetical break
  var ordered = (current.groupResults[group].manualRanking || teams.slice().sort(function (a, b) {
    var dp = s.points[b] - s.points[a];
    if (dp !== 0) return dp;
    return a < b ? -1 : 1;
  })).slice();

  function move(idx, dir) {
    var next = idx + dir;
    if (next < 0 || next >= ordered.length) return;
    var tmp = ordered[idx]; ordered[idx] = ordered[next]; ordered[next] = tmp;
    if (!confirmIfDownstream('groups')) return;
    current.groupResults[group].manualRanking = ordered.slice();
    clearAllAfter('groups');
    state.save(current);
    renderAll();
  }

  return el('div', { class: 'tiebreaker' }, [
    el('p', { class: 'tiebreaker-h' }, ['Order the teams:']),
    el('ol', { class: 'tiebreaker-list' }, ordered.map(function (t, idx) {
      return el('li', null, [
        flagImg(t),
        el('span', { class: 'tiebreaker-name' }, [teamLabel(t) + ' (' + s.points[t] + ' pts)']),
        el('button', {
          type: 'button',
          class: 'tb-btn',
          'aria-label': 'Move ' + teamLabel(t) + ' up',
          on: { click: function () { move(idx, -1); } }
        }, ['↑']),
        el('button', {
          type: 'button',
          class: 'tb-btn',
          'aria-label': 'Move ' + teamLabel(t) + ' down',
          on: { click: function () { move(idx, 1); } }
        }, ['↓'])
      ]);
    }))
  ]);
}
```

- [ ] **Step 2: Append tiebreaker after standings in `renderGroup`**

Replace the article children to include `renderTiebreaker(group, s, teams)` as the last (possibly null) child. Children that are null are skipped by `el()`:

```js
return el('article', { class: 'group-card', dataset: { group: group } }, [
  el('h3', null, ['Group ' + group]),
  el('ul', { class: 'team-list' }, teams.map(function (t) {
    return el('li', null, [flagImg(t), el('span', null, [teamLabel(t)])]);
  })),
  el('div', { class: 'matches' }, pairs.map(function (p) { return renderMatchPicker(group, p[0], p[1]); })),
  renderStandingsTable(group, s),
  renderTiebreaker(group, s, teams)
]);
```

- [ ] **Step 3: Add tiebreaker styles**

```css
.tiebreaker {
  margin-top: 12px; padding: 10px;
  background: rgba(212,160,23,0.06);
  border: 1px solid var(--gold); border-radius: 8px;
}
.tiebreaker-h { margin: 0 0 8px; color: var(--gold); font-size: 14px; }
.tiebreaker-list { list-style: none; counter-reset: tb; margin: 0; padding: 0; }
.tiebreaker-list li {
  counter-increment: tb;
  display: flex; align-items: center; gap: 8px;
  padding: 6px 0;
}
.tiebreaker-list li::before {
  content: counter(tb) '.'; color: var(--gold); font-weight: 700; min-width: 18px;
}
.tiebreaker-name { flex: 1; }
.tb-btn {
  background: transparent; border: 1px solid var(--border); color: var(--text);
  width: var(--tap); height: var(--tap); border-radius: 6px; cursor: pointer; font-size: 18px;
}
.tb-btn:hover { border-color: var(--gold); color: var(--gold); }
```

- [ ] **Step 4: Smoke test**

In Group A, pick all 6 matches as draws. Expected: tiebreaker widget appears with all 4 teams. Use ↑/↓ to reorder. Standings table reorders accordingly. Refresh — order persists.

- [ ] **Step 5: Commit**

```bash
git add js/app.js css/style.css
git commit -m "feat(ui): tiebreaker widget for tied group standings"
```

---

## Task 13: Third-Place Selector

**Files:**
- Modify: `js/app.js`, `css/style.css`

- [ ] **Step 1: Add `allGroupRankings()` and `renderThirdPlace()`**

Inside the IIFE:

```js
function allGroupRankings() {
  // Returns { rankings: { A: [1st,2nd,3rd,4th] | null, ... }, allComplete: bool }
  var rankings = {};
  var allComplete = true;
  Object.keys(data.GROUPS).forEach(function (g) {
    var teams = data.GROUPS[g];
    var gr = current.groupResults[g];
    var s = standings.computeGroup(teams, gr.matches, gr.manualRanking);
    if (!s.complete || !s.ranked) allComplete = false;
    rankings[g] = s.ranked || null;
  });
  return { rankings: rankings, allComplete: allComplete };
}

function renderThirdPlace() {
  var section = document.getElementById('thirds');
  var container = document.getElementById('thirds-container');
  clear(container);

  var info = allGroupRankings();
  if (!info.allComplete) {
    section.classList.add('locked');
    return info;
  }
  section.classList.remove('locked');
  var lockNote = section.querySelector('.lock-note');
  if (lockNote) lockNote.style.display = 'none';

  var thirds = Object.keys(info.rankings).map(function (g) {
    return { group: g, teamId: info.rankings[g][2] };
  });
  var selected = current.thirdPlaceAdvancing.slice();

  function toggle(teamId) {
    var idx = selected.indexOf(teamId);
    if (idx >= 0) {
      if (!confirmIfDownstream('groups')) return;
      selected.splice(idx, 1);
    } else if (selected.length < 8) {
      if (!confirmIfDownstream('groups')) return;
      selected.push(teamId);
    } else {
      window.alert('You can only pick 8 third-place teams. Deselect one first.');
      return;
    }
    current.thirdPlaceAdvancing = selected.slice();
    clearAllAfter('groups');
    state.save(current);
    renderAll();
  }

  container.appendChild(el('p', { class: 'thirds-help' }, [
    'Pick exactly 8 of the 12 third-place teams to advance. Selected: ' + selected.length + ' / 8.'
  ]));

  container.appendChild(el('ul', { class: 'thirds-list' }, thirds.map(function (item) {
    var isSel = selected.indexOf(item.teamId) !== -1;
    return el('li', null, [
      el('button', {
        type: 'button',
        class: 'third-pill' + (isSel ? ' selected' : ''),
        on: { click: function () { toggle(item.teamId); } }
      }, [
        el('span', { class: 'third-grp' }, ['Group ' + item.group]),
        flagImg(item.teamId),
        el('span', null, [teamLabel(item.teamId)])
      ])
    ]);
  })));

  return info;
}
```

- [ ] **Step 2: Call `renderThirdPlace()` from `renderAll()`**

```js
function renderAll() {
  renderGroups();
  renderThirdPlace();
  // renderKnockouts() / renderChampion() added in next tasks
}
```

- [ ] **Step 3: Add styles**

```css
.thirds-help { color: var(--text-dim); font-size: 14px; margin-bottom: 12px; }
.thirds-list {
  list-style: none; padding: 0; margin: 0;
  display: grid; gap: 8px; grid-template-columns: 1fr;
}
@media (min-width: 600px) { .thirds-list { grid-template-columns: 1fr 1fr; } }
@media (min-width: 900px) { .thirds-list { grid-template-columns: 1fr 1fr 1fr; } }
.third-pill {
  width: 100%;
  display: flex; align-items: center; gap: 10px;
  background: var(--bg-card); border: 1px solid var(--border); color: var(--text);
  padding: 10px; border-radius: 8px; min-height: var(--tap);
  cursor: pointer; font: inherit; text-align: left;
}
.third-pill .third-grp { color: var(--text-dim); font-size: 12px; min-width: 60px; }
.third-pill.selected { border-color: var(--gold); background: rgba(212,160,23,0.12); color: var(--gold-hi); }
```

- [ ] **Step 4: Smoke test**

Pick winners for all 6 matches in all 12 groups (use draws + tiebreaker as needed) so every group has a `ranked` array. Expected: third-place section unlocks; clicking pills toggles selection up to 8.

- [ ] **Step 5: Commit**

```bash
git add js/app.js css/style.css
git commit -m "feat(ui): third-place selector unlocks when all groups complete"
```

---

## Task 14: Knockout Bracket Rendering

**Files:**
- Modify: `js/app.js`, `css/style.css`

- [ ] **Step 1: Add knockout pick helpers + match-card render**

Inside the IIFE, after `renderTiebreaker`:

```js
function knockoutPick(round, matchId) {
  if (round === 'finalFinal') return current.knockout.final.final;
  if (round === 'finalThird') return current.knockout.final.third;
  return current.knockout[round][matchId];
}

function setKnockoutPick(round, matchId, value) {
  if (round === 'finalFinal') { current.knockout.final.final = value; return; }
  if (round === 'finalThird') { current.knockout.final.third = value; return; }
  if (value === null || value === undefined) delete current.knockout[round][matchId];
  else current.knockout[round][matchId] = value;
}

// Map our internal round keys to the cascade-clear key.
function cascadeKey(round) {
  if (round === 'finalFinal' || round === 'finalThird') return 'sf';
  return round;
}

function renderKnockoutMatch(match, round) {
  var picked = knockoutPick(round, match.id);

  function row(teamId) {
    if (!teamId) return el('div', { class: 'ko-row ko-row-empty' }, ['—']);
    var selected = picked === teamId;
    var dim = picked && picked !== teamId;
    return el('button', {
      type: 'button',
      class: 'ko-row' + (selected ? ' selected' : '') + (dim ? ' dim' : ''),
      on: {
        click: function () {
          var next = (picked === teamId) ? null : teamId;
          if (next === picked) return;
          if (!confirmIfDownstream(cascadeKey(round))) return;
          setKnockoutPick(round, match.id, next);
          clearAllAfter(cascadeKey(round));
          state.save(current);
          renderAll();
        }
      }
    }, [flagImg(teamId), el('span', null, [teamLabel(teamId)])]);
  }

  return el('article', { class: 'ko-match', dataset: { id: match.id } }, [
    el('div', { class: 'ko-id' }, [match.id.toUpperCase()]),
    row(match.teamA),
    row(match.teamB)
  ]);
}
```

- [ ] **Step 2: Add `renderKnockouts()` and call it from `renderAll()`**

```js
function roundDone(matches, picks) {
  return matches.every(function (m) { return picks[m.id]; });
}

function renderRound(round, sectionId, containerId, matches) {
  var section = document.getElementById(sectionId);
  var container = document.getElementById(containerId);
  clear(container);
  var ready = matches.every(function (m) { return m.teamA && m.teamB; });
  if (!ready) { section.classList.add('locked'); return false; }
  section.classList.remove('locked');
  matches.forEach(function (m) { container.appendChild(renderKnockoutMatch(m, round)); });
  return true;
}

function renderKnockouts(info) {
  var thirdsOk = info.allComplete && current.thirdPlaceAdvancing.length === 8;

  // R32
  var r32Section = document.getElementById('r32');
  var r32Container = document.getElementById('r32-container');
  clear(r32Container);
  if (!thirdsOk) {
    r32Section.classList.add('locked');
    ['r16','qf','sf','final'].forEach(function (id) {
      document.getElementById(id).classList.add('locked');
    });
    return;
  }
  r32Section.classList.remove('locked');
  var r32 = MUNDIAL.bracket.buildR32(info.rankings, current.thirdPlaceAdvancing);
  r32.forEach(function (m) { r32Container.appendChild(renderKnockoutMatch(m, 'r32')); });

  // R16
  if (!roundDone(r32, current.knockout.r32)) {
    ['r16','qf','sf','final'].forEach(function (id) {
      document.getElementById(id).classList.add('locked');
      clear(document.getElementById(id + '-container'));
    });
    return;
  }
  var r16 = MUNDIAL.bracket.advance('r16', { r32: current.knockout.r32 });
  if (!renderRound('r16', 'r16', 'r16-container', r16)) return;

  // QF
  if (!roundDone(r16, current.knockout.r16)) {
    ['qf','sf','final'].forEach(function (id) {
      document.getElementById(id).classList.add('locked');
      clear(document.getElementById(id + '-container'));
    });
    return;
  }
  var qf = MUNDIAL.bracket.advance('qf', { r32: current.knockout.r32, r16: current.knockout.r16 });
  if (!renderRound('qf', 'qf', 'qf-container', qf)) return;

  // SF
  if (!roundDone(qf, current.knockout.qf)) {
    ['sf','final'].forEach(function (id) {
      document.getElementById(id).classList.add('locked');
      clear(document.getElementById(id + '-container'));
    });
    return;
  }
  var sf = MUNDIAL.bracket.advance('sf', {
    r32: current.knockout.r32, r16: current.knockout.r16, qf: current.knockout.qf
  });
  if (!renderRound('sf', 'sf', 'sf-container', sf)) return;

  // Final + 3rd place
  if (!roundDone(sf, current.knockout.sf)) {
    document.getElementById('final').classList.add('locked');
    clear(document.getElementById('final-container'));
    return;
  }
  var finalSection = document.getElementById('final');
  var finalContainer = document.getElementById('final-container');
  clear(finalContainer);
  finalSection.classList.remove('locked');

  var finalMatches = MUNDIAL.bracket.advance('final', {
    r32: current.knockout.r32, r16: current.knockout.r16,
    qf: current.knockout.qf, sf: current.knockout.sf
  });
  var third = MUNDIAL.bracket.buildThirdPlace(sf, current.knockout.sf);
  finalContainer.appendChild(renderKnockoutMatch(
    { id: 'm103', teamA: third.teamA, teamB: third.teamB }, 'finalThird'
  ));
  finalContainer.appendChild(renderKnockoutMatch(finalMatches[0], 'finalFinal'));
}
```

Update `renderAll`:

```js
function renderAll() {
  renderGroups();
  var info = renderThirdPlace();
  renderKnockouts(info);
}
```

- [ ] **Step 3: Add knockout styles**

```css
#r32-container, #r16-container, #qf-container, #sf-container, #final-container {
  display: grid; gap: 12px; grid-template-columns: 1fr;
}
@media (min-width: 600px) {
  #r32-container, #r16-container, #qf-container { grid-template-columns: 1fr 1fr; }
  #final-container { grid-template-columns: 1fr 1fr; }
}
@media (min-width: 900px) {
  #r32-container, #r16-container, #qf-container { grid-template-columns: 1fr 1fr 1fr 1fr; }
  #sf-container { grid-template-columns: 1fr 1fr; }
}

.ko-match {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 8px;
  display: flex; flex-direction: column; gap: 6px;
}
.ko-id { font-size: 11px; color: var(--text-dim); letter-spacing: 0.1em; }
.ko-row {
  display: flex; align-items: center; gap: 10px;
  background: transparent; border: 1px solid var(--border); color: var(--text);
  padding: 8px; border-radius: 6px; min-height: var(--tap);
  font: inherit; cursor: pointer; text-align: left;
}
.ko-row.selected { border-color: var(--gold); background: rgba(212,160,23,0.12); color: var(--gold-hi); }
.ko-row.dim { opacity: 0.45; }
.ko-row-empty { color: var(--text-dim); padding: 12px; text-align: center; }
```

- [ ] **Step 4: Smoke test**

Complete groups + thirds. Expected: R32 populates with the right pairings (verify a couple against FIFA: e.g. m73 = 2A vs 2B). Pick R32 winners; R16 unlocks. Continue through the bracket; the Final and 3rd-place card both render at the end. Change a group match midway → confirm dialog → downstream picks clear.

- [ ] **Step 5: Commit**

```bash
git add js/app.js css/style.css
git commit -m "feat(ui): full knockout bracket with edit cascade and confirm"
```

---

## Task 15: Champion Reveal

**Files:**
- Modify: `js/app.js`, `css/style.css`

- [ ] **Step 1: Add champion render**

Inside the IIFE, after `renderKnockouts`:

```js
function renderChampion() {
  var section = document.getElementById('champion');
  var container = document.getElementById('champion-container');
  clear(container);
  var champ = current.knockout.final.final;
  if (!champ) {
    section.hidden = true;
    return;
  }
  section.hidden = false;
  container.appendChild(el('div', { class: 'champion-card' }, [
    el('img', { src: data.flagUrl(champ), alt: '', class: 'champion-flag' }),
    el('div', { class: 'champion-name' }, [teamLabel(champ)]),
    el('div', { class: 'champion-tag' }, ['MUNDIAL 2026 CHAMPION'])
  ]));
}
```

Update `renderAll`:

```js
function renderAll() {
  renderGroups();
  var info = renderThirdPlace();
  renderKnockouts(info);
  renderChampion();
}
```

- [ ] **Step 2: Style it**

```css
#champion { text-align: center; }
.champion-card {
  display: inline-flex; flex-direction: column; align-items: center; gap: 12px;
  padding: 24px 36px;
  border: 2px solid var(--gold); border-radius: 12px;
  background: linear-gradient(180deg, rgba(212,160,23,0.16) 0%, rgba(212,160,23,0.04) 100%);
}
.champion-flag {
  width: 120px; height: 80px; object-fit: cover;
  border-radius: 6px; box-shadow: 0 4px 16px rgba(0,0,0,0.4);
}
.champion-name {
  font-size: clamp(28px, 6vw, 44px);
  color: var(--gold-hi); font-weight: 800; letter-spacing: 0.05em;
}
.champion-tag { color: var(--text-dim); letter-spacing: 0.2em; font-size: 12px; }
```

- [ ] **Step 3: Smoke test**

Pick a winner of the Final. Expected: Champion section appears with flag + team name + "MUNDIAL 2026 CHAMPION" caption.

- [ ] **Step 4: Commit**

```bash
git add js/app.js css/style.css
git commit -m "feat(ui): champion reveal section after final pick"
```

---

## Task 16: Mobile Polish & Cross-Device Smoke

**Files:**
- Possibly modify: `css/style.css`

- [ ] **Step 1: Test in Chrome DevTools mobile emulation**

Open `index.html`. DevTools → Toggle device toolbar. Test at: iPhone SE (375×667), iPhone 12 Pro (390×844), Pixel 7 (412×915), iPad (768×1024).

Verify:
- All tap targets ≥ 44px
- Sticky nav scrolls horizontally if content overflows
- Group cards stack one per row on phones
- Knockout matches stack one per row on phones
- No horizontal page overflow
- Section headings not hidden behind sticky nav on click of nav link

- [ ] **Step 2: Fix any issues found**

Common adjustments:
- Tap targets too narrow → add `min-width: var(--tap)`
- Text overflow on small screens → add `overflow-wrap: anywhere` on the offending element
- Sticky nav covers content → increase `scroll-margin-top` on `section`

- [ ] **Step 3: Test on a real phone**

In terminal at the project directory:
```bash
python3 -m http.server 8000
```
Find your machine's local IP (System Settings → Network on macOS) and visit `http://<your-ip>:8000` from your phone on the same Wi-Fi. Walk through a full bracket pick. Stop the server with `Ctrl+C` when done.

- [ ] **Step 4: Commit any tweaks**

```bash
git add css/style.css
git commit -m "fix(ui): mobile polish based on device testing"
```

(Skip this commit if no changes were needed.)

---

## Task 17: README + Deploy Instructions

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Write the README**

```markdown
# Mundial 2026 — Bracket Picker

A simple web page to predict the entire 2026 FIFA World Cup: group-stage matches, third-place advancement, and the full knockout bracket.

## Run locally

Open `index.html` in any modern browser. No server, no build step, no installation.

```bash
open index.html      # macOS
xdg-open index.html  # Linux
start index.html     # Windows
```

Picks are saved automatically in your browser's local storage. To start over, click **Reset bracket**.

## Run the test suite

Open `tests.html` the same way. The page shows a green count of passed assertions; failures are listed below.

## Mobile testing on a real device

```bash
python3 -m http.server 8000
```
Find your computer's local IP and visit `http://<your-ip>:8000` from a phone on the same Wi-Fi.

## Deploy to GitHub Pages

1. Create a new public repo on GitHub (e.g. `mundial-2026`).
2. From this folder:
   ```bash
   git remote add origin https://github.com/<your-username>/mundial-2026.git
   git branch -M main
   git push -u origin main
   ```
3. On the repo page → **Settings** → **Pages** → **Source** → **Deploy from a branch**, branch **main**, folder **/** (root). Save.
4. Wait ~1 minute. Site is live at `https://<your-username>.github.io/mundial-2026/`.

## Files

- `index.html` — the page
- `tests.html` — assertion-based test page
- `css/style.css` — styles (dark + gold)
- `js/dom.js` — DOM helpers (no innerHTML)
- `js/data.js` — teams, groups, knockout pairing tables
- `js/state.js` — localStorage persistence
- `js/standings.js` — group standings calculation
- `js/bracket.js` — knockout pairing logic
- `js/app.js` — UI rendering + event wiring

## Format reference

- 48 teams in 12 groups of 4 (groups A–L)
- Top 2 of each group + 8 best third-place teams = 32 advance to knockouts
- R32 → R16 → QF → SF → Final + 3rd-place match
- Win = 3 pts, Draw = 1 pt, Loss = 0 pts
- When teams tie on points within a group, the user manually orders them
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: README with run, test, and deploy instructions"
```

---

## Task 18: Final Verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Open `tests.html`. Expected: every suite green. Count matches the sum of `assert()` calls across the harness, standings, state, and bracket suites.

- [ ] **Step 2: Walk through a complete bracket end-to-end**

In `index.html`:
1. Pick all 72 group-stage matches (mix wins and draws).
2. Resolve any tiebreaker that appears.
3. Pick exactly 8 third-place teams.
4. Pick R32, R16, QF, SF, Final, and 3rd-place winners in order.
5. Confirm the Champion section reveals.
6. Refresh the page. Confirm all picks persisted.
7. Click **Reset bracket** → confirm dialog → confirm everything cleared.

- [ ] **Step 3: Verify on mobile (real device or DevTools)**

Repeat the end-to-end walk-through at iPhone SE size. Confirm no overflow, all tap targets ≥44px, no horizontal scroll on the page.

- [ ] **Step 4: Verify against spec**

Open `docs/superpowers/specs/2026-05-02-mundial-bracket-design.md`. For each section/requirement, confirm it's implemented. List any gaps in commit message of a follow-up commit if anything is deferred.

- [ ] **Step 5: Push to GitHub and enable Pages**

```bash
# After creating the empty GitHub repo:
git remote add origin https://github.com/<username>/mundial-2026.git
git branch -M main
git push -u origin main
```

Then enable Pages per the README. Confirm the site loads at the GitHub Pages URL and a full bracket can be picked there.
