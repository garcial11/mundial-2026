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
