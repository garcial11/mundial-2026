var MUNDIAL = MUNDIAL || {};

MUNDIAL.bracket = (function () {
  function getData() { return MUNDIAL.data; }

  // Resolve a non-third slot ('1A', '2B', etc.) to a team id.
  function resolveSlot(slot, groupRankings, thirdsByGroup) {
    if (slot[0] === '1' || slot[0] === '2') {
      var pos = slot[0] === '1' ? 0 : 1;
      var grp = slot.slice(1);
      var ranking = groupRankings[grp];
      return ranking ? ranking[pos] : null;
    }
    if (slot.indexOf('3rd-of-') === 0) {
      // Legacy single-slot resolution — returns the first matching group.
      // Kept for the exported API; buildR32 uses assignThirds instead so
      // each advancing third-place team is assigned to exactly one slot.
      var groups = slot.slice('3rd-of-'.length).split('');
      for (var i = 0; i < groups.length; i++) {
        if (thirdsByGroup[groups[i]]) return thirdsByGroup[groups[i]];
      }
      return null;
    }
    return null;
  }

  // Backtracking solver: assign each '3rd-of-XYZ' slot to a unique advancing
  // third-place group such that the group's letter is in the slot's allowed set.
  // Returns { slotIdx -> groupLetter } or null if no valid assignment exists.
  function assignThirds(thirdSlots, thirdsByGroup) {
    function solve(idx, used) {
      if (idx >= thirdSlots.length) return {};
      var allowed = thirdSlots[idx].allowed;
      for (var i = 0; i < allowed.length; i++) {
        var g = allowed[i];
        if (thirdsByGroup[g] && !used[g]) {
          used[g] = true;
          var rest = solve(idx + 1, used);
          if (rest !== null) {
            rest[idx] = g;
            return rest;
          }
          used[g] = false;
        }
      }
      return null;
    }
    return solve(0, {});
  }

  function buildR32(groupRankings, thirdPlaceAdvancing) {
    var thirdsByGroup = {};
    Object.keys(groupRankings).forEach(function (g) {
      var thirdId = groupRankings[g] && groupRankings[g][2];
      if (thirdPlaceAdvancing.indexOf(thirdId) !== -1) {
        thirdsByGroup[g] = thirdId;
      }
    });

    var pairings = getData().R32_PAIRINGS;

    // Collect all '3rd-of-*' slots, in pairing/side order.
    var thirdSlots = [];
    var slotIdxByPos = {}; // 'matchIdx-side' -> slotIdx
    pairings.forEach(function (p, mi) {
      ['A','B'].forEach(function (side) {
        var slot = side === 'A' ? p.slotA : p.slotB;
        if (slot.indexOf('3rd-of-') === 0) {
          slotIdxByPos[mi + '-' + side] = thirdSlots.length;
          thirdSlots.push({ allowed: slot.slice('3rd-of-'.length).split('') });
        }
      });
    });

    var assignment = assignThirds(thirdSlots, thirdsByGroup);

    function teamForSlot(slot, mi, side) {
      if (slot.indexOf('3rd-of-') === 0) {
        if (!assignment) return null;
        var slotIdx = slotIdxByPos[mi + '-' + side];
        var grp = assignment[slotIdx];
        return grp ? thirdsByGroup[grp] : null;
      }
      return resolveSlot(slot, groupRankings, thirdsByGroup);
    }

    return pairings.map(function (p, mi) {
      return {
        id: p.id,
        teamA: teamForSlot(p.slotA, mi, 'A'),
        teamB: teamForSlot(p.slotB, mi, 'B')
      };
    });
  }

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
