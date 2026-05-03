/**
 * World Cup Picks · 2026 — Google Sheets pool builder.
 *
 * One-time setup:
 *   1. Create a new blank Google Sheet (sheets.new).
 *   2. Extensions → Apps Script.
 *   3. Replace the default code with this entire file. Save.
 *   4. Reload the Sheet — a "World Cup Pool" menu appears.
 *   5. World Cup Pool → Set up sheet. Authorize when prompted.
 *
 * Day-to-day:
 *   • World Cup Pool → Add participant — creates a tab named after the player
 *     and adds them to the Scoring tab. Then File → Import that player's CSV
 *     into that tab (Replace data starting at A1).
 *   • As games end, fill column B in the Master tab using the dropdowns.
 *     Scoring and Leaderboard update automatically.
 */

// =========================================================================
// 1. Static data — 48 teams + 12 groups (mirrors js/data.js).
// =========================================================================

var TEAMS = {
  mex: 'Mexico',                 rsa: 'South Africa',           kor: 'South Korea',     cze: 'Czechia',
  can: 'Canada',                 bih: 'Bosnia and Herzegovina', qat: 'Qatar',           sui: 'Switzerland',
  bra: 'Brazil',                 mar: 'Morocco',                hai: 'Haiti',           sco: 'Scotland',
  usa: 'United States',          par: 'Paraguay',               aus: 'Australia',       tur: 'Türkiye',
  ger: 'Germany',                cur: 'Curaçao',                civ: 'Ivory Coast',     ecu: 'Ecuador',
  ned: 'Netherlands',            jpn: 'Japan',                  swe: 'Sweden',          tun: 'Tunisia',
  bel: 'Belgium',                egy: 'Egypt',                  irn: 'Iran',            nzl: 'New Zealand',
  esp: 'Spain',                  cpv: 'Cape Verde',             ksa: 'Saudi Arabia',    uru: 'Uruguay',
  fra: 'France',                 sen: 'Senegal',                irq: 'Iraq',            nor: 'Norway',
  arg: 'Argentina',              alg: 'Algeria',                aut: 'Austria',         jor: 'Jordan',
  por: 'Portugal',               cod: 'DR Congo',               uzb: 'Uzbekistan',      col: 'Colombia',
  eng: 'England',                cro: 'Croatia',                gha: 'Ghana',           pan: 'Panama'
};

var GROUPS = {
  A: ['mex','rsa','kor','cze'],   B: ['can','bih','qat','sui'],   C: ['bra','mar','hai','sco'],
  D: ['usa','par','aus','tur'],   E: ['ger','cur','civ','ecu'],   F: ['ned','jpn','swe','tun'],
  G: ['bel','egy','irn','nzl'],   H: ['esp','cpv','ksa','uru'],   I: ['fra','sen','irq','nor'],
  J: ['arg','alg','aut','jor'],   K: ['por','cod','uzb','col'],   L: ['eng','cro','gha','pan']
};

var GROUP_LETTERS = ['A','B','C','D','E','F','G','H','I','J','K','L'];

// All 48 team names — used for team-set dropdowns.
var ALL_TEAM_NAMES = Object.keys(TEAMS).map(function (id) { return TEAMS[id]; }).sort();

var MAX_PARTICIPANTS = 25;

// =========================================================================
// 2. Menu
// =========================================================================

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('World Cup Pool')
    .addItem('Set up sheet (run once)',     'setUp')
    .addItem('Add participant',             'addParticipant')
    .addSeparator()
    .addItem('Pull latest results from API','pullLatestResults')
    .addItem('Clear API key',               'clearApiKey')
    .addToUi();
}

// =========================================================================
// 3. Top-level: build the whole sheet
// =========================================================================

function setUp() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ui = SpreadsheetApp.getUi();

  if (ss.getSheetByName('Master')) {
    var resp = ui.alert('Sheet already set up',
      'A "Master" tab already exists. Re-running will rebuild Master, Scoring, and Leaderboard tabs (your participant tabs will be left alone). Continue?',
      ui.ButtonSet.YES_NO);
    if (resp !== ui.Button.YES) return;
  }

  // Reuse Sheet1 if it's the only blank tab.
  var sheet1 = ss.getSheetByName('Sheet1');
  if (sheet1 && ss.getSheets().length === 1 && sheet1.getLastRow() === 0) {
    sheet1.setName('Master');
  }

  buildMaster(ss);
  buildScoring(ss);
  buildLeaderboard(ss);
  ss.setActiveSheet(ss.getSheetByName('Leaderboard'));
  ui.alert('Done',
    'Master, Scoring, and Leaderboard tabs are ready. Use World Cup Pool → Add participant for each player.',
    ui.ButtonSet.OK);
}

