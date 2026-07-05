/* ==========================================================================
   demo-data.js — populates realistic sample data so you can see the whole
   app wired together (standings, leaderboard, live scoreboard, team sheets)
   without manually clicking through every step first.
   ========================================================================== */

const DemoData = (() => {
  const TCODE = 'DEMO01';
  const ACODE = 'DEMOAU';

  const TEAM_DEFS = [
    { name: 'Ridgeway Falcons', players: ['A. Karim', 'S. Rahman', 'T. Islam', 'M. Hasan', 'R. Chowdhury', 'F. Ahmed'] },
    { name: 'Northbank Tigers', players: ['J. Alam', 'K. Uddin', 'N. Sarkar', 'B. Hossain', 'D. Khan', 'P. Roy'] },
    { name: 'Riverside Strikers', players: ['H. Miah', 'L. Talukder', 'W. Bhuiyan', 'Q. Sultana', 'V. Akter', 'Z. Mollah'] },
    { name: 'Southgate Warriors', players: ['E. Chy', 'O. Siddique', 'G. Kabir', 'I. Nasrin', 'U. Reza', 'Y. Haque'] }
  ];

  const ROLE_CYCLE = ['Batter', 'Batter', 'All-rounder', 'Bowler', 'Bowler', 'Wicketkeeper'];

  function buildTeam(def) {
    const id = Utils.generateId();
    const players = def.players.map((name, i) => ({ id: Utils.generateId(), name, role: ROLE_CYCLE[i % ROLE_CYCLE.length] }));
    return { id, name: def.name, players };
  }

  function randomRuns() {
    const r = Math.random();
    if (r < 0.30) return 0;
    if (r < 0.52) return 1;
    if (r < 0.64) return 2;
    if (r < 0.70) return 3;
    if (r < 0.88) return 4;
    return 6;
  }

  /** Simulates a full innings against a real engine instance so the ball
   *  log, fall of wickets, and partnerships are all internally consistent. */
  function simulateInnings(inn, battingPlayers, bowlingPlayers) {
    const order = battingPlayers.map(p => p.id);
    const bowlers = bowlingPlayers.filter(p => p.role !== 'Wicketkeeper').map(p => p.id);
    let striker = order[0], nonStriker = order[1], nextIdx = 2;
    inn.startPartnership(striker, nonStriker);

    while (!inn.isInningsOver()) {
      const over = Math.floor(inn.legalBalls / 6);
      const ballInOver = inn.legalBalls % 6;
      const bowlerId = bowlers[over % bowlers.length];
      const roll = Math.random();

      if (roll < 0.055 && nextIdx < order.length) {
        const event = makeBallEvent({ over, ballInOver, bowlerId, strikerId: striker, nonStrikerId: nonStriker,
          runs: 0, wicket: true, wicketType: 'bowled', dismissedId: striker });
        inn.recordBall(event);
        if (inn.isInningsOver()) break;
        striker = order[nextIdx++];
        inn.startPartnership(striker, nonStriker);
        continue;
      }

      if (roll < 0.10) {
        inn.recordBall(makeBallEvent({ over, ballInOver, bowlerId, strikerId: striker, nonStrikerId: nonStriker, runs: 0, extraType: 'wide', extraRuns: 1 }));
        continue;
      }

      const runs = randomRuns();
      inn.recordBall(makeBallEvent({ over, ballInOver, bowlerId, strikerId: striker, nonStrikerId: nonStriker, runs }));
      if (runs % 2 === 1) [striker, nonStriker] = [nonStriker, striker];

      if (inn.legalBalls % 6 === 0 && !inn.isInningsOver()) [striker, nonStriker] = [nonStriker, striker];
    }
  }

  function simulateCompletedMatch(teamA, teamB, oversLimit) {
    const wicketsLimit = Math.min(10, teamA.players.length - 1, teamB.players.length - 1);
    const match = new MatchEngine({
      id: Utils.generateId(), teamAId: teamA.id, teamBId: teamB.id, oversLimit,
      tossWinnerId: teamA.id, tossDecision: 'bat'
    });
    match.innings1.wicketsLimit = wicketsLimit;
    simulateInnings(match.innings1, teamA.players, teamB.players);

    match.startSecondInnings();
    match.innings2.wicketsLimit = wicketsLimit;
    // Simulate ball-by-ball but stop as soon as the chase is decided or overs run out
    const order = teamB.players.map(p => p.id);
    const bowlers = teamA.players.filter(p => p.role !== 'Wicketkeeper').map(p => p.id);
    let striker = order[0], nonStriker = order[1], nextIdx = 2;
    match.innings2.startPartnership(striker, nonStriker);

    while (match.innings2.score < match.target && !match.innings2.isInningsOver()) {
      const over = Math.floor(match.innings2.legalBalls / 6);
      const ballInOver = match.innings2.legalBalls % 6;
      const bowlerId = bowlers[over % bowlers.length];
      const roll = Math.random();

      if (roll < 0.05 && nextIdx < order.length) {
        match.innings2.recordBall(makeBallEvent({ over, ballInOver, bowlerId, strikerId: striker, nonStrikerId: nonStriker, runs: 0, wicket: true, wicketType: 'caught', dismissedId: striker }));
        if (match.innings2.isInningsOver()) break;
        striker = order[nextIdx++];
        match.innings2.startPartnership(striker, nonStriker);
        continue;
      }
      const runs = randomRuns();
      match.innings2.recordBall(makeBallEvent({ over, ballInOver, bowlerId, strikerId: striker, nonStrikerId: nonStriker, runs }));
      if (runs % 2 === 1) [striker, nonStriker] = [nonStriker, striker];
      if (match.innings2.legalBalls % 6 === 0 && !match.innings2.isInningsOver()) [striker, nonStriker] = [nonStriker, striker];
    }
    match.checkMatchComplete();
    return match;
  }

  function nameLookup(teamsById) {
    const map = {};
    Object.values(teamsById).forEach(t => t.players.forEach(p => { map[p.id] = p.name; }));
    return (id) => map[id] || id;
  }

  function loadTournamentDemo() {
    const teamDefs = TEAM_DEFS.map(buildTeam);
    const teamsObj = {};
    teamDefs.forEach(t => { teamsObj[t.id] = t; });
    const getName = nameLookup(teamsObj);

    DB.set(`tournaments/${TCODE}/meta`, {
      name: 'PitchCode Demo Premier League', format: 'group_knockout',
      oversLimit: 6, wicketsLimit: 10, numGroups: 2, createdAt: Date.now()
    });
    DB.set(`tournaments/${TCODE}/teams`, teamsObj);

    const groupA = [teamDefs[0].id, teamDefs[1].id];
    const groupB = [teamDefs[2].id, teamDefs[3].id];
    DB.set(`tournaments/${TCODE}/groups`, [groupA, groupB]);

    const matches = {};
    // One fully simulated & completed match (Group A)
    const completedMatch = simulateCompletedMatch(teamDefs[0], teamDefs[1], 6);
    const matchId1 = completedMatch.id;
    matches[matchId1] = {
      id: matchId1, teamAId: teamDefs[0].id, teamBId: teamDefs[1].id, round: 'Group A · Round 1', stage: 'group',
      status: 'completed', result: completedMatch.result,
      scoreState: {
        matchEngine: JSON.parse(JSON.stringify(completedMatch)),
        currentStriker: null, currentNonStriker: null, currentBowler: null, dismissedIds1: [], dismissedIds2: []
      }
    };

    // One scheduled-but-not-started match (Group B), so the Matches tab shows a mix of states
    const matchId2 = Utils.generateId();
    matches[matchId2] = { id: matchId2, teamAId: teamDefs[2].id, teamBId: teamDefs[3].id, round: 'Group B · Round 1', stage: 'group', status: 'scheduled', result: null };

    DB.set(`tournaments/${TCODE}/matches`, matches);

    // Aggregate stats from the completed match into the leaderboard
    const statsMap = new Map();
    [completedMatch.innings1, completedMatch.innings2].forEach(inn => {
      inn.ballQueue.forEach(ev => {
        applyBallToStats(statsMap, { ...ev, strikerName: getName(ev.strikerId), bowlerName: getName(ev.bowlerId) }, ev.strikerId, ev.bowlerId, inn.battingTeamId);
      });
    });
    const playersObj = {};
    statsMap.forEach((v, k) => playersObj[k] = v);
    DB.set(`tournaments/${TCODE}/players`, playersObj);

    return TCODE;
  }

  function loadAuctionDemo() {
    const categories = [
      { name: 'Marquee', basePrice: 2000000, hidden: false },
      { name: 'Category A', basePrice: 800000, hidden: false },
      { name: 'Category B', basePrice: 400000, hidden: true }
    ];
    const playerDefs = [
      { name: 'Shakib Al Hasan Jr.', role: 'All-rounder', category: 'Marquee' },
      { name: 'Tamim Rahman', role: 'Batter', category: 'Marquee' },
      { name: 'Mustafiz Karim', role: 'Bowler', category: 'Category A' },
      { name: 'Liton Chowdhury', role: 'Wicketkeeper', category: 'Category A' },
      { name: 'Mahmud Hossain', role: 'Batter', category: 'Category A' },
      { name: 'Afif Sultana', role: 'All-rounder', category: 'Category B' },
      { name: 'Nasum Talukder', role: 'Bowler', category: 'Category B' },
      { name: 'Soumya Akter', role: 'Batter', category: 'Category B' },
      { name: 'Ebadot Mollah', role: 'Bowler', category: 'Category B' }
    ];

    const players = {};
    playerDefs.forEach(p => {
      const cat = categories.find(c => c.name === p.category);
      const id = Utils.generateId();
      players[id] = { id, name: p.name, role: p.role, category: p.category, basePrice: cat.basePrice, status: 'unsold', soldTo: null, soldPrice: null };
    });

    const teamDefs = ['Capital Kings', 'Coastal Chargers', 'Delta Dominators'];
    const teams = {};
    teamDefs.forEach(name => {
      const id = Utils.generateId();
      teams[id] = { id, name, ownerName: '', totalPurse: 10000000, remainingPurse: 10000000, squad: [] };
    });

    DB.set(`auctionRooms/${ACODE}/meta`, {
      name: 'PitchCode Demo Auction', defaultPurse: 10000000, createdAt: Date.now(),
      categoryOrder: categories.map(c => c.name),
      hiddenCategories: Object.fromEntries(categories.filter(c => c.hidden).map(c => [c.name, true])),
      categoryBasePrices: Object.fromEntries(categories.map(c => [c.name, c.basePrice])),
      bidderKey: Utils.generateId()
    });
    DB.set(`auctionRooms/${ACODE}/players`, players);
    DB.set(`auctionRooms/${ACODE}/teams`, teams);
    DB.set(`auctionRooms/${ACODE}/liveBid`, null);
    DB.set(`auctionRooms/${ACODE}/sealedBids`, {});
    DB.set(`auctionRooms/${ACODE}/categoryBids`, {});

    // Sell a few players directly so team sheets and purses look organized
    const teamIds = Object.keys(teams);
    const nonHiddenSold = Object.values(players).filter(p => p.category !== 'Category B').slice(0, 3);
    nonHiddenSold.forEach((p, i) => {
      const teamId = teamIds[i % teamIds.length];
      const price = p.basePrice + (i + 1) * 200000;
      const { updatedTeam, updatedPlayer } = Auction.finalizeSale(teams[teamId], p, price);
      teams[teamId] = updatedTeam;
      players[p.id] = updatedPlayer;
    });
    DB.set(`auctionRooms/${ACODE}/teams`, teams);
    DB.set(`auctionRooms/${ACODE}/players`, players);

    return ACODE;
  }

  function loadAll() {
    const tCode = loadTournamentDemo();
    const aCode = loadAuctionDemo();
    return { tournamentCode: tCode, auctionCode: aCode };
  }

  function clearAll() {
    DB.remove(`tournaments/${TCODE}`);
    DB.remove(`auctionRooms/${ACODE}`);
  }

  return { loadAll, clearAll, TCODE, ACODE };
})();
