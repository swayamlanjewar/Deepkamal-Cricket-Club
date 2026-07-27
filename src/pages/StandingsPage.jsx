import React, { useState, useEffect } from "react";
import { Trophy, Award, Shield, User, ArrowUpRight, AwardIcon, Star } from "lucide-react";
import { subscribeTeams, subscribePlayers } from "../services/db";

export default function StandingsPage() {
  const [teams, setTeams] = useState([]);
  const [players, setPlayers] = useState([]);
  const [activeTab, setActiveTab] = useState("pointsTable"); // 'pointsTable' | 'leaderboards'
  
  // Leaderboard sub-tabs
  const [leaderboardCategory, setLeaderboardCategory] = useState("runs"); // 'runs' | 'wickets' | 'batAvg' | 'bowlEcon' | 'fielding' | 'mvp'

  useEffect(() => {
    const unsubTeams = subscribeTeams((list) => {
      setTeams(list);
    });
    const unsubPlayers = subscribePlayers((list) => {
      setPlayers(list);
    });

    return () => {
      unsubTeams();
      unsubPlayers();
    };
  }, []);

  // Sort teams: Points (desc) -> NRR (desc) -> Name
  const sortedTeams = [...teams].sort((a, b) => {
    const statsA = a.stats || { points: 0, nrr: 0 };
    const statsB = b.stats || { points: 0, nrr: 0 };
    
    if (statsB.points !== statsA.points) {
      return statsB.points - statsA.points;
    }
    return statsB.nrr - statsA.nrr;
  });

  // Qualifiers
  const MIN_BAT_INNINGS = 2;
  const MIN_BOWL_INNINGS = 2;

  // Leaderboard lists
  const runsLeaderboard = [...players]
    .filter(p => (p.careerStats?.batting?.runs || 0) > 0)
    .sort((a, b) => (b.careerStats?.batting?.runs || 0) - (a.careerStats?.batting?.runs || 0));

  const wicketsLeaderboard = [...players]
    .filter(p => (p.careerStats?.bowling?.wickets || 0) > 0)
    .sort((a, b) => (b.careerStats?.bowling?.wickets || 0) - (a.careerStats?.bowling?.wickets || 0));

  const batAvgLeaderboard = [...players]
    .filter(p => (p.careerStats?.batting?.innings || 0) >= MIN_BAT_INNINGS && (p.careerStats?.batting?.average || 0) > 0)
    .sort((a, b) => (b.careerStats?.batting?.average || 0) - (a.careerStats?.batting?.average || 0));

  const bowlEconLeaderboard = [...players]
    .filter(p => (p.careerStats?.bowling?.innings || 0) >= MIN_BOWL_INNINGS && (p.careerStats?.bowling?.economy || 99) > 0)
    .sort((a, b) => (a.careerStats?.bowling?.economy || 99) - (b.careerStats?.bowling?.economy || 99));

  const fieldingLeaderboard = [...players]
    .filter(p => {
      const f = p.careerStats?.fielding || { catches: 0, stumpings: 0, runOuts: 0 };
      return (f.catches + f.stumpings + f.runOuts) > 0;
    })
    .sort((a, b) => {
      const fA = a.careerStats?.fielding || { catches: 0, stumpings: 0, runOuts: 0 };
      const fB = b.careerStats?.fielding || { catches: 0, stumpings: 0, runOuts: 0 };
      return (fB.catches + fB.stumpings + fB.runOuts) - (fA.catches + fA.stumpings + fA.runOuts);
    });

  // MVP (runs + wickets * 20 + catches * 10 + stumpings * 10)
  const calculateMVPScore = (p) => {
    const bat = p.careerStats?.batting || { runs: 0 };
    const bowl = p.careerStats?.bowling || { wickets: 0 };
    const fld = p.careerStats?.fielding || { catches: 0, stumpings: 0 };
    return bat.runs + (bowl.wickets * 20) + (fld.catches * 10) + (fld.stumpings * 10);
  };

  const mvpLeaderboard = [...players]
    .map(p => ({ ...p, mvpScore: calculateMVPScore(p) }))
    .filter(p => p.mvpScore > 0)
    .sort((a, b) => b.mvpScore - a.mvpScore);

  const getActiveLeaderboardList = () => {
    if (leaderboardCategory === "runs") return runsLeaderboard;
    if (leaderboardCategory === "wickets") return wicketsLeaderboard;
    if (leaderboardCategory === "batAvg") return batAvgLeaderboard;
    if (leaderboardCategory === "bowlEcon") return bowlEconLeaderboard;
    if (leaderboardCategory === "fielding") return fieldingLeaderboard;
    return mvpLeaderboard;
  };

  const activeList = getActiveLeaderboardList();
  
  // Podium players (positions 1, 2, 3)
  // Reorder so [2nd, 1st, 3rd] renders correctly on screen from left to right!
  const topThree = activeList.slice(0, 3);
  const podiumOrder = [];
  if (topThree[1]) podiumOrder.push({ player: topThree[1], rank: 2 });
  if (topThree[0]) podiumOrder.push({ player: topThree[0], rank: 1 });
  if (topThree[2]) podiumOrder.push({ player: topThree[2], rank: 3 });

  const remainingPlayers = activeList.slice(3, 10); // Positions 4-10

  const getStatLabelAndVal = (p, cat) => {
    const stats = p.careerStats || { batting: {}, bowling: {}, fielding: {} };
    if (cat === "runs") return { label: "Runs", val: stats.batting.runs || 0 };
    if (cat === "wickets") return { label: "Wickets", val: stats.bowling.wickets || 0 };
    if (cat === "batAvg") return { label: "Average", val: stats.batting.average || "0" };
    if (cat === "bowlEcon") return { label: "Economy", val: stats.bowling.economy || "0" };
    if (cat === "fielding") {
      const f = stats.fielding || { catches: 0, stumpings: 0, runOuts: 0 };
      return { label: "Dismissals", val: f.catches + f.stumpings + f.runOuts };
    }
    return { label: "MVP Pts", val: p.mvpScore || 0 };
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 animate-pop">
      {/* Header */}
      <div className="mb-8">
        <h2 className="font-display font-extrabold text-2xl sm:text-3xl text-slate-900 dark:text-white tracking-tight">
          Standings & Leaderboards
        </h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
          Review tournament points tables, team statistics, and player-wise leaderboard stats.
        </p>
      </div>

      {/* Main Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 mb-8">
        {[
          { id: "pointsTable", label: "Points Table", icon: Trophy },
          { id: "leaderboards", label: "Player Leaderboards", icon: Award }
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center space-x-2 py-3.5 px-4 font-display font-bold text-sm border-b-2 tracking-wide uppercase mr-6 transition-all ${
                activeTab === tab.id
                  ? "border-teal-600 dark:border-teal-400 text-teal-600 dark:text-teal-400 font-extrabold"
                  : "border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              <Icon size={16} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* -------------------------------------------------------------
          TAB 1: POINTS TABLE
          ------------------------------------------------------------- */}
      {activeTab === "pointsTable" && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm transition-all duration-300">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/50 dark:bg-slate-900/50">
                  <th className="p-4 pl-6 text-center w-12">Pos</th>
                  <th className="p-4">Team</th>
                  <th className="p-4 text-center">Played</th>
                  <th className="p-4 text-center">Won</th>
                  <th className="p-4 text-center">Lost</th>
                  <th className="p-4 text-center">Drawn</th>
                  <th className="p-4 text-center">Tied</th>
                  <th className="p-4 text-center font-bold text-slate-900 dark:text-white">Points</th>
                  <th className="p-4 text-center pr-6">NRR</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-semibold text-slate-700 dark:text-slate-300">
                {sortedTeams.map((team, idx) => {
                  const stats = team.stats || { played: 0, won: 0, lost: 0, drawn: 0, tied: 0, points: 0, nrr: 0 };
                  const isLeader = idx === 0 && stats.played > 0;
                  return (
                    <tr 
                      key={team.id} 
                      className={`hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-colors ${
                        isLeader ? "bg-teal-500/5 dark:bg-teal-400/5 font-bold" : ""
                      }`}
                    >
                      <td className="p-4 pl-6 text-center text-slate-400">
                        {isLeader ? (
                          <div className="flex items-center justify-center text-teal-600 dark:text-teal-400">
                            <Star size={16} fill="currentColor" />
                          </div>
                        ) : idx + 1}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center space-x-3">
                          <Shield size={16} className={isLeader ? "text-teal-600 dark:text-teal-400" : "text-slate-400"} />
                          <span className={isLeader ? "text-teal-900 dark:text-white font-extrabold" : "text-slate-900 dark:text-slate-100"}>
                            {team.name}
                          </span>
                        </div>
                      </td>
                      <td className="p-4 text-center font-medium text-slate-500">{stats.played}</td>
                      <td className="p-4 text-center text-slate-600 dark:text-slate-400">{stats.won}</td>
                      <td className="p-4 text-center text-slate-600 dark:text-slate-400">{stats.lost}</td>
                      <td className="p-4 text-center text-slate-600 dark:text-slate-400">{stats.drawn}</td>
                      <td className="p-4 text-center text-slate-600 dark:text-slate-400">{stats.tied}</td>
                      <td className="p-4 text-center font-black text-slate-900 dark:text-white text-sm">{stats.points}</td>
                      <td className={`p-4 text-center pr-6 font-mono ${
                        stats.nrr > 0 ? "text-emerald-600 dark:text-emerald-400" : stats.nrr < 0 ? "text-rose-500" : "text-slate-400"
                      }`}>
                        {stats.nrr > 0 ? `+${stats.nrr}` : stats.nrr}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          
          <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 text-[10px] text-slate-400 font-semibold uppercase tracking-wider flex items-center justify-between">
            <span>Points System: Win = 12, Tie = 6, Draw = 4, Loss = 0</span>
            <span>Tiebreaker: Net Run Rate (NRR)</span>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          TAB 2: PLAYER LEADERBOARDS
          ------------------------------------------------------------- */}
      {activeTab === "leaderboards" && (
        <div className="space-y-8 animate-pop">
          {/* Leaderboard sub-navigation buttons */}
          <div className="flex flex-wrap gap-2.5 border-b border-slate-200 dark:border-slate-800 pb-4 overflow-x-auto">
            {[
              { id: "runs", label: "Most Runs" },
              { id: "wickets", label: "Most Wickets" },
              { id: "batAvg", label: "Highest Avg", badge: `Min ${MIN_BAT_INNINGS} Inn` },
              { id: "bowlEcon", label: "Best Econ", badge: `Min ${MIN_BOWL_INNINGS} Inn` },
              { id: "fielding", label: "Fielding MVP" },
              { id: "mvp", label: "Tournament MVP" }
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => setLeaderboardCategory(cat.id)}
                className={`py-2 px-4 rounded-xl text-xs font-bold transition-all ${
                  leaderboardCategory === cat.id
                    ? "bg-teal-600 dark:bg-teal-500 text-white shadow-md shadow-teal-600/15"
                    : "bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400"
                }`}
              >
                <span>{cat.label}</span>
                {cat.badge && (
                  <span className="ml-1.5 text-[9px] bg-white/20 px-1 py-0.5 rounded uppercase opacity-90 font-medium">
                    {cat.badge}
                  </span>
                )}
              </button>
            ))}
          </div>

          {activeList.length === 0 ? (
            <div className="text-center py-16 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl">
              <p className="text-slate-500 dark:text-slate-400 text-sm">No player statistics available for this category yet.</p>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Leaderboard Podium (Top 3) */}
              <div className="grid grid-cols-3 gap-3 max-w-lg mx-auto pt-10 pb-6 items-end relative min-h-[300px]">
                {podiumOrder.map((item) => {
                  const p = item.player;
                  const rank = item.rank;
                  const stat = getStatLabelAndVal(p, leaderboardCategory);
                  
                  // Render styles based on rank (1st = tallest, center; 2nd = medium, left; 3rd = shortest, right)
                  const heightClass = rank === 1 ? "h-40 bg-teal-500/10 border-teal-500/30" : rank === 2 ? "h-32 bg-slate-100/50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800" : "h-24 bg-slate-100/30 dark:bg-slate-800/20 border-slate-200/50 dark:border-slate-800/50";
                  const ringClass = rank === 1 ? "ring-4 ring-teal-500/30" : rank === 2 ? "ring-2 ring-slate-300 dark:ring-slate-700" : "ring-1 ring-slate-200 dark:ring-slate-800";
                  const orderClass = rank === 1 ? "order-2" : rank === 2 ? "order-1" : "order-3";

                  return (
                    <div key={p.id} className={`flex flex-col items-center text-center ${orderClass} animate-pop`}>
                      {/* Avatar */}
                      <div className={`relative mb-3`}>
                        <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-display font-extrabold text-lg text-slate-800 dark:text-slate-200 ${ringClass}`}>
                          {(p.name || "").charAt(0)}
                        </div>
                        {/* Rank Badge */}
                        <div className={`absolute -top-2 -right-1 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black text-white shadow-md ${
                          rank === 1 ? "bg-amber-500" : rank === 2 ? "bg-slate-400" : "bg-amber-700"
                        }`}>
                          {rank}
                        </div>
                      </div>

                      {/* Name & Team */}
                      <div className="px-1 w-full truncate">
                        <p className="font-display font-bold text-xs text-slate-900 dark:text-white truncate">{p.name}</p>
                        <p className="text-[9px] font-bold text-slate-400 uppercase truncate mt-0.5">{p.teamName}</p>
                      </div>

                      {/* Stand Podium Pedestal */}
                      <div className={`w-full mt-4 rounded-t-2xl border-t border-x flex flex-col items-center justify-center p-3 ${heightClass}`}>
                        <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{stat.label}</span>
                        <span className="font-display font-black text-lg sm:text-2xl text-slate-800 dark:text-white mt-1">
                          {stat.val}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Table list for remaining players (Positions 4 to 10) */}
              {remainingPlayers.length > 0 && (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
                  <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                    <h4 className="font-display font-extrabold text-[10px] uppercase tracking-wider text-slate-400">
                      Top 10 Rankings
                    </h4>
                  </div>
                  <table className="w-full text-left border-collapse text-xs">
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-semibold text-slate-700 dark:text-slate-300">
                      {remainingPlayers.map((p, idx) => {
                        const stat = getStatLabelAndVal(p, leaderboardCategory);
                        const roleStats = p.careerStats?.batting || {};
                        const bowlStats = p.careerStats?.bowling || {};
                        return (
                          <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10">
                            <td className="p-4 pl-6 w-12 text-slate-400 text-center font-bold">{idx + 4}</td>
                            <td className="p-4">
                              <div className="font-display font-bold text-slate-900 dark:text-white">{p.name}</div>
                              <div className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">{p.teamName}</div>
                            </td>
                            <td className="p-4 text-center">
                              {leaderboardCategory === "runs" && (
                                <div className="text-slate-400 font-medium">
                                  Avg: <strong className="text-slate-800 dark:text-white">{roleStats.average || "0"}</strong> • SR: <strong className="text-slate-800 dark:text-white">{roleStats.strikeRate || "0"}</strong>
                                </div>
                              )}
                              {leaderboardCategory === "wickets" && (
                                <div className="text-slate-400 font-medium">
                                  Econ: <strong className="text-slate-800 dark:text-white">{bowlStats.economy || "0"}</strong> • BBI: <strong className="text-slate-800 dark:text-white">{bowlStats.bestBowlingWickets !== undefined ? `${bowlStats.bestBowlingWickets}/${bowlStats.bestBowlingRuns}` : "-"}</strong>
                                </div>
                              )}
                              {leaderboardCategory === "batAvg" && (
                                <div className="text-slate-400 font-medium">
                                  Runs: <strong className="text-slate-800 dark:text-white">{roleStats.runs || 0}</strong> • Inns: <strong className="text-slate-800 dark:text-white">{roleStats.innings || 0}</strong>
                                </div>
                              )}
                              {leaderboardCategory === "bowlEcon" && (
                                <div className="text-slate-400 font-medium">
                                  Wkts: <strong className="text-slate-800 dark:text-white">{bowlStats.wickets || 0}</strong> • Overs: <strong className="text-slate-800 dark:text-white">{bowlStats.overs || 0}</strong>
                                </div>
                              )}
                              {leaderboardCategory === "fielding" && (
                                <div className="text-slate-400 font-medium">
                                  Catches: <strong className="text-slate-800 dark:text-white">{p.careerStats?.fielding?.catches || 0}</strong> • Stump: <strong className="text-slate-800 dark:text-white">{p.careerStats?.fielding?.stumpings || 0}</strong>
                                </div>
                              )}
                            </td>
                            <td className="p-4 text-right pr-6 font-display font-black text-sm text-slate-800 dark:text-white">
                              {stat.val}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