// =========================================================================
// 4. Master tab — labels + actual results with dropdowns
// =========================================================================

// Map from internal section key to a valid named-range identifier.
var SECTION_RANGE_NAME = {
  groupMatches:    'master_groupMatches',
  groupStandings:  'master_groupStandings',
  thirdsAdvancing: 'master_thirdsAdv',
  actualR32:       'master_actualR32',
  actualR16:       'master_actualR16',
  actualQF:        'master_actualQF',
  actualSF:        'master_actualSF',
  actualFinalist:  'master_actualFinalist',
  actualChampion:  'master_actualChampion'
};

// Label written into Master column A for each team-set section.
var SECTION_LABEL = {
  thirdsAdvancing: 'Actual 3rd place advancing',
  actualR32:       'Actual R32 team',
  actualR16:       'Actual R16 team',
  actualQF:        'Actual QF team',
  actualSF:        'Actual SF team',
  actualFinalist:  'Actual Finalist',
  actualChampion:  'Actual Champion'
};

function buildMaster(ss) {
  var sh = ss.getSheetByName('Master') || ss.insertSheet('Master');
  sh.clear();
  sh.clearConditionalFormatRules();

  // Header.
  sh.getRange(1, 1, 1, 2).setValues([['pick_label', 'actual_value']])
    .setFontWeight('bold').setBackground('#0a0e1a').setFontColor('#d4a017');

  var rows = [];
  var sectionStart = {};
  var sectionEnd   = {};
  function note(key)  { sectionStart[key] = rows.length + 2; }
  function close(key) { sectionEnd[key]   = rows.length + 1; }

  // 1. Group matches — 72 rows.
  note('groupMatches');
  GROUP_LETTERS.forEach(function (g) {
    var ids = GROUPS[g];
    for (var i = 0; i < ids.length; i++) {
      for (var j = i + 1; j < ids.length; j++) {
        rows.push(['Group ' + g + ' — ' + TEAMS[ids[i]] + ' vs ' + TEAMS[ids[j]], '']);
      }
    }
  });
  close('groupMatches');

  // 2. Group standings — 48 rows.
  note('groupStandings');
  GROUP_LETTERS.forEach(function (g) {
    ['1st place','2nd place','3rd place','4th place'].forEach(function (lbl) {
      rows.push(['Group ' + g + ' — ' + lbl, '']);
    });
  });
  close('groupStandings');

  // 3. 3rd-place advancing — 8 rows.
  note('thirdsAdvancing');
  for (var i = 0; i < 8; i++) rows.push([SECTION_LABEL.thirdsAdvancing, '']);
  close('thirdsAdvancing');

  // 4. Team-set sections.
  function teamSet(key, count) {
    note(key);
    for (var i = 0; i < count; i++) rows.push([SECTION_LABEL[key], '']);
    close(key);
  }
  teamSet('actualR32',      32);
  teamSet('actualR16',      16);
  teamSet('actualQF',       8);
  teamSet('actualSF',       4);
  teamSet('actualFinalist', 2);
  teamSet('actualChampion', 1);

  sh.getRange(2, 1, rows.length, 2).setValues(rows);

  // Create named ranges over column B for each section.
  Object.keys(sectionStart).forEach(function (key) {
    var name = SECTION_RANGE_NAME[key];
    var startRow = sectionStart[key];
    var endRow   = sectionEnd[key];
    var range    = sh.getRange(startRow, 2, endRow - startRow + 1, 1);
    var existing = ss.getNamedRanges().filter(function (nr) { return nr.getName() === name; });
    existing.forEach(function (nr) { nr.remove(); });
    ss.setNamedRange(name, range);
  });

  applyMasterDropdowns(sh, sectionStart, sectionEnd);

  sh.setColumnWidth(1, 360);
  sh.setColumnWidth(2, 220);
  sh.setFrozenRows(1);
}

