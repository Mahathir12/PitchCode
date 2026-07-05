/* ==========================================================================
   scheduling.js — match schedule generation
   ========================================================================== */

const Scheduling = (() => {

  /** Circle method round-robin. Returns array of rounds, each an array of
   *  [teamAId, teamBId] pairs. O(n^2) matches, O(n) per round rotation. */
  function roundRobin(teamIds) {
    const list = [...teamIds];
    const hasBye = list.length % 2 !== 0;
    if (hasBye) list.push('__BYE__');
    const n = list.length;
    const fixed = list[0];
    let rotating = list.slice(1);
    const rounds = [];

    for (let r = 0; r < n - 1; r++) {
      const current = [fixed, ...rotating];
      const roundMatches = [];
      for (let i = 0; i < n / 2; i++) {
        const home = current[i];
        const away = current[n - 1 - i];
        if (home !== '__BYE__' && away !== '__BYE__') roundMatches.push([home, away]);
      }
      rounds.push(roundMatches);
      rotating.unshift(rotating.pop());
    }
    return rounds;
  }

  /** Splits teams into `numGroups` groups using a snake/seeded distribution
   *  so groups stay balanced in size (and roughly in seeding order if the
   *  input list is pre-ranked). */
  function splitIntoGroups(teamIds, numGroups) {
    const groups = Array.from({ length: numGroups }, () => []);
    teamIds.forEach((id, i) => {
      const groupIdx = i % numGroups; // simple round-robin bucket fill
      groups[groupIdx].push(id);
    });
    return groups; // array of arrays
  }

  /** Random schedule: shuffle teams first (Fisher-Yates), then round robin. */
  function randomSchedule(teamIds) {
    return roundRobin(Utils.fisherYatesShuffle(teamIds));
  }

  /** Single-elimination knockout bracket from a (possibly non-power-of-2)
   *  list of teams. Byes are given to top seeds first. */
  function knockoutBracket(teamIds) {
    const n = teamIds.length;
    let bracketSize = 1;
    while (bracketSize < n) bracketSize *= 2;
    const byes = bracketSize - n;
    const seeded = [...teamIds];
    const firstRound = [];
    let idx = 0;
    for (let i = 0; i < bracketSize / 2; i++) {
      const a = seeded[idx++] ?? null;
      const b = i < byes ? null : (seeded[idx++] ?? null);
      firstRound.push([a, b]); // null = bye, auto-advance
    }
    return firstRound;
  }

  /** IPL-style playoff DAG for a 4-team knockout stage after group play. */
  const PLAYOFF_DAG = {
    Qualifier1: { winnerTo: 'Final', loserTo: 'Qualifier2' },
    Eliminator: { winnerTo: 'Qualifier2', loserTo: null },
    Qualifier2: { winnerTo: 'Final', loserTo: null },
    Final: { winnerTo: null, loserTo: null }
  };

  return { roundRobin, splitIntoGroups, randomSchedule, knockoutBracket, PLAYOFF_DAG };
})();
