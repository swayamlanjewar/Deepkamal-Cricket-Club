import { db, isConfigValid } from "../lib/firebase";
import { 
  collection, doc, setDoc, addDoc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy, getDocs, getDoc,
  arrayUnion, arrayRemove, deleteField
} from "firebase/firestore";
import { rebuildInningsState, createBlankInnings } from "./scoringEngine";

// LocalStorage Keys
const PLAYERS_KEY = "cricket_players";
const TEAMS_KEY = "cricket_teams";
const MATCHES_KEY = "cricket_matches";
const POSTS_KEY = "cricket_posts";

// Self-clearing check: Flush LocalStorage once to ensure a clean database for new testing.
if (typeof window !== "undefined") {
  try {
    const isClearedJuly3 = localStorage.getItem("cricket_cleared_july3");
    if (!isClearedJuly3) {
      localStorage.removeItem("cricket_players");
      localStorage.removeItem("cricket_teams");
      localStorage.removeItem("cricket_matches");
      localStorage.removeItem("cricket_posts");
      localStorage.removeItem("cricket_checked_in_player");
      localStorage.removeItem("cricket_mock_auth_user");
      localStorage.setItem("cricket_cleared_july3", "true");
      console.log("Mock database flushed. Database is now completely empty.");
    }
  } catch (e) {
    console.error("Storage access error:", e);
  }
}

// Listener registration for mock databases
const listeners = {
  players: [],
  teams: [],
  matches: [],
  posts: []
};

// Listen to other tabs making updates to sync mock DB
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === PLAYERS_KEY && listeners.players.length) {
      const data = getMockItem("players");
      listeners.players.forEach(cb => cb(data));
    }
    if (e.key === TEAMS_KEY && listeners.teams.length) {
      const data = getMockItem("teams");
      listeners.teams.forEach(cb => cb(data));
    }
    if (e.key === MATCHES_KEY && listeners.matches.length) {
      const data = getMockItem("matches");
      listeners.matches.forEach(cb => cb(data));
    }
    if (e.key === POSTS_KEY && listeners.posts.length) {
      const data = getMockItem("posts");
      listeners.posts.forEach(cb => cb(data));
    }
  });
}

function notifyListeners(type) {
  const data = getMockItem(type);
  listeners[type].forEach(cb => cb(data));
}

function getMockItem(type) {
  const keys = { players: PLAYERS_KEY, teams: TEAMS_KEY, matches: MATCHES_KEY, posts: POSTS_KEY };
  const raw = localStorage.getItem(keys[type]);
  if (!raw) {
    const defaultData = getInitialMockData(type);
    localStorage.setItem(keys[type], JSON.stringify(defaultData));
    return defaultData;
  }
  return JSON.parse(raw);
}

function setMockItem(type, data) {
  const keys = { players: PLAYERS_KEY, teams: TEAMS_KEY, matches: MATCHES_KEY, posts: POSTS_KEY };
  localStorage.setItem(keys[type], JSON.stringify(data));
  notifyListeners(type);
}

// Default Mock Data (Starts empty for fresh users)
function getInitialMockData(type) {
  return [];
}

// -------------------------------------------------------------
// Unified Service Layer Exports
// -------------------------------------------------------------

export function subscribePlayers(callback) {
  if (isConfigValid) {
    return onSnapshot(query(collection(db, "players")), (snapshot) => {
      const list = [];
      snapshot.forEach(d => list.push({ id: d.id, ...d.data() }));
      callback(list);
    });
  } else {
    listeners.players.push(callback);
    callback(getMockItem("players"));
    return () => {
      listeners.players = listeners.players.filter(cb => cb !== callback);
    };
  }
}

