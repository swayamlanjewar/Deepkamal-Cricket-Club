/**
 * Cricket Club Test Tournament scoring logic using an Event-Sourcing approach.
 * Replays ball events to reconstruct scorecard states deterministically.
 */

export function oversToBalls(oversFraction) {
  if (oversFraction === null || oversFraction === undefined) return 0;
  const oversInt = Math.floor(oversFraction);
  const balls = Math.round((oversFraction - oversInt) * 10);
  return oversInt * 6 + balls;
}

export function ballsToOvers(balls) {
  if (!balls || balls <= 0) return 0;
  const oversInt = Math.floor(balls / 6);
  const ballsRem = balls % 6;
  return parseFloat(`${oversInt}.${ballsRem}`);
}

export function getOversAvailableForInnings(match, innNo) {
  if (!match || match.oversMode !== "limited") return null;
  let completedInningsBalls = 0;
  for (let i = 1; i < innNo; i++) {
    const prevInn = match.innings[String(i)];
    if (prevInn) {
      completedInningsBalls += oversToBalls(prevInn.oversUsed);
    }
  }
  const totalLimitBalls = (match.totalOversLimit || 0) * 6;
  const remainingBalls = Math.max(0, totalLimitBalls - completedInningsBalls);
  return ballsToOvers(remainingBalls);
}

// Initialize a blank scorecard for an innings
export function createBlankInnings(inningsNo, battingTeamId, bowlingTeamId, oversAvailable = null) {
  return {
    inningsNo,
    battingTeamId,
    bowlingTeamId,
    totalRuns: 0,
    wickets: 0,
    oversUsed: 0, // e.g. 14.3
    oversAvailable, // null if unlimited, else innings limit
    isCompleted: false,
    isDeclared: false,
    isAllOut: false,
    battingCard: [], // { playerId, playerName, runs, balls, fours, sixes, out, dismissalType, bowlerId, bowlerName, fielderId, fielderName }
    bowlingCard: [], // { playerId, playerName, overs, maidens, runsConceded, wickets, balls } (exact balls kept for math)
    fallOfWickets: [], // { wicketNo, runs, over, ball, batsmanName }
    balls: [], // The source of truth list of ball events
    
    // Active states during scoring
    currentStrikerId: null,
    currentNonStrikerId: null,
    currentBowlerId: null,
    lastBowlerId: null,
    thisOverBalls: [], // Display details of current over (e.g. ['0', '1', 'W', '4', 'wd', '1nb'])
    currentOverLegalBalls: 0,
    currentOverRuns: 0,
    currentOverWickets: 0
  };
}

