var MUNDIAL = MUNDIAL || {};

MUNDIAL.export = (function () {
  var data = MUNDIAL.data;
  var standings = MUNDIAL.standings;
  var bracket = MUNDIAL.bracket;

  // ---------- helpers ----------

  function teamName(id) {
    if (!id) return '';
    var t = data.TEAMS[id];
    return t ? t.name : id;
  }

  function csvEscape(v) {
    var s = (v === null || v === undefined) ? '' : String(v);
    // Always quote — keeps things safe with commas, quotes, dashes, accents.
    return '"' + s.replace(/"/g, '""') + '"';
  }

  function todayISO() {
    var d = new Date();
    var pad = function (n) { return n < 10 ? '0' + n : '' + n; };
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function safeFilenamePart(s) {
    return (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }

  // ---------- gather picks into a unified row list ----------

  // Returns an array of [label, value] pairs. Same order every time so a
  // spreadsheet user can paste columns side-by-side and still line up.
  function collectRows(state) {
    var rows = [];

    // Group stage matches — 12 groups × 6 matches each, in deterministic order.
    Object.keys(data.GROUPS).forEach(function (g) {
      var teams = data.GROUPS[g];
      for (var i = 0; i < teams.length; i++) {
        for (var j = i + 1; j < teams.length; j++) {
          var a = teams[i], b = teams[j];
          var key = data.matchKey(a, b);
          var pick = state.groupResults[g].matches[key];
          var pickLabel;
          if (!pick) pickLabel = '';
          else if (pick === 'draw') pickLabel = 'Draw';
          else pickLabel = teamName(pick) + ' wins';
          rows.push([
            'Group ' + g + ' — ' + teamName(a) + ' vs ' + teamName(b),
            pickLabel
          ]);
        }
      }
    });

    // Group standings — 1st / 2nd / 3rd / 4th of every group.
    Object.keys(data.GROUPS).forEach(function (g) {
      var teams = data.GROUPS[g];
      var gr = state.groupResults[g];
      var s = standings.computeGroup(teams, gr.matches, gr.manualRanking);
      var ranked = s.ranked || [];
      ['1st place', '2nd place', '3rd place', '4th place'].forEach(function (label, idx) {
        rows.push(['Group ' + g + ' — ' + label, teamName(ranked[idx])]);
      });
    });

    // Best third-place advancing — 8 entries, sorted alphabetically by name so
    // the rows are deterministic and can be set-compared in the Google Sheet.
    var thirdsSorted = state.thirdPlaceAdvancing.slice().sort(function (a, b) {
      var an = teamName(a), bn = teamName(b);
      return an < bn ? -1 : an > bn ? 1 : 0;
    });
    for (var k = 0; k < 8; k++) {
      rows.push(['My 3rd place advancing', teamName(thirdsSorted[k])]);
    }

    // Knockout rounds.
    var allComplete = Object.keys(data.GROUPS).every(function (g) {
      var teams = data.GROUPS[g];
      var gr = state.groupResults[g];
      var s = standings.computeGroup(teams, gr.matches, gr.manualRanking);
      return s.complete && s.ranked;
    });
    var thirdsOk = allComplete && state.thirdPlaceAdvancing.length === 8;

    // Build R32 + later rounds (uses bracket logic identical to the live UI).
    var r32 = [];
    if (thirdsOk) {
      var rankings = {};
      Object.keys(data.GROUPS).forEach(function (g) {
        var gr = state.groupResults[g];
        rankings[g] = standings.computeGroup(data.GROUPS[g], gr.matches, gr.manualRanking).ranked;
      });
      r32 = bracket.buildR32(rankings, state.thirdPlaceAdvancing);
    } else {
      // Skeleton with just match IDs so the CSV still has consistent rows.
      r32 = data.R32_PAIRINGS.map(function (p) { return { id: p.id, teamA: null, teamB: null }; });
    }

    function roundLabel(round, m) {
      var who = m.teamA && m.teamB ? teamName(m.teamA) + ' vs ' + teamName(m.teamB) : '';
      return round + ' ' + m.id.toUpperCase() + (who ? ' (' + who + ')' : '');
    }

    r32.forEach(function (m) {
      rows.push([roundLabel('R32', m), teamName(state.knockout.r32[m.id])]);
    });

    var rounds = [
      { name: 'r16', display: 'R16' },
      { name: 'qf', display: 'QF' },
      { name: 'sf', display: 'SF' }
    ];
    var picksSoFar = { r32: state.knockout.r32 };
    var sfMatches = null;
    rounds.forEach(function (r) {
      var matches;
      try {
        matches = bracket.advance(r.name, picksSoFar);
      } catch (e) {
        matches = data.KNOCKOUT_CHAIN[r.name].map(function (p) { return { id: p.id, teamA: null, teamB: null }; });
      }
      matches.forEach(function (m) {
        rows.push([roundLabel(r.display, m), teamName(state.knockout[r.name][m.id])]);
      });
      picksSoFar[r.name] = state.knockout[r.name];
      if (r.name === 'sf') sfMatches = matches;
    });

    // 3rd-place match (loser of m101 vs loser of m102).
    var thirdMatch = sfMatches && sfMatches.length === 2
      ? bracket.buildThirdPlace(sfMatches, state.knockout.sf)
      : { id: 'm103', teamA: null, teamB: null };
    rows.push([
      '3RD PLACE MATCH ' + thirdMatch.id.toUpperCase() +
        (thirdMatch.teamA && thirdMatch.teamB ? ' (' + teamName(thirdMatch.teamA) + ' vs ' + teamName(thirdMatch.teamB) + ')' : ''),
      teamName(state.knockout.final.third)
    ]);

    // Final.
    var finalMatch;
    try {
      finalMatch = bracket.advance('final', picksSoFar)[0];
    } catch (e) {
      finalMatch = { id: 'm104', teamA: null, teamB: null };
    }
    rows.push([
      'FINAL ' + finalMatch.id.toUpperCase() +
        (finalMatch.teamA && finalMatch.teamB ? ' (' + teamName(finalMatch.teamA) + ' vs ' + teamName(finalMatch.teamB) + ')' : ''),
      teamName(state.knockout.final.final)
    ]);

    rows.push(['CHAMPION', teamName(state.knockout.final.final)]);

    // ---------- Team-advancement rows (used by the Google Sheet for scoring) ----------
    // These are flat lists of teams the user expects to reach each round, so the
    // sheet can score by "team made it to round X" rather than by exact match
    // outcomes (the user's bracket fixture won't match the real one).

    function teamsInRound(round) {
      var picks = state.knockout[round] || {};
      // Walk match IDs in the chain order so output is deterministic. R32 lives
      // in R32_PAIRINGS, not KNOCKOUT_CHAIN — handle that case explicitly.
      var order = (round === 'r32') ? data.R32_PAIRINGS : (data.KNOCKOUT_CHAIN[round] || []);
      return order.map(function (m) { return picks[m.id]; }).filter(Boolean);
    }

    // R32 = top 2 of every group (24 teams) + the 8 advancing 3rd-place teams.
    var r32List = [];
    Object.keys(data.GROUPS).forEach(function (g) {
      var teams = data.GROUPS[g];
      var gr = state.groupResults[g];
      var s = standings.computeGroup(teams, gr.matches, gr.manualRanking);
      if (s.ranked) {
        if (s.ranked[0]) r32List.push(s.ranked[0]);
        if (s.ranked[1]) r32List.push(s.ranked[1]);
      }
    });
    state.thirdPlaceAdvancing.forEach(function (t) { if (t) r32List.push(t); });

    var r16List = teamsInRound('r32');                // winners of R32 = R16 teams
    var qfList  = teamsInRound('r16');                // winners of R16 = QF teams
    var sfList  = teamsInRound('qf');                 // winners of QF  = SF teams
    var finList = teamsInRound('sf');                 // winners of SF  = finalists

    // Sort each list alphabetically by display name so spreadsheet diffs are stable.
    function byName(a, b) {
      var an = teamName(a), bn = teamName(b);
      return an < bn ? -1 : an > bn ? 1 : 0;
    }
    [r32List, r16List, qfList, sfList, finList].forEach(function (list) { list.sort(byName); });

    function pushTeamRows(label, list) {
      list.forEach(function (id) { rows.push([label, teamName(id)]); });
    }

    pushTeamRows('My R32 team', r32List);
    pushTeamRows('My R16 team', r16List);
    pushTeamRows('My QF team',  qfList);
    pushTeamRows('My SF team',  sfList);
    pushTeamRows('My Finalist', finList);
    if (state.knockout.final.final) {
      rows.push(['My Champion', teamName(state.knockout.final.final)]);
    }

    return rows;
  }

  // ---------- CSV ----------

  function buildCSV(state, name) {
    var rows = collectRows(state);
    var out = [];
    out.push(csvEscape('World Cup Picks · 2026') + ',' + csvEscape(name || 'Anonymous'));
    out.push(csvEscape('Exported') + ',' + csvEscape(todayISO()));
    out.push('');
    out.push(csvEscape('pick_label') + ',' + csvEscape('pick_value'));
    rows.forEach(function (r) {
      out.push(csvEscape(r[0]) + ',' + csvEscape(r[1]));
    });
    return out.join('\r\n') + '\r\n';
  }

  function downloadCSV(state, name) {
    var csv = buildCSV(state, name);
    var bom = '﻿'; // BOM so Excel/Google Sheets correctly handle accents
    var blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    var namePart = safeFilenamePart(name);
    a.href = url;
    a.download = 'world-cup-picks-2026' + (namePart ? '-' + namePart : '') + '-' + todayISO() + '.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  // ---------- PDF (via browser print) ----------

  function downloadPDF(name) {
    // Stamp the name + date into the page so they appear on the printed sheet.
    var stamp = document.getElementById('print-stamp');
    if (!stamp) {
      stamp = document.createElement('div');
      stamp.id = 'print-stamp';
      stamp.className = 'print-only print-stamp';
      document.body.insertBefore(stamp, document.body.firstChild);
    }
    while (stamp.firstChild) stamp.removeChild(stamp.firstChild);
    var title = document.createElement('div');
    title.className = 'print-stamp-title';
    title.textContent = 'WORLD CUP PICKS · 2026';
    var who = document.createElement('div');
    who.className = 'print-stamp-meta';
    who.textContent = (name || 'Anonymous') + ' · ' + todayISO();
    stamp.appendChild(title);
    stamp.appendChild(who);

    // Trigger the print dialog. Browser handles "Save as PDF".
    window.print();
  }

  return {
    buildCSV: buildCSV,
    downloadCSV: downloadCSV,
    downloadPDF: downloadPDF
  };
})();
