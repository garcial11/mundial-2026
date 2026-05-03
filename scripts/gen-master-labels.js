// One-shot generator for docs/master-labels.csv — the source-of-truth label
// list that the admin pastes into the Google Sheet's "Master & Results" tab.
// Run with: `node scripts/gen-master-labels.js` from the project root.

var fs = require('fs');
var path = require('path');
var vm = require('vm');

var root = path.join(__dirname, '..');
var src = fs.readFileSync(path.join(root, 'js/data.js'), 'utf8');
var ctx = vm.createContext({});
vm.runInContext(src, ctx);
var data = ctx.MUNDIAL.data;

function teamName(id) { return data.TEAMS[id].name; }

var rows = [['pick_label', 'actual_value']];

// Group stage matches (72 rows). Same labels as the user CSV — admin enters
// 'TeamA wins' / 'TeamB wins' / 'Draw' here.
Object.keys(data.GROUPS).forEach(function (g) {
  var teams = data.GROUPS[g];
  for (var i = 0; i < teams.length; i++) {
    for (var j = i + 1; j < teams.length; j++) {
      rows.push(['Group ' + g + ' — ' + teamName(teams[i]) + ' vs ' + teamName(teams[j]), '']);
    }
  }
});

// Group standings (48 rows). Admin enters team names per position.
Object.keys(data.GROUPS).forEach(function (g) {
  ['1st place', '2nd place', '3rd place', '4th place'].forEach(function (lbl) {
    rows.push(['Group ' + g + ' — ' + lbl, '']);
  });
});

// 3rd-place advancing (8 rows). Admin enters the actual 8 third-place teams
// that advanced to R32.
for (var i = 0; i < 8; i++) rows.push(['Actual 3rd place advancing', '']);

// Team-set rows for each knockout round.
for (var i = 0; i < 32; i++) rows.push(['Actual R32 team', '']);
for (var i = 0; i < 16; i++) rows.push(['Actual R16 team', '']);
for (var i = 0; i < 8;  i++) rows.push(['Actual QF team',  '']);
for (var i = 0; i < 4;  i++) rows.push(['Actual SF team',  '']);
for (var i = 0; i < 2;  i++) rows.push(['Actual Finalist', '']);
rows.push(['Actual Champion', '']);

function csvEsc(s) { return '"' + String(s).replace(/"/g, '""') + '"'; }
var lines = rows.map(function (r) { return csvEsc(r[0]) + ',' + csvEsc(r[1]); });
var out = '﻿' + lines.join('\r\n') + '\r\n';

var outPath = path.join(root, 'docs/master-labels.csv');
fs.writeFileSync(outPath, out);
console.log('Wrote ' + (rows.length - 1) + ' label rows to docs/master-labels.csv');