function applyMasterDropdowns(sh, start, end) {
  // Group match outcomes — per-row 3-option dropdown.
  var row = start.groupMatches;
  GROUP_LETTERS.forEach(function (g) {
    var ids = GROUPS[g];
    for (var i = 0; i < ids.length; i++) {
      for (var j = i + 1; j < ids.length; j++) {
        var rule = SpreadsheetApp.newDataValidation()
          .requireValueInList([TEAMS[ids[i]] + ' wins', TEAMS[ids[j]] + ' wins', 'Draw'], true)
          .setAllowInvalid(false).build();
        sh.getRange(row, 2).setDataValidation(rule);
        row++;
      }
    }
  });

  // Group standings — 4-option dropdown per group (the 4 teams).
  row = start.groupStandings;
  GROUP_LETTERS.forEach(function (g) {
    var teams = GROUPS[g].map(function (id) { return TEAMS[id]; });
    var rule = SpreadsheetApp.newDataValidation()
      .requireValueInList(teams, true).setAllowInvalid(false).build();
    sh.getRange(row, 2, 4, 1).setDataValidation(rule);
    row += 4;
  });

  // Team-set sections — any of the 48 teams.
  var anyTeam = SpreadsheetApp.newDataValidation()
    .requireValueInList(ALL_TEAM_NAMES, true).setAllowInvalid(false).build();
  ['thirdsAdvancing','actualR32','actualR16','actualQF','actualSF','actualFinalist','actualChampion']
    .forEach(function (key) {
      var s = start[key], e = end[key];
      sh.getRange(s, 2, e - s + 1, 1).setDataValidation(anyTeam);
    });
}

// =========================================================================
// 5. Scoring tab
// =========================================================================

function buildScoring(ss) {
  var sh = ss.getSheetByName('Scoring') || ss.insertSheet('Scoring');
  sh.clear();
  sh.clearConditionalFormatRules();

  var labels = [
    'Group matches (1 pt winner / 2 pt draw)',
    'Group standings (2 pt × 1st/2nd/3rd)',
    '3rd-place advancing (3 pt each)',
    'R32 teams (3 pt each)',
    'R16 teams (5 pt each)',
    'QF teams (8 pt each)',
    'SF teams (12 pt each)',
    'Finalists (20 pt each)',
    'Champion (25 pt bonus)',
    'TOTAL'
  ];
  for (var i = 0; i < labels.length; i++) sh.getRange(i + 2, 1).setValue(labels[i]);
  sh.getRange(11, 1).setFontWeight('bold');

  sh.getRange(1, 1).setValue('Player →').setFontWeight('bold');
  sh.getRange(1, 1, 1, MAX_PARTICIPANTS + 1)
    .setBackground('#0a0e1a').setFontColor('#d4a017').setFontWeight('bold');

  for (var u = 0; u < MAX_PARTICIPANTS; u++) {
    var col = u + 2;
    var colA1 = colNum2A1(col);
    var formulas = scoringFormulasForUser(colA1);
    for (var r = 0; r < formulas.length; r++) {
      sh.getRange(r + 2, col).setFormula(formulas[r]);
    }
  }

  sh.setColumnWidth(1, 280);
  for (var c = 2; c <= MAX_PARTICIPANTS + 1; c++) sh.setColumnWidth(c, 110);
  sh.setFrozenRows(1);
  sh.setFrozenColumns(1);
}