export async function registerPlayer(playerData) {
  if (isConfigValid) {
    const docRef = await addDoc(collection(db, "players"), {
      ...playerData,
      careerStats: {
        batting: { matches: 0, innings: 0, notOuts: 0, runs: 0, highestScore: 0, ballsFaced: 0, strikeRate: 0, hundreds: 0, fifties: 0, fours: 0, sixes: 0, ducks: 0 },
        bowling: { matches: 0, innings: 0, overs: 0, maidens: 0, runsConceded: 0, wickets: 0, bestBowlingRuns: 0, bestBowlingWickets: 0, average: 0, economy: 0, strikeRate: 0, fiveWickets: 0, tenWicketsMatch: 0 },
        fielding: { catches: 0, stumpings: 0, runOuts: 0 }
      }
    });
    // Immediately delete accessCode so it doesn't linger in public doc
    await updateDoc(docRef, {
      accessCode: deleteField()
    });
    const { accessCode, ...playerDataWithoutCode } = playerData;
    return { id: docRef.id, ...playerDataWithoutCode };
  } else {
    if (playerData.accessCode !== "Deepkamal Club") {
      throw new Error("Invalid club code. Please check with your club admin.");
    }
    const list = getMockItem("players");
    
    // Duplicate phone check
    const exists = list.find(p => p.phone === playerData.phone);
    if (exists) {
      throw new Error("A player with this phone number is already registered.");
    }

    const { accessCode, ...playerDataWithoutCode } = playerData;
    const newPlayer = {
      id: "p_" + Math.random().toString(36).substr(2, 9),
      ...playerDataWithoutCode,
      careerStats: {
        batting: { matches: 0, innings: 0, notOuts: 0, runs: 0, highestScore: 0, ballsFaced: 0, strikeRate: 0, hundreds: 0, fifties: 0, fours: 0, sixes: 0, ducks: 0 },
        bowling: { matches: 0, innings: 0, overs: 0, maidens: 0, runsConceded: 0, wickets: 0, bestBowlingRuns: 0, bestBowlingWickets: 0, average: 0, economy: 0, strikeRate: 0, fiveWickets: 0, tenWicketsMatch: 0 },
        fielding: { catches: 0, stumpings: 0, runOuts: 0 }
      }
    };
    list.push(newPlayer);
    setMockItem("players", list);

    // Update team player list
    if (playerData.teamId) {
      const teamsList = getMockItem("teams");
      const teamIdx = teamsList.findIndex(t => t.id === playerData.teamId);
      if (teamIdx !== -1) {
        if (!teamsList[teamIdx].playerIds.includes(newPlayer.id)) {
          teamsList[teamIdx].playerIds.push(newPlayer.id);
          setMockItem("teams", teamsList);
        }
      }
    }

    return newPlayer;
  }
}

export function subscribeTeams(callback) {
  if (isConfigValid) {
    return onSnapshot(query(collection(db, "teams")), (snapshot) => {
      const list = [];
      snapshot.forEach(d => list.push({ id: d.id, ...d.data() }));
      callback(list);
    });
  } else {
    listeners.teams.push(callback);
    callback(getMockItem("teams"));
    return () => {
      listeners.teams = listeners.teams.filter(cb => cb !== callback);
    };
  }
}

export async function createTeam(name) {
  if (isConfigValid) {
    const docRef = await addDoc(collection(db, "teams"), {
      name,
      logoUrl: "",
      playerIds: [],
      stats: { played: 0, won: 0, lost: 0, drawn: 0, tied: 0, points: 0, runsScored: 0, oversFaced: 0, runsConceded: 0, oversBowled: 0, nrr: 0 }
    });
    return { id: docRef.id, name };
  } else {
    const list = getMockItem("teams");
    const newTeam = {
      id: "t_" + Math.random().toString(36).substr(2, 9),
      name,
      logoUrl: "",
      playerIds: [],
      stats: { played: 0, won: 0, lost: 0, drawn: 0, tied: 0, points: 0, runsScored: 0, oversFaced: 0, runsConceded: 0, oversBowled: 0, nrr: 0 }
    };
    list.push(newTeam);
    setMockItem("teams", list);
    return newTeam;
  }
}