// Rebuilds the innings state from a list of ball events
export function rebuildInningsState(initialInnings, battingSquad, bowlingSquad, ballEvents, match = null, allPlayers = []) {
  const N = battingSquad.length || 11;
  let endsAtWickets = Math.max(1, N - 1);
  let lastManActive = false;

  if (match) {
    const isTeamA = initialInnings.battingTeamId === match.teamA.id;
    const teamChoice = isTeamA ? match.lastManChoice?.teamA : match.lastManChoice?.teamB;

    if (match.lastManRule === "both") {
      endsAtWickets = N;
    } else if (match.lastManRule === "perTeam" && teamChoice) {
      const isFirstBattingInnings = initialInnings.inningsNo === 1 || initialInnings.inningsNo === 2;
      if (isFirstBattingInnings) {
        endsAtWickets = (teamChoice === "innings1") ? N : Math.max(1, N - 1);
      } else {
        endsAtWickets = (teamChoice === "innings2") ? N : Math.max(1, N - 1);
      }
    }
  }

  const innings = {
    ...initialInnings,
    totalRuns: 0,
    wickets: 0,
    oversUsed: 0,
    isCompleted: initialInnings.isCompleted,
    isDeclared: initialInnings.isDeclared,
    isAllOut: false,
    lastManActive: false,
    endsAtWickets,
    battingCard: [],
    bowlingCard: [],
    fallOfWickets: [],
    balls: [...ballEvents],
    thisOverBalls: [],
    currentOverLegalBalls: 0,
    currentOverRuns: 0,
    currentOverWickets: 0
  };

  // Helper to get or create batsman scorecard entry
  const getBatsmanCard = (playerId) => {
    let card = innings.battingCard.find(c => c.playerId === playerId);
    if (!card) {
      const pInfo = (allPlayers && allPlayers.length > 0)
        ? allPlayers.find(p => p.id === playerId)
        : battingSquad.find(p => p.id === playerId);
      card = {
        playerId,
        playerName: pInfo ? pInfo.name : "Unknown Batsman",
        runs: 0,
        balls: 0,
        fours: 0,
        sixes: 0,
        out: false,
        dismissalType: "",
        bowlerId: "",
        bowlerName: "",
        fielderId: "",
        fielderName: ""
      };
      innings.battingCard.push(card);
    }
    return card;
  };

  // Helper to get or create bowler scorecard entry
  const getBowlerCard = (playerId) => {
    let card = innings.bowlingCard.find(c => c.playerId === playerId);
    if (!card) {
      const pInfo = (allPlayers && allPlayers.length > 0)
        ? allPlayers.find(p => p.id === playerId)
        : bowlingSquad.find(p => p.id === playerId);
      card = {
        playerId,
        playerName: pInfo ? pInfo.name : "Unknown Bowler",
        overs: 0,
        balls: 0,
        maidens: 0,
        runsConceded: 0,
        wickets: 0,
        currentSpellBalls: 0,
        currentSpellRuns: 0,
        currentSpellWickets: 0
      };
      innings.bowlingCard.push(card);
    }
    return card;
  };

  // We need to keep track of active striker and non-striker in a loop
  let strikerId = innings.currentStrikerId;
  let nonStrikerId = innings.currentNonStrikerId;
  let bowlerId = innings.currentBowlerId;
  let lastBowlerId = innings.lastBowlerId;

  // Let's iterate through the ball events in chronological order
  ballEvents.forEach((ball, index) => {
    // Set active batsman if specified in event (or fallback to running tracker)
    if (ball.strikerId) strikerId = ball.strikerId;
    if (ball.nonStrikerId) nonStrikerId = ball.nonStrikerId;
    if (ball.bowlerId) bowlerId = ball.bowlerId;

    if (!strikerId && !lastManActive) return; // invalid ball
    if (lastManActive && !strikerId) {
      // Re-map striker if empty
      const activeIds = battingSquad.map(p => p.id);
      const outIds = innings.battingCard.filter(c => c.out).map(c => c.playerId);
      const remaining = activeIds.filter(id => !outIds.includes(id));
      if (remaining.length > 0) {
        strikerId = remaining[0];
      }
    }
    if (!strikerId || !bowlerId) return; // invalid ball

    const batCard = getBatsmanCard(strikerId);
    const bowlCard = getBowlerCard(bowlerId);

    // Is it a legal delivery?
    const isWide = ball.extraType === "wide";
    const isNoBall = ball.extraType === "noball";
    const isLegal = !isWide && !isNoBall;



    // Add display symbol for this over balls
    let symbol = "";
    if (ball.wicket) {
      symbol = "W";
    } else if (isWide) {
      symbol = `${ball.runs}wd`;
    } else if (isNoBall) {
      symbol = `${ball.runs}nb`;
    } else if (ball.extraType === "bye") {
      symbol = `${ball.runs}b`;
    } else if (ball.extraType === "legbye") {
      symbol = `${ball.runs}lb`;
    } else if (ball.isDeclaredRun) {
      symbol = `${ball.runs}d`;
    } else {
      symbol = `${ball.runs}`;
    }
    innings.thisOverBalls.push(symbol);

    // Process Runs & Extras
    let totalRunsForBall = 0;
    if (isWide) {
      totalRunsForBall = 1 + ball.runs; // 1 penalty + runs off the wide
      innings.totalRuns += totalRunsForBall;
      bowlCard.runsConceded += totalRunsForBall;
      innings.currentOverRuns += totalRunsForBall;
    } else if (isNoBall) {
      totalRunsForBall = 1 + ball.runs; // 1 penalty + runs off the bat
      innings.totalRuns += totalRunsForBall;
      bowlCard.runsConceded += totalRunsForBall;
      innings.currentOverRuns += totalRunsForBall;
      
      batCard.runs += ball.runs;
      batCard.balls += 1;
      if (ball.runs === 4) batCard.fours += 1;
      if (ball.runs === 6) batCard.sixes += 1;
    } else {
      // Legal ball
      innings.currentOverLegalBalls += 1;
      bowlCard.balls += 1;
      
      // Update bowler overs count
      const oversInt = Math.floor(bowlCard.balls / 6);
      const ballsRem = bowlCard.balls % 6;
      bowlCard.overs = parseFloat(`${oversInt}.${ballsRem}`);

      if (ball.extraType === "bye" || ball.extraType === "legbye") {
        totalRunsForBall = ball.runs;
        innings.totalRuns += totalRunsForBall;
        innings.currentOverRuns += totalRunsForBall;
        batCard.balls += 1;
      } else {
        // Runs off bat
        totalRunsForBall = ball.runs;
        innings.totalRuns += totalRunsForBall;
        bowlCard.runsConceded += totalRunsForBall;
        innings.currentOverRuns += totalRunsForBall;
        
        batCard.runs += ball.runs;
        batCard.balls += 1;
        if (ball.runs === 4) batCard.fours += 1;
        if (ball.runs === 6) batCard.sixes += 1;
      }
    }

    // Process Wicket
    if (ball.wicket) {
      innings.wickets += 1;
      innings.currentOverWickets += 1;
      
      const outBatsmanId = ball.wicket.batsmanId;
      const outBatsmanCard = getBatsmanCard(outBatsmanId);
      outBatsmanCard.out = true;
      outBatsmanCard.dismissalType = ball.wicket.dismissalType;
      outBatsmanCard.bowlerId = bowlerId;
      outBatsmanCard.bowlerName = bowlCard.playerName;
      
      if (ball.wicket.fielderId) {
        outBatsmanCard.fielderId = ball.wicket.fielderId;
        const fielderInfo = bowlingSquad.find(f => f.id === ball.wicket.fielderId);
        outBatsmanCard.fielderName = fielderInfo ? fielderInfo.name : "Fielder";
      }

      // Check bowler wicket credit
      const bowlerCredited = ["Bowled", "Caught", "LBW", "Stumped", "Hit Wicket"].includes(ball.wicket.dismissalType);
      if (bowlerCredited) {
        bowlCard.wickets += 1;
      }

      // Recalculate overs used
      const totalLegalBalls = ballEvents.slice(0, index + 1).filter(b => b.extraType !== "wide" && b.extraType !== "noball").length;
      const overInt = Math.floor(totalLegalBalls / 6);
      const ballRem = totalLegalBalls % 6;
      innings.oversUsed = parseFloat(`${overInt}.${ballRem}`);

      // Fall of Wicket Record
      innings.fallOfWickets.push({
        wicketNo: innings.wickets,
        runs: innings.totalRuns,
        over: overInt,
        ball: ballRem,
        batsmanName: outBatsmanCard.playerName
      });

      // Clear the dismissed batsman from active slots
      if (outBatsmanId === strikerId) {
        strikerId = null; // Needs new striker selection
      } else if (outBatsmanId === nonStrikerId) {
        nonStrikerId = null; // Needs new non-striker selection
      }

      // If last man rule applies and we have N - 1 wickets
      if (endsAtWickets === N && innings.wickets === N - 1) {
        lastManActive = true;
        // The remaining batsman must be the striker
        if (!strikerId && nonStrikerId) {
          strikerId = nonStrikerId;
        }
        nonStrikerId = null;
      }
    } else {
      // Recalculate overs used
      const totalLegalBalls = ballEvents.slice(0, index + 1).filter(b => b.extraType !== "wide" && b.extraType !== "noball").length;
      const overInt = Math.floor(totalLegalBalls / 6);
      const ballRem = totalLegalBalls % 6;
      innings.oversUsed = parseFloat(`${overInt}.${ballRem}`);
    }

    // Strike Rotation for Runs
    if (ball.runs % 2 !== 0 && !ball.wicket && !ball.isDeclaredRun && !lastManActive) {
      const temp = strikerId;
      strikerId = nonStrikerId;
      nonStrikerId = temp;
    }

    // Strike Rotation at End of Over
    if (innings.currentOverLegalBalls === 6) {
      if (!lastManActive) {
        const temp = strikerId;
        strikerId = nonStrikerId;
        nonStrikerId = temp;
      }
      
      // Reset over stats for next over
      lastBowlerId = bowlerId;
      bowlerId = null; // Clear active bowler so new one must be selected
      innings.thisOverBalls = [];
      innings.currentOverLegalBalls = 0;
      innings.currentOverRuns = 0;
      innings.currentOverWickets = 0;
    }
  });

  // Calculate Maidens for bowlers who have finished overs
  innings.bowlingCard.forEach((bowl) => {
    // A maiden is an over where 0 runs (no bat runs, no wides, no noballs) are conceded.
    // To compute maidens, we can scan the balls array for this bowler:
    const bowlerBalls = ballEvents.filter(b => b.bowlerId === bowl.playerId);
    
    let oversCount = 0;
    let maidens = 0;
    let currentOverRunsConceded = 0;
    let currentOverLegalCount = 0;

    bowlerBalls.forEach((b) => {
      const isExtraConceded = b.extraType === "wide" || b.extraType === "noball";
      const isLegalBowl = !isExtraConceded;
      
      let runsConceded = 0;
      if (isExtraConceded) {
        runsConceded = 1 + b.runs;
      } else if (b.extraType !== "bye" && b.extraType !== "legbye") {
        runsConceded = b.runs;
      }
      
      currentOverRunsConceded += runsConceded;
      if (isLegalBowl) {
        currentOverLegalCount += 1;
      }

      if (currentOverLegalCount === 6) {
        if (currentOverRunsConceded === 0) {
          maidens += 1;
        }
        currentOverRunsConceded = 0;
        currentOverLegalCount = 0;
      }
    });

    bowl.maidens = maidens;
  });

  // Save current active states
  innings.currentStrikerId = strikerId;
  innings.currentNonStrikerId = nonStrikerId;
  innings.currentBowlerId = bowlerId;
  innings.lastBowlerId = lastBowlerId;
  innings.lastManActive = lastManActive;

  const totalLegalBalls = ballEvents.filter(b => b.extraType !== "wide" && b.extraType !== "noball").length;
  innings.fullOversCompleted = Math.floor(totalLegalBalls / 6);
  innings.ballsInFinalPartialOver = totalLegalBalls % 6;

  // Post-process: Mark replaced or removed players as retired in batting card
  if (match && match.squadDetails) {
    innings.battingCard.forEach(card => {
      if (!card.out) {
        const detailsA = match.squadDetails.teamA?.[card.playerId];
        const detailsB = match.squadDetails.teamB?.[card.playerId];
        const playerMeta = detailsA || detailsB;
        if (playerMeta && (playerMeta.matchStatus === "replaced" || playerMeta.matchStatus === "removed")) {
          card.out = true;
          card.dismissalType = "Retired — unable to continue";
        }
      }
    });
  }

  // Check if All Out: when wickets down matches max batsmen
  if (innings.wickets >= endsAtWickets && battingSquad.length > 0) {
    innings.isCompleted = true;
    innings.isAllOut = true;
  }

  // Check if overs limit reached (Limited Overs Mode)
  if (innings.oversAvailable) {
    const usedBalls = totalLegalBalls;
    const availableBalls = oversToBalls(innings.oversAvailable);
    if (usedBalls >= availableBalls) {
      innings.isCompleted = true;
    }
  }

  // Ensure totalRuns is exactly derived by summing batsman runs + extras (where noball extra is only the 1-run penalty)
  let w = 0, nb = 0, b = 0, lb = 0;
  ballEvents.forEach((ball) => {
    if (ball.extraType === "wide") w += (1 + (ball.runs || 0));
    else if (ball.extraType === "noball") nb += 1;
    else if (ball.extraType === "bye") b += (ball.runs || 0);
    else if (ball.extraType === "legbye") lb += (ball.runs || 0);
  });
  const extrasTotal = w + nb + b + lb;
  const batsmanRunsTotal = innings.battingCard.reduce((sum, bat) => sum + (bat.runs || 0), 0);
  innings.totalRuns = batsmanRunsTotal + extrasTotal;

  return innings;
}

// Check if chase is completed (chasing team passes target)
export function checkChaseCompleted(innings2Runs, innings1Runs) {
  return innings2Runs > innings1Runs;
}