// Build the 10 formulas (rows 2–11) for a given user column letter.
function scoringFormulasForUser(colA1) {
  var f = [];
  // Row 2 — Group matches: per-row, 1pt winner / 2pt draw.
  f.push(perRowFormula(colA1, SECTION_RANGE_NAME.groupMatches,
    'IF(' + SECTION_RANGE_NAME.groupMatches + ' = "Draw", 2, 1)'));

  // Row 3 — Group standings: 2pt × (1st/2nd/3rd correct).
  f.push(perRowFormula(colA1, SECTION_RANGE_NAME.groupStandings,
    '(REGEXMATCH(OFFSET(' + SECTION_RANGE_NAME.groupStandings + ', 0, -1), " — (1st|2nd|3rd) place$") * 2)'));

  // Rows 4–9 — set comparisons.
  f.push(setFormula(colA1, SECTION_RANGE_NAME.thirdsAdvancing, 'My 3rd place advancing', 3));
  f.push(setFormula(colA1, SECTION_RANGE_NAME.actualR32,       'My R32 team',            3));
  f.push(setFormula(colA1, SECTION_RANGE_NAME.actualR16,       'My R16 team',            5));
  f.push(setFormula(colA1, SECTION_RANGE_NAME.actualQF,        'My QF team',             8));
  f.push(setFormula(colA1, SECTION_RANGE_NAME.actualSF,        'My SF team',            12));
  f.push(setFormula(colA1, SECTION_RANGE_NAME.actualFinalist,  'My Finalist',           20));

  // Row 10 — Champion (single-team bonus).
  f.push(championFormula(colA1));

  // Row 11 — TOTAL.
  f.push('=SUM(' + colA1 + '2:' + colA1 + '10)');

  return f;
}

// Per-row scoring formula. masterRange = named range over Master col B; the
// formula derives the matching label range via OFFSET(..., 0, -1).
function perRowFormula(userCol, masterRange, perRowPointsExpr) {
  return [
    '=IFERROR(SUMPRODUCT(',
      '(' + masterRange + ' <> "") * ',
      '(' + masterRange + ' = ARRAYFORMULA(IFERROR(VLOOKUP(',
        'OFFSET(' + masterRange + ', 0, -1), ',
        'INDIRECT("\'" & ' + userCol + '$1 & "\'!A:B"), 2, FALSE), ""))) * ',
      '(' + perRowPointsExpr + ')',
    '), 0)'
  ].join('');
}

// Set-comparison scoring: count of user picks (rows where their A == userLabel)
// that appear in the master range, multiplied by perTeamPts.
function setFormula(userCol, masterRange, userLabel, perTeamPts) {
  return [
    '=IFERROR(', perTeamPts, ' * SUMPRODUCT(COUNTIF(',
      masterRange, ', ',
      'FILTER(',
        'INDIRECT("\'" & ', userCol, '$1 & "\'!B:B"), ',
        'INDIRECT("\'" & ', userCol, '$1 & "\'!A:A") = "', userLabel, '"',
      ')',
    ')), 0)'
  ].join('');
}

function championFormula(userCol) {
  // Master's actual champion is the single value in master_actualChampion.
  // Note: for a 1-row named range, INDEX(rng, 1, 1) gives the value.
  return [
    '=IFERROR(IF(AND(',
      'INDEX(', SECTION_RANGE_NAME.actualChampion, ', 1, 1) <> "", ',
      'INDEX(', SECTION_RANGE_NAME.actualChampion, ', 1, 1) = ',
        'IFERROR(VLOOKUP("My Champion", INDIRECT("\'" & ', userCol, '$1 & "\'!A:B"), 2, FALSE), "")',
    '), 25, 0), 0)'
  ].join('');
}

// =========================================================================
// 6. Leaderboard
// =========================================================================

function buildLeaderboard(ss) {
  var sh = ss.getSheetByName('Leaderboard') || ss.insertSheet('Leaderboard');
  sh.clear();

  sh.getRange(1, 1, 1, 2).setValues([['Player', 'Score']])
    .setFontWeight('bold').setBackground('#0a0e1a').setFontColor('#d4a017');

  var lastCol = colNum2A1(MAX_PARTICIPANTS + 1);
  // After TRANSPOSE(B1:lastCol11), the original ROW becomes a column.
  // Col1 = original row 1 (player names), Col11 = original row 11 (TOTAL).
  var formula = '=IFERROR(QUERY(' +
    'TRANSPOSE(Scoring!B1:' + lastCol + '11),' +
    '"select Col1, Col11 where Col1 is not null and Col1 <> \'\' order by Col11 desc",' +
    '0), "")';
  sh.getRange(2, 1).setFormula(formula);

  sh.setColumnWidth(1, 220);
  sh.setColumnWidth(2, 100);
  sh.setFrozenRows(1);
}

// =========================================================================
// 7. Add participant
// =========================================================================