export function subscribeMatches(callback) {
  if (isConfigValid) {
    return onSnapshot(query(collection(db, "matches"), orderBy("date", "desc")), (snapshot) => {
      const list = [];
      snapshot.forEach(d => list.push({ id: d.id, ...d.data() }));
      callback(list);
    });
  } else {
    listeners.matches.push(callback);
    callback(getMockItem("matches"));
    return () => {
      listeners.matches = listeners.matches.filter(cb => cb !== callback);
    };
  }
}

export function subscribeMatch(matchId, callback) {
  if (isConfigValid) {
    return onSnapshot(doc(db, "matches", matchId), (snapshot) => {
      if (snapshot.exists()) {
        callback({ id: snapshot.id, ...snapshot.data() });
      } else {
        callback(null);
      }
    });
  } else {
    const wrapper = (matchesList) => {
      const match = matchesList.find(m => m.id === matchId);
      callback(match || null);
    };
    listeners.matches.push(wrapper);
    const matches = getMockItem("matches");
    wrapper(matches);
    return () => {
      listeners.matches = listeners.matches.filter(cb => cb !== wrapper);
    };
  }
}

export async function createMatch(matchData) {
  const initialMatch = {
    ...matchData,
    status: "upcoming",
    result: null,
    manOfTheMatch: null,
    scores: {
      teamA: { runs: 0, wickets: 0, overs: 0, inningsCompleted: false },
      teamB: { runs: 0, wickets: 0, overs: 0, inningsCompleted: false }
    }
  };

  if (isConfigValid) {
    const docRef = await addDoc(collection(db, "matches"), initialMatch);
    if (matchData.squadDetails) {
      for (const [teamKey, playersMap] of Object.entries(matchData.squadDetails)) {
        const teamId = teamKey === "teamA" ? matchData.teamA.id : matchData.teamB.id;
        for (const [playerId, playerMeta] of Object.entries(playersMap)) {
          const playerRef = doc(db, "matches", docRef.id, "squads", teamId, "players", playerId);
          await setDoc(playerRef, playerMeta);
        }
      }
    }
    return docRef.id;
  } else {
    const list = getMockItem("matches");
    const id = "m_" + Math.random().toString(36).substr(2, 9);
    const newMatch = { id, ...initialMatch };
    list.push(newMatch);
    setMockItem("matches", list);
    return id;
  }
}

export async function updateMatch(matchId, updates) {
  if (isConfigValid) {
    await updateDoc(doc(db, "matches", matchId), updates);
    if (updates.squadDetails) {
      const matchRef = doc(db, "matches", matchId);
      const matchSnap = await getDoc(matchRef);
      if (matchSnap.exists()) {
        const matchData = matchSnap.data();
        for (const [teamKey, playersMap] of Object.entries(updates.squadDetails)) {
          const teamId = teamKey === "teamA" ? matchData.teamA.id : matchData.teamB.id;
          for (const [playerId, playerMeta] of Object.entries(playersMap)) {
            const playerRef = doc(db, "matches", matchId, "squads", teamId, "players", playerId);
            await setDoc(playerRef, playerMeta);
          }
        }
      }
    }
  } else {
    const list = getMockItem("matches");
    const idx = list.findIndex(m => m.id === matchId);
    if (idx !== -1) {
      const match = { ...list[idx] };
      // Perform deep/dot-notation update
      for (const [key, value] of Object.entries(updates)) {
        if (key.includes(".")) {
          const parts = key.split(".");
          let obj = match;
          for (let i = 0; i < parts.length - 1; i++) {
            if (!obj[parts[i]]) obj[parts[i]] = {};
            // Deep copy nested level to avoid mutation side-effects
            obj[parts[i]] = { ...obj[parts[i]] };
            obj = obj[parts[i]];
          }
          obj[parts[parts.length - 1]] = value;
        } else {
          match[key] = value;
        }
      }
      list[idx] = match;
      setMockItem("matches", list);
    }
  }
}

