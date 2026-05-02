var MUNDIAL = MUNDIAL || {};

MUNDIAL.app = (function () {
  var data = MUNDIAL.data;
  var state = MUNDIAL.state;
  var standings = MUNDIAL.standings;
  var dom = MUNDIAL.dom;
  var el = dom.el, clear = dom.clear;
  var current;

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

  function confirmIfDownstream(round) {
    if (!hasDownstream(round)) return true;
    return window.confirm('This will clear your later picks. Continue?');
  }

  // Knockout pick helpers — abstract over the slightly different shapes for final/third
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

  function cascadeKey(round) {
    if (round === 'finalFinal' || round === 'finalThird') return 'sf';
    return round;
  }

  // ----- GROUP MATCH PICKER -----

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

  // ----- STANDINGS TABLE -----

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

  // ----- TIEBREAKER WIDGET -----

  function renderTiebreaker(group, s, teams) {
    if (s.tiedClusters.length === 0) return null;
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

  // ----- GROUP CARD -----

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
      renderStandingsTable(group, s),
      renderTiebreaker(group, s, teams)
    ]);
  }

  function renderGroups() {
    var container = document.getElementById('groups-container');
    clear(container);
    Object.keys(data.GROUPS).forEach(function (g) {
      container.appendChild(renderGroup(g));
    });
  }

  // ----- GROUP RANKINGS AGGREGATION -----

  function allGroupRankings() {
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

  // ----- THIRD-PLACE SELECTOR -----

  function renderThirdPlace() {
    var section = document.getElementById('thirds');
    var container = document.getElementById('thirds-container');
    clear(container);

    var info = allGroupRankings();
    if (!info.allComplete) {
      section.classList.add('locked');
      var lockNote = section.querySelector('.lock-note');
      if (lockNote) lockNote.style.display = '';
      return info;
    }
    section.classList.remove('locked');
    var lockNote2 = section.querySelector('.lock-note');
    if (lockNote2) lockNote2.style.display = 'none';

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

  // ----- KNOCKOUT BRACKET -----

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

  function lockSection(id) {
    document.getElementById(id).classList.add('locked');
    var c = document.getElementById(id + '-container');
    if (c) clear(c);
  }

  function renderKnockouts(info) {
    var thirdsOk = info.allComplete && current.thirdPlaceAdvancing.length === 8;

    var r32Section = document.getElementById('r32');
    var r32Container = document.getElementById('r32-container');
    clear(r32Container);
    if (!thirdsOk) {
      r32Section.classList.add('locked');
      ['r16','qf','sf','final'].forEach(lockSection);
      return;
    }
    r32Section.classList.remove('locked');
    var r32 = MUNDIAL.bracket.buildR32(info.rankings, current.thirdPlaceAdvancing);
    r32.forEach(function (m) { r32Container.appendChild(renderKnockoutMatch(m, 'r32')); });

    if (!roundDone(r32, current.knockout.r32)) {
      ['r16','qf','sf','final'].forEach(lockSection);
      return;
    }
    var r16 = MUNDIAL.bracket.advance('r16', { r32: current.knockout.r32 });
    if (!renderRound('r16', 'r16', 'r16-container', r16)) {
      ['qf','sf','final'].forEach(lockSection);
      return;
    }

    if (!roundDone(r16, current.knockout.r16)) {
      ['qf','sf','final'].forEach(lockSection);
      return;
    }
    var qf = MUNDIAL.bracket.advance('qf', { r32: current.knockout.r32, r16: current.knockout.r16 });
    if (!renderRound('qf', 'qf', 'qf-container', qf)) {
      ['sf','final'].forEach(lockSection);
      return;
    }

    if (!roundDone(qf, current.knockout.qf)) {
      ['sf','final'].forEach(lockSection);
      return;
    }
    var sf = MUNDIAL.bracket.advance('sf', {
      r32: current.knockout.r32, r16: current.knockout.r16, qf: current.knockout.qf
    });
    if (!renderRound('sf', 'sf', 'sf-container', sf)) {
      lockSection('final');
      return;
    }

    if (!roundDone(sf, current.knockout.sf)) {
      lockSection('final');
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

  // ----- CHAMPION REVEAL -----

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

  // ----- TOP-LEVEL RENDER -----

  function renderAll() {
    renderGroups();
    var info = renderThirdPlace();
    renderKnockouts(info);
    renderChampion();
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
