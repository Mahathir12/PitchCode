/* ==========================================================================
   scoring-engine.js — ball-by-ball scoring
   Event log doubles as a Stack (undo = pop + reapply) and a Queue
   (chronological replay for scorecards/highlights).
   ========================================================================== */

function makeBallEvent({ over, ballInOver, bowlerId, strikerId, nonStrikerId,
                          runs = 0, extraType = null, extraRuns = 0,
                          wicket = false, wicketType = null, dismissedId = null, fielderId = null }) {
  return {
    id: Utils.generateId(),
    timestamp: Date.now(),
    over, ballInOver, bowlerId, strikerId, nonStrikerId,
    runs, extraType, extraRuns, wicket, wicketType, dismissedId, fielderId
  };
}

class InningsEngine {
  constructor({ battingTeamId, bowlingTeamId, oversLimit, wicketsLimit = 10 }) {
    this.battingTeamId = battingTeamId;
    this.bowlingTeamId = bowlingTeamId;
    this.oversLimit = oversLimit;
    this.wicketsLimit = wicketsLimit;

    this.eventStack = [];   // supports O(1) undo of most recent ball
    this.ballQueue = [];    // full chronological log for scorecard/replay

    this.score = 0;
    this.wickets = 0;
    this.legalBalls = 0;
    this.currentOverEvents = [];
    this.fallOfWickets = [];       // [{ score, wicketNo, over }]
    this.partnerships = [];        // completed partnerships
    this.currentPartnership = null; // { batters:[a,b], runs, balls }
    this.battingOrder = [];        // ids in order they came to crease
    this.status = 'in_progress';   // in_progress | completed
  }

  static isLegalDelivery(extraType) {
    return extraType !== 'wide' && extraType !== 'noball';
  }

  startPartnership(strikerId, nonStrikerId) {
    this.currentPartnership = { batters: [strikerId, nonStrikerId], runs: 0, balls: 0 };
  }

  recordBall(event) {
    if (this.status === 'completed') throw new Error('Innings already completed');

    this.eventStack.push(event);
    this.ballQueue.push(event);
    this._applyDelta(event, +1);

    if (this.isInningsOver()) this.status = 'completed';
    return event;
  }

  undoLast() {
    const last = this.eventStack.pop();
    if (!last) return null;
    this.ballQueue.pop();
    this._applyDelta(last, -1);
    this.status = 'in_progress';
    return last;
  }

  _applyDelta(event, sign) {
    const totalRuns = event.runs + (event.extraRuns || 0);
    this.score += sign * totalRuns;

    if (InningsEngine.isLegalDelivery(event.extraType)) {
      this.legalBalls += sign;
    }

    if (event.wicket) {
      this.wickets += sign;
      if (sign > 0) {
        this.fallOfWickets.push({ score: this.score, wicketNo: this.wickets, overs: Utils.formatOvers(this.legalBalls) });
        if (this.currentPartnership) {
          this.partnerships.push({ ...this.currentPartnership });
        }
      } else {
        this.fallOfWickets.pop();
      }
    }

    if (this.currentPartnership && sign > 0) {
      this.currentPartnership.runs += totalRuns;
      if (InningsEngine.isLegalDelivery(event.extraType)) this.currentPartnership.balls += 1;
    }
  }

  isInningsOver() {
    return this.wickets >= this.wicketsLimit || this.legalBalls >= this.oversLimit * 6;
  }

  runRate() {
    const overs = this.legalBalls / 6;
    return overs > 0 ? (this.score / overs) : 0;
  }

  requiredRunRate(target) {
    const ballsLeft = this.oversLimit * 6 - this.legalBalls;
    if (ballsLeft <= 0) return null;
    const runsNeeded = target - this.score;
    return runsNeeded > 0 ? (runsNeeded / (ballsLeft / 6)) : 0;
  }

  overSummaries() {
    // Group ballQueue into overs for a Manhattan/worm chart
    const overs = [];
    let currentOver = -1;
    let runsThisOver = 0;
    for (const ev of this.ballQueue) {
      if (ev.over !== currentOver) {
        if (currentOver !== -1) overs.push(runsThisOver);
        currentOver = ev.over;
        runsThisOver = 0;
      }
      runsThisOver += ev.runs + (ev.extraRuns || 0);
    }
    if (currentOver !== -1) overs.push(runsThisOver);
    return overs;
  }
}

class MatchEngine {
  constructor({ id, teamAId, teamBId, oversLimit, tossWinnerId, tossDecision }) {
    this.id = id;
    this.teamAId = teamAId;
    this.teamBId = teamBId;
    this.oversLimit = oversLimit;
    this.tossWinnerId = tossWinnerId;
    this.tossDecision = tossDecision; // 'bat' | 'bowl'

    const battingFirst = tossDecision === 'bat' ? tossWinnerId : (tossWinnerId === teamAId ? teamBId : teamAId);
    const bowlingFirst = battingFirst === teamAId ? teamBId : teamAId;

    this.innings1 = new InningsEngine({ battingTeamId: battingFirst, bowlingTeamId: bowlingFirst, oversLimit });
    this.innings2 = null;
    this.status = 'innings1'; // innings1 | innings2 | completed
    this.result = null;
  }

  startSecondInnings() {
    const target = this.innings1.score + 1;
    this.innings2 = new InningsEngine({
      battingTeamId: this.innings1.bowlingTeamId,
      bowlingTeamId: this.innings1.battingTeamId,
      oversLimit: this.oversLimit
    });
    this.target = target;
    this.status = 'innings2';
  }

  currentInnings() {
    return this.status === 'innings2' ? this.innings2 : this.innings1;
  }

  checkMatchComplete() {
    if (this.status === 'innings2') {
      const inn = this.innings2;
      if (inn.score >= this.target) {
        this.status = 'completed';
        const wicketsRemaining = inn.wicketsLimit - inn.wickets;
        this.result = { winnerId: inn.battingTeamId, method: 'chased', margin: `${wicketsRemaining} wicket${wicketsRemaining === 1 ? '' : 's'}` };
      } else if (inn.isInningsOver()) {
        this.status = 'completed';
        if (inn.score === this.target - 1) {
          this.result = { winnerId: null, method: 'tie' };
        } else {
          this.result = { winnerId: inn.bowlingTeamId, method: 'defended', margin: `${this.target - 1 - inn.score} runs` };
        }
      }
    }
    return this.status === 'completed';
  }
}