export function subscribePosts(callback) {
  if (isConfigValid) {
    return onSnapshot(query(collection(db, "posts"), orderBy("uploadedAt", "desc")), (snapshot) => {
      const list = [];
      snapshot.forEach(d => list.push({ id: d.id, ...d.data() }));
      callback(list);
    });
  } else {
    listeners.posts.push(callback);
    callback(getMockItem("posts"));
    return () => {
      listeners.posts = listeners.posts.filter(cb => cb !== callback);
    };
  }
}

export async function createPost(postData) {
  const initialPost = {
    ...postData,
    uploadedAt: new Date().toISOString(),
    likes: [],
    comments: []
  };

  if (isConfigValid) {
    const docRef = await addDoc(collection(db, "posts"), initialPost);
    return { id: docRef.id, ...initialPost };
  } else {
    const list = getMockItem("posts");
    const newPost = {
      id: "po_" + Math.random().toString(36).substr(2, 9),
      ...initialPost
    };
    list.push(newPost);
    setMockItem("posts", list);
    return newPost;
  }
}

export async function likePost(postId, phone) {
  if (isConfigValid) {
    // Check if liked already to toggle
    const postRef = doc(db, "posts", postId);
    const snap = await getDoc(postRef);
    if (snap.exists()) {
      const data = snap.data();
      const likes = data.likes || [];
      if (likes.includes(phone)) {
        await updateDoc(postRef, { likes: arrayRemove(phone) });
      } else {
        await updateDoc(postRef, { likes: arrayUnion(phone) });
      }
    }
  } else {
    const list = getMockItem("posts");
    const idx = list.findIndex(p => p.id === postId);
    if (idx !== -1) {
      const likes = list[idx].likes || [];
      if (likes.includes(phone)) {
        list[idx].likes = likes.filter(ph => ph !== phone);
      } else {
        list[idx].likes.push(phone);
      }
      setMockItem("posts", list);
    }
  }
}

export async function commentPost(postId, comment) {
  const newComment = {
    ...comment,
    timestamp: new Date().toISOString()
  };

  if (isConfigValid) {
    await updateDoc(doc(db, "posts", postId), {
      comments: arrayUnion(newComment)
    });
  } else {
    const list = getMockItem("posts");
    const idx = list.findIndex(p => p.id === postId);
    if (idx !== -1) {
      list[idx].comments = list[idx].comments || [];
      list[idx].comments.push(newComment);
      setMockItem("posts", list);
    }
  }
}

// -------------------------------------------------------------
// Career & Standings Rollup Utility on Match Finish
// -------------------------------------------------------------
function oversToBalls(oversFraction) {
  if (oversFraction === null || oversFraction === undefined) return 0;
  const oversInt = Math.floor(oversFraction);
  const balls = Math.round((oversFraction - oversInt) * 10);
  return oversInt * 6 + balls;
}

function ballsToOvers(balls) {
  if (!balls || balls <= 0) return 0;
  const oversInt = Math.floor(balls / 6);
  const ballsRem = balls % 6;
  return parseFloat(`${oversInt}.${ballsRem}`);
}

