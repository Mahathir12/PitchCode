/* ==========================================================================
   stats.js — running player statistics (HashMap) + top-N leaderboards (Min-Heap)
   ========================================================================== */

class MinHeap {
  constructor(compareFn) { this.data = []; this.cmp = compareFn; }
  size() { return this.data.length; }
  peek() { return this.data[0]; }

  push(x) {
    this.data.push(x);
    this._bubbleUp(this.data.length - 1);
  }

  pop() {
    const top = this.data[0];
    const last = this.data.pop();
    if (this.data.length > 0) {
      this.data[0] = last;
      this._bubbleDown(0);
    }
    return top;
  }

  _bubbleUp(i) {
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.cmp(this.data[i], this.data[parent]) < 0) {
        [this.data[i], this.data[parent]] = [this.data[parent], this.data[i]];
        i = parent;
      } else break;
    }
  }

  _bubbleDown(i) {
    const n = this.data.length;
    while (true) {
      let smallest = i;
      const l = 2 * i + 1, r = 2 * i + 2;
      if (l < n && this.cmp(this.data[l], this.data[smallest]) < 0) smallest = l;
      if (r < n && this.cmp(this.data[r], this.data[smallest]) < 0) smallest = r;
      if (smallest === i) break;
      [this.data[i], this.data[smallest]] = [this.data[smallest], this.data[i]];
      i = smallest;
    }
  }
}

function blankPlayerStats(id, name) {
  return {
    id, name,
    matches: 0, innings: 0, notOuts: 0, runs: 0, ballsFaced: 0, fours: 0, sixes: 0, highestScore: 0,
    oversBowled: 0, ballsBowled: 0, runsConceded: 0, wickets: 0, bestBowling: '0/0',
    catches: 0, stumpings: 0, runOuts: 0
  };
}

/** O(1) amortized per-event update into a HashMap<playerId, PlayerStats>. */
function applyBallToStats(statsMap, event, strikerId, bowlerId, battingTeamId) {
  if (!statsMap.has(strikerId)) statsMap.set(strikerId, blankPlayerStats(strikerId, event.strikerName || strikerId));
  if (!statsMap.has(bowlerId)) statsMap.set(bowlerId, blankPlayerStats(bowlerId, event.bowlerName || bowlerId));

  const striker = statsMap.get(strikerId);
  const bowler = statsMap.get(bowlerId);
  const legal = event.extraType !== 'wide' && event.extraType !== 'noball';

  if (!event.extraType || event.extraType === 'noball') {
    striker.runs += event.runs;
    if (event.runs === 4) striker.fours += 1;
    if (event.runs === 6) striker.sixes += 1;
  }
  if (legal) {
    striker.ballsFaced += 1;
    bowler.ballsBowled += 1;
  }
  if (striker.runs > striker.highestScore) striker.highestScore = striker.runs;

  if (event.extraType !== 'bye' && event.extraType !== 'legbye') {
    bowler.runsConceded += event.runs + (event.extraRuns || 0);
  } else {
    bowler.runsConceded += (event.extraType === 'wide' || event.extraType === 'noball') ? (event.extraRuns || 0) : 0;
  }

  if (event.wicket && event.wicketType !== 'run_out') {
    bowler.wickets += 1;
  }
  bowler.oversBowled = Utils.formatOvers(bowler.ballsBowled);

  return statsMap;
}

function strikeRate(p) { return p.ballsFaced ? +(p.runs / p.ballsFaced * 100).toFixed(2) : 0; }
function battingAverage(p) { const d = p.innings - p.notOuts; return d ? +(p.runs / d).toFixed(2) : p.runs; }
function economy(p) { const overs = p.ballsBowled / 6; return overs ? +(p.runsConceded / overs).toFixed(2) : 0; }
function bowlingAverage(p) { return p.wickets ? +(p.runsConceded / p.wickets).toFixed(2) : null; }

/** Top-N by a numeric key using a size-bounded min-heap: O(n log k) instead
 *  of sorting the whole player list (O(n log n)) every time stats update. */
function topN(players, key, n, higherIsBetter = true) {
  const heap = new MinHeap((a, b) => higherIsBetter ? a[key] - b[key] : b[key] - a[key]);
  for (const p of players) {
    if (heap.size() < n) heap.push(p);
    else if ((higherIsBetter && p[key] > heap.peek()[key]) || (!higherIsBetter && p[key] < heap.peek()[key])) {
      heap.pop();
      heap.push(p);
    }
  }
  return heap.data.sort((a, b) => higherIsBetter ? b[key] - a[key] : a[key] - b[key]);
}

const Stats = { MinHeap, blankPlayerStats, applyBallToStats, strikeRate, battingAverage, economy, bowlingAverage, topN };