function addParticipant() {
  var ui = SpreadsheetApp.getUi();
  var resp = ui.prompt('Add participant',
    'Enter the player\'s name. This becomes the tab name and the column header in the Scoring tab. Single word works best (e.g. Luis, Sara).',
    ui.ButtonSet.OK_CANCEL);
  if (resp.getSelectedButton() !== ui.Button.OK) return;
  var name = resp.getResponseText().trim();
  if (!name) return;

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (ss.getSheetByName(name)) {
    ui.alert('A tab with that name already exists.');
    return;
  }
  ss.insertSheet(name);

  // Auto-fill the next empty header cell in the Scoring tab.
  var scoring = ss.getSheetByName('Scoring');
  if (scoring) {
    var headerRow = scoring.getRange(1, 2, 1, MAX_PARTICIPANTS).getValues()[0];
    var added = false;
    for (var i = 0; i < headerRow.length; i++) {
      if (!headerRow[i]) {
        scoring.getRange(1, i + 2).setValue(name);
        added = true;
        break;
      }
    }
    if (!added) {
      ui.alert('Heads up — no empty Scoring column was free. The tab "' + name + '" was created, but you\'ll need to bump MAX_PARTICIPANTS in the script and re-run setUp.');
    }
  }

  ui.alert('Tab created',
    'Now: open the "' + name + '" tab → File → Import → Upload → drop their CSV → Replace data starting at A1 → Import.',
    ui.ButtonSet.OK);
}

// =========================================================================
// Helpers
// =========================================================================