export async function recalculateAllStats() {
  try {
    // 1. Fetch all players, matches, and teams
    let playersList = [];
    let matchesList = [];
    let teamsList = [];
    
    if (isConfigValid) {
      const playersSnap = await getDocs(collection(db, "players"));
      playersSnap.forEach(docSnap => {
        playersList.push({ id: docSnap.id, ...docSnap.data() });
      });
      const matchesSnap = await getDocs(collection(db, "matches"));
      matchesSnap.forEach(docSnap => {
        matchesList.push({ id: docSnap.id, ...docSnap.data() });
      });
      const teamsSnap = await getDocs(collection(db, "teams"));
      teamsSnap.forEach(docSnap => {
        teamsList.push({ id: docSnap.id, ...docSnap.data() });
      });
    } else {
      playersList = getMockItem("players") || [];
      matchesList = getMockItem("matches") || [];
      teamsList = getMockItem("teams") || [];
    }

    // 2. Initialize players' careerStats to 0
    const cleanPlayers = playersList.map(player => {
      return {
        ...player,
        careerStats: {
          batting: { matches: 0, innings: 0, notOuts: 0, runs: 0, highestScore: 0, ballsFaced: 0, strikeRate: 0, hundreds: 0, fifties: 0, fours: 0, sixes: 0, ducks: 0 },
          bowling: { matches: 0, innings: 0, overs: 0, maidens: 0, runsConceded: 0, wickets: 0, bestBowlingRuns: 0, bestBowlingWickets: 0, average: 0, economy: 0, strikeRate: 0, fiveWickets: 0, tenWicketsMatch: 0 },
          fielding: { catches: 0, stumpings: 0, runOuts: 0 }
        }
      };
    });

    // 3. Initialize teams' stats to 0
    const cleanTeams = teamsList.map(team => {
      return {
        ...team,
        stats: { played: 0, won: 0, lost: 0, drawn: 0, tied: 0, points: 0, runsScored: 0, oversFaced: 0, runsConceded: 0, oversBowled: 0, nrr: 0 }
      };
    });

    // 4. Filter finished matches
    const finishedMatches = matchesList.filter(m => m.status === "finished");

    // Process each finished match
    finishedMatches.forEach(match => {
      const innings = match.innings || {};
      
      // Rebuild innings using ball-by-ball events
      const rebuiltInnings = {};
      Object.keys(innings).forEach(innNo => {
        const inn = innings[innNo];
        const battingSquadIds = match.squads[inn.battingTeamId === match.teamA.id ? "teamA" : "teamB"] || [];
        const bowlingSquadIds = match.squads[inn.bowlingTeamId === match.teamA.id ? "teamA" : "teamB"] || [];
        
        const battingSquad = cleanPlayers.filter(p => battingSquadIds.includes(p.id));
        const bowlingSquad = cleanPlayers.filter(p => bowlingSquadIds.includes(p.id));
        
        rebuiltInnings[innNo] = rebuildInningsState(
          createBlankInnings(inn.inningsNo, inn.battingTeamId, inn.bowlingTeamId, inn.oversAvailable),
          battingSquad,
          bowlingSquad,
          inn.balls || [],
          match,
          cleanPlayers
        );
      });

      // Map matching players and aggregate
      const playerMatchStats = {};
      const getAccumulator = (id) => {
        if (!playerMatchStats[id]) {
          playerMatchStats[id] = {
            battedInningsCount: 0,
            bowledInningsCount: 0,
            battingRuns: 0,
            battingBalls: 0,
            battingFours: 0,
            battingSixes: 0,
            battingOuts: 0,
            ducks: 0,
            highestScore: 0,
            hundreds: 0,
            fifties: 0,
            bowlingBalls: 0,
            bowlingMaidens: 0,
            bowlingRunsConceded: 0,
            bowlingWickets: 0,
            bestBowlingWickets: 0,
            bestBowlingRuns: 9999,
            hadBowlingSpell: false,
            fiveWickets: 0,
            catches: 0,
            stumpings: 0,
            runOuts: 0
          };
        }
        return playerMatchStats[id];
      };

      Object.values(rebuiltInnings).forEach((inn) => {
        // Batting
        inn.battingCard.forEach((bat) => {
          const stats = getAccumulator(bat.playerId);
          stats.battedInningsCount += 1;
          stats.battingRuns += bat.runs || 0;
          stats.battingBalls += bat.balls || 0;
          stats.battingFours += bat.fours || 0;
          stats.battingSixes += bat.sixes || 0;
          if (bat.out) {
            stats.battingOuts += 1;
            if ((bat.runs || 0) === 0) {
              stats.ducks += 1;
            }
          }
          if ((bat.runs || 0) > stats.highestScore) {
            stats.highestScore = bat.runs;
          }
          if ((bat.runs || 0) >= 100) {
            stats.hundreds += 1;
          } else if ((bat.runs || 0) >= 50) {
            stats.fifties += 1;
          }
        });

        // Bowling
        inn.bowlingCard.forEach((bowl) => {
          const stats = getAccumulator(bowl.playerId);
          stats.bowledInningsCount += 1;
          stats.bowlingBalls += bowl.balls || 0;
          stats.bowlingMaidens += bowl.maidens || 0;
          stats.bowlingRunsConceded += bowl.runsConceded || 0;
          stats.bowlingWickets += bowl.wickets || 0;
          stats.hadBowlingSpell = true;

          const isNewBest = !stats.bestBowlingWickets || 
                            bowl.wickets > stats.bestBowlingWickets || 
                            (bowl.wickets === stats.bestBowlingWickets && bowl.runsConceded < stats.bestBowlingRuns);
          if (isNewBest) {
            stats.bestBowlingWickets = bowl.wickets;
            stats.bestBowlingRuns = bowl.runsConceded;
          }

          if (bowl.wickets >= 5) {
            stats.fiveWickets += 1;
          }
        });

        // Fielding
        inn.battingCard.forEach((bat) => {
          if (bat.out && bat.fielderId) {
            const stats = getAccumulator(bat.fielderId);
            if (bat.dismissalType === "Caught") {
              stats.catches += 1;
            } else if (bat.dismissalType === "Stumped") {
              stats.stumpings += 1;
            } else if (bat.dismissalType === "Run Out") {
              stats.runOuts += 1;
            }
          }
        });
      });

      // Apply match stats to cleanPlayers
      cleanPlayers.forEach(player => {
        const perf = playerMatchStats[player.id];
        if (perf) {
          const { batting, bowling, fielding } = player.careerStats;

          // Batting
          if (perf.battedInningsCount > 0) {
            batting.matches += 1;
            batting.innings += perf.battedInningsCount;
            batting.runs += perf.battingRuns;
            batting.ballsFaced += perf.battingBalls;
            batting.fours += perf.battingFours;
            batting.sixes += perf.battingSixes;
            batting.ducks += perf.ducks;
            
            const matchNotOuts = perf.battedInningsCount - perf.battingOuts;
            batting.notOuts += matchNotOuts;

            if (perf.highestScore > batting.highestScore) {
              batting.highestScore = perf.highestScore;
            }

            batting.hundreds += perf.hundreds;
            batting.fifties += perf.fifties;
          }

          // Bowling
          if (perf.bowledInningsCount > 0) {
            bowling.matches += 1;
            bowling.innings += perf.bowledInningsCount;
            
            const prevOversInt = Math.floor(bowling.overs || 0);
            const prevBalls = Math.round(((bowling.overs || 0) - prevOversInt) * 10);
            const addBalls = perf.bowlingBalls;
            
            let totalBalls = prevBalls + addBalls + (prevOversInt * 6);
            const finalOvers = Math.floor(totalBalls / 6);
            const finalBalls = totalBalls % 6;
            
            bowling.overs = parseFloat(`${finalOvers}.${finalBalls}`);
            bowling.maidens += perf.bowlingMaidens;
            bowling.runsConceded += perf.bowlingRunsConceded;
            bowling.wickets += perf.bowlingWickets;

            if (perf.hadBowlingSpell) {
              const isNewBest = !bowling.bestBowlingWickets || 
                                perf.bestBowlingWickets > bowling.bestBowlingWickets || 
                                (perf.bestBowlingWickets === bowling.bestBowlingWickets && perf.bestBowlingRuns < bowling.bestBowlingRuns);
              if (isNewBest) {
                bowling.bestBowlingWickets = perf.bestBowlingWickets;
                bowling.bestBowlingRuns = perf.bestBowlingRuns;
              }
            }

            bowling.fiveWickets = (bowling.fiveWickets || 0) + (perf.fiveWickets || 0);
            if (perf.bowlingWickets >= 10) {
              bowling.tenWicketsMatch = (bowling.tenWicketsMatch || 0) + 1;
            }
          }

          // Fielding
          fielding.catches += perf.catches;
          fielding.stumpings += perf.stumpings;
          fielding.runOuts += perf.runOuts;
        }
      });

      // Update Teams Standings
      const updateTeamRecordLocal = (team, runsScored, ballsFaced, runsConceded, ballsBowled, pointsReward, win, loss, draw, tie) => {
        const { stats } = team;
        stats.played += 1;
        stats.won += win ? 1 : 0;
        stats.lost += loss ? 1 : 0;
        stats.drawn += draw ? 1 : 0;
        stats.tied += tie ? 1 : 0;
        stats.points += pointsReward;
        stats.runsScored += runsScored;
        stats.runsConceded += runsConceded;

        const prevBallsFaced = oversToBalls(stats.oversFaced || 0);
        const newBallsFaced = prevBallsFaced + ballsFaced;
        stats.oversFaced = ballsToOvers(newBallsFaced);

        const prevBallsBowled = oversToBalls(stats.oversBowled || 0);
        const newBallsBowled = prevBallsBowled + ballsBowled;
        stats.oversBowled = ballsToOvers(newBallsBowled);

        const decimalOversFaced = newBallsFaced / 6;
        const decimalOversBowled = newBallsBowled / 6;

        const rateScored = decimalOversFaced > 0 ? (stats.runsScored / decimalOversFaced) : 0;
        const rateConceded = decimalOversBowled > 0 ? (stats.runsConceded / decimalOversBowled) : 0;
        
        stats.nrr = parseFloat((rateScored - rateConceded).toFixed(3));
      };

      const { teamA, teamB, result: matchResult } = match;
      if (matchResult) {
        const inn1 = rebuiltInnings["1"];
        if (inn1) {
          const team1Id = inn1.battingTeamId;

          let team1_runs = 0;
          let team1_balls = 0;
          let team2_runs = 0;
          let team2_balls = 0;

          Object.values(rebuiltInnings).forEach((inn) => {
            const balls = oversToBalls(inn.oversUsed);
            if (inn.battingTeamId === team1Id) {
              team1_runs += inn.totalRuns || 0;
              team1_balls += balls;
            } else {
              team2_runs += inn.totalRuns || 0;
              team2_balls += balls;
            }
          });

          let teamA_runs = 0;
          let teamA_balls = 0;
          let teamB_runs = 0;
          let teamB_balls = 0;

          if (teamA.id === team1Id) {
            teamA_runs = team1_runs;
            teamA_balls = team1_balls;
            teamB_runs = team2_runs;
            teamB_balls = team2_balls;
          } else {
            teamA_runs = team2_runs;
            teamA_balls = team2_balls;
            teamB_runs = team1_runs;
            teamB_balls = team1_balls;
          }

          const winA = matchResult.winnerId === teamA.id;
          const winB = matchResult.winnerId === teamB.id;
          const isTie = matchResult.type === "tie";
          const isDraw = matchResult.type === "draw";

          const ptsA = winA ? 12 : (isTie ? 6 : (isDraw ? 4 : 0));
          const ptsB = winB ? 12 : (isTie ? 6 : (isDraw ? 4 : 0));

          const tA = cleanTeams.find(t => t.id === teamA.id);
          const tB = cleanTeams.find(t => t.id === teamB.id);

          if (tA && tB) {
            updateTeamRecordLocal(tA, teamA_runs, teamA_balls, teamB_runs, teamB_balls, ptsA, winA, winB, isDraw, isTie);
            updateTeamRecordLocal(tB, teamB_runs, teamB_balls, teamA_runs, teamA_balls, ptsB, winB, winA, isDraw, isTie);
          }
        }
      }
    });

    // 5. Save players (derived ratios and DB write)
    for (const player of cleanPlayers) {
      const { batting, bowling } = player.careerStats;
      
      batting.strikeRate = batting.ballsFaced > 0 
        ? parseFloat(((batting.runs / batting.ballsFaced) * 100).toFixed(1)) 
        : 0;

      batting.average = batting.innings > 0 
        ? parseFloat((batting.runs / batting.innings).toFixed(2)) 
        : batting.runs;

      const bowlingOversInt = Math.floor(bowling.overs || 0);
      const bowlingBallsRem = Math.round(((bowling.overs || 0) - bowlingOversInt) * 10);
      const totalBowlingBalls = (bowlingOversInt * 6) + bowlingBallsRem;
      const totalOversDec = totalBowlingBalls / 6;

      bowling.economy = totalOversDec > 0 
        ? parseFloat((bowling.runsConceded / totalOversDec).toFixed(2)) 
        : 0;
      
      bowling.average = bowling.wickets > 0 
        ? parseFloat((bowling.runsConceded / bowling.wickets).toFixed(2)) 
        : 0;

      bowling.strikeRate = bowling.wickets > 0 
        ? parseFloat((totalBowlingBalls / bowling.wickets).toFixed(2)) 
        : 0;

      // Find original player to compare
      const originalPlayer = playersList.find(p => p.id === player.id);
      const hasChanged = !originalPlayer || JSON.stringify(originalPlayer.careerStats) !== JSON.stringify(player.careerStats);
      
      if (hasChanged) {
        console.log(`Updating careerStats for player ${player.name}`);
        if (isConfigValid) {
          const pRef = doc(db, "players", player.id);
          await updateDoc(pRef, { careerStats: player.careerStats });
        }
      }
    }

    if (!isConfigValid) {
      setMockItem("players", cleanPlayers);
    }

    // 6. Save teams (DB write)
    for (const team of cleanTeams) {
      const originalTeam = teamsList.find(t => t.id === team.id);
      const hasChanged = !originalTeam || JSON.stringify(originalTeam.stats) !== JSON.stringify(team.stats);
      
      if (hasChanged) {
        console.log(`Updating stats for team ${team.name}`);
        if (isConfigValid) {
          const tRef = doc(db, "teams", team.id);
          await updateDoc(tRef, { stats: team.stats });
        }
      }
    }

    if (!isConfigValid) {
      setMockItem("teams", cleanTeams);
    }

    console.log("All player and team stats successfully recalculated!");
  } catch (error) {
    console.error("Error in recalculateAllStats:", error);
  }
}

