/* ==========================================================================
   auction-engine.js — IPL-style auction logic
   ========================================================================== */

const Auction = (() => {

  /** Bucketed FIFO queue of players by category, so marquee categories can
   *  be dequeued before lower categories while staying stable within a tier. */
  function nextPlayer(players, categoryOrder) {
    for (const cat of categoryOrder) {
      const p = players.find(pl => pl.category === cat && pl.status === 'unsold');
      if (p) return p;
    }
    // fall back to any remaining unsold player outside the known order
    return players.find(pl => pl.status === 'unsold') || null;
  }

  /** Validates and applies a live open-market bid (running max, O(1)). */
  function placeBid(liveBidState, teamId, amount, teamPurseRemaining) {
    if (amount <= liveBidState.currentBid) {
      throw new Error(`Bid must exceed current bid of ${liveBidState.currentBid}`);
    }
    if (amount > teamPurseRemaining) {
      throw new Error('Bid exceeds remaining purse');
    }
    liveBidState.currentBid = amount;
    liveBidState.currentBidder = teamId;
    liveBidState.bidHistory.push({ teamId, amount, timestamp: Date.now() });
    return liveBidState;
  }

  /** First-price sealed-bid resolution for the "hidden bid to end" flow.
   *  sealedBids: { teamId: amount }. O(n) single pass.
   *  When `strict` is true, bids must exceed `floor` (used when converting a
   *  live auction to sealed mode — the sealed price must beat the highest
   *  open bid already on the table, not merely match the base price). When
   *  `strict` is false, bids only need to meet `floor` (the normal base-price
   *  rule for a category that started hidden from the very first bid). */
  function resolveSealedBid(sealedBids, floor, strict = false) {
    let winner = null, highest = -Infinity, second = -Infinity;
    for (const [teamId, amount] of Object.entries(sealedBids || {})) {
      const meetsFloor = strict ? amount > floor : amount >= floor;
      if (!meetsFloor) continue;
      if (amount > highest) { second = highest; highest = amount; winner = teamId; }
      else if (amount > second) { second = amount; }
    }
    return { winnerTeamId: winner, winningAmount: winner ? highest : null, secondHighest: second > -Infinity ? second : null };
  }

  /** Greedy recommendation for a fully-hidden category: sort all submitted
   *  (player, team, amount) bids descending, then assign highest bids first
   *  as long as the player is unclaimed and the team can still afford it.
   *  This mirrors real auction semantics (highest affordable bidder wins),
   *  so it isn't an approximation of an assignment-problem optimum — it IS
   *  the correct rule for this domain. O(m log m) for m submitted bids. */
  function recommendHiddenCategoryAssignments(bids, teamsById, minPrice) {
    const sorted = [...bids]
      .filter(b => b.amount >= minPrice)
      .sort((a, b) => b.amount - a.amount);

    const assignedPlayers = new Set();
    const tentativePurse = new Map(Object.entries(teamsById).map(([id, t]) => [id, t.remainingPurse]));
    const recommendations = [];

    for (const bid of sorted) {
      if (assignedPlayers.has(bid.playerId)) continue;
      const remaining = tentativePurse.get(bid.teamId);
      if (remaining === undefined || remaining < bid.amount) continue;
      recommendations.push(bid);
      assignedPlayers.add(bid.playerId);
      tentativePurse.set(bid.teamId, remaining - bid.amount);
    }
    return recommendations; // bidder reviews/edits before confirming
  }

  /** Finalizes a sale via any path (live / sealed / direct). Mutates and
   *  returns updated team + player records; caller persists via DB. */
  function finalizeSale(team, player, price) {
    const updatedTeam = {
      ...team,
      remainingPurse: team.remainingPurse - price,
      squad: [...(team.squad || []), { playerId: player.id, price }]
    };
    const updatedPlayer = { ...player, status: 'sold', soldTo: team.id, soldPrice: price };
    return { updatedTeam, updatedPlayer };
  }

  function markUnsold(player) {
    return { ...player, status: 'unsold_final' };
  }

  return { nextPlayer, placeBid, resolveSealedBid, recommendHiddenCategoryAssignments, finalizeSale, markUnsold };
})();