function colNum2A1(n) {
  var s = '';
  while (n > 0) {
    var r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

// =========================================================================
// 8. Pull latest results from football-data.org
// =========================================================================
//
// Fetches the World Cup competition data and updates Master with:
//   • Group match outcomes ("Mexico wins" / "Draw" / "South Africa wins")
//   • Group standings (1st / 2nd / 3rd / 4th of each group)
//   • Knockout team lists (R32 / R16 / QF / SF / Finalists / Champion)
//
// API: https://www.football-data.org — free tier covers the World Cup.
// Sign up at football-data.org/client/register; paste the key on first use.

var API_BASE = 'https://api.football-data.org/v4';
// football-data.org sometimes addresses competitions by code ('WC') and
// sometimes by numeric ID ('2000'). Try them in order; first that works wins.
var COMPETITION_IDS = ['WC', '2000'];

// Mapping from API team-name spellings to the names used in our Master labels.
// Most match exactly; only override the differences.
var TEAM_NAME_ALIASES = {
  'USA':                              'United States',
  'United States of America':         'United States',
  'Korea Republic':                   'South Korea',
  'Republic of Korea':                'South Korea',
  'Korea, South':                     'South Korea',
  'Cote d\'Ivoire':                   'Ivory Coast',
  'Côte d\'Ivoire':              'Ivory Coast',
  'Czech Republic':                   'Czechia',
  'Turkey':                           'Türkiye',
  'Türkiye':                     'Türkiye',
  'Cape Verde Islands':               'Cape Verde',
  'Bosnia-Herzegovina':               'Bosnia and Herzegovina',
  'Congo DR':                         'DR Congo',
  'Democratic Republic of the Congo': 'DR Congo'
};

// API stage labels → Master section "Actual <Round> team" label.
// (Knockout team lists are populated as soon as a round's matches are scheduled.)
var STAGE_TO_SECTION = {
  'PLAY_OFF_ROUND':   'Actual R32 team',
  'PLAY_OFFS':        'Actual R32 team',
  'ROUND_OF_32':      'Actual R32 team',
  'LAST_32':          'Actual R32 team',
  'ROUND_OF_16':      'Actual R16 team',
  'LAST_16':          'Actual R16 team',
  'QUARTER_FINALS':   'Actual QF team',
  'SEMI_FINALS':      'Actual SF team',
  'FINAL':            'Actual Finalist'
};

function pullLatestResults() {
  var ui = SpreadsheetApp.getUi();
  var props = PropertiesService.getScriptProperties();
  var apiKey = props.getProperty('FOOTBALL_DATA_API_KEY');

  if (!apiKey) {
    var resp = ui.prompt('football-data.org API key',
      'Paste your free API key (one-time setup; it gets stored in this script\'s properties).\n\n' +
      'Don\'t have one? Sign up at:\nhttps://www.football-data.org/client/register',
      ui.ButtonSet.OK_CANCEL);
    if (resp.getSelectedButton() !== ui.Button.OK) return;
    apiKey = resp.getResponseText().trim();
    if (!apiKey) return;
    props.setProperty('FOOTBALL_DATA_API_KEY', apiKey);
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var master = ss.getSheetByName('Master');
  if (!master) {
    ui.alert('No Master tab found. Run "Set up sheet" first.');
    return;
  }

  // 1. Matches — try each competition identifier; first that works wins.
  var matchesData = null;
  var lastError = null;
  var workingId = null;
  for (var idx = 0; idx < COMPETITION_IDS.length; idx++) {
    try {
      matchesData = apiCall('/competitions/' + COMPETITION_IDS[idx] + '/matches', apiKey);
      workingId = COMPETITION_IDS[idx];
      break;
    } catch (e) {
      lastError = e;
    }
  }
  if (!matchesData) {
    ui.alert('API error',
      'Could not reach football-data.org. Tried competition IDs: ' + COMPETITION_IDS.join(', ') + '.\n\n' +
      'Last error:\n' + String(lastError && lastError.message || lastError) + '\n\n' +
      'Common causes:\n' +
      '  • Account not yet activated (check email at football-data.org)\n' +
      '  • Free tier doesn\'t include World Cup right now (try standings only)\n' +
      '  • API key typo (use "Clear API key" then retry)\n' +
      '  • Apps Script needs URL-fetch authorization (run pullLatestResults\n' +
      '    once from the Apps Script editor and accept the prompt)',
      ui.ButtonSet.OK);
    return;
  }
  var matches = matchesData.matches || [];

  // Cache Master labels in a single read.
  var lastRow = master.getLastRow();
  var labelValues = master.getRange(2, 1, lastRow - 1, 1).getValues();

  var groupUpdates = 0;
  var skipped = [];
  var stageTeams = {}; // stage → { teamName: true }

  matches.forEach(function (m) {
    var stage = m.stage;
    var home = m.homeTeam ? normalizeTeamName(m.homeTeam.name) : null;
    var away = m.awayTeam ? normalizeTeamName(m.awayTeam.name) : null;
    if (!home || !away) {
      skipped.push((m.homeTeam && m.homeTeam.name) + ' vs ' + (m.awayTeam && m.awayTeam.name) + ' [' + stage + ']');
      return;
    }

    if (stage && stage !== 'GROUP_STAGE') {
      stageTeams[stage] = stageTeams[stage] || {};
      stageTeams[stage][home] = true;
      stageTeams[stage][away] = true;
    }

    if (stage === 'GROUP_STAGE' && m.status === 'FINISHED') {
      var groupLetter = m.group ? String(m.group).replace('GROUP_', '') : null;
      if (!groupLetter) return;

      var winnerStr;
      if (m.score && m.score.winner === 'DRAW') winnerStr = 'Draw';
      else if (m.score && m.score.winner === 'HOME_TEAM') winnerStr = home + ' wins';
      else if (m.score && m.score.winner === 'AWAY_TEAM') winnerStr = away + ' wins';
      else return;

      var labelA = 'Group ' + groupLetter + ' — ' + home + ' vs ' + away;
      var labelB = 'Group ' + groupLetter + ' — ' + away + ' vs ' + home;
      if (setLabelValue(master, labelValues, labelA, winnerStr) ||
          setLabelValue(master, labelValues, labelB, winnerStr)) {
        groupUpdates++;
      }
    }
  });

  // 2. Knockout team lists
  Object.keys(stageTeams).forEach(function (stage) {
    var section = STAGE_TO_SECTION[stage];
    if (!section) return;
    populateTeamSet(master, labelValues, section, Object.keys(stageTeams[stage]).sort());
  });

  // 3. Champion (only after Final FINISHED)
  var finalMatch = matches.find(function (m) { return m.stage === 'FINAL'; });
  if (finalMatch && finalMatch.status === 'FINISHED' && finalMatch.score) {
    var champ = null;
    if (finalMatch.score.winner === 'HOME_TEAM') champ = normalizeTeamName(finalMatch.homeTeam.name);
    else if (finalMatch.score.winner === 'AWAY_TEAM') champ = normalizeTeamName(finalMatch.awayTeam.name);
    if (champ) populateTeamSet(master, labelValues, 'Actual Champion', [champ]);
  }

  // 4. Group standings (1st / 2nd / 3rd / 4th)
  var standingsUpdates = 0;
  try {
    var standingsData = apiCall('/competitions/' + workingId + '/standings', apiKey);
    (standingsData.standings || []).forEach(function (s) {
      if (s.type !== 'TOTAL') return;
      var groupLetter = s.group ? String(s.group).replace('GROUP_', '') : null;
      if (!groupLetter) return;
      var positions = ['1st place', '2nd place', '3rd place', '4th place'];
      (s.table || []).forEach(function (row, i) {
        if (i >= 4 || !row.team) return;
        var team = normalizeTeamName(row.team.name);
        if (!team) return;
        var label = 'Group ' + groupLetter + ' — ' + positions[i];
        if (setLabelValue(master, labelValues, label, team)) standingsUpdates++;
      });
    });
  } catch (e) {
    // Standings may not exist before any group game has been played; that's fine.
  }

  // Summary
  var msg = 'Updated:\n' +
    '  • ' + groupUpdates + ' group match outcome(s)\n' +
    '  • ' + standingsUpdates + ' group standing slot(s)\n' +
    '  • Knockout team lists for: ' + (Object.keys(stageTeams).join(', ') || 'none yet');
  if (finalMatch && finalMatch.status === 'FINISHED') msg += '\n  • Champion set';
  if (skipped.length) {
    msg += '\n\nSkipped (team-name mismatch — let the developer know):\n' + skipped.slice(0, 8).join('\n');
  }
  ui.alert('Pull complete', msg, ui.ButtonSet.OK);
}

function clearApiKey() {
  var ui = SpreadsheetApp.getUi();
  var resp = ui.alert('Clear API key',
    'This will remove the saved football-data.org API key. You\'ll be prompted to paste it again on the next pull. Continue?',
    ui.ButtonSet.YES_NO);
  if (resp === ui.Button.YES) {
    PropertiesService.getScriptProperties().deleteProperty('FOOTBALL_DATA_API_KEY');
    ui.alert('API key cleared.');
  }
}

// ---- Helpers used by pullLatestResults ----

function apiCall(path, apiKey) {
  var resp = UrlFetchApp.fetch(API_BASE + path, {
    method: 'get',
    headers: { 'X-Auth-Token': apiKey },
    muteHttpExceptions: true
  });
  var code = resp.getResponseCode();
  if (code !== 200) {
    throw new Error('HTTP ' + code + ' from football-data.org\n' + resp.getContentText().substring(0, 300));
  }
  return JSON.parse(resp.getContentText());
}

function normalizeTeamName(apiName) {
  if (!apiName) return null;
  if (TEAM_NAME_ALIASES[apiName]) return TEAM_NAME_ALIASES[apiName];
  // Exact match against our team list.
  for (var i = 0; i < ALL_TEAM_NAMES.length; i++) {
    if (ALL_TEAM_NAMES[i] === apiName) return ALL_TEAM_NAMES[i];
  }
  // Case-insensitive fallback.
  var lower = String(apiName).toLowerCase();
  for (var j = 0; j < ALL_TEAM_NAMES.length; j++) {
    if (ALL_TEAM_NAMES[j].toLowerCase() === lower) return ALL_TEAM_NAMES[j];
  }
  return null;
}

// Set Master col B for the row whose label matches `label`. Returns true if
// changed (or first-time set), false if already had this value or label not found.
function setLabelValue(master, labelValues, label, value) {
  for (var i = 0; i < labelValues.length; i++) {
    if (labelValues[i][0] === label) {
      var cell = master.getRange(i + 2, 2);
      var existing = cell.getValue();
      if (existing !== value) {
        cell.setValue(value);
        return true;
      }
      return false;
    }
  }
  return false;
}

// Populate all rows in Master that share `label` with the given team list,
// in order. Trims/extends as needed.
function populateTeamSet(master, labelValues, label, teams) {
  var matchingRows = [];
  for (var i = 0; i < labelValues.length; i++) {
    if (labelValues[i][0] === label) matchingRows.push(i + 2);
  }
  for (var j = 0; j < matchingRows.length; j++) {
    var newVal = j < teams.length ? teams[j] : '';
    var cell = master.getRange(matchingRows[j], 2);
    if (cell.getValue() !== newVal) cell.setValue(newVal);
  }
}