export async function finalizeMatchStats(matchId, matchData) {
  // Recalculate everything from scratch to guarantee idempotency!
  await recalculateAllStats();
}

// Auto-run once on app initialization to repair any corrupt stats
if (typeof window !== "undefined") {
  setTimeout(() => {
    console.log("Running background database self-healing repair pass...");
    recalculateAllStats();
  }, 3000);
}

// Clear all database entries
export async function clearAllDatabaseEntries() {
  try {
    if (isConfigValid) {
      // Clear Firebase collections
      const collections = ["players", "teams", "matches", "posts"];
      
      for (const collectionName of collections) {
        const snapshot = await getDocs(collection(db, collectionName));
        for (const docSnap of snapshot.docs) {
          const docRef = doc(db, collectionName, docSnap.id);
          await deleteDoc(docRef);
        }
      }
      console.log("All Firebase collections cleared!");
    } else {
      // Clear localStorage mock database
      localStorage.removeItem("cricket_players");
      localStorage.removeItem("cricket_teams");
      localStorage.removeItem("cricket_matches");
      localStorage.removeItem("cricket_posts");
      localStorage.removeItem("cricket_checked_in_player");
      localStorage.removeItem("cricket_mock_auth_user");
      localStorage.removeItem("cricket_cleared_july3");
      
      // Reinitialize with empty data
      setMockItem("players", []);
      setMockItem("teams", []);
      setMockItem("matches", []);
      setMockItem("posts", []);
      
      console.log("Mock database cleared! All entries removed.");
    }
    
    return true;
  } catch (error) {
    console.error("Error clearing database:", error);
    return false;
  }
}

export function clearAllData() {
  if (typeof window !== "undefined") {
    localStorage.removeItem("cricket_players");
    localStorage.removeItem("cricket_teams");
    localStorage.removeItem("cricket_matches");
    localStorage.removeItem("cricket_posts");
    localStorage.removeItem("cricket_checked_in_player");
    localStorage.removeItem("cricket_mock_auth_user");
    window.location.reload();
  }
}
