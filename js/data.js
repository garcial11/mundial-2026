var MUNDIAL = MUNDIAL || {};

MUNDIAL.data = (function () {
  var TEAMS = {
    'mex': { name: 'Mexico',                 code: 'mx' },
    'rsa': { name: 'South Africa',           code: 'za' },
    'kor': { name: 'South Korea',            code: 'kr' },
    'cze': { name: 'Czechia',                code: 'cz' },

    'can': { name: 'Canada',                 code: 'ca' },
    'bih': { name: 'Bosnia and Herzegovina', code: 'ba' },
    'qat': { name: 'Qatar',                  code: 'qa' },
    'sui': { name: 'Switzerland',            code: 'ch' },

    'bra': { name: 'Brazil',                 code: 'br' },
    'mar': { name: 'Morocco',                code: 'ma' },
    'hai': { name: 'Haiti',                  code: 'ht' },
    'sco': { name: 'Scotland',               code: 'gb-sct' },

    'usa': { name: 'United States',          code: 'us' },
    'par': { name: 'Paraguay',               code: 'py' },
    'aus': { name: 'Australia',              code: 'au' },
    'tur': { name: 'Türkiye',                code: 'tr' },

    'ger': { name: 'Germany',                code: 'de' },
    'cur': { name: 'Curaçao',                code: 'cw' },
    'civ': { name: 'Ivory Coast',            code: 'ci' },
    'ecu': { name: 'Ecuador',                code: 'ec' },

    'ned': { name: 'Netherlands',            code: 'nl' },
    'jpn': { name: 'Japan',                  code: 'jp' },
    'swe': { name: 'Sweden',                 code: 'se' },
    'tun': { name: 'Tunisia',                code: 'tn' },

    'bel': { name: 'Belgium',                code: 'be' },
    'egy': { name: 'Egypt',                  code: 'eg' },
    'irn': { name: 'Iran',                   code: 'ir' },
    'nzl': { name: 'New Zealand',            code: 'nz' },

    'esp': { name: 'Spain',                  code: 'es' },
    'cpv': { name: 'Cape Verde',             code: 'cv' },
    'ksa': { name: 'Saudi Arabia',           code: 'sa' },
    'uru': { name: 'Uruguay',                code: 'uy' },

    'fra': { name: 'France',                 code: 'fr' },
    'sen': { name: 'Senegal',                code: 'sn' },
    'irq': { name: 'Iraq',                   code: 'iq' },
    'nor': { name: 'Norway',                 code: 'no' },

    'arg': { name: 'Argentina',              code: 'ar' },
    'alg': { name: 'Algeria',                code: 'dz' },
    'aut': { name: 'Austria',                code: 'at' },
    'jor': { name: 'Jordan',                 code: 'jo' },

    'por': { name: 'Portugal',               code: 'pt' },
    'cod': { name: 'DR Congo',               code: 'cd' },
    'uzb': { name: 'Uzbekistan',             code: 'uz' },
    'col': { name: 'Colombia',               code: 'co' },

    'eng': { name: 'England',                code: 'gb-eng' },
    'cro': { name: 'Croatia',                code: 'hr' },
    'gha': { name: 'Ghana',                  code: 'gh' },
    'pan': { name: 'Panama',                 code: 'pa' }
  };

  var GROUPS = {
    A: ['mex', 'rsa', 'kor', 'cze'],
    B: ['can', 'bih', 'qat', 'sui'],
    C: ['bra', 'mar', 'hai', 'sco'],
    D: ['usa', 'par', 'aus', 'tur'],
    E: ['ger', 'cur', 'civ', 'ecu'],
    F: ['ned', 'jpn', 'swe', 'tun'],
    G: ['bel', 'egy', 'irn', 'nzl'],
    H: ['esp', 'cpv', 'ksa', 'uru'],
    I: ['fra', 'sen', 'irq', 'nor'],
    J: ['arg', 'alg', 'aut', 'jor'],
    K: ['por', 'cod', 'uzb', 'col'],
    L: ['eng', 'cro', 'gha', 'pan']
  };

  function matchKey(idA, idB) {
    return idA < idB ? idA + '-' + idB : idB + '-' + idA;
  }

  function flagUrl(teamId) {
    var team = TEAMS[teamId];
    if (!team) return 'https://flagcdn.com/w160/un.png';
    return 'https://flagcdn.com/w160/' + team.code + '.png';
  }

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

  return {
    TEAMS: TEAMS,
    GROUPS: GROUPS,
    R32_PAIRINGS: R32_PAIRINGS,
    KNOCKOUT_CHAIN: KNOCKOUT_CHAIN,
    matchKey: matchKey,
    flagUrl: flagUrl
  };
})();
