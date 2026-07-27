import React, { useState, useEffect } from "react";
import { 
  Lock, Radio, Calendar, MapPin, User, ChevronRight, 
  RotateCcw, Award, AlertTriangle, Shield, CheckSquare, 
  Square, AlertCircle, Play, Sparkles, Check, Trash2
} from "lucide-react";
import { 
  subscribeMatches, subscribeTeams, subscribePlayers, 
  createMatch, updateMatch, finalizeMatchStats, createTeam, clearAllDatabaseEntries
} from "../services/db";
import { loginAdmin, subscribeAuthState } from "../services/auth";
import { 
  createBlankInnings, rebuildInningsState, checkChaseCompleted,
  oversToBalls, ballsToOvers, getOversAvailableForInnings
} from "../services/scoringEngine";
import confetti from "canvas-confetti";

export default function ScoringPanelPage() {
  const [adminUser, setAdminUser] = useState(null);
  
  // Login credentials
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  // Matches list
  const [matches, setMatches] = useState([]);
  const [teams, setTeams] = useState([]);
  const [allPlayers, setAllPlayers] = useState([]);

  // Panel state: 'list' | 'setup' | 'score'
  const [panelState, setPanelState] = useState("list");
  
  // Setup wizard stepper state: 1, 2, 3
  const [setupStep, setSetupStep] = useState(1);
  const [setupData, setSetupData] = useState({
    name: "",
    venue: "",
    date: new Date().toISOString().split("T")[0],
    oversMode: "limited", // 'limited' | 'unlimited'
    totalOversLimit: 20,
    teamAName: "",
    teamBName: "",
    teamAId: "",
    teamBId: "",
    squads: { teamA: [], teamB: [] }, // player ids
    tossWinnerId: "",
    tossDecision: "bat" // 'bat' | 'bowl'
  });

  // Scoring active match state
  const [scoringMatchId, setScoringMatchId] = useState(null);
  const [scoringMatch, setScoringMatch] = useState(null);

  // Wicket modal state
  const [showWicketModal, setShowWicketModal] = useState(false);
  const [wicketData, setWicketData] = useState({
    dismissalType: "Bowled",
    batsmanId: "",
    fielderId: ""
  });

  // Extra run prompting (Byes / Leg Byes / No Ball)
  const [showExtraPrompt, setShowExtraPrompt] = useState(false);
  const [promptExtraType, setPromptExtraType] = useState(null); // 'bye' | 'legbye'
  const [showNoBallPrompt, setShowNoBallPrompt] = useState(false);

  // Last Man Rule choice modal (shown when inning starts if rule is "perTeam")
  const [showLastManChoiceModal, setShowLastManChoiceModal] = useState(false);
  const [lastManChoiceInning, setLastManChoiceInning] = useState(null);

  // Man of the Match selection modal
  const [showMOTMModal, setShowMOTMModal] = useState(false);
  const [motmData, setMotmData] = useState({
    playerId: "",
    name: "",
    reason: ""
  });

  // Manage Match Squads state hooks
  const [showManageSquadModal, setShowManageSquadModal] = useState(false);
  const [selectedManagePlayerId, setSelectedManagePlayerId] = useState(null);
  const [selectedManageTeamKey, setSelectedManageTeamKey] = useState("teamA");
  const [manageAction, setManageAction] = useState(null); // 'replace' | 'changeTeam' | 'remove'
  const [replacementPlayerId, setReplacementPlayerId] = useState("");
  const [newTeamAssignment, setNewTeamAssignment] = useState("");
  const [removalReasonText, setRemovalReasonText] = useState("");
  const [replacementReasonText, setReplacementReasonText] = useState("");
  const [modalKey, setModalKey] = useState(0); // Force modal re-render
  const [successToast, setSuccessToast] = useState("");

  // Add player to team mid-match state
  const [showAddPlayerModal, setShowAddPlayerModal] = useState(false);
  const [selectedTeamForAdd, setSelectedTeamForAdd] = useState("teamA");
  const [newPlayerIdToAdd, setNewPlayerIdToAdd] = useState("");

  // Reset all manage squad state and reopen modal
  const handleOpenManageSquadModal = () => {
    setManageAction(null);
    setSelectedManagePlayerId(null);
    setSelectedManageTeamKey("teamA");
    setReplacementPlayerId("");
    setNewTeamAssignment("");
    setRemovalReasonText("");
    setReplacementReasonText("");
    setModalKey(prev => prev + 1); // Force re-render
    setShowManageSquadModal(true);
  };

  useEffect(() => {
    const unsubAuth = subscribeAuthState((user) => {
      setAdminUser(user);
    });
    const unsubMatches = subscribeMatches((list) => {
      setMatches(list);
    });
    const unsubTeams = subscribeTeams((list) => {
      setTeams(list);
    });
    const unsubPlayers = subscribePlayers((list) => {
      setAllPlayers(list);
    });

    return () => {
      unsubAuth();
      unsubMatches();
      unsubTeams();
      unsubPlayers();
    };
  }, []);

  // Update live scoring match subscriber if active
  useEffect(() => {
    if (scoringMatchId) {
      const activeMatch = matches.find(m => m.id === scoringMatchId);
      if (activeMatch) {
        setScoringMatch(activeMatch);
      }
    }
  }, [matches, scoringMatchId]);

  // Handle Scorer Login
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError("");
    setLoginLoading(true);
    try {
      await loginAdmin(loginEmail, loginPassword);
      setLoginEmail("");
      setLoginPassword("");
    } catch (err) {
      setLoginError(err.message || "Failed to log in.");
    } finally {
      setLoginLoading(false);
    }
  };

  // Start the setup wizard
  const handleStartSetup = () => {
    setSetupStep(1);
    setSetupData({
      name: "",
      venue: "",
      date: new Date().toISOString().split("T")[0],
      oversMode: "limited",
      totalOversLimit: 20,
      teamAName: "",
      teamBName: "",
      teamAId: "",
      teamBId: "",
      squads: { teamA: [], teamB: [] },
      tossWinnerId: "",
      tossDecision: "bat"
    });
    setPanelState("setup");
  };

  const handleClearDatabase = async () => {
    const confirmed = window.confirm(
      "⚠️ WARNING: This will permanently delete ALL data (players, teams, matches, posts, etc.). This action cannot be undone.\n\nAre you absolutely sure?"
    );
    
    if (!confirmed) return;
    
    const doubleConfirm = window.confirm(
      "Final confirmation: Delete all database entries? Type YES to confirm would be ideal but clicking OK here will proceed."
    );
    
    if (!doubleConfirm) return;
    
    try {
      const success = await clearAllDatabaseEntries();
      if (success) {
        alert("✓ Database cleared successfully! All entries have been deleted.");
        // Refresh the page to see the updated empty state
        window.location.reload();
      } else {
        alert("Error clearing database. Check console for details.");
      }
    } catch (err) {
      alert("Error: " + err.message);
    }
  };

  const handleNextStep = async () => {
    if (setupStep === 1) {
      if (!setupData.name || !setupData.venue || !setupData.teamAName.trim() || !setupData.teamBName.trim()) {
        alert("Please fill in all fields and provide both team names.");
        return;
      }
      if (setupData.teamAName.toLowerCase().trim() === setupData.teamBName.toLowerCase().trim()) {
        alert("Team A and Team B names must be different.");
        return;
      }

      // Lookup or create Team A and Team B
      let tA = teams.find(t => t && t.name && t.name.toLowerCase().trim() === setupData.teamAName.toLowerCase().trim());
      let tB = teams.find(t => t && t.name && t.name.toLowerCase().trim() === setupData.teamBName.toLowerCase().trim());

      try {
        if (!tA) {
          tA = await createTeam(setupData.teamAName.trim());
        }
        if (!tB) {
          tB = await createTeam(setupData.teamBName.trim());
        }

        setSetupData(prev => ({
          ...prev,
          teamAId: tA.id,
          teamBId: tB.id,
          squads: { teamA: [], teamB: [] } // Start clean for assignment
        }));
      } catch (err) {
        alert("Error initializing teams: " + err.message);
        return;
      }
    }
    if (setupStep === 2) {
      if (setupData.squads.teamA.length === 0 || setupData.squads.teamB.length === 0) {
        alert("Both squads must have at least one recruited player.");
        return;
      }
      // Set default toss winner option to Team A
      setSetupData(prev => ({
        ...prev,
        tossWinnerId: prev.teamAId
      }));
    }
    setSetupStep(prev => prev + 1);
  };

  // Assign player to team A, team B, or common
  const handlePlayerAssignment = (playerId, assignment) => {
    setSetupData((prev) => {
      let teamA = [...prev.squads.teamA];
      let teamB = [...prev.squads.teamB];

      // Remove from both first
      teamA = teamA.filter(id => id !== playerId);
      teamB = teamB.filter(id => id !== playerId);

      if (assignment === "teamA") {
        teamA.push(playerId);
      } else if (assignment === "teamB") {
        teamB.push(playerId);
      } else if (assignment === "common") {
        teamA.push(playerId);
        teamB.push(playerId);
      }

      return {
        ...prev,
        squads: { teamA, teamB }
      };
    });
  };

  // Conclude Wizard: Create Match
  const handleFinishSetup = async () => {
    const teamAObj = teams.find(t => t.id === setupData.teamAId);
    const teamBObj = teams.find(t => t.id === setupData.teamBId);

    // Determine Innings 1 Batting & Bowling Teams
    const tossWinnerBatting = (setupData.tossWinnerId === setupData.teamAId && setupData.tossDecision === "bat") ||
                              (setupData.tossWinnerId === setupData.teamBId && setupData.tossDecision === "bowl");
    
    const batTeamId = tossWinnerBatting ? setupData.teamAId : setupData.teamBId;
    const bowlTeamId = tossWinnerBatting ? setupData.teamBId : setupData.teamAId;

    const innings1 = createBlankInnings(
      1, 
      batTeamId, 
      bowlTeamId, 
      setupData.oversMode === "limited" ? setupData.totalOversLimit : null
    );

    // Initialize squad details
    const squadDetails = { teamA: {}, teamB: {} };
    setupData.squads.teamA.forEach(id => {
      const isCommon = setupData.squads.teamB.includes(id);
      squadDetails.teamA[id] = {
        originalPlayerId: id,
        currentPlayerId: id,
        teamAssignment: isCommon ? "common" : "A",
        matchStatus: "active",
        removalReason: null
      };
    });
    setupData.squads.teamB.forEach(id => {
      const isCommon = setupData.squads.teamA.includes(id);
      squadDetails.teamB[id] = {
        originalPlayerId: id,
        currentPlayerId: id,
        teamAssignment: isCommon ? "common" : "B",
        matchStatus: "active",
        removalReason: null
      };
    });

    const matchPayload = {
      name: setupData.name,
      venue: setupData.venue,
      date: new Date(setupData.date).toISOString(),
      oversMode: setupData.oversMode,
      totalOversLimit: setupData.oversMode === "limited" ? Number(setupData.totalOversLimit) : null,
      oversPoolRemaining: setupData.oversMode === "limited" ? Number(setupData.totalOversLimit) : null,
      teamA: { id: setupData.teamAId, name: teamAObj?.name || "Team A" },
      teamB: { id: setupData.teamBId, name: teamBObj?.name || "Team B" },
      tossWinnerId: setupData.tossWinnerId,
      tossDecision: setupData.tossDecision,
      squads: setupData.squads,
      playingXIs: setupData.squads, // Default playing XIs as recruited squads
      squadSize: {
        teamA: setupData.squads.teamA.length,
        teamB: setupData.squads.teamB.length
      },
      squadDetails: squadDetails,
      squadChanges: [],
      lastManRule: setupData.lastManRule,
      lastManChoice: { teamA: null, teamB: null }, // Will be set dynamically when innings start
      currentInningsNo: 1,
      status: "upcoming", // Stays in upcoming status until scorer clicks "Go Live"
      liveStartedAt: null,
      innings: {
        "1": innings1
      }
    };

    try {
      const matchId = await createMatch(matchPayload);
      setScoringMatchId(matchId);
      setPanelState("score");
    } catch (err) {
      alert("Error creating match: " + err.message);
    }
  };


  // Resume scoring a match from dashboard
  const handleResumeScoring = (matchId) => {
    setScoringMatchId(matchId);
    const match = matches.find(m => m.id === matchId);
    setScoringMatch(match);
    setPanelState("score");
  };

  // -------------------------------------------------------------
  // Scoring Actions Inside Match Scoring Panel
  // -------------------------------------------------------------

  const handleSelectStriker = async (batsmanId) => {
    const matchCopy = { ...scoringMatch };
    const inn = matchCopy.innings[matchCopy.currentInningsNo];
    inn.currentStrikerId = batsmanId;
    
    // Add batsman to batting card if not exists
    if (!inn.battingCard.find(c => c.playerId === batsmanId)) {
      const pInfo = allPlayers.find(p => p.id === batsmanId);
      inn.battingCard.push({
        playerId: batsmanId,
        playerName: (pInfo && pInfo.name) ? pInfo.name : "Unknown Batsman",
        runs: 0,
        balls: 0,
        fours: 0,
        sixes: 0,
        out: false,
        dismissalType: ""
      });
    }

    await updateMatch(scoringMatch.id, { innings: matchCopy.innings });
  };

  const handleSelectNonStriker = async (batsmanId) => {
    const matchCopy = { ...scoringMatch };
    const inn = matchCopy.innings[matchCopy.currentInningsNo];
    inn.currentNonStrikerId = batsmanId;
    
    // Add batsman to batting card if not exists
    if (!inn.battingCard.find(c => c.playerId === batsmanId)) {
      const pInfo = allPlayers.find(p => p.id === batsmanId);
      inn.battingCard.push({
        playerId: batsmanId,
        playerName: (pInfo && pInfo.name) ? pInfo.name : "Unknown Batsman",
        runs: 0,
        balls: 0,
        fours: 0,
        sixes: 0,
        out: false,
        dismissalType: ""
      });
    }

    await updateMatch(scoringMatch.id, { innings: matchCopy.innings });
  };

  const handleSelectBowler = async (bowlerId) => {
    const matchCopy = { ...scoringMatch };
    const inn = matchCopy.innings[matchCopy.currentInningsNo];
    inn.currentBowlerId = bowlerId;

    // Add bowler to bowling card if not exists
    if (!inn.bowlingCard.find(c => c.playerId === bowlerId)) {
      const pInfo = allPlayers.find(p => p.id === bowlerId);
      inn.bowlingCard.push({
        playerId: bowlerId,
        playerName: (pInfo && pInfo.name) ? pInfo.name : "Unknown Bowler",
        overs: 0,
        balls: 0,
        maidens: 0,
        runsConceded: 0,
        wickets: 0
      });
    }

    await updateMatch(scoringMatch.id, { innings: matchCopy.innings });
  };

  // CORE: Add Ball to event sequence and rebuild innings state
  const handleScoreBall = async (runs, extraType = null, wicketInfo = null, isDeclaredRun = false) => {
    const match = scoringMatch;
    const innNo = match.currentInningsNo;
    const inn = match.innings[innNo];

    const currentStrikerId = inn.currentStrikerId;
    const currentNonStrikerId = inn.currentNonStrikerId;
    const currentBowlerId = inn.currentBowlerId;

    const isNonStrikerRequired = !inn.lastManActive;

    if (!currentStrikerId || !currentBowlerId || (isNonStrikerRequired && !currentNonStrikerId)) {
      alert(`Please ensure striker, ${isNonStrikerRequired ? "non-striker, " : ""}and bowler are selected first!`);
      return;
    }

    // Trigger confetti on boundaries!
    if (!extraType && (runs === 4 || runs === 6)) {
      confetti({
        particleCount: runs === 6 ? 100 : 50,
        spread: 70,
        origin: { y: 0.8 }
      });
    }

    const newBallEvent = {
      over: Math.floor(inn.oversUsed),
      ballInOver: inn.thisOverBalls.length + 1,
      strikerId: currentStrikerId,
      nonStrikerId: currentNonStrikerId,
      bowlerId: currentBowlerId,
      runs,
      extraType,
      wicket: wicketInfo,
      isDeclaredRun,
      timestamp: new Date().toISOString()
    };

    const updatedBalls = [...(inn.balls || []), newBallEvent];
    
    // Get squads
    const battingSquadIds = match.squads[inn.battingTeamId === match.teamA.id ? "teamA" : "teamB"];
    const bowlingSquadIds = match.squads[inn.bowlingTeamId === match.teamA.id ? "teamA" : "teamB"];

    const battingSquad = allPlayers.filter(p => battingSquadIds.includes(p.id));
    const bowlingSquad = allPlayers.filter(p => bowlingSquadIds.includes(p.id));

    const oversAvailable = getOversAvailableForInnings(match, innNo);
    const rebuiltInnings = rebuildInningsState(
      createBlankInnings(innNo, inn.battingTeamId, inn.bowlingTeamId, oversAvailable),
      battingSquad,
      bowlingSquad,
      updatedBalls,
      match,
      allPlayers
    );

    // Score summaries
    const scoresUpdate = { ...match.scores };
    const activeTeamKey = inn.battingTeamId === match.teamA.id ? "teamA" : "teamB";
    
    // Calculate cumulative runs
    const prevInningsKey = String(innNo - 2);
    const cumulativeRuns = (innNo === 1 || innNo === 2)
      ? rebuiltInnings.totalRuns
      : (match.innings[prevInningsKey]?.totalRuns || 0) + rebuiltInnings.totalRuns;

    scoresUpdate[activeTeamKey] = {
      runs: cumulativeRuns,
      wickets: rebuiltInnings.wickets,
      overs: rebuiltInnings.oversUsed,
      inningsCompleted: rebuiltInnings.isCompleted
    };

    const updates = {
      [`innings.${innNo}`]: rebuiltInnings,
      scores: scoresUpdate
    };

    let updatedOversPoolRemaining = null;
    let poolEndsToZero = false;

    if (match.oversMode === "limited") {
      let completedInningsBalls = 0;
      for (let i = 1; i < innNo; i++) {
        const prevInn = match.innings[String(i)];
        if (prevInn) {
          completedInningsBalls += oversToBalls(prevInn.oversUsed);
        }
      }
      const currentInningsBalls = oversToBalls(rebuiltInnings.oversUsed);
      const totalBallsBowled = completedInningsBalls + currentInningsBalls;
      const totalOversLimitBalls = match.totalOversLimit * 6;
      const remainingPoolBalls = Math.max(0, totalOversLimitBalls - totalBallsBowled);
      updatedOversPoolRemaining = ballsToOvers(remainingPoolBalls);
      updates.oversPoolRemaining = updatedOversPoolRemaining;
      
      if (remainingPoolBalls <= 0) {
        poolEndsToZero = true;
      }
    }

    if (poolEndsToZero) {
      rebuiltInnings.isCompleted = true;
      scoresUpdate[activeTeamKey].inningsCompleted = true;
      
      if (updates.status !== "finished" && match.status !== "finished") {
        updates.status = "finished";
        updates.result = {
          winnerId: null,
          winnerName: "",
          margin: "Match tied (overs pool ended)",
          type: "tie"
        };
        calculateMOTMSuggestion({ ...match, innings: { ...match.innings, [innNo]: rebuiltInnings } });
        setShowMOTMModal(true);
      }
    }

    // Check chase completion for Innings 4
    if (innNo === 4) {
      const team1Total = (match.innings["1"]?.totalRuns || 0) + (match.innings["3"]?.totalRuns || 0);
      const team2Total = (match.innings["2"]?.totalRuns || 0) + rebuiltInnings.totalRuns;

      if (team2Total > team1Total) {
        rebuiltInnings.isCompleted = true;
        scoresUpdate[activeTeamKey].inningsCompleted = true;
        updates.status = "finished";
        
        const N = battingSquad.length || 11;
        const endsAtWickets = rebuiltInnings.endsAtWickets || Math.max(1, N - 1);

        updates.result = {
          winnerId: inn.battingTeamId,
          winnerName: inn.battingTeamId === match.teamA.id ? match.teamA.name : match.teamB.name,
          margin: `${endsAtWickets - rebuiltInnings.wickets} wickets`,
          type: "win_wickets"
        };
        
        calculateMOTMSuggestion({ ...match, innings: { ...match.innings, "4": rebuiltInnings } });
        setShowMOTMModal(true);
      }
    }

    // Check if Innings ended (All Out or overs run out)
    if (rebuiltInnings.isCompleted && updates.status !== "finished") {
      if (innNo === 1) {
        alert("Innings 1 Completed! You can now start Innings 2.");
      } else if (innNo === 2) {
        alert("Innings 2 Completed! You can now start Innings 3.");
      } else if (innNo === 3) {
        // Check for Innings defeat
        const team1Total = (match.innings["1"]?.totalRuns || 0) + rebuiltInnings.totalRuns;
        const team2Total = (match.innings["2"]?.totalRuns || 0);
        
        if (team1Total < team2Total) {
          updates.status = "finished";
          updates.result = {
            winnerId: match.innings["2"].battingTeamId,
            winnerName: match.innings["2"].battingTeamId === match.teamA.id ? match.teamA.name : match.teamB.name,
            margin: `an innings and ${team2Total - team1Total} runs`,
            type: "win_runs"
          };
          calculateMOTMSuggestion({ ...match, innings: { ...match.innings, "3": rebuiltInnings } });
          setShowMOTMModal(true);
        } else {
          alert("Innings 3 Completed! You can now start Innings 4.");
        }
      } else if (innNo === 4) {
        // Innings 4 ended without passing target
        updates.status = "finished";
        const team1Total = (match.innings["1"]?.totalRuns || 0) + (match.innings["3"]?.totalRuns || 0);
        const team2Total = (match.innings["2"]?.totalRuns || 0) + rebuiltInnings.totalRuns;
        
        let resultType = "win_runs";
        let marginText = "";
        let winnerId = null;
        let winnerName = "";

        if (team2Total < team1Total) {
          if (rebuiltInnings.isAllOut) {
            winnerId = match.innings["1"].battingTeamId;
            winnerName = winnerId === match.teamA.id ? match.teamA.name : match.teamB.name;
            marginText = `${team1Total - team2Total} runs`;
            resultType = "win_runs";
          } else {
            resultType = "tie";
            marginText = "Match tied (batting team survived overs)";
          }
        } else {
          resultType = "tie";
          marginText = "Scores level";
        }

        updates.result = {
          winnerId,
          winnerName,
          margin: marginText,
          type: resultType
        };

        calculateMOTMSuggestion({ ...match, innings: { ...match.innings, "4": rebuiltInnings } });
        setShowMOTMModal(true);
      }
    }

    await updateMatch(match.id, updates);
  };

  // Undo Last Ball
  const handleUndo = async () => {
    const match = scoringMatch;
    const innNo = match.currentInningsNo;
    const inn = match.innings[innNo];

    if (!inn.balls || inn.balls.length === 0) {
      alert("No balls in history to undo.");
      return;
    }

    const updatedBalls = inn.balls.slice(0, -1);
    
    // Rebuild
    const battingSquadIds = match.squads[inn.battingTeamId === match.teamA.id ? "teamA" : "teamB"];
    const bowlingSquadIds = match.squads[inn.bowlingTeamId === match.teamA.id ? "teamA" : "teamB"];
    const battingSquad = allPlayers.filter(p => battingSquadIds.includes(p.id));
    const bowlingSquad = allPlayers.filter(p => bowlingSquadIds.includes(p.id));

    const rebuiltInnings = rebuildInningsState(
      createBlankInnings(innNo, inn.battingTeamId, inn.bowlingTeamId, inn.oversAvailable),
      battingSquad,
      bowlingSquad,
      updatedBalls,
      match,
      allPlayers
    );

    // Rebuild complete means it resets completeness
    rebuiltInnings.isCompleted = false;

    const scoresUpdate = { ...match.scores };
    const activeTeamKey = inn.battingTeamId === match.teamA.id ? "teamA" : "teamB";
    
    // Calculate cumulative runs
    const prevInningsKey = String(innNo - 2);
    const cumulativeRuns = (innNo === 1 || innNo === 2)
      ? rebuiltInnings.totalRuns
      : (match.innings[prevInningsKey]?.totalRuns || 0) + rebuiltInnings.totalRuns;

    scoresUpdate[activeTeamKey] = {
      runs: cumulativeRuns,
      wickets: rebuiltInnings.wickets,
      overs: rebuiltInnings.oversUsed,
      inningsCompleted: false
    };

    const updates = {
      [`innings.${innNo}`]: rebuiltInnings,
      scores: scoresUpdate,
      status: "live", // Revert from finished if it was finished
      result: null
    };

    if (match.oversMode === "limited") {
      let completedInningsBalls = 0;
      for (let i = 1; i < innNo; i++) {
        const prevInn = match.innings[String(i)];
        if (prevInn) {
          completedInningsBalls += oversToBalls(prevInn.oversUsed);
        }
      }
      const currentInningsBalls = oversToBalls(rebuiltInnings.oversUsed);
      const totalBalls = completedInningsBalls + currentInningsBalls;
      const remainingPoolBalls = Math.max(0, match.totalOversLimit * 6 - totalBalls);
      updates.oversPoolRemaining = ballsToOvers(remainingPoolBalls);
    }

    await updateMatch(match.id, updates);
  };

  // Start Next Innings (supporting Innings 2, 3, and 4)
  const handleStartNextInnings = async (nextInningsNo) => {
    const match = scoringMatch;
    const prevInningsNo = nextInningsNo - 1;
    const prevInn = match.innings[String(prevInningsNo)];
    
    if (!prevInn.isCompleted && !prevInn.isDeclared) {
      alert(`Please complete or declare Innings ${prevInningsNo} first.`);
      return;
    }

    let oversAvailable = null;
    if (match.oversMode === "limited") {
      oversAvailable = getOversAvailableForInnings(match, nextInningsNo);
    }

    const team1Id = match.innings["1"].battingTeamId;
    const team2Id = match.innings["1"].bowlingTeamId;

    const batTeamId = (nextInningsNo % 2 !== 0) ? team1Id : team2Id;
    const bowlTeamId = (nextInningsNo % 2 !== 0) ? team2Id : team1Id;

    const nextInn = createBlankInnings(nextInningsNo, batTeamId, bowlTeamId, oversAvailable);
    
    const updates = {
      currentInningsNo: nextInningsNo,
      [`innings.${nextInningsNo}`]: nextInn
    };

    await updateMatch(match.id, updates);

    // If last man rule is "perTeam", show modal to ask batting team their choice
    if (match.lastManRule === "perTeam") {
      setLastManChoiceInning(nextInningsNo);
      setShowLastManChoiceModal(true);
    }
  };

  // Handle last man choice during inning start
  const handleLastManChoice = async (choice) => {
    const match = scoringMatch;
    const innNo = lastManChoiceInning;
    const isTeamA = match.innings[String(innNo)].battingTeamId === match.teamA.id;
    
    const teamKey = isTeamA ? "teamA" : "teamB";
    const updatedChoice = { ...match.lastManChoice };
    updatedChoice[teamKey] = choice; // 'innings1' or 'innings2'
    
    await updateMatch(match.id, { lastManChoice: updatedChoice });
    setShowLastManChoiceModal(false);
    setLastManChoiceInning(null);
  };

  // Declare Innings closed
  const handleDeclareInnings = async () => {
    if (!window.confirm("Are you sure you want to declare this innings closed?")) return;

    const match = scoringMatch;
    const innNo = match.currentInningsNo;
    const inn = match.innings[innNo];

    inn.isCompleted = true;
    inn.isDeclared = true;

    const scoresUpdate = { ...match.scores };
    const activeTeamKey = inn.battingTeamId === match.teamA.id ? "teamA" : "teamB";
    scoresUpdate[activeTeamKey].inningsCompleted = true;

    const updates = {
      [`innings.${innNo}`]: inn,
      scores: scoresUpdate
    };

    if (match.oversMode === "limited") {
      let completedInningsBalls = 0;
      for (let i = 1; i < innNo; i++) {
        const prevInn = match.innings[String(i)];
        if (prevInn) {
          completedInningsBalls += oversToBalls(prevInn.oversUsed);
        }
      }
      const currentInningsBalls = oversToBalls(inn.oversUsed);
      const totalBalls = completedInningsBalls + currentInningsBalls;
      const remainingPoolBalls = Math.max(0, match.totalOversLimit * 6 - totalBalls);
      updates.oversPoolRemaining = ballsToOvers(remainingPoolBalls);
    }

    if (innNo === 3) {
      // Check for Innings defeat on declaration
      const team1Total = match.innings["1"].totalRuns + inn.totalRuns;
      const team2Total = match.innings["2"].totalRuns;
      if (team1Total < team2Total) {
        updates.status = "finished";
        updates.result = {
          winnerId: match.innings["2"].battingTeamId,
          winnerName: match.innings["2"].battingTeamId === match.teamA.id ? match.teamA.name : match.teamB.name,
          margin: `an innings and ${team2Total - team1Total} runs`,
          type: "win_runs"
        };
        calculateMOTMSuggestion({ ...match, innings: { ...match.innings, "3": inn } });
        setShowMOTMModal(true);
      }
    } else if (innNo === 4) {
      // Innings 4 declared closed -> Match ends immediately
      updates.status = "finished";
      const team1Total = match.innings["1"].totalRuns + match.innings["3"].totalRuns;
      const team2Total = match.innings["2"].totalRuns + inn.totalRuns;
      
      let winnerId = null;
      let winnerName = "";
      let resultType = "win_runs";
      let marginText = "";

      if (team2Total < team1Total) {
        // By declaring, they are not all out, so it is a tie!
        resultType = "tie";
        marginText = "Match tied (batting team declared)";
      } else if (team2Total > team1Total) {
        winnerId = inn.battingTeamId;
        winnerName = inn.battingTeamId === match.teamA.id ? match.teamA.name : match.teamB.name;
        marginText = "Declared chase successful";
        resultType = "win_wickets";
      } else {
        resultType = "tie";
        marginText = "Scores level";
      }

      updates.result = {
        winnerId,
        winnerName,
        margin: marginText,
        type: resultType
      };

      calculateMOTMSuggestion({ ...match, innings: { ...match.innings, "4": inn } });
      setShowMOTMModal(true);
    }

    await updateMatch(match.id, updates);
  };

  // Calculate Sugggested Man of the Match (MVP score = runs + wickets * 20 + catches * 10)
  const calculateMOTMSuggestion = (match) => {
    const squadPlayerIds = [...match.squads.teamA, ...match.squads.teamB];
    const performance = {};

    squadPlayerIds.forEach(id => {
      performance[id] = { runs: 0, wickets: 0, catches: 0, stumpings: 0 };
    });

    const processInns = (inn) => {
      if (!inn) return;
      inn.battingCard.forEach(b => {
        if (performance[b.playerId]) performance[b.playerId].runs += b.runs;
        if (b.out && b.fielderId && performance[b.fielderId]) {
          if (b.dismissalType === "Caught") performance[b.fielderId].catches += 1;
          if (b.dismissalType === "Stumped") performance[b.fielderId].stumpings += 1;
        }
      });
      inn.bowlingCard.forEach(b => {
        if (performance[b.playerId]) performance[b.playerId].wickets += b.wickets;
      });
    };

    Object.values(match.innings || {}).forEach((inn) => {
      processInns(inn);
    });

    let topPlayerId = "";
    let topScore = -1;

    for (const [id, stats] of Object.entries(performance)) {
      const score = stats.runs + (stats.wickets * 20) + (stats.catches * 10) + (stats.stumpings * 10);
      if (score > topScore) {
        topScore = score;
        topPlayerId = id;
      }
    }

    const topPlayer = allPlayers.find(p => p.id === topPlayerId);
    if (topPlayer) {
      const reasonText = `${topPlayer.name} has the highest match impact with ${performance[topPlayerId].runs} runs and ${performance[topPlayerId].wickets} wickets.`;
      setMotmData({
        playerId: topPlayer.id,
        name: topPlayer.name,
        reason: reasonText
      });
    }
  };

  // Save Man of the Match and conclude scoring panel
  const handleSaveMOTM = async () => {
    if (!motmData.playerId) {
      alert("Please select a Man of the Match.");
      return;
    }

    const matchCopy = { ...scoringMatch };
    const pInfo = allPlayers.find(p => p.id === motmData.playerId);

    const updates = {
      manOfTheMatch: {
        playerId: motmData.playerId,
        name: pInfo ? pInfo.name : "Unknown",
        reason: motmData.reason
      },
      status: "finished"
    };

    // Re-verify scores object
    matchCopy.status = "finished";
    matchCopy.manOfTheMatch = updates.manOfTheMatch;

    try {
      // 1. Save match details
      await updateMatch(scoringMatch.id, updates);
      
      // 2. Perform stats rollups for players and teams
      await finalizeMatchStats(scoringMatch.id, matchCopy);
      
      setShowMOTMModal(false);
      setScoringMatchId(null);
      setScoringMatch(null);
      setPanelState("list");
      alert("Match score finalized and player stats computed!");
    } catch (err) {
      alert("Error saving MOTM: " + err.message);
    }
  };

  // Prompt for Leg Bye / Bye runs
  const handleScoreExtraPrompt = (runs) => {
    handleScoreBall(runs, promptExtraType);
    setShowExtraPrompt(false);
    setPromptExtraType(null);
  };

  // Handle No Ball with batsman runs
  const handleScoreNoBall = (batsmanRuns) => {
    // Just pass batsman runs. The scoring engine will add 1 for the no ball penalty automatically
    handleScoreBall(batsmanRuns, "noball");
    setShowNoBallPrompt(false);
  };

  // Submit Wicket Details
  const handleScoreWicket = () => {
    let dismissedId = wicketData.batsmanId;
    
    // Fallback: Default to current active striker if dropdown selection state is unbound
    const match = scoringMatch;
    const inn = match?.innings[match?.currentInningsNo];
    if (!dismissedId && inn?.currentStrikerId) {
      dismissedId = inn.currentStrikerId;
    }

    if (!dismissedId) {
      alert("Please select the batsman who was dismissed.");
      return;
    }

    const wInfo = {
      isWicket: true,
      dismissalType: wicketData.dismissalType,
      batsmanId: dismissedId,
      fielderId: ["Caught", "Stumped", "Run Out"].includes(wicketData.dismissalType) ? wicketData.fielderId : ""
    };

    console.log("Confirming wicket dismissal event: ", wInfo);
    handleScoreBall(0, null, wInfo);
    setShowWicketModal(false);
    setWicketData({ dismissalType: "Bowled", batsmanId: "", fielderId: "" });
  };

  // Filter available batsmen (excluding those already out, flagging conflicts)
  const getAvailableBatsmen = (match, inn) => {
    const teamKey = inn.battingTeamId === match.teamA.id ? "teamA" : "teamB";
    const squadIds = match.squads[teamKey];
    
    // Out batsmen
    const outIds = inn.battingCard.filter(c => c.out).map(c => c.playerId);
    
    // Active batsmen
    const activeIds = [];
    if (inn.currentStrikerId) activeIds.push(inn.currentStrikerId);
    if (inn.currentNonStrikerId) activeIds.push(inn.currentNonStrikerId);

    const candidates = allPlayers.filter(p => squadIds.includes(p.id) && !outIds.includes(p.id) && !activeIds.includes(p.id));
    
    // Check conflicts: a player cannot bat if they are currently bowling for the opposing side
    // Exception: waived if no other candidates are left (last man scenario)
    const otherCandidatesCount = candidates.filter(p => p.id !== inn.currentBowlerId).length;
    const isShared = (playerId) => {
      const oppTeamKey = teamKey === "teamA" ? "teamB" : "teamA";
      const oppSquadIds = match.squads[oppTeamKey] || [];
      return oppSquadIds.includes(playerId);
    };

    return candidates.map(p => {
      const hasConflict = isShared(p.id) && p.id === inn.currentBowlerId && otherCandidatesCount > 0;
      return {
        ...p,
        isConflict: hasConflict,
        conflictReason: "Active Bowler - Conflict"
      };
    });
  };

  // Filter available bowlers (excluding last bowler, flagging conflicts)
  const getAvailableBowlers = (match, inn) => {
    const teamKey = inn.bowlingTeamId === match.teamA.id ? "teamA" : "teamB";
    const squadIds = match.squads[teamKey];
    
    // Exclude the bowler of the last ball event
    const lastBall = inn.balls && inn.balls.length > 0 ? inn.balls[inn.balls.length - 1] : null;
    const lastBowlerId = lastBall ? lastBall.bowlerId : null;

    const candidates = allPlayers.filter(p => squadIds.includes(p.id) && p.id !== lastBowlerId);

    const activeBatsmenIds = [];
    if (inn.currentStrikerId) activeBatsmenIds.push(inn.currentStrikerId);
    if (inn.currentNonStrikerId) activeBatsmenIds.push(inn.currentNonStrikerId);

    // Check conflicts: a player cannot bowl if they are currently batting for the opposing side
    // Exception: waived if no other candidates are left (last man scenario)
    const otherCandidatesCount = candidates.filter(p => !activeBatsmenIds.includes(p.id)).length;
    const isShared = (playerId) => {
      const oppTeamKey = teamKey === "teamA" ? "teamB" : "teamA";
      const oppSquadIds = match.squads[oppTeamKey] || [];
      return oppSquadIds.includes(playerId);
    };

    return candidates.map(p => {
      const hasConflict = isShared(p.id) && activeBatsmenIds.includes(p.id) && otherCandidatesCount > 0;
      return {
        ...p,
        isConflict: hasConflict,
        conflictReason: "Active Batsman - Conflict"
      };
    });
  };

  // Squad Management Helpers
  const hasPlayerRecordedStats = (match, playerId) => {
    if (!match.innings) return false;
    for (const inn of Object.values(match.innings)) {
      const batEntry = inn.battingCard?.find(c => c.playerId === playerId);
      if (batEntry && (batEntry.balls > 0 || batEntry.runs > 0 || (batEntry.out && batEntry.dismissalType !== "Retired — unable to continue"))) {
        return true;
      }
      const bowlEntry = inn.bowlingCard?.find(c => c.playerId === playerId);
      if (bowlEntry && bowlEntry.balls > 0) {
        return true;
      }
      const fielded = inn.battingCard?.some(c => c.fielderId === playerId);
      if (fielded) {
        return true;
      }
    }
    return false;
  };

  const isPlayerActiveOnField = (match, playerId) => {
    const currentInnNo = match.currentInningsNo;
    const currentInn = match.innings?.[currentInnNo];
    if (!currentInn) return false;
    return currentInn.currentStrikerId === playerId ||
           currentInn.currentNonStrikerId === playerId ||
           currentInn.currentBowlerId === playerId;
  };

  const getSquadDetailsWithFallback = (match, teamKey) => {
    if (match.squadDetails?.[teamKey]) {
      return match.squadDetails[teamKey];
    }
    const details = {};
    const squadIds = match.squads?.[teamKey] || [];
    const oppTeamKey = teamKey === "teamA" ? "teamB" : "teamA";
    const oppSquadIds = match.squads?.[oppTeamKey] || [];
    squadIds.forEach(id => {
      const isCommon = oppSquadIds.includes(id);
      details[id] = {
        originalPlayerId: id,
        currentPlayerId: id,
        teamAssignment: isCommon ? "common" : (teamKey === "teamA" ? "A" : "B"),
        matchStatus: "active",
        removalReason: null
      };
    });
    return details;
  };

  const canManagePlayer = (match, playerId, teamKey) => {
    const squadDetails = match.squadDetails || {
      teamA: getSquadDetailsWithFallback(match, "teamA"),
      teamB: getSquadDetailsWithFallback(match, "teamB")
    };
    const playerDetails = squadDetails?.[teamKey]?.[playerId];
    if (!playerDetails || playerDetails.matchStatus !== "active") return false;
    if (match.status === "finished") return false;

    const currentInnNo = match.currentInningsNo;
    const currentInn = match.innings?.[currentInnNo];
    if (!currentInn) return true; // Before match starts / toss stage

    // If player is currently active in the current inning, they can be managed.
    if (currentInn.currentStrikerId === playerId || 
        currentInn.currentNonStrikerId === playerId || 
        currentInn.currentBowlerId === playerId) {
      return true;
    }

    // Check if they have future batting/bowling roles
    const isCommon = playerDetails.teamAssignment === "common";
    const battingInningsNumbers = [];
    if (match.oversMode === "limited") {
      if (isCommon) {
        battingInningsNumbers.push(1, 2);
      } else {
        battingInningsNumbers.push(teamKey === "teamA" ? 1 : 2);
      }
    } else {
      if (isCommon) {
        battingInningsNumbers.push(1, 2, 3, 4);
      } else {
        if (teamKey === "teamA") {
          battingInningsNumbers.push(1, 3);
        } else {
          battingInningsNumbers.push(2, 4);
        }
      }
    }

    let hasFutureBatting = false;
    for (const innNo of battingInningsNumbers) {
      if (innNo >= currentInnNo) {
        if (innNo > currentInnNo) {
          hasFutureBatting = true;
          break;
        }
        const inn = match.innings[String(innNo)];
        if (inn) {
          const isPlayerTeamBatting = isCommon || (teamKey === "teamA" ? inn.battingTeamId === match.teamA.id : inn.battingTeamId === match.teamB.id);
          if (isPlayerTeamBatting) {
            const card = inn.battingCard?.find(c => c.playerId === playerId);
            const isDismissed = card && card.out && card.dismissalType !== "Retired — unable to continue";
            if (!isDismissed) {
              hasFutureBatting = true;
              break;
            }
          }
        } else {
          hasFutureBatting = true;
          break;
        }
      }
    }

    const bowlingInningsNumbers = [];
    if (match.oversMode === "limited") {
      if (isCommon) {
        bowlingInningsNumbers.push(1, 2);
      } else {
        bowlingInningsNumbers.push(teamKey === "teamA" ? 2 : 1);
      }
    } else {
      if (isCommon) {
        bowlingInningsNumbers.push(1, 2, 3, 4);
      } else {
        if (teamKey === "teamA") {
          bowlingInningsNumbers.push(2, 4);
        } else {
          bowlingInningsNumbers.push(1, 3);
        }
      }
    }

    let hasFutureBowling = false;
    for (const innNo of bowlingInningsNumbers) {
      if (innNo >= currentInnNo) {
        if (innNo > currentInnNo) {
          hasFutureBowling = true;
          break;
        }
        const inn = match.innings[String(innNo)];
        if (inn) {
          const isPlayerTeamBowling = isCommon || (teamKey === "teamA" ? inn.bowlingTeamId === match.teamA.id : inn.bowlingTeamId === match.teamB.id);
          if (isPlayerTeamBowling) {
            hasFutureBowling = true;
            break;
          }
        } else {
          hasFutureBowling = true;
          break;
        }
      }
    }

    return hasFutureBatting || hasFutureBowling;
  };

  const handleReplacePlayer = async (teamKey, outgoingPlayerId, incomingPlayerId) => {
    if (!incomingPlayerId) {
      alert("Please select a replacement player.");
      return;
    }
    const match = scoringMatch;
    const allSquads = { ...match.squads };
    const allSquadDetails = { ...match.squadDetails };
    const allSquadChanges = [...(match.squadChanges || [])];

    const outgoingPlayer = allPlayers.find(p => p.id === outgoingPlayerId);
    const incomingPlayer = allPlayers.find(p => p.id === incomingPlayerId);
    if (!outgoingPlayer || !incomingPlayer) return;

    const prevDetails = allSquadDetails[teamKey]?.[outgoingPlayerId] || {
      originalPlayerId: outgoingPlayerId,
      currentPlayerId: outgoingPlayerId,
      teamAssignment: teamKey === "teamA" ? "A" : "B",
      matchStatus: "active",
      removalReason: null
    };

    const isCommon = prevDetails.teamAssignment === "common";
    if (isCommon) {
      allSquads.teamA = allSquads.teamA.map(id => id === outgoingPlayerId ? incomingPlayerId : id);
      allSquads.teamB = allSquads.teamB.map(id => id === outgoingPlayerId ? incomingPlayerId : id);
    } else {
      allSquads[teamKey] = allSquads[teamKey].map(id => id === outgoingPlayerId ? incomingPlayerId : id);
    }

    const teamsToUpdate = isCommon ? ["teamA", "teamB"] : [teamKey];
    teamsToUpdate.forEach(tk => {
      if (!allSquadDetails[tk]) allSquadDetails[tk] = {};
      const details = allSquadDetails[tk]?.[outgoingPlayerId] || prevDetails;
      allSquadDetails[tk][outgoingPlayerId] = {
        ...details,
        matchStatus: "replaced",
        removalReason: replacementReasonText ? `Replaced by ${incomingPlayer.name} (${replacementReasonText})` : `Replaced by ${incomingPlayer.name}`
      };

      allSquadDetails[tk][incomingPlayerId] = {
        originalPlayerId: details.originalPlayerId,
        currentPlayerId: incomingPlayerId,
        teamAssignment: details.teamAssignment,
        matchStatus: "active",
        removalReason: null
      };
    });

    const displayReason = replacementReasonText ? ` (Reason: ${replacementReasonText})` : "";
    allSquadChanges.push({
      timestamp: new Date().toISOString(),
      type: "replacement",
      playerId: outgoingPlayerId,
      replacementPlayerId: incomingPlayerId,
      details: `Replaced ${outgoingPlayer.name} with ${incomingPlayer.name} in ${isCommon ? "both teams (Common)" : (teamKey === "teamA" ? match.teamA.name : match.teamB.name)}${displayReason}`
    });

    const updates = {
      squads: allSquads,
      squadDetails: allSquadDetails,
      squadChanges: allSquadChanges
    };

    const innNo = match.currentInningsNo;
    const inn = { ...match.innings[innNo] };
    if (inn) {
      let changedInnings = false;
      if (inn.currentStrikerId === outgoingPlayerId || inn.currentNonStrikerId === outgoingPlayerId) {
        const cardIdx = inn.battingCard.findIndex(c => c.playerId === outgoingPlayerId);
        if (cardIdx !== -1) {
          inn.battingCard[cardIdx] = {
            ...inn.battingCard[cardIdx],
            out: true,
            dismissalType: "Retired — unable to continue"
          };
        } else {
          inn.battingCard.push({
            playerId: outgoingPlayerId,
            playerName: outgoingPlayer.name,
            runs: 0,
            balls: 0,
            fours: 0,
            sixes: 0,
            out: true,
            dismissalType: "Retired — unable to continue"
          });
        }
        if (inn.currentStrikerId === outgoingPlayerId) {
          inn.currentStrikerId = null;
        } else {
          inn.currentNonStrikerId = null;
        }
        changedInnings = true;
      }
      if (inn.currentBowlerId === outgoingPlayerId) {
        inn.currentBowlerId = null;
        changedInnings = true;
      }
      if (changedInnings) {
        const battingSquadIds = allSquads[inn.battingTeamId === match.teamA.id ? "teamA" : "teamB"] || [];
        const bowlingSquadIds = allSquads[inn.bowlingTeamId === match.teamA.id ? "teamA" : "teamB"] || [];
        const battingSquad = allPlayers.filter(p => battingSquadIds.includes(p.id));
        const bowlingSquad = allPlayers.filter(p => bowlingSquadIds.includes(p.id));

        const rebuiltInnings = rebuildInningsState(
          createBlankInnings(innNo, inn.battingTeamId, inn.bowlingTeamId, inn.oversAvailable),
          battingSquad,
          bowlingSquad,
          inn.balls,
          { ...match, squads: allSquads, squadDetails: allSquadDetails },
          allPlayers
        );
        updates[`innings.${innNo}`] = rebuiltInnings;
      }
    }

    try {
      await updateMatch(match.id, updates);
      setSuccessToast("Player replaced successfully");
      setTimeout(() => setSuccessToast(""), 3000);
      setManageAction(null);
      setSelectedManagePlayerId(null);
      setReplacementPlayerId("");
      setReplacementReasonText("");
      setScoringMatch({ ...match, squads: allSquads, squadDetails: allSquadDetails, squadChanges: allSquadChanges, [`innings.${innNo}`]: updates[`innings.${innNo}`] || match.innings[innNo] });
    } catch (err) {
      alert("Error performing replacement: " + err.message);
    }
  };

  const handleChangeTeamAssignment = async (teamKey, playerId, newAssignment) => {
    const match = scoringMatch;
    const allSquads = { ...match.squads };
    const allSquadDetails = { ...match.squadDetails };
    const allSquadChanges = [...(match.squadChanges || [])];
    
    const player = allPlayers.find(p => p.id === playerId);
    if (!player) return;

    allSquads.teamA = allSquads.teamA.filter(id => id !== playerId);
    allSquads.teamB = allSquads.teamB.filter(id => id !== playerId);

    if (newAssignment === "teamA") {
      allSquads.teamA.push(playerId);
    } else if (newAssignment === "teamB") {
      allSquads.teamB.push(playerId);
    } else if (newAssignment === "common") {
      allSquads.teamA.push(playerId);
      allSquads.teamB.push(playerId);
    }

    const prevDetails = allSquadDetails.teamA?.[playerId] || allSquadDetails.teamB?.[playerId] || {
      originalPlayerId: playerId,
      currentPlayerId: playerId,
      teamAssignment: "A",
      matchStatus: "active",
      removalReason: null
    };

    if (allSquadDetails.teamA) delete allSquadDetails.teamA[playerId];
    if (allSquadDetails.teamB) delete allSquadDetails.teamB[playerId];

    const updatedMeta = {
      ...prevDetails,
      teamAssignment: newAssignment
    };

    if (newAssignment === "teamA" || newAssignment === "common") {
      if (!allSquadDetails.teamA) allSquadDetails.teamA = {};
      allSquadDetails.teamA[playerId] = updatedMeta;
    }
    if (newAssignment === "teamB" || newAssignment === "common") {
      if (!allSquadDetails.teamB) allSquadDetails.teamB = {};
      allSquadDetails.teamB[playerId] = updatedMeta;
    }

    allSquadChanges.push({
      timestamp: new Date().toISOString(),
      type: "reassignment",
      playerId,
      details: `Reassigned ${player.name} to ${newAssignment === "common" ? "Common" : newAssignment === "teamA" ? match.teamA.name : match.teamB.name}`
    });

    const updates = {
      squads: allSquads,
      squadDetails: allSquadDetails,
      squadChanges: allSquadChanges
    };

    const innNo = match.currentInningsNo;
    const inn = { ...match.innings[innNo] };
    if (inn) {
      const battingSquadIds = allSquads[inn.battingTeamId === match.teamA.id ? "teamA" : "teamB"] || [];
      const bowlingSquadIds = allSquads[inn.bowlingTeamId === match.teamA.id ? "teamA" : "teamB"] || [];
      const battingSquad = allPlayers.filter(p => battingSquadIds.includes(p.id));
      const bowlingSquad = allPlayers.filter(p => bowlingSquadIds.includes(p.id));

      const rebuiltInnings = rebuildInningsState(
        createBlankInnings(innNo, inn.battingTeamId, inn.bowlingTeamId, inn.oversAvailable),
        battingSquad,
        bowlingSquad,
        inn.balls,
        { ...match, squads: allSquads, squadDetails: allSquadDetails },
        allPlayers
      );
      updates[`innings.${innNo}`] = rebuiltInnings;
    }

    try {
      await updateMatch(match.id, updates);
      setSuccessToast("Team assignment updated successfully");
      setTimeout(() => setSuccessToast(""), 3000);
      setManageAction(null);
      setSelectedManagePlayerId(null);
      setScoringMatch({ ...match, squads: allSquads, squadDetails: allSquadDetails, squadChanges: allSquadChanges, [`innings.${innNo}`]: updates[`innings.${innNo}`] || match.innings[innNo] });
    } catch (err) {
      alert("Error performing team reassignment: " + err.message);
    }
  };

  const handleRemovePlayer = async (teamKey, playerId, reason) => {
    const player = allPlayers.find(p => p.id === playerId);
    if (!player) return;

    // Add confirmation dialog
    const confirmed = window.confirm(
      `Are you sure you want to remove ${player.name} from this match? This action cannot be undone.`
    );
    if (!confirmed) return;

    const match = scoringMatch;
    const allSquads = { ...match.squads };
    const allSquadDetails = { ...match.squadDetails };
    const allSquadChanges = [...(match.squadChanges || [])];
    const allSquadSize = { ...(match.squadSize || { teamA: allSquads.teamA.length, teamB: allSquads.teamB.length }) };

    const prevDetails = allSquadDetails[teamKey]?.[playerId] || {
      originalPlayerId: playerId,
      currentPlayerId: playerId,
      teamAssignment: teamKey === "teamA" ? "A" : "B",
      matchStatus: "active",
      removalReason: null
    };

    const isCommon = prevDetails.teamAssignment === "common";
    if (isCommon) {
      allSquads.teamA = allSquads.teamA.filter(id => id !== playerId);
      allSquads.teamB = allSquads.teamB.filter(id => id !== playerId);
      allSquadSize.teamA = Math.max(0, allSquadSize.teamA - 1);
      allSquadSize.teamB = Math.max(0, allSquadSize.teamB - 1);
    } else {
      allSquads[teamKey] = allSquads[teamKey].filter(id => id !== playerId);
      allSquadSize[teamKey] = Math.max(0, allSquadSize[teamKey] - 1);
    }

    const teamsToUpdate = isCommon ? ["teamA", "teamB"] : [teamKey];
    teamsToUpdate.forEach(tk => {
      if (!allSquadDetails[tk]) allSquadDetails[tk] = {};
      const details = allSquadDetails[tk]?.[playerId] || prevDetails;
      allSquadDetails[tk][playerId] = {
        ...details,
        matchStatus: "removed",
        removalReason: reason || "Removed from match scoped play"
      };
    });

    const displayReason = reason ? ` (Reason: ${reason})` : "";
    allSquadChanges.push({
      timestamp: new Date().toISOString(),
      type: "removal",
      playerId,
      details: `Removed ${player.name} from match squads in ${isCommon ? "both teams (Common)" : (teamKey === "teamA" ? match.teamA.name : match.teamB.name)}${displayReason}`
    });

    const updates = {
      squads: allSquads,
      squadDetails: allSquadDetails,
      squadChanges: allSquadChanges,
      squadSize: allSquadSize
    };

    const innNo = match.currentInningsNo;
    const inn = { ...match.innings[innNo] };
    if (inn) {
      if (inn.currentStrikerId === playerId) inn.currentStrikerId = null;
      if (inn.currentNonStrikerId === playerId) inn.currentNonStrikerId = null;
      if (inn.currentBowlerId === playerId) inn.currentBowlerId = null;

      const battingSquadIds = allSquads[inn.battingTeamId === match.teamA.id ? "teamA" : "teamB"] || [];
      const bowlingSquadIds = allSquads[inn.bowlingTeamId === match.teamA.id ? "teamA" : "teamB"] || [];
      const battingSquad = allPlayers.filter(p => battingSquadIds.includes(p.id));
      const bowlingSquad = allPlayers.filter(p => bowlingSquadIds.includes(p.id));

      const rebuiltInnings = rebuildInningsState(
        createBlankInnings(innNo, inn.battingTeamId, inn.bowlingTeamId, inn.oversAvailable),
        battingSquad,
        bowlingSquad,
        inn.balls,
        { ...match, squads: allSquads, squadDetails: allSquadDetails, squadSize: allSquadSize },
        allPlayers
      );
      updates[`innings.${innNo}`] = rebuiltInnings;

      const activeTeamKey = inn.battingTeamId === match.teamA.id ? "teamA" : "teamB";
      const scoresUpdate = { ...match.scores };
      const prevInningsKey = String(innNo - 2);
      const cumulativeRuns = (innNo === 1 || innNo === 2)
        ? rebuiltInnings.totalRuns
        : (match.innings[prevInningsKey]?.totalRuns || 0) + rebuiltInnings.totalRuns;

      scoresUpdate[activeTeamKey] = {
        runs: cumulativeRuns,
        wickets: rebuiltInnings.wickets,
        overs: rebuiltInnings.oversUsed,
        inningsCompleted: rebuiltInnings.isCompleted
      };
      updates.scores = scoresUpdate;
    }

    try {
      await updateMatch(match.id, updates);
      setSuccessToast("Player removed successfully");
      setTimeout(() => setSuccessToast(""), 3000);
      setManageAction(null);
      setSelectedManagePlayerId(null);
      setRemovalReasonText("");
      setScoringMatch({ ...match, squads: allSquads, squadDetails: allSquadDetails, squadChanges: allSquadChanges, squadSize: allSquadSize, [`innings.${innNo}`]: updates[`innings.${innNo}`] || match.innings[innNo], scores: updates.scores || match.scores });
    } catch (err) {
      alert("Error removing player: " + err.message);
    }
  };

  const handleAddPlayerToTeam = async (teamKey, playerId) => {
    if (!playerId) {
      alert("Please select a player to add.");
      return;
    }

    const match = scoringMatch;
    const allSquads = { ...match.squads };
    const allSquadDetails = { ...match.squadDetails };
    const allSquadChanges = [...(match.squadChanges || [])];
    const allSquadSize = { ...(match.squadSize || { teamA: allSquads.teamA.length, teamB: allSquads.teamB.length }) };

    const player = allPlayers.find(p => p.id === playerId);
    if (!player) return;

    // Check if player is already in the team
    if (allSquads[teamKey].includes(playerId)) {
      alert("This player is already in this team.");
      return;
    }

    // Add player to the team
    allSquads[teamKey].push(playerId);
    allSquadSize[teamKey] = allSquadSize[teamKey] + 1;

    // Add squad details for the new player
    if (!allSquadDetails[teamKey]) allSquadDetails[teamKey] = {};
    allSquadDetails[teamKey][playerId] = {
      originalPlayerId: playerId,
      currentPlayerId: playerId,
      teamAssignment: teamKey === "teamA" ? "A" : "B",
      matchStatus: "active",
      removalReason: null
    };

    // Add to audit trail
    allSquadChanges.push({
      timestamp: new Date().toISOString(),
      type: "addition",
      playerId,
      details: `Added ${player.name} to ${teamKey === "teamA" ? match.teamA.name : match.teamB.name} during match`
    });

    const updates = {
      squads: allSquads,
      squadDetails: allSquadDetails,
      squadChanges: allSquadChanges,
      squadSize: allSquadSize
    };

    // Update innings if match is live
    const innNo = match.currentInningsNo;
    const inn = match.innings?.[innNo];
    if (inn) {
      const battingSquadIds = allSquads[inn.battingTeamId === match.teamA.id ? "teamA" : "teamB"] || [];
      const bowlingSquadIds = allSquads[inn.bowlingTeamId === match.teamA.id ? "teamA" : "teamB"] || [];
      const battingSquad = allPlayers.filter(p => battingSquadIds.includes(p.id));
      const bowlingSquad = allPlayers.filter(p => bowlingSquadIds.includes(p.id));

      const rebuiltInnings = rebuildInningsState(
        createBlankInnings(innNo, inn.battingTeamId, inn.bowlingTeamId, inn.oversAvailable),
        battingSquad,
        bowlingSquad,
        inn.balls,
        { ...match, squads: allSquads, squadDetails: allSquadDetails, squadSize: allSquadSize },
        allPlayers
      );
      updates[`innings.${innNo}`] = rebuiltInnings;
    }

    try {
      await updateMatch(match.id, updates);
      setShowAddPlayerModal(false);
      setNewPlayerIdToAdd("");
      setSelectedTeamForAdd("teamA");
      setScoringMatch({ ...match, squads: allSquads, squadDetails: allSquadDetails, squadChanges: allSquadChanges, squadSize: allSquadSize, [`innings.${innNo}`]: updates[`innings.${innNo}`] || match.innings[innNo] });
      setModalKey(prev => prev + 1);
    } catch (err) {
      alert("Error adding player: " + err.message);
    }
  };

  // -------------------------------------------------------------
  // Rendering Layouts
  // -------------------------------------------------------------

  if (!adminUser) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 animate-pop">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-xl">
          <div className="text-center mb-8">
            <div className="w-12 h-12 bg-rose-500/10 text-rose-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Lock size={24} />
            </div>
            <h2 className="font-display font-extrabold text-2xl text-slate-900 dark:text-white">
              Scorer Panel Login
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">
              Authorized cricket club scorers only.
            </p>
          </div>

          {loginError && (
            <div className="flex items-center space-x-2 p-3.5 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-xl text-red-600 dark:text-red-400 text-xs mb-6">
              <AlertCircle size={16} className="shrink-0" />
              <span>{loginError}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                Scorer Username / Email
              </label>
              <input
                type="text"
                placeholder="e.g. admin"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500 text-sm transition-all"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                Password
              </label>
              <input
                type="password"
                placeholder="••••••••"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500 text-sm transition-all"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loginLoading}
              className={`w-full py-3.5 text-white font-medium rounded-xl text-sm transition-all shadow-lg shadow-rose-500/10 ${
                loginLoading ? "bg-slate-400 dark:bg-slate-800" : "bg-rose-600 hover:bg-rose-700 active:scale-[0.98]"
              }`}
            >
              {loginLoading ? "Signing in..." : "Secure Login"}
            </button>
          </form>

          <p className="text-center text-[10px] text-slate-400 dark:text-slate-500 mt-6 leading-relaxed">
            Hint: Use `admin` and `admin123` to log in for quick preview testing.
          </p>
        </div>
      </div>
    );
  }

  // Dashboard List of Matches
  if (panelState === "list") {
    const liveMatches = matches.filter(m => m.status === "live");
    const upcomingMatches = matches.filter(m => m.status === "upcoming");
    const finishedMatches = matches.filter(m => m.status === "finished");

    return (
      <div className="max-w-5xl mx-auto px-4 py-8 animate-pop">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0 mb-8 border-b border-slate-200 dark:border-slate-800 pb-6">
          <div>
            <h2 className="font-display font-extrabold text-2xl sm:text-3xl text-slate-900 dark:text-white tracking-tight">
              Scorer Control Board
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
              Select an active match to score or create a new test-style tournament match.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <button
              onClick={handleStartSetup}
              className="px-5 py-3 bg-rose-600 hover:bg-rose-700 active:scale-[0.98] text-white font-bold rounded-2xl text-sm transition-all shadow-lg shadow-rose-600/20 flex items-center justify-center space-x-2"
            >
              <Play size={16} />
              <span>Create New Match</span>
            </button>
            <button
              onClick={handleClearDatabase}
              className="px-5 py-3 bg-red-600 hover:bg-red-700 active:scale-[0.98] text-white font-bold rounded-2xl text-sm transition-all shadow-lg shadow-red-600/20 flex items-center justify-center space-x-2"
            >
              <Trash2 size={16} />
              <span>Clear Database</span>
            </button>
          </div>
        </div>

        {/* Live Matches Scorer Ticker */}
        {liveMatches.length > 0 && (
          <div className="mb-8">
            <h3 className="font-display font-bold text-xs uppercase tracking-wider text-rose-500 flex items-center space-x-2 mb-4">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping"></span>
              <span>Live Matches In Progress ({liveMatches.length})</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {liveMatches.map((m) => (
                <div key={m.id} className="bg-rose-50/20 dark:bg-rose-950/5 border border-rose-500/30 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
                  <div>
                    <h4 className="font-display font-bold text-slate-800 dark:text-white text-base">{m.name}</h4>
                    <p className="text-slate-400 text-xs mt-1 flex items-center space-x-1">
                      <MapPin size={12} />
                      <span>{m.venue}</span>
                    </p>
                    <div className="mt-4 flex items-center justify-between text-sm text-slate-600 dark:text-slate-300 font-semibold bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 rounded-xl p-3">
                      <div>{m.teamA.name}: {m.scores.teamA.runs}/{m.scores.teamA.wickets} ({m.scores.teamA.overs})</div>
                      <div>{m.teamB.name}: {m.scores.teamB.runs}/{m.scores.teamB.wickets} ({m.scores.teamB.overs})</div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleResumeScoring(m.id)}
                    className="w-full mt-4 py-2.5 bg-rose-600 hover:bg-rose-700 active:scale-[0.98] text-white font-semibold rounded-xl text-xs transition-all shadow-md"
                  >
                    Resume Ball-by-Ball Scoring
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Upcoming Matches Setup */}
        <div className="mb-8">
          <h3 className="font-display font-bold text-xs uppercase tracking-wider text-slate-400 mb-4">
            Upcoming Fixtures ({upcomingMatches.length})
          </h3>
          {upcomingMatches.length === 0 ? (
            <p className="text-slate-400 text-xs bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl p-5 text-center">No upcoming fixtures scheduled.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {upcomingMatches.map((m) => (
                <div key={m.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
                  <div>
                    <h4 className="font-display font-bold text-slate-800 dark:text-white text-base">{m.name}</h4>
                    <p className="text-slate-500 dark:text-slate-400 text-xs mt-1.5 flex items-center space-x-1">
                      <MapPin size={12} className="text-slate-400" />
                      <span>{m.venue}</span>
                    </p>
                    <div className="mt-4 text-xs font-medium text-slate-500 dark:text-slate-400">
                      Matchup: <span className="text-slate-700 dark:text-slate-300 font-semibold">{m.teamA.name}</span> vs <span className="text-slate-700 dark:text-slate-300 font-semibold">{m.teamB.name}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleResumeScoring(m.id)}
                    className="w-full mt-4 py-2.5 border border-rose-500/50 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-rose-500 font-semibold rounded-xl text-xs transition-all"
                  >
                    Initiate Toss & Recruit Squad
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Finished Matches List */}
        <div>
          <h3 className="font-display font-bold text-xs uppercase tracking-wider text-slate-400 mb-4">
            Completed Scorecards ({finishedMatches.length})
          </h3>
          {finishedMatches.length === 0 ? (
            <p className="text-slate-400 text-xs bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl p-5 text-center">No finished matches scored.</p>
          ) : (
            <div className="space-y-4">
              {finishedMatches.map((m) => (
                <div key={m.id} className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
                  <div>
                    <h4 className="font-display font-bold text-slate-800 dark:text-white text-sm">{m.name}</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center space-x-1 mt-0.5">
                      <MapPin size={11} />
                      <span>{m.venue}</span>
                    </p>
                  </div>
                  <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-lg px-3 py-1.5 self-start sm:self-center">
                    {m.result ? `${m.result.winnerName} won by ${m.result.margin}` : "Draw"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Setup Wizard for Creating/Configuring Match
  if (panelState === "setup") {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8 animate-pop">
        {/* Progress bar / tabs */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl">
          <div className="flex items-center justify-between mb-8 border-b border-slate-100 dark:border-slate-800 pb-5">
            <h2 className="font-display font-extrabold text-xl sm:text-2xl text-slate-900 dark:text-white">
              Match Setup Wizard
            </h2>
            <button
              onClick={() => setPanelState("list")}
              className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:underline"
            >
              Cancel Setup
            </button>
          </div>

          <div className="flex items-center space-x-2 mb-8">
            {[
              { num: 1, label: "Info" },
              { num: 2, label: "Squads" },
              { num: 3, label: "Toss" }
            ].map((s) => (
              <React.Fragment key={s.num}>
                <div className="flex items-center space-x-2">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                    setupStep >= s.num 
                      ? "bg-rose-600 text-white" 
                      : "bg-slate-100 dark:bg-slate-800 text-slate-400"
                  }`}>
                    {s.num}
                  </div>
                  <span className={`text-xs font-semibold uppercase tracking-wider hidden sm:inline ${
                    setupStep >= s.num ? "text-slate-800 dark:text-white" : "text-slate-400"
                  }`}>
                    {s.label}
                  </span>
                </div>
                {s.num < 3 && <ChevronRight size={14} className="text-slate-300" />}
              </React.Fragment>
            ))}
          </div>

          {/* Step 1: Info */}
          {setupStep === 1 && (
            <div className="space-y-6">
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Match Name</label>
                <input
                  type="text"
                  placeholder="e.g. Club Championship Final"
                  value={setupData.name}
                  onChange={(e) => setSetupData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-4 py-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500 text-sm transition-all"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Venue</label>
                  <input
                    type="text"
                    placeholder="e.g. Lords Ground"
                    value={setupData.venue}
                    onChange={(e) => setSetupData(prev => ({ ...prev, venue: e.target.value }))}
                    className="w-full px-4 py-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500 text-sm transition-all"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Match Date</label>
                  <input
                    type="date"
                    value={setupData.date}
                    onChange={(e) => setSetupData(prev => ({ ...prev, date: e.target.value }))}
                    className="w-full px-4 py-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500 text-sm transition-all"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-100 dark:border-slate-800 pt-6">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Team A Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Mumbai Kings"
                    value={setupData.teamAName}
                    onChange={(e) => setSetupData(prev => ({ ...prev, teamAName: e.target.value }))}
                    className="w-full px-4 py-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500 text-sm transition-all"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Team B Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Delhi Capitals"
                    value={setupData.teamBName}
                    onChange={(e) => setSetupData(prev => ({ ...prev, teamBName: e.target.value }))}
                    className="w-full px-4 py-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500 text-sm transition-all"
                    required
                  />
                </div>
              </div>

              <div className="border-t border-slate-100 dark:border-slate-800 pt-6 space-y-4">
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Overs Mode</label>
                <div className="flex space-x-4">
                  {[
                    { id: "limited", label: "Limited Overs (Shared pool)" },
                    { id: "unlimited", label: "Unlimited (True Test format)" }
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setSetupData(prev => ({ ...prev, oversMode: m.id }))}
                      className={`flex-1 py-3 px-2 border rounded-xl text-xs font-bold transition-all ${
                        setupData.oversMode === m.id
                          ? "border-rose-600 dark:border-rose-400 bg-rose-50/50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400"
                          : "border-slate-200 dark:border-slate-800 text-slate-500 hover:border-slate-300 dark:hover:border-slate-700"
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>

                {setupData.oversMode === "limited" && (
                  <div className="animate-pop border border-dashed border-rose-500/20 rounded-xl p-4 bg-rose-50/10 dark:bg-rose-950/5">
                    <label className="block text-xs font-semibold text-rose-600 dark:text-rose-400 uppercase tracking-wider mb-2">
                      Total Match Overs (Shared pool)
                    </label>
                    <input
                      type="number"
                      min="2"
                      max="300"
                      value={setupData.totalOversLimit}
                      onChange={(e) => setSetupData(prev => ({ ...prev, totalOversLimit: e.target.value }))}
                      className="w-32 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500 text-sm font-bold"
                    />
                    <p className="text-[10px] text-slate-400 mt-2">
                      These overs are shared. Innings 2 receives whatever remains after Innings 1.
                    </p>
                  </div>
                )}
              </div>

              {/* Last Man Rule Selection */}
              <div className="border-t border-slate-100 dark:border-slate-800 pt-6 space-y-4">
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                  Last Man Rule (Enable solo batting for the last player?)
                </label>
                <div className="flex flex-col sm:flex-row gap-3">
                  {[
                    { id: "off", label: "No (Ends at N-1 wickets)" },
                    { id: "both", label: "Yes (Always in both innings)" },
                    { id: "perTeam", label: "Yes (One innings per team)" }
                  ].map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setSetupData(prev => ({ 
                        ...prev, 
                        lastManRule: r.id,
                        lastManChoice: r.id === "perTeam" ? { teamA: "innings1", teamB: "innings1" } : { teamA: null, teamB: null }
                      }))}
                      className={`flex-1 py-3 px-2 border rounded-xl text-xs font-bold transition-all ${
                        setupData.lastManRule === r.id
                          ? "border-rose-600 dark:border-rose-400 bg-rose-50/50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400"
                          : "border-slate-200 dark:border-slate-800 text-slate-500 hover:border-slate-300 dark:hover:border-slate-700"
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleNextStep}
                className="w-full mt-6 py-3.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-sm transition-all shadow-md"
              >
                Next: Recruit Squads
              </button>
            </div>
          )}

          {/* Step 2: Squad Recruitment */}
          {setupStep === 2 && (
            <div>
              <p className="text-slate-500 dark:text-slate-400 text-xs mb-6 font-medium">
                Assign players from the registered club pool to play for **{setupData.teamAName}**, **{setupData.teamBName}**, or as a **Common Player** who plays for both sides.
              </p>

              <div className="border-t border-slate-100 dark:border-slate-800 pt-6 space-y-4 max-h-[400px] overflow-y-auto pr-2">
                {allPlayers.map((p) => {
                  const inA = setupData.squads.teamA.includes(p.id);
                  const inB = setupData.squads.teamB.includes(p.id);
                  const isCommon = inA && inB;
                  const currentAssignment = isCommon ? "common" : inA ? "teamA" : inB ? "teamB" : "none";

                  return (
                    <div
                      key={p.id}
                      className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-900 rounded-2xl gap-3 text-xs"
                    >
                      <div>
                        <div className="font-bold text-slate-800 dark:text-slate-200 text-sm">{p.name}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5 font-medium">
                          Role: <span className="capitalize">{p.role}</span> • Registered Club: {p.teamName || "Unassigned"}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-1.5 self-start sm:self-center">
                        {[
                          { id: "none", label: "None" },
                          { id: "teamA", label: setupData.teamAName },
                          { id: "teamB", label: setupData.teamBName },
                          { id: "common", label: "Common (Both)" }
                        ].map((choice) => (
                          <button
                            key={choice.id}
                            type="button"
                            onClick={() => handlePlayerAssignment(p.id, choice.id)}
                            className={`px-3 py-1.5 rounded-xl font-bold transition-all text-[11px] ${
                              currentAssignment === choice.id
                                ? choice.id === "common"
                                  ? "bg-purple-600 text-white shadow-sm"
                                  : choice.id === "teamA"
                                  ? "bg-rose-600 text-white shadow-sm"
                                  : choice.id === "teamB"
                                  ? "bg-blue-600 text-white shadow-sm"
                                  : "bg-slate-300 dark:bg-slate-700 text-slate-800 dark:text-white"
                                : "bg-slate-100 dark:bg-slate-850 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800"
                            }`}
                          >
                            {choice.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}

                {allPlayers.length === 0 && (
                  <div className="text-center py-8 text-slate-400 italic">
                    No registered players. Please register players first in the "Register" tab.
                  </div>
                )}
              </div>

              <div className="flex space-x-4 mt-8 pt-6 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={() => setSetupStep(1)}
                  className="flex-1 py-3 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold rounded-xl text-xs transition-all"
                >
                  Back
                </button>
                <button
                  onClick={handleNextStep}
                  className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs transition-all shadow-md"
                >
                  Next: Toss Setup
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Toss Setup */}
          {setupStep === 3 && (
            <div className="space-y-6">
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                  Toss Winner
                </label>
                <div className="flex space-x-4">
                  {[
                    { id: setupData.teamAId, label: setupData.teamAName },
                    { id: setupData.teamBId, label: setupData.teamBName }
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setSetupData(prev => ({ ...prev, tossWinnerId: t.id }))}
                      className={`flex-1 py-3 px-2 border rounded-xl text-xs font-bold transition-all ${
                        setupData.tossWinnerId === t.id
                          ? "border-rose-600 dark:border-rose-400 bg-rose-50/50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400"
                          : "border-slate-200 dark:border-slate-800 text-slate-500 hover:border-slate-300 dark:hover:border-slate-700"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                  Toss Winner Decision
                </label>
                <div className="flex space-x-4">
                  {[
                    { id: "bat", label: "Bat First" },
                    { id: "bowl", label: "Bowl First" }
                  ].map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => setSetupData(prev => ({ ...prev, tossDecision: d.id }))}
                      className={`flex-1 py-3 px-2 border rounded-xl text-xs font-bold transition-all ${
                        setupData.tossDecision === d.id
                          ? "border-rose-600 dark:border-rose-400 bg-rose-50/50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400"
                          : "border-slate-200 dark:border-slate-800 text-slate-500 hover:border-slate-300 dark:hover:border-slate-700"
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>



              <div className="flex space-x-4 mt-8 pt-6 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={() => setSetupStep(2)}
                  className="flex-1 py-3 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold rounded-xl text-xs transition-all"
                >
                  Back
                </button>
                <button
                  onClick={handleFinishSetup}
                  className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 text-white font-extrabold rounded-xl text-xs transition-all shadow-md shadow-rose-600/20 uppercase tracking-wider"
                >
                  Start Match & Scoring
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Active Scoring Board Panel
  if (panelState === "score" && scoringMatch) {
    const m = scoringMatch;
    const innNo = m.currentInningsNo;
    const inn = m.innings[innNo];

    if (!inn) return null;

    // Get batting squad and bowling squad details
    const battingTeamKey = inn.battingTeamId === m.teamA.id ? "teamA" : "teamB";
    const bowlingTeamKey = inn.bowlingTeamId === m.teamA.id ? "teamA" : "teamB";

    const battingSquadIds = m.squads[battingTeamKey] || [];
    const bowlingSquadIds = m.squads[bowlingTeamKey] || [];

    const battingSquad = allPlayers.filter(p => battingSquadIds.includes(p.id));
    const bowlingSquad = allPlayers.filter(p => bowlingSquadIds.includes(p.id));

    const striker = inn.battingCard.find(c => c.playerId === inn.currentStrikerId);
    const nonStriker = inn.battingCard.find(c => c.playerId === inn.currentNonStrikerId);
    const bowler = inn.bowlingCard.find(c => c.playerId === inn.currentBowlerId);

    const availableBatsmen = getAvailableBatsmen(m, inn);
    const availableBowlers = getAvailableBowlers(m, inn);

    let targetRuns = null;
    let reqRuns = null;
    let ballsRemaining = null;

    if (innNo === 4) {
      const team1Total = (m.innings["1"]?.totalRuns || 0) + (m.innings["3"]?.totalRuns || 0);
      const team2Innings2Runs = m.innings["2"]?.totalRuns || 0;
      targetRuns = team1Total - team2Innings2Runs + 1;
      reqRuns = targetRuns - inn.totalRuns;
      
      if (inn.oversAvailable) {
        const oversUsedInt = Math.floor(inn.oversUsed);
        const oversUsedBalls = Math.round((inn.oversUsed - oversUsedInt) * 10);
        const totalUsedBalls = oversUsedInt * 6 + oversUsedBalls;
        ballsRemaining = (inn.oversAvailable * 6) - totalUsedBalls;
      }
    }

    const getLiveMatchStatusText = () => {
      const inn1 = m.innings["1"];
      const inn2 = m.innings["2"];
      const inn3 = m.innings["3"];
      const inn4 = m.innings["4"];

      if (!inn1) return "";

      if (innNo === 1) {
        return `${m.teamA.id === inn1.battingTeamId ? m.teamA.name : m.teamB.name} is batting first`;
      }

      if (innNo === 2 && inn1.isCompleted) {
        const diff = inn1.totalRuns - inn.totalRuns;
        const battingTeam = inn.battingTeamId === m.teamA.id ? m.teamA.name : m.teamB.name;
        if (diff > 0) return `${battingTeam} trails by ${diff} runs`;
        if (diff < 0) return `${battingTeam} leads by ${Math.abs(diff)} runs`;
        return "Scores level";
      }

      if (innNo === 3 && inn2?.isCompleted) {
        const team1Cumulative = inn1.totalRuns + inn.totalRuns;
        const team2Total = inn2.totalRuns;
        const diff = team2Total - team1Cumulative;
        const battingTeam = inn.battingTeamId === m.teamA.id ? m.teamA.name : m.teamB.name;
        if (diff > 0) return `${battingTeam} trails by ${diff} runs`;
        if (diff < 0) return `${battingTeam} leads by ${Math.abs(diff)} runs`;
        return "Scores level";
      }

      if (innNo === 4 && inn3?.isCompleted) {
        const team1Total = inn1.totalRuns + inn3.totalRuns;
        const team2Cumulative = (inn2?.totalRuns || 0) + inn.totalRuns;
        const diff = team1Total - team2Cumulative;
        const battingTeam = inn.battingTeamId === m.teamA.id ? m.teamA.name : m.teamB.name;
        if (diff > 0) return `${battingTeam} needs ${diff} runs to win`;
        if (diff < 0) return `${battingTeam} won the match`;
        return "Scores level";
      }

      return "";
    };

    return (
      <div className="max-w-5xl mx-auto px-4 py-8 animate-pop">
        {/* Scoring Header */}
        <div className="bg-slate-900 border border-slate-800 text-white rounded-3xl p-5 mb-6 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/5 rounded-full blur-2xl"></div>
          
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0 relative z-10">
            <div>
              <div className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse"></span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400">Live Scoring Panel</span>
              </div>
              <h3 className="font-display font-extrabold text-lg sm:text-xl tracking-tight mt-1">{m.name}</h3>
              <p className="text-slate-400 text-xs mt-0.5">{m.venue}</p>
            </div>

            <div className="flex flex-wrap gap-2">
              {m.status === "upcoming" && (
                <button
                  onClick={async () => {
                    if (window.confirm("Are you sure you want to publish this match? It will go live instantly on the matches center.")) {
                      await updateMatch(m.id, { 
                        status: "live",
                        liveStartedAt: new Date().toISOString()
                      });
                    }
                  }}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-extrabold rounded-xl text-xs transition-all shadow-md shadow-rose-650/20 animate-pulse uppercase tracking-wider"
                >
                  Go Live 📡
                </button>
              )}
              
              <button
                onClick={handleDeclareInnings}
                className="px-4 py-2 border border-slate-700 hover:bg-slate-800 text-slate-200 font-semibold rounded-xl text-xs transition-all"
              >
                Declare
              </button>

              <button
                onClick={handleOpenManageSquadModal}
                className="px-4 py-2 bg-purple-650 hover:bg-purple-700 text-white font-semibold rounded-xl text-xs transition-all shadow-md shadow-purple-650/10"
              >
                Manage Squad 👥
              </button>
              
              {inn.isCompleted && innNo < 4 && (
                <button
                  onClick={() => handleStartNextInnings(innNo + 1)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-all shadow-md shadow-emerald-600/10 animate-pulse"
                >
                  Start Innings {innNo + 1}
                </button>
              )}
              
              <button
                onClick={() => {
                  if (window.confirm("Exit scoring panel? Progress is saved dynamically in the database.")) {
                    setScoringMatchId(null);
                    setScoringMatch(null);
                    setPanelState("list");
                  }
                }}
                className="px-4 py-2 border border-slate-700 hover:bg-slate-800 text-slate-400 font-semibold rounded-xl text-xs transition-all"
              >
                Exit Panel
              </button>
            </div>
          </div>
        </div>

        {/* Large Score Indicator Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          {/* Main Board */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm md:col-span-2 flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <div>
                <h4 className="font-display font-black text-4xl sm:text-5xl text-slate-900 dark:text-white tracking-tight">
                  {inn.totalRuns}/{inn.wickets}
                  <span className="text-lg text-slate-400 dark:text-slate-500 font-bold ml-2">
                    (max {inn.endsAtWickets})
                  </span>
                </h4>
                <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mt-1.5 flex items-center space-x-1.5">
                  <Shield size={12} className="text-teal-600" />
                  <span>{battingTeamKey === "teamA" ? m.teamA.name : m.teamB.name} (Inns {innNo})</span>
                </p>
              </div>
              <div className="text-right">
                <p className="text-slate-400 font-semibold text-[10px] uppercase tracking-widest">Overs</p>
                <p className="font-display font-black text-2xl text-slate-800 dark:text-white mt-1">
                  {inn.oversUsed}{inn.oversAvailable ? ` / ${inn.oversAvailable}` : ""}
                </p>
              </div>
            </div>

            {/* Lead/Trail Match Status Banner */}
            {innNo >= 2 && (
              <div className="mt-6 p-4 bg-sky-50/50 dark:bg-sky-950/20 border border-sky-100 dark:border-sky-900/50 rounded-2xl flex items-center justify-between text-xs animate-pop">
                <span className="font-semibold text-sky-850 dark:text-sky-400">Match Status:</span>
                <span className="text-sky-700 dark:text-sky-400 font-extrabold tracking-wide uppercase">
                  {getLiveMatchStatusText()}
                </span>
              </div>
            )}

            {(() => {
              const batsmanRunsSum = (inn.battingCard || []).reduce((sum, b) => sum + (b.runs || 0), 0);
              let localW = 0, localNb = 0, localB = 0, localLb = 0;
              (inn.balls || []).forEach((ball) => {
                if (ball.extraType === "wide") localW += (1 + (ball.runs || 0));
                else if (ball.extraType === "noball") localNb += 1;
                else if (ball.extraType === "bye") localB += (ball.runs || 0);
                else if (ball.extraType === "legbye") localLb += (ball.runs || 0);
              });
              const localExtras = localW + localNb + localB + localLb;
              const isSanityMatch = batsmanRunsSum + localExtras === inn.totalRuns;
              if (!isSanityMatch) {
                return (
                  <div className="mt-4 p-4 bg-red-50 dark:bg-red-950/20 border border-red-200/50 dark:border-red-900/50 rounded-2xl flex items-center text-xs animate-pop text-red-600 dark:text-red-400 font-semibold gap-2">
                    <span>⚠️ Warning: Scorecard runs mismatch! Batsmen runs ({batsmanRunsSum}) + extras ({localExtras}) = {batsmanRunsSum + localExtras}, but innings total shows {inn.totalRuns}.</span>
                  </div>
                );
              }
              return null;
            })()}

            {/* Inning 4 Target Information */}
            {innNo === 4 && targetRuns && (
              <div className="mt-4 p-4 bg-teal-50/30 dark:bg-teal-950/10 border border-teal-500/10 rounded-2xl flex items-center justify-between text-xs animate-pop">
                <span className="font-semibold text-teal-800 dark:text-teal-400">Target: {targetRuns} Runs (Inns 4)</span>
                <span className="text-slate-500 dark:text-slate-400 font-medium">
                  Need <strong className="text-teal-600 dark:text-teal-400">{reqRuns}</strong> runs
                  {ballsRemaining !== null ? ` off ${ballsRemaining} balls` : ""}
                </span>
              </div>
            )}

            {/* Over Tally */}
            <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">This Over:</span>
              <div className="flex items-center space-x-2 mt-2">
                {inn.thisOverBalls.map((symbol, idx) => (
                  <div
                    key={idx}
                    className={`w-8 h-8 rounded-full flex items-center justify-center font-display font-extrabold text-xs border ${
                      symbol === "W"
                        ? "bg-red-500 border-red-600 text-white animate-pulse"
                        : ["4", "6"].includes(symbol)
                        ? "bg-teal-600 border-teal-700 text-white"
                        : symbol.includes("wd") || symbol.includes("nb")
                        ? "bg-amber-100 dark:bg-amber-950 border-amber-200 dark:border-amber-900/50 text-amber-700 dark:text-amber-400"
                        : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    {symbol}
                  </div>
                ))}
                {inn.thisOverBalls.length === 0 && (
                  <span className="text-slate-400 text-xs italic font-medium">Ready for next over...</span>
                )}
              </div>
            </div>
          </div>

          {/* Bowler figures side panel */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
            <div>
              <h5 className="font-display font-extrabold text-xs uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-slate-800 pb-2 mb-4">
                Active Bowler Figures
              </h5>
              {bowler ? (
                <div className="space-y-3">
                  <div className="font-display font-bold text-base text-slate-900 dark:text-white truncate">
                    {bowler.playerName}
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-center text-xs">
                    <div>
                      <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Overs</p>
                      <p className="font-extrabold text-slate-800 dark:text-slate-200 mt-1">{bowler.overs}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Mdn</p>
                      <p className="font-extrabold text-slate-800 dark:text-slate-200 mt-1">{bowler.maidens}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Runs</p>
                      <p className="font-extrabold text-slate-800 dark:text-slate-200 mt-1">{bowler.runsConceded}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Wkts</p>
                      <p className="font-extrabold text-slate-800 dark:text-slate-200 mt-1">{bowler.wickets}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-4 border border-dashed border-rose-500/20 rounded-xl bg-rose-50/5 dark:bg-rose-950/5 text-center text-xs font-semibold text-rose-500 uppercase tracking-wide">
                  Select a Bowler Below
                </div>
              )}
            </div>

            {/* Over complete bowler prompt */}
            {inn.currentOverLegalBalls === 6 && (
              <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-xl text-amber-700 dark:text-amber-400 text-xs flex items-center space-x-1.5 font-medium animate-pop">
                <AlertTriangle size={14} className="shrink-0" />
                <span>Over completed! Change bowler next.</span>
              </div>
            )}
          </div>
        </div>

        {/* Selected Batsmen details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
          {/* Striker (Highlighted Crease Card) */}
          <div className="bg-white dark:bg-slate-900 border-2 border-teal-500 dark:border-teal-400 shadow-md shadow-teal-500/5 dark:shadow-teal-400/5 rounded-3xl p-5 relative overflow-hidden transition-all duration-300 ring-4 ring-teal-500/10 dark:ring-teal-400/10">
            {/* Pulsing indicator tag */}
            <div className="absolute top-0 right-0 bg-teal-650 text-white text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-bl-xl animate-pulse">
              On Strike
            </div>

            <h5 className="font-display font-extrabold text-[10px] uppercase tracking-wider text-teal-600 dark:text-teal-400 flex items-center space-x-1 mb-3">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-ping"></span>
              <span>Striker</span>
            </h5>
            {inn.currentStrikerId ? (
              <div>
                <div className="font-display font-bold text-slate-900 dark:text-white text-base">{striker?.playerName}</div>
                <div className="flex items-center space-x-4 mt-2 text-xs text-slate-500 dark:text-slate-400 font-semibold">
                  <div>Runs: <strong className="text-slate-800 dark:text-white">{striker?.runs}</strong></div>
                  <div>Balls: <strong className="text-slate-800 dark:text-white">{striker?.balls}</strong></div>
                  <div>4s/6s: <strong className="text-slate-800 dark:text-white">{striker?.fours}/{striker?.sixes}</strong></div>
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-2">Assign Striker</label>
                <select
                  onChange={(e) => handleSelectStriker(e.target.value)}
                  className="w-full text-xs font-semibold p-2 border rounded-xl dark:bg-slate-950 dark:border-slate-800 focus:outline-none focus:ring-1 focus:ring-rose-500"
                  defaultValue=""
                >
                  <option value="" disabled>-- Select Striker --</option>
                  {availableBatsmen.map(p => (
                    <option key={p.id} value={p.id} disabled={p.isConflict}>
                      {p.name} {p.isConflict ? ` (${p.conflictReason})` : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Non-Striker */}
          {inn.lastManActive ? (
            <div className="bg-amber-50/20 dark:bg-amber-950/10 border border-dashed border-amber-500/20 rounded-3xl p-5 flex flex-col items-center justify-center text-center animate-pop">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse mb-2"></span>
              <h5 className="font-display font-extrabold text-xs uppercase tracking-wider text-amber-600 dark:text-amber-400">
                Last Man Active
              </h5>
              <p className="text-[10px] text-slate-400 dark:text-slate-400 mt-1 max-w-[200px] leading-relaxed">
                Solo batting activated. No non-striker is required. Strike rotation is disabled.
              </p>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm">
              <h5 className="font-display font-extrabold text-[10px] uppercase tracking-wider text-slate-400 mb-3">
                Non-Striker
              </h5>
              {inn.currentNonStrikerId ? (
                <div>
                  <div className="font-display font-bold text-slate-900 dark:text-white">{nonStriker?.playerName}</div>
                  <div className="flex items-center space-x-4 mt-2 text-xs text-slate-500 dark:text-slate-400 font-semibold">
                    <div>Runs: <strong className="text-slate-800 dark:text-white">{nonStriker?.runs}</strong></div>
                    <div>Balls: <strong className="text-slate-800 dark:text-white">{nonStriker?.balls}</strong></div>
                    <div>4s/6s: <strong className="text-slate-800 dark:text-white">{nonStriker?.fours}/{nonStriker?.sixes}</strong></div>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-2">Assign Non-Striker</label>
                  <select
                    onChange={(e) => handleSelectNonStriker(e.target.value)}
                    className="w-full text-xs font-semibold p-2 border rounded-xl dark:bg-slate-950 dark:border-slate-800 focus:outline-none focus:ring-1 focus:ring-rose-500"
                    defaultValue=""
                  >
                    <option value="" disabled>-- Select Non-Striker --</option>
                    {availableBatsmen.map(p => (
                      <option key={p.id} value={p.id} disabled={p.isConflict}>
                        {p.name} {p.isConflict ? ` (${p.conflictReason})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bowler Selection prompt */}
        {(!inn.currentBowlerId || inn.currentOverLegalBalls === 6) && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 mb-6 shadow-sm animate-pop">
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
              Select Bowler for Next Over {inn.lastBowlerId ? "(Excluding last bowler)" : ""}
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {availableBowlers.map((p) => (
                <button
                  key={p.id}
                  disabled={p.isConflict}
                  onClick={() => handleSelectBowler(p.id)}
                  className={`py-2.5 px-3 border rounded-xl text-xs font-bold text-left transition-all ${
                    p.isConflict
                      ? "bg-slate-105 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed"
                      : "bg-slate-50 dark:bg-slate-950 hover:bg-rose-50 dark:hover:bg-rose-950/20 border border-slate-200 dark:border-slate-800 hover:border-rose-500/50 dark:hover:border-rose-400/50 text-slate-800 dark:text-slate-200 cursor-pointer"
                  }`}
                >
                  <span>{p.name}</span>
                  {p.isConflict && <span className="block text-[8px] uppercase text-rose-500 mt-0.5 font-extrabold">{p.conflictReason}</span>}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* SCORING INPUT BOARD - BUTTONS */}
        <div className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-inner">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Perform Ball-by-ball actions:</span>
          
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
            {/* Runs 0 - 3 */}
            <div className="grid grid-cols-2 gap-2 col-span-2">
              {[0, 1, 2, 3].map((r) => (
                <button
                  key={r}
                  onClick={() => handleScoreBall(r)}
                  className="py-6 bg-white dark:bg-slate-900 active:scale-95 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-900 dark:text-white font-display font-extrabold text-2xl rounded-2xl shadow-sm transition-all flex items-center justify-center"
                >
                  {r} {r === 1 ? "Run" : "Runs"}
                </button>
              ))}
            </div>

            {/* Boundary 4 & 6 */}
            <button
              onClick={() => handleScoreBall(4)}
              className="py-6 bg-teal-600 hover:bg-teal-700 active:scale-95 text-white font-display font-black text-3xl rounded-2xl shadow-md shadow-teal-600/10 transition-all flex flex-col items-center justify-center"
            >
              <span>4</span>
              <span className="text-[9.5px] uppercase font-bold tracking-widest mt-1">Boundary</span>
            </button>
            <button
              onClick={() => handleScoreBall(6)}
              className="py-6 bg-violet-600 hover:bg-violet-700 active:scale-95 text-white font-display font-black text-3xl rounded-2xl shadow-md shadow-violet-600/10 transition-all flex flex-col items-center justify-center"
            >
              <span>6</span>
              <span className="text-[9.5px] uppercase font-bold tracking-widest mt-1">Maximum</span>
            </button>
          </div>

          {/* Declared Runs (No Strike Rotation) */}
          <div className="grid grid-cols-2 gap-2 mt-4">
            <button
              onClick={() => handleScoreBall(1, null, null, true)}
              className="py-6 bg-sky-50 dark:bg-sky-950/20 active:scale-95 border border-sky-200 dark:border-sky-850 hover:border-sky-400 dark:hover:border-sky-500 text-sky-600 dark:text-sky-400 font-display font-extrabold text-2xl rounded-2xl shadow-sm transition-all flex items-center justify-center cursor-pointer"
            >
              +1 Declared
            </button>
            <button
              onClick={() => handleScoreBall(2, null, null, true)}
              className="py-6 bg-sky-50 dark:bg-sky-950/20 active:scale-95 border border-sky-200 dark:border-sky-850 hover:border-sky-400 dark:hover:border-sky-500 text-sky-600 dark:text-sky-400 font-display font-extrabold text-2xl rounded-2xl shadow-sm transition-all flex items-center justify-center cursor-pointer"
            >
              +2 Declared
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-4">
            {/* Extras */}
            <button
              onClick={() => handleScoreBall(0, "wide")}
              className="py-4 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all"
            >
              Wide (+1wd)
            </button>
            <button
              onClick={() => setShowNoBallPrompt(true)}
              className="py-4 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all"
            >
              No Ball (+1nb)
            </button>
            <button
              onClick={() => { setPromptExtraType("bye"); setShowExtraPrompt(true); }}
              className="py-4 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 active:scale-95 text-slate-800 dark:text-slate-200 font-bold text-xs uppercase tracking-wider rounded-xl transition-all"
            >
              Bye (Extras)
            </button>
            <button
              onClick={() => { setPromptExtraType("legbye"); setShowExtraPrompt(true); }}
              className="py-4 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 active:scale-95 text-slate-800 dark:text-slate-200 font-bold text-xs uppercase tracking-wider rounded-xl transition-all"
            >
              Leg Bye (Extras)
            </button>

            {/* Wicket */}
            <button
              onClick={() => {
                // Set default batsman to striker
                setWicketData(prev => ({ ...prev, batsmanId: inn.currentStrikerId || "" }));
                setShowWicketModal(true);
              }}
              className="py-4 bg-red-600 hover:bg-red-700 active:scale-95 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all col-span-2 sm:col-span-1 shadow-md shadow-red-600/10"
            >
              Wicket (OUT)
            </button>
          </div>

          {/* Control Utility Row */}
          <div className="flex items-center space-x-4 mt-6 pt-5 border-t border-slate-200 dark:border-slate-800">
            <button
              onClick={handleUndo}
              disabled={!inn.balls || inn.balls.length === 0}
              className="flex items-center space-x-1.5 px-4 py-2.5 border border-slate-300 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 disabled:opacity-50 text-slate-600 dark:text-slate-300 font-semibold rounded-xl text-xs transition-all"
            >
              <RotateCcw size={14} />
              <span>Undo Last Ball</span>
            </button>
          </div>
        </div>

        {/* -----------------------------------------------------------
            WICKET MODAL OVERLAY
        ------------------------------------------------------------ */}
        {showWicketModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-pop p-6">
              <h3 className="font-display font-extrabold text-lg text-slate-950 dark:text-white uppercase tracking-tight mb-4">
                Record Batsman Dismissal
              </h3>
              
              <div className="space-y-4 text-xs font-semibold">
                {/* Out Batsman Select */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">Batsman Dismissed</label>
                  <select
                    value={wicketData.batsmanId}
                    onChange={(e) => setWicketData(prev => ({ ...prev, batsmanId: e.target.value }))}
                    className="w-full p-3 border rounded-xl dark:bg-slate-950 dark:border-slate-800 text-slate-800 dark:text-slate-200"
                  >
                    <option value="" disabled>-- Select Batsman --</option>
                    {inn.currentStrikerId && <option value={inn.currentStrikerId}>{striker?.playerName} (Striker)</option>}
                    {inn.currentNonStrikerId && <option value={inn.currentNonStrikerId}>{nonStriker?.playerName} (Non-Striker)</option>}
                  </select>
                </div>

                {/* Dismissal Type */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">Dismissal Type</label>
                  <select
                    value={wicketData.dismissalType}
                    onChange={(e) => setWicketData(prev => ({ ...prev, dismissalType: e.target.value }))}
                    className="w-full p-3 border rounded-xl dark:bg-slate-950 dark:border-slate-800 text-slate-800 dark:text-slate-200"
                  >
                    {["Bowled", "Caught", "LBW", "Stumped", "Run Out", "Hit Wicket", "Retired Out", "Obstructing the field"].map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                {/* Fielder Select (For Catch, Stump, Run Out) */}
                {["Caught", "Stumped", "Run Out"].includes(wicketData.dismissalType) && (
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">Fielder Responsible</label>
                    <select
                      value={wicketData.fielderId}
                      onChange={(e) => setWicketData(prev => ({ ...prev, fielderId: e.target.value }))}
                      className="w-full p-3 border rounded-xl dark:bg-slate-950 dark:border-slate-800 text-slate-800 dark:text-slate-200"
                    >
                      <option value="">-- Select Fielder --</option>
                      {bowlingSquad.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="flex space-x-3 pt-4 border-t border-slate-100 dark:border-slate-800 mt-6">
                  <button
                    onClick={() => setShowWicketModal(false)}
                    className="flex-1 py-3 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleScoreWicket}
                    className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-md"
                  >
                    Confirm Out
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* -----------------------------------------------------------
            BYES / LEG BYES PROMPTING
        ------------------------------------------------------------ */}
        {showExtraPrompt && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-xs overflow-hidden shadow-2xl animate-pop p-6 text-center">
              <h3 className="font-display font-extrabold text-sm text-slate-950 dark:text-white uppercase tracking-wider mb-4">
                Record {promptExtraType === "bye" ? "Byes" : "Leg Byes"} Runs
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {[1, 2, 3, 4].map((r) => (
                  <button
                    key={r}
                    onClick={() => handleScoreExtraPrompt(r)}
                    className="py-4 bg-slate-50 hover:bg-rose-50 dark:bg-slate-950 dark:hover:bg-rose-950/20 border border-slate-200 dark:border-slate-800 hover:border-rose-500/50 rounded-xl text-lg font-bold text-slate-800 dark:text-slate-200 transition-all"
                  >
                    {r} {r === 1 ? "Run" : "Runs"}
                  </button>
                ))}
              </div>
              <button
                onClick={() => { setShowExtraPrompt(false); setPromptExtraType(null); }}
                className="w-full mt-4 py-2 border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 text-xs rounded-xl font-semibold"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* -----------------------------------------------------------
            NO BALL RUNS PROMPTING
        ------------------------------------------------------------ */}
        {showNoBallPrompt && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-pop p-6">
              <h3 className="font-display font-extrabold text-sm text-slate-950 dark:text-white uppercase tracking-wider mb-2 text-center">
                No Ball - Select Runs
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 text-center mb-4">
                Runs scored by batsman (penalty +1 added automatically)
              </p>
              <div className="grid grid-cols-4 gap-2">
                {[0, 1, 2, 3, 4, 6].map((r) => (
                  <button
                    key={r}
                    onClick={() => handleScoreNoBall(r)}
                    className="py-4 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/20 dark:hover:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 hover:border-amber-500/50 rounded-xl text-lg font-bold text-amber-700 dark:text-amber-400 transition-all"
                  >
                    {r}
                  </button>
                ))}
              </div>
              <div className="mt-4 border-t border-slate-100 dark:border-slate-800 pt-3">
                <p className="text-xs text-slate-400 dark:text-slate-500 mb-3 font-semibold text-center">Additional Extras</p>
                <div className="grid grid-cols-4 gap-2">
                  <button
                    onClick={() => handleScoreNoBall(1)}
                    className="py-3 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/20 dark:hover:bg-blue-950/40 border border-blue-200 dark:border-blue-900/50 hover:border-blue-500/50 rounded-xl text-sm font-bold text-blue-700 dark:text-blue-400 transition-all"
                  >
                    +1
                  </button>
                  <button
                    onClick={() => handleScoreNoBall(2)}
                    className="py-3 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/20 dark:hover:bg-blue-950/40 border border-blue-200 dark:border-blue-900/50 hover:border-blue-500/50 rounded-xl text-sm font-bold text-blue-700 dark:text-blue-400 transition-all"
                  >
                    +2
                  </button>
                </div>
              </div>
              <button
                onClick={() => setShowNoBallPrompt(false)}
                className="w-full mt-4 py-2.5 border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 text-xs rounded-xl font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* -----------------------------------------------------------
            LAST MAN RULE CHOICE MODAL (Shown when inning starts if perTeam rule)
        ------------------------------------------------------------ */}
        {showLastManChoiceModal && scoringMatch && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-pop p-6">
              <div className="text-center mb-6">
                <div className="w-12 h-12 bg-amber-500/10 text-amber-500 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <AlertTriangle size={24} />
                </div>
                <h3 className="font-display font-extrabold text-lg text-slate-950 dark:text-white uppercase tracking-tight">
                  Last Man Rule Choice
                </h3>
                <p className="text-slate-500 dark:text-slate-400 text-xs mt-2">
                  {scoringMatch.innings[String(lastManChoiceInning)]?.battingTeamId === scoringMatch.teamA.id 
                    ? scoringMatch.teamA.name 
                    : scoringMatch.teamB.name} - Which inning would you like to use the last man rule?
                </p>
              </div>

              <div className="space-y-3">
                <button
                  onClick={() => handleLastManChoice("innings1")}
                  className="w-full py-4 px-4 bg-slate-50 hover:bg-rose-50 dark:bg-slate-950 dark:hover:bg-rose-950/20 border border-slate-200 dark:border-slate-800 hover:border-rose-500/50 rounded-xl text-sm font-bold text-slate-800 dark:text-slate-200 transition-all"
                >
                  {lastManChoiceInning <= 2 ? "This Inning (First Bat)" : "This Inning (Second Bat)"}
                </button>
                <button
                  onClick={() => handleLastManChoice(lastManChoiceInning <= 2 ? "innings2" : "innings1")}
                  className="w-full py-4 px-4 bg-slate-50 hover:bg-rose-50 dark:bg-slate-950 dark:hover:bg-rose-950/20 border border-slate-200 dark:border-slate-800 hover:border-rose-500/50 rounded-xl text-sm font-bold text-slate-800 dark:text-slate-200 transition-all"
                >
                  {lastManChoiceInning <= 2 ? "Next Inning (Second Bat)" : "Previous Inning (First Bat)"}
                </button>
              </div>

              <p className="text-center text-[10px] text-slate-400 dark:text-slate-500 mt-4 leading-relaxed">
                The last man rule allows solo batting when only one player remains.
              </p>
            </div>
          </div>
        )}

        {/* -----------------------------------------------------------
            MAN OF THE MATCH SELECTION MODAL (Match Finished)
        ------------------------------------------------------------ */}
        {showMOTMModal && (

          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-pop p-6">
              <div className="text-center mb-6">
                <div className="w-12 h-12 bg-amber-500/10 text-amber-500 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <Award size={24} />
                </div>
                <h3 className="font-display font-extrabold text-lg text-slate-950 dark:text-white uppercase tracking-tight">
                  Select Man of the Match
                </h3>
                <p className="text-[11px] text-slate-400 mt-1">
                  Recommends the player with the highest batting + bowling Impact score.
                </p>
              </div>

              <div className="space-y-4 text-xs font-semibold">
                {/* suggested details */}
                <div className="p-4 bg-amber-50/50 dark:bg-amber-955/10 border border-amber-500/10 rounded-2xl flex items-start space-x-2">
                  <Sparkles size={16} className="text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-amber-800 dark:text-amber-400">Suggested MVP: {motmData.name}</p>
                    <p className="text-[10px] text-slate-400 mt-1 leading-normal font-medium">{motmData.reason}</p>
                  </div>
                </div>

                {/* dropdown override */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">Override MVP Player</label>
                  <select
                    value={motmData.playerId}
                    onChange={(e) => {
                      const p = allPlayers.find(pl => pl.id === e.target.value);
                      setMotmData(prev => ({
                        ...prev,
                        playerId: e.target.value,
                        name: p ? p.name : ""
                      }));
                    }}
                    className="w-full p-3 border rounded-xl dark:bg-slate-950 dark:border-slate-800 text-slate-850 dark:text-slate-200"
                  >
                    <option value="" disabled>-- Select Player --</option>
                    <optgroup label={m.teamA.name}>
                      {allPlayers.filter(p => m.squads.teamA.includes(p.id)).map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </optgroup>
                    <optgroup label={m.teamB.name}>
                      {allPlayers.filter(p => m.squads.teamB.includes(p.id)).map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </optgroup>
                  </select>
                </div>

                {/* MOTM Reason */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">Performance Description</label>
                  <textarea
                    placeholder="e.g. Scored a magnificent century and grabbed 3 catches"
                    value={motmData.reason}
                    onChange={(e) => setMotmData(prev => ({ ...prev, reason: e.target.value }))}
                    className="w-full p-3 border rounded-xl dark:bg-slate-950 dark:border-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-rose-500 font-medium"
                    rows={3}
                  />
                </div>

                <button
                  onClick={handleSaveMOTM}
                  className="w-full mt-6 py-3.5 bg-rose-600 hover:bg-rose-700 text-white font-extrabold rounded-xl shadow-md text-xs uppercase tracking-wider flex items-center justify-center space-x-1.5"
                >
                  <Check size={14} />
                  <span>Finalize Match Results</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* -----------------------------------------------------------
            MANAGE SQUAD MODAL OVERLAY
        ------------------------------------------------------------ */}
        {showManageSquadModal && (
          <div key={modalKey} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-4xl overflow-hidden shadow-2xl animate-pop p-6 sm:p-8 my-8 max-h-[90vh] flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
                <h3 className="font-display font-extrabold text-xl text-slate-900 dark:text-white uppercase tracking-tight">
                  Manage Match Squads
                </h3>
                <button
                  onClick={() => {
                    setShowManageSquadModal(false);
                    setManageAction(null);
                    setSelectedManagePlayerId(null);
                  }}
                  className="text-slate-400 hover:text-slate-650 dark:hover:text-slate-205 font-bold text-sm"
                >
                  Close
                </button>
              </div>

              {/* Scrollable Modal Content */}
              <div className="flex-1 overflow-y-auto py-6 pr-2">
                {successToast && (
                  <div className="mb-6 p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/50 rounded-2xl text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center justify-between animate-pop">
                    <span>✅ {successToast}</span>
                    <button type="button" onClick={() => setSuccessToast("")} className="text-emerald-500 hover:text-emerald-750 font-bold text-sm">✕</button>
                  </div>
                )}
                {/* Audit Trail Ticker */}
                {m.squadChanges && m.squadChanges.length > 0 && (
                  <div className="mb-6 p-4 bg-slate-50 dark:bg-slate-955/40 border border-slate-100 dark:border-slate-800 rounded-2xl">
                    <span className="text-[10px] font-bold text-slate-455 dark:text-slate-500 uppercase tracking-widest block mb-2">Match Squad Audit Trail</span>
                    <div className="space-y-1.5 max-h-24 overflow-y-auto text-[11px] text-slate-500 dark:text-slate-400">
                      {m.squadChanges.map((change, idx) => (
                        <div key={idx} className="flex items-start space-x-1.5">
                          <span className="font-mono text-[10px] text-slate-450 mt-0.5">[{new Date(change.timestamp).toLocaleTimeString()}]</span>
                          <span>{change.details}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Main Squad Lists columns */}
                {!selectedManagePlayerId ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Team A column */}
                    <div>
                      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2 mb-4">
                        <h4 className="font-display font-bold text-sm text-rose-500 uppercase tracking-wider flex items-center space-x-2">
                          <Shield size={16} />
                          <span>{m.teamA.name} ({m.squadSize?.teamA ?? m.squads.teamA.length} Players)</span>
                        </h4>
                        <button
                          onClick={() => {
                            setSelectedTeamForAdd("teamA");
                            setShowAddPlayerModal(true);
                          }}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg text-xs transition-all"
                        >
                          + Add Player
                        </button>
                      </div>

                      <div className="space-y-3">
                        {Object.entries(getSquadDetailsWithFallback(m, "teamA")).map(([pid, meta]) => {
                          const player = allPlayers.find(p => p.id === pid);
                          if (!player) return null;
                          return (
                            <SquadPlayerRow
                              key={pid}
                              player={player}
                              meta={meta}
                              teamKey="teamA"
                              isManageable={canManagePlayer(m, pid, "teamA")}
                              onActionSelect={(action) => {
                                setSelectedManagePlayerId(pid);
                                setSelectedManageTeamKey("teamA");
                                setManageAction(action);
                                if (action === "changeTeam") {
                                  setNewTeamAssignment(meta.teamAssignment);
                                }
                              }}
                            />
                          );
                        })}
                      </div>
                    </div>

                    {/* Team B column */}
                    <div>
                      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2 mb-4">
                        <h4 className="font-display font-bold text-sm text-blue-500 uppercase tracking-wider flex items-center space-x-2">
                          <Shield size={16} />
                          <span>{m.teamB.name} ({m.squadSize?.teamB ?? m.squads.teamB.length} Players)</span>
                        </h4>
                        <button
                          onClick={() => {
                            setSelectedTeamForAdd("teamB");
                            setShowAddPlayerModal(true);
                          }}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg text-xs transition-all"
                        >
                          + Add Player
                        </button>
                      </div>

                      <div className="space-y-3">
                        {Object.entries(getSquadDetailsWithFallback(m, "teamB")).map(([pid, meta]) => {
                          const player = allPlayers.find(p => p.id === pid);
                          if (!player) return null;
                          return (
                            <SquadPlayerRow
                              key={pid}
                              player={player}
                              meta={meta}
                              teamKey="teamB"
                              isManageable={canManagePlayer(m, pid, "teamB")}
                              onActionSelect={(action) => {
                                setSelectedManagePlayerId(pid);
                                setSelectedManageTeamKey("teamB");
                                setManageAction(action);
                                if (action === "changeTeam") {
                                  setNewTeamAssignment(meta.teamAssignment);
                                }
                              }}
                            />
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Squad Action Sub-Views */
                  <div className="bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 animate-pop">
                    <button
                      onClick={() => {
                        setSelectedManagePlayerId(null);
                        setManageAction(null);
                      }}
                      className="text-xs text-slate-550 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-205 underline font-semibold mb-6 block"
                    >
                      ← Back to squad lists
                    </button>

                    {/* Replacement view */}
                    {manageAction === "replace" && (
                      <div className="space-y-6 max-w-lg">
                        <div>
                          <h4 className="font-display font-extrabold text-lg text-slate-900 dark:text-white">
                            Replace Player
                          </h4>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                            Swapping out **{allPlayers.find(p => p.id === selectedManagePlayerId)?.name}** for a new player. Any recorded stats for the outgoing player will remain in the match scorecards as-is.
                          </p>
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">Select Replacement Player</label>
                          <select
                            value={replacementPlayerId}
                            onChange={(e) => setReplacementPlayerId(e.target.value)}
                            className="w-full p-3.5 border rounded-xl dark:bg-slate-900 dark:border-slate-800 text-slate-850 dark:text-slate-200 text-xs font-semibold"
                          >
                            <option value="">-- Select Registered Player --</option>
                            {(() => {
                              const activeSquadPlayerIds = [...(m.squads.teamA || []), ...(m.squads.teamB || [])];
                              const replacementCandidates = allPlayers.filter(p => !activeSquadPlayerIds.includes(p.id));
                              return replacementCandidates.map(p => (
                                <option key={p.id} value={p.id}>
                                  {p.name} ({p.role})
                                </option>
                              ));
                            })()}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">Replacement Reason (Optional)</label>
                          <input
                            type="text"
                            placeholder="e.g. Injured mid-match, had to leave"
                            value={replacementReasonText}
                            onChange={(e) => setReplacementReasonText(e.target.value)}
                            className="w-full p-3 border rounded-xl dark:bg-slate-900 dark:border-slate-800 text-slate-800 dark:text-slate-200 text-xs font-semibold"
                          />
                        </div>

                        <div className="flex space-x-3 pt-4">
                          <button
                            onClick={() => {
                              setSelectedManagePlayerId(null);
                              setManageAction(null);
                              setReplacementPlayerId("");
                            }}
                            className="flex-1 py-3 border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-350 font-semibold rounded-xl text-xs"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleReplacePlayer(selectedManageTeamKey, selectedManagePlayerId, replacementPlayerId)}
                            className="flex-1 py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl text-xs"
                          >
                            Confirm Swap
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Change Team view */}
                    {manageAction === "changeTeam" && (
                      <div className="space-y-6 max-w-lg">
                        <div>
                          <h4 className="font-display font-extrabold text-lg text-slate-900 dark:text-white">
                            Change Team Assignment
                          </h4>
                          <p className="text-xs text-slate-550 dark:text-slate-400 mt-1">
                            Move **{allPlayers.find(p => p.id === selectedManagePlayerId)?.name}** to another side or mark as Common.
                          </p>
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">New Team Assignment</label>
                          <div className="flex space-x-3">
                            {[
                              { id: "teamA", label: m.teamA.name },
                              { id: "teamB", label: m.teamB.name },
                              { id: "common", label: "Common (Both)" }
                            ].map((opt) => {
                              return (
                                <button
                                  key={opt.id}
                                  type="button"
                                  onClick={() => setNewTeamAssignment(opt.id)}
                                  className={`flex-1 py-3 border text-xs font-bold rounded-xl transition-all ${
                                    newTeamAssignment === opt.id
                                      ? "border-purple-650 bg-purple-50 dark:bg-purple-950/30 text-purple-650 dark:text-purple-400"
                                      : "border-slate-200 dark:border-slate-800 text-slate-500 hover:border-slate-355"
                                  }`}
                                >
                                  {opt.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <div className="flex space-x-3 pt-4">
                          <button
                            onClick={() => {
                              setSelectedManagePlayerId(null);
                              setManageAction(null);
                            }}
                            className="flex-1 py-3 border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-350 font-semibold rounded-xl text-xs"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleChangeTeamAssignment(selectedManageTeamKey, selectedManagePlayerId, newTeamAssignment)}
                            className="flex-1 py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl text-xs"
                          >
                            Confirm Reassignment
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Remove view */}
                    {manageAction === "remove" && (
                      <div className="space-y-6 max-w-lg">
                        <div>
                          <h4 className="font-display font-extrabold text-lg text-slate-900 dark:text-white">
                            Remove from This Match Only
                          </h4>
                          <p className="text-xs text-slate-550 dark:text-slate-400 mt-1 leading-relaxed">
                            This removes **{allPlayers.find(p => p.id === selectedManagePlayerId)?.name}** from this match squad entirely. 
                            The team will play one player short.
                          </p>
                          <div className="mt-3 p-4 bg-amber-50 dark:bg-amber-955/20 border border-amber-200/50 rounded-2xl text-[11px] text-amber-700 dark:text-amber-450 leading-relaxed font-semibold">
                            ⚠️ This action shrinks the team's squad size, triggering an automatic recalculation of Last Man rule thresholds. Any stats already recorded by this player in this match will stay in the scorecard.
                          </div>
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">Removal Reason (Optional)</label>
                          <input
                            type="text"
                            placeholder="e.g. Injured, left early, no show"
                            value={removalReasonText}
                            onChange={(e) => setRemovalReasonText(e.target.value)}
                            className="w-full p-3 border rounded-xl dark:bg-slate-900 dark:border-slate-800 text-slate-800 dark:text-slate-200 text-xs font-semibold"
                          />
                        </div>

                        <div className="flex space-x-3 pt-4">
                          <button
                            onClick={() => {
                              setSelectedManagePlayerId(null);
                              setManageAction(null);
                              setRemovalReasonText("");
                            }}
                            className="flex-1 py-3 border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-350 font-semibold rounded-xl text-xs"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleRemovePlayer(selectedManageTeamKey, selectedManagePlayerId, removalReasonText)}
                            className="flex-1 py-3 bg-red-650 hover:bg-red-700 text-white font-bold rounded-xl text-xs"
                          >
                            Confirm Removal
                          </button>
                        </div>
                      </div>
                    )}

                    {/* View History view */}
                    {manageAction === "viewHistory" && (
                      <div className="space-y-6">
                        <div>
                          <h4 className="font-display font-extrabold text-lg text-slate-900 dark:text-white">
                            Squad History for {allPlayers.find(p => p.id === selectedManagePlayerId)?.name}
                          </h4>
                          <p className="text-xs text-slate-555 dark:text-slate-400 mt-1">
                            Chronological history of changes for this player in this match.
                          </p>
                        </div>
                        <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                          {(() => {
                            const playerChanges = (m.squadChanges || []).filter(c => c.playerId === selectedManagePlayerId || c.replacementPlayerId === selectedManagePlayerId);
                            if (playerChanges.length === 0) {
                              return <p className="text-xs text-slate-400 italic">No history recorded for this player in this match.</p>;
                            }
                            return playerChanges.map((change, idx) => (
                              <div key={idx} className="p-3 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-850 rounded-xl text-xs leading-normal">
                                <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold mb-1.5 uppercase tracking-wider">
                                  <span>{change.type}</span>
                                  <span>{new Date(change.timestamp).toLocaleTimeString()}</span>
                                </div>
                                <p className="text-slate-700 dark:text-slate-300 font-semibold">{change.details}</p>
                              </div>
                            ));
                          })()}
                        </div>
                        <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedManagePlayerId(null);
                              setManageAction(null);
                            }}
                            className="w-full py-3 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-white font-bold rounded-xl text-xs transition-all"
                          >
                            Back to Squad List
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ADD PLAYER MODAL */}
        {showAddPlayerModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-pop p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-display font-extrabold text-lg text-slate-900 dark:text-white">
                  Add Player to {selectedTeamForAdd === "teamA" ? scoringMatch?.teamA.name : scoringMatch?.teamB.name}
                </h3>
                <button
                  onClick={() => {
                    setShowAddPlayerModal(false);
                    setNewPlayerIdToAdd("");
                  }}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Select Player</label>
                  <select
                    value={newPlayerIdToAdd}
                    onChange={(e) => setNewPlayerIdToAdd(e.target.value)}
                    className="w-full p-3 border border-slate-200 dark:border-slate-800 rounded-xl dark:bg-slate-950 text-slate-800 dark:text-slate-200 text-sm font-semibold"
                  >
                    <option value="">Choose a player...</option>
                    {allPlayers
                      .filter(p => !scoringMatch?.squads.teamA.includes(p.id) && !scoringMatch?.squads.teamB.includes(p.id))
                      .map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.role})
                        </option>
                      ))}
                  </select>
                </div>

                <div className="flex space-x-3 pt-4">
                  <button
                    onClick={() => {
                      setShowAddPlayerModal(false);
                      setNewPlayerIdToAdd("");
                    }}
                    className="flex-1 py-3 border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold rounded-xl text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleAddPlayerToTeam(selectedTeamForAdd, newPlayerIdToAdd)}
                    className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm"
                  >
                    Add Player
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
}

function SquadPlayerRow({ player, meta, teamKey, isManageable, onActionSelect }) {
  const isActive = meta.matchStatus === "active";
  const isReplaced = meta.matchStatus === "replaced";
  const isRemoved = meta.matchStatus === "removed";

  return (
    <div className={`p-4 rounded-2xl border text-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${
      isReplaced 
        ? "bg-amber-50/10 dark:bg-amber-955/5 border-amber-500/10 border-dashed" 
        : isRemoved 
        ? "bg-rose-50/10 dark:bg-rose-955/5 border-rose-500/10 border-dashed"
        : "bg-slate-50 dark:bg-slate-950 border-slate-100 dark:border-slate-900"
    }`}>
      <div>
        <div className="flex items-center space-x-2">
          <span className={`font-bold text-sm ${
            isReplaced || isRemoved ? "text-slate-400 line-through" : "text-slate-800 dark:text-slate-200"
          }`}>
            {player.name}
          </span>
          {meta.teamAssignment === "common" && (
            <span className="px-2 py-0.5 bg-purple-500 text-white text-[9px] font-bold rounded-full uppercase tracking-wider">
              Common
            </span>
          )}
          {isActive && (
            <span className="px-2 py-0.5 bg-emerald-500 text-white text-[9px] font-bold rounded-full uppercase tracking-wider">
              Active
            </span>
          )}
          {isReplaced && (
            <span className="px-2 py-0.5 bg-amber-550 text-white text-[9px] font-bold rounded-full uppercase tracking-wider">
              Replaced
            </span>
          )}
          {isRemoved && (
            <span className="px-2 py-0.5 bg-rose-600 text-white text-[9px] font-bold rounded-full uppercase tracking-wider">
              Removed
            </span>
          )}
        </div>
        <p className="text-[10px] text-slate-400 mt-1 capitalize font-medium">
          {player.role} {meta.removalReason ? `• ${meta.removalReason}` : ""}
        </p>
      </div>

      <div className="flex items-center space-x-1.5 self-end sm:self-center">
        {isActive && isManageable && (
          <>
            <button
              onClick={() => onActionSelect("replace")}
              className="px-2.5 py-1.5 bg-purple-50 dark:bg-purple-950/40 hover:bg-purple-100 border border-purple-200/50 text-purple-650 dark:text-purple-400 font-bold rounded-lg text-[10px] uppercase transition-all"
            >
              Replace
            </button>
            <button
              onClick={() => onActionSelect("changeTeam")}
              className="px-2.5 py-1.5 bg-purple-50 dark:bg-purple-950/40 hover:bg-purple-100 border border-purple-200/50 text-purple-650 dark:text-purple-400 font-bold rounded-lg text-[10px] uppercase transition-all"
            >
              Team
            </button>
            <button
              onClick={() => onActionSelect("remove")}
              className="px-2.5 py-1.5 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 border border-rose-200/55 text-rose-600 dark:text-rose-450 font-bold rounded-lg text-[10px] uppercase transition-all"
            >
              Remove
            </button>
          </>
        )}
        <button
          onClick={() => onActionSelect("viewHistory")}
          className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-350 font-bold rounded-lg text-[10px] uppercase transition-all"
        >
          History
        </button>
      </div>
    </div>
  );
}

