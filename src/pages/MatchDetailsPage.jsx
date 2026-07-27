import React, { useState, useEffect } from "react";
import { ArrowLeft, MapPin, Calendar, Clock, Trophy, Award, Shield, User, Info, Radio } from "lucide-react";
import { subscribeMatch, subscribePlayers } from "../services/db";

export default function MatchDetailsPage({ matchId, onBack }) {
  const [match, setMatch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [scorecardTab, setScorecardTab] = useState("1"); // '1' | '2' for innings cards
  const [players, setPlayers] = useState([]);
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    const unsubMatch = subscribeMatch(matchId, (data) => {
      setMatch((prevMatch) => {
        // Default scorecard tab only on initial load
        if (!prevMatch && data) {
          setScorecardTab(data.currentInningsNo ? String(data.currentInningsNo) : "1");
        }
        return data;
      });
      setLoading(false);
    });

    const unsubPlayers = subscribePlayers((list) => {
      setPlayers(list);
    });

    return () => {
      unsubMatch();
      unsubPlayers();
    };
  }, [matchId]);

  // Countdown timer for upcoming matches
  useEffect(() => {
    if (!match || match.status !== "upcoming") return;

    const calculateTime = () => {
      const diff = new Date(match.date) - new Date();
      if (diff <= 0) {
        setTimeLeft("Starts shortly");
        return;
      }
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const mins = Math.floor((diff / (1000 * 60)) % 60);
      const secs = Math.floor((diff / 1000) % 60);
      
      if (hours > 24) {
        const days = Math.floor(hours / 24);
        setTimeLeft(`In ${days} day${days > 1 ? "s" : ""}`);
      } else {
        setTimeLeft(`${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`);
      }
    };

    calculateTime();
    const interval = setInterval(calculateTime, 1000);
    return () => clearInterval(interval);
  }, [match]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <p className="text-slate-500 dark:text-slate-400 text-sm">Loading match details...</p>
      </div>
    );
  }

  if (!match) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center animate-pop">
        <p className="text-slate-500 dark:text-slate-400 text-sm mb-4">Match not found.</p>
        <button onClick={onBack} className="text-teal-600 dark:text-teal-400 underline text-sm">
          Return to Matches
        </button>
      </div>
    );
  }

  // Common metadata elements
  const isLimited = match.oversMode === "limited";
  const limitOvers = match.totalOversLimit;

  // Calculate Extras breakdown from balls list
  const getExtrasBreakdown = (inns) => {
    if (!inns || !inns.balls) return { total: 0, w: 0, nb: 0, b: 0, lb: 0 };
    let w = 0, nb = 0, b = 0, lb = 0;
    inns.balls.forEach((ball) => {
      if (ball.extraType === "wide") w += (1 + (ball.runs || 0));
      else if (ball.extraType === "noball") nb += 1;
      else if (ball.extraType === "bye") b += (ball.runs || 0);
      else if (ball.extraType === "legbye") lb += (ball.runs || 0);
    });
    return { total: w + nb + b + lb, w, nb, b, lb };
  };

  const getLiveMatchStatusText = () => {
    const inn1 = match.innings["1"];
    const inn2 = match.innings["2"];
    const inn3 = match.innings["3"];
    const inn4 = match.innings["4"];
    const innNo = match.currentInningsNo;
    const inn = match.innings[String(innNo)];

    if (!inn1 || !inn) return "";

    if (innNo === 1) {
      return `${match.teamA.name} is batting first`;
    }

    if (innNo === 2 && inn1.isCompleted) {
      const diff = inn1.totalRuns - inn.totalRuns;
      const battingTeam = inn.battingTeamId === match.teamA.id ? match.teamA.name : match.teamB.name;
      if (diff > 0) return `${battingTeam} trails by ${diff} runs`;
      if (diff < 0) return `${battingTeam} leads by ${Math.abs(diff)} runs`;
      return "Scores level";
    }

    if (innNo === 3 && inn2?.isCompleted) {
      const team1Cumulative = inn1.totalRuns + inn.totalRuns;
      const team2Total = inn2.totalRuns;
      const diff = team2Total - team1Cumulative;
      const battingTeam = inn.battingTeamId === match.teamA.id ? match.teamA.name : match.teamB.name;
      if (diff > 0) return `${battingTeam} trails by ${diff} runs`;
      if (diff < 0) return `${battingTeam} leads by ${Math.abs(diff)} runs`;
      return "Scores level";
    }

    if (innNo === 4 && inn3?.isCompleted) {
      const team1Total = inn1.totalRuns + inn3.totalRuns;
      const team2Cumulative = (inn2?.totalRuns || 0) + inn.totalRuns;
      const diff = team1Total - team2Cumulative;
      const battingTeam = inn.battingTeamId === match.teamA.id ? match.teamA.name : match.teamB.name;
      if (diff > 0) return `${battingTeam} needs ${diff} runs to win`;
      if (diff < 0) return `${battingTeam} won the match`;
      return "Scores level";
    }

    return "";
  };

  const renderScorecard = () => {
    const showCard = match.innings[scorecardTab];
    if (!showCard) return null;

    const battingTeamName = showCard.battingTeamId === match.teamA.id ? match.teamA.name : match.teamB.name;
    const bowlingTeamName = showCard.bowlingTeamId === match.teamA.id ? match.teamA.name : match.teamB.name;

    const battingSquadIds = match.squads[showCard.battingTeamId === match.teamA.id ? "teamA" : "teamB"] || [];
    const battingSquad = players.filter(p => battingSquadIds.includes(p.id));

    const extras = getExtrasBreakdown(showCard);

    return (
      <div className="mt-8 animate-pop">
        {/* Scorecard Tab select */}
        <div className="flex flex-wrap border-b border-slate-200 dark:border-slate-800 mb-6">
          {Object.keys(match.innings || {}).sort((a, b) => Number(a) - Number(b)).map((innsNo) => {
            const innObj = match.innings[innsNo];
            const teamName = innObj.battingTeamId === match.teamA.id ? match.teamA.name : match.teamB.name;
            return (
              <button
                key={innsNo}
                onClick={() => setScorecardTab(innsNo)}
                className={`py-3 px-4 font-display font-bold text-sm border-b-2 tracking-wide uppercase mr-4 transition-all ${
                  scorecardTab === innsNo
                    ? "border-teal-600 dark:border-teal-400 text-teal-600 dark:text-teal-400"
                    : "border-transparent text-slate-400 hover:text-slate-700"
                }`}
              >
                {teamName} Inns {innsNo}
              </button>
            );
          })}
        </div>

        {/* Scorecard Table Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
          {/* Batting Card */}
          <div className="p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
            <h4 className="font-display font-extrabold text-sm uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Batting scorecard — {battingTeamName}
            </h4>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50/30 dark:bg-slate-900/20">
                  <th className="p-4 pl-6">Batsman</th>
                  <th className="p-4">Dismissal</th>
                  <th className="p-4 text-center">Runs</th>
                  <th className="p-4 text-center">Balls</th>
                  <th className="p-4 text-center">4s</th>
                  <th className="p-4 text-center">6s</th>
                  <th className="p-4 text-center pr-6">SR</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-semibold text-slate-700 dark:text-slate-300">
                {showCard.battingCard.map((b, idx) => {
                  const isLastManTag = showCard.lastManActive && !b.out;
                  const battingTeamKey = showCard.battingTeamId === match.teamA.id ? "teamA" : "teamB";
                  const playerMeta = match.squadDetails?.[battingTeamKey]?.[b.playerId];
                  const isReplacement = playerMeta && playerMeta.originalPlayerId !== b.playerId;
                  const isReplaced = playerMeta && playerMeta.matchStatus === "replaced";
                  const isRemoved = playerMeta && playerMeta.matchStatus === "removed";
                  return (
                    <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10">
                      <td className="p-4 pl-6 font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                        <span>{b.playerName}</span>
                        {isLastManTag && (
                          <span className="bg-amber-100 dark:bg-amber-950/40 border border-amber-500/20 text-amber-750 dark:text-amber-400 text-[8px] px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider animate-pulse">Last Man</span>
                        )}
                        {isReplacement && (
                          <span className="bg-purple-100 dark:bg-purple-950/40 border border-purple-500/20 text-purple-750 dark:text-purple-400 text-[8px] px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider">Sub In</span>
                        )}
                        {isReplaced && (
                          <span className="bg-amber-100 dark:bg-amber-950/40 border border-amber-500/20 text-amber-750 dark:text-amber-400 text-[8px] px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider">Sub Out</span>
                        )}
                        {isRemoved && (
                          <span className="bg-rose-100 dark:bg-rose-955/40 border border-rose-500/20 text-rose-700 dark:text-rose-455 text-[8px] px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider">Removed</span>
                        )}
                      </td>
                      <td className="p-4 text-slate-400 dark:text-slate-500 font-medium italic">
                        {b.out ? (
                          <span>
                            {b.dismissalType} {b.fielderName ? `c ${b.fielderName}` : ""} {b.bowlerName ? `b ${b.bowlerName}` : ""}
                          </span>
                        ) : (
                          <span className="text-teal-650 dark:text-teal-400 font-bold not-italic">not out</span>
                        )}
                      </td>
                      <td className="p-4 text-center font-bold text-slate-900 dark:text-white">{b.runs}</td>
                      <td className="p-4 text-center text-slate-505">{b.balls}</td>
                      <td className="p-4 text-center text-slate-505">{b.fours || 0}</td>
                      <td className="p-4 text-center text-slate-505">{b.sixes || 0}</td>
                      <td className="p-4 text-center text-slate-550 pr-6">
                        {b.balls > 0 ? ((b.runs / b.balls) * 100).toFixed(1) : "0.0"}
                      </td>
                    </tr>
                  );
                })}
                
                {/* Unbatted squad members */}
                {battingSquad.filter(p => !showCard.battingCard.some(bc => bc.playerId === p.id)).map((p, idx) => (
                  <tr key={`unbat-${idx}`} className="opacity-60">
                    <td className="p-4 pl-6 font-bold text-slate-505">{p.name}</td>
                    <td className="p-4 text-slate-400 font-medium italic">did not bat</td>
                    <td className="p-4 text-center">-</td>
                    <td className="p-4 text-center">-</td>
                    <td className="p-4 text-center">-</td>
                    <td className="p-4 text-center">-</td>
                    <td className="p-4 text-center pr-6">-</td>
                  </tr>
                ))}

                {/* Extras Row */}
                <tr className="bg-slate-50/50 dark:bg-slate-900/10 font-bold text-slate-800 dark:text-slate-200">
                  <td className="p-4 pl-6">Extras</td>
                  <td className="p-4 text-slate-400 dark:text-slate-500 font-normal italic">
                    (w {extras.w}, nb {extras.nb}, b {extras.b}, lb {extras.lb})
                  </td>
                  <td className="p-4 text-center font-extrabold">{extras.total}</td>
                  <td colSpan={4} className="p-4"></td>
                </tr>

                {/* Total Row */}
                <tr className="bg-slate-50 dark:bg-slate-900/30 font-black text-slate-900 dark:text-white text-sm">
                  <td className="p-4 pl-6">Total</td>
                  <td className="p-4 text-slate-400 dark:text-slate-505 font-normal">
                    ({showCard.wickets} wickets, {showCard.oversUsed} overs)
                  </td>
                  <td className="p-4 text-center font-black text-teal-650 dark:text-teal-400">
                    {showCard.totalRuns}
                  </td>
                  <td colSpan={4} className="p-4"></td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Bowling Card */}
          <div className="p-5 border-y border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 mt-4">
            <h4 className="font-display font-extrabold text-sm uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Bowling scorecard — {bowlingTeamName}
            </h4>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50/30 dark:bg-slate-900/20">
                  <th className="p-4 pl-6">Bowler</th>
                  <th className="p-4 text-center">Overs</th>
                  <th className="p-4 text-center">Maidens</th>
                  <th className="p-4 text-center">Runs</th>
                  <th className="p-4 text-center">Wickets</th>
                  <th className="p-4 text-center pr-6">Econ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-semibold text-slate-700 dark:text-slate-300">
                {showCard.bowlingCard.map((bowl, idx) => {
                  const oversInt = Math.floor(bowl.overs || 0);
                  const ballsRem = Math.round(((bowl.overs || 0) - oversInt) * 10);
                  const totalOversDec = oversInt + (ballsRem / 6);
                  const econ = totalOversDec > 0 ? parseFloat((bowl.runsConceded / totalOversDec).toFixed(2)) : "0.0";
                  const bowlingTeamKey = showCard.bowlingTeamId === match.teamA.id ? "teamA" : "teamB";
                  const playerMeta = match.squadDetails?.[bowlingTeamKey]?.[bowl.playerId];
                  const isReplacement = playerMeta && playerMeta.originalPlayerId !== bowl.playerId;
                  const isReplaced = playerMeta && playerMeta.matchStatus === "replaced";
                  const isRemoved = playerMeta && playerMeta.matchStatus === "removed";
                  return (
                    <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10">
                      <td className="p-4 pl-6 font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                        <span>{bowl.playerName}</span>
                        {isReplacement && (
                          <span className="bg-purple-100 dark:bg-purple-950/40 border border-purple-500/20 text-purple-755 dark:text-purple-400 text-[8px] px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider">Sub In</span>
                        )}
                        {isReplaced && (
                          <span className="bg-amber-100 dark:bg-amber-950/40 border border-amber-500/20 text-amber-755 dark:text-amber-400 text-[8px] px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider">Sub Out</span>
                        )}
                        {isRemoved && (
                          <span className="bg-rose-100 dark:bg-rose-955/40 border border-rose-500/20 text-rose-700 dark:text-rose-455 text-[8px] px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider">Removed</span>
                        )}
                      </td>
                      <td className="p-4 text-center font-bold text-slate-900 dark:text-white">{bowl.overs}</td>
                      <td className="p-4 text-center text-slate-505">{bowl.maidens || 0}</td>
                      <td className="p-4 text-center text-slate-505">{bowl.runsConceded}</td>
                      <td className="p-4 text-center font-bold text-teal-650 dark:text-teal-400">{bowl.wickets}</td>
                      <td className="p-4 text-center text-slate-505 pr-6">{econ}</td>
                    </tr>
                  );
                })}
                {showCard.bowlingCard.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-4 pl-6 text-slate-405 text-xs italic">No overs bowled yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Fall of Wickets Card */}
          {showCard.fallOfWickets && showCard.fallOfWickets.length > 0 && (
            <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50/20 dark:bg-slate-900/10">
              <h5 className="font-display font-extrabold text-[10px] uppercase tracking-widest text-slate-400 mb-3">
                Fall of Wickets
              </h5>
              <div className="flex flex-wrap gap-2 text-[11px] font-semibold text-slate-600 dark:text-slate-400 leading-relaxed">
                {showCard.fallOfWickets.map((w, idx) => (
                  <span key={idx} className="bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200/50 dark:border-slate-700/50">
                    <strong>{w.wicketNo}-{w.runs}</strong> ({w.batsmanName}, {w.over}.{w.ball} ov)
                    {idx < showCard.fallOfWickets.length - 1 && <span className="ml-2 text-slate-300 dark:text-slate-700">|</span>}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // -------------------------------------------------------------
  // LAYOUT 1: UPCOMING MATCH
  // -------------------------------------------------------------
  if (match.status === "upcoming") {
    const squadAPlayers = players.filter(p => match.squads.teamA.includes(p.id));
    const squadBPlayers = players.filter(p => match.squads.teamB.includes(p.id));

    return (
      <div className="max-w-4xl mx-auto px-4 py-8 animate-pop">
        {/* Back Button */}
        <button onClick={onBack} className="flex items-center space-x-2 text-slate-500 hover:text-slate-900 dark:hover:text-white font-medium text-sm mb-6 transition-all">
          <ArrowLeft size={16} />
          <span>Back to Matches</span>
        </button>

        {/* Hero Card */}
        <div className="bg-gradient-to-r from-teal-800 to-slate-950 dark:from-slate-900 dark:to-slate-950 border border-slate-800 rounded-3xl p-6 sm:p-10 text-white shadow-xl mb-8 relative text-center">
          <div className="absolute top-0 right-0 w-48 h-48 bg-teal-500/10 rounded-full blur-3xl pointer-events-none"></div>
          
          <span className="inline-flex items-center space-x-1.5 bg-teal-500/15 border border-teal-500/30 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider text-teal-300 mb-4">
            <Clock size={13} />
            <span>Countdown to Start</span>
          </span>

          <h2 className="font-display font-black text-3xl sm:text-5xl tracking-tight text-white mb-3">
            {timeLeft}
          </h2>
          <h3 className="font-display font-bold text-lg text-slate-200 mt-2">{match.name}</h3>
          
          <div className="flex flex-col sm:flex-row items-center justify-center space-y-2 sm:space-y-0 sm:space-x-6 text-xs text-slate-400 mt-4 font-semibold uppercase tracking-wider">
            <span className="flex items-center space-x-1"><MapPin size={13} className="text-teal-400" /> <span>{match.venue}</span></span>
            <span className="hidden sm:inline w-1 h-1 bg-slate-700 rounded-full"></span>
            <span className="flex items-center space-x-1"><Calendar size={13} className="text-teal-400" /> <span>{new Date(match.date).toLocaleDateString()}</span></span>
          </div>

          <div className="mt-6 pt-6 border-t border-slate-800 text-xs text-slate-400 font-semibold uppercase tracking-wider">
            Format: {isLimited ? `${limitOvers} Overs Tournament Match` : "Unlimited Test Match"}
          </div>
        </div>

        {/* Squad lists */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm">
          {/* Team A playing XI */}
          <div>
            <h4 className="font-display font-extrabold text-sm text-slate-800 dark:text-slate-200 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 pb-2 mb-4 flex items-center space-x-2">
              <Shield size={16} className="text-teal-500" />
              <span>{match.teamA.name} Recruits ({squadAPlayers.length})</span>
            </h4>
            <div className="space-y-2.5">
              {squadAPlayers.map((p) => (
                <div key={p.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-900 rounded-xl text-xs font-semibold animate-pop">
                  <div className="flex items-center space-x-2">
                    <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] flex items-center justify-center uppercase font-bold">{(p.name || "").charAt(0)}</div>
                    <span className="text-slate-800 dark:text-slate-200">{p.name}</span>
                    {match.squads.teamB.includes(p.id) && (
                      <span className="bg-purple-100 dark:bg-purple-950/40 border border-purple-500/20 text-purple-700 dark:text-purple-400 text-[8px] px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider">Common</span>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400 uppercase">{p.role}</span>
                </div>
              ))}
              {squadAPlayers.length === 0 && <p className="text-slate-400 text-xs italic">Squad not yet recruited.</p>}
            </div>
          </div>

          {/* Team B playing XI */}
          <div>
            <h4 className="font-display font-extrabold text-sm text-slate-800 dark:text-slate-200 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 pb-2 mb-4 flex items-center space-x-2">
              <Shield size={16} className="text-teal-500" />
              <span>{match.teamB.name} Recruits ({squadBPlayers.length})</span>
            </h4>
            <div className="space-y-2.5">
              {squadBPlayers.map((p) => (
                <div key={p.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-900 rounded-xl text-xs font-semibold animate-pop">
                  <div className="flex items-center space-x-2">
                    <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] flex items-center justify-center uppercase font-bold">{(p.name || "").charAt(0)}</div>
                    <span className="text-slate-800 dark:text-slate-200">{p.name}</span>
                    {match.squads.teamA.includes(p.id) && (
                      <span className="bg-purple-100 dark:bg-purple-950/40 border border-purple-500/20 text-purple-700 dark:text-purple-400 text-[8px] px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider">Common</span>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400 uppercase">{p.role}</span>
                </div>
              ))}
              {squadBPlayers.length === 0 && <p className="text-slate-400 text-xs italic">Squad not yet recruited.</p>}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // LAYOUT 2: LIVE MATCH VIEW
  // -------------------------------------------------------------
  if (match.status === "live") {
    const innNo = match.currentInningsNo;
    const inn = match.innings[innNo];
    if (!inn) return null;

    const battingTeamKey = inn.battingTeamId === match.teamA.id ? "teamA" : "teamB";
    const bowlingTeamKey = inn.bowlingTeamId === match.teamA.id ? "teamA" : "teamB";

    const striker = inn.battingCard.find(c => c.playerId === inn.currentStrikerId);
    const nonStriker = inn.battingCard.find(c => c.playerId === inn.currentNonStrikerId);
    const bowler = inn.bowlingCard.find(c => c.playerId === inn.currentBowlerId);

    let targetRuns = null;
    let reqRuns = null;
    let ballsRemaining = null;
    let reqRate = null;
    
    if (innNo === 4) {
      const team1Total = (match.innings["1"]?.totalRuns || 0) + (match.innings["3"]?.totalRuns || 0);
      const team2Innings2Runs = match.innings["2"]?.totalRuns || 0;
      targetRuns = team1Total - team2Innings2Runs + 1;
      reqRuns = targetRuns - inn.totalRuns;
      
      if (inn.oversAvailable) {
        const oversUsedInt = Math.floor(inn.oversUsed);
        const oversUsedBalls = Math.round((inn.oversUsed - oversUsedInt) * 10);
        const totalUsedBalls = oversUsedInt * 6 + oversUsedBalls;
        ballsRemaining = (inn.oversAvailable * 6) - totalUsedBalls;
        reqRate = ballsRemaining > 0 ? parseFloat(((reqRuns / ballsRemaining) * 6).toFixed(2)) : 0;
      }
    }

    const runRate = inn.oversUsed > 0 ? parseFloat((inn.totalRuns / (Math.floor(inn.oversUsed) + (inn.oversUsed % 1) * (10 / 6))).toFixed(2)) : 0;

    // Remaining Match Overs (Shared Pool)
    let oversRemaining = null;
    if (isLimited && limitOvers) {
      const remainingVal = match.oversPoolRemaining !== undefined && match.oversPoolRemaining !== null
        ? match.oversPoolRemaining
        : limitOvers - Object.values(match.innings || {}).reduce((acc, curr) => acc + (curr.isCompleted ? curr.fullOversCompleted : 0), 0);
      
      const oversRemInt = Math.floor(remainingVal);
      const ballsRem = Math.round((remainingVal - oversRemInt) * 10);
      oversRemaining = ballsRem === 6 ? `${oversRemInt + 1}.0` : `${oversRemInt}.${ballsRem}`;
    }

    return (
      <div className="max-w-4xl mx-auto px-4 py-8 animate-pop">
        {/* Back Button */}
        <button onClick={onBack} className="flex items-center space-x-2 text-slate-500 hover:text-slate-900 dark:hover:text-white font-medium text-sm mb-6 transition-all">
          <ArrowLeft size={16} />
          <span>Back to Matches</span>
        </button>

        {/* Live Banner Alert */}
        <div className="bg-rose-600 text-white px-5 py-3 rounded-2xl flex items-center justify-between text-xs font-bold uppercase tracking-wider mb-6 shadow-md shadow-rose-600/10">
          <span className="flex items-center space-x-1.5">
            <Radio size={14} className="animate-pulse" />
            <span>Match is currently active</span>
          </span>
          <span className="text-[10px] font-black tracking-widest bg-white/10 px-2.5 py-1 rounded-md">Real-Time Updates</span>
        </div>

        {/* Large Score Grid */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Batting Now</p>
              <h3 className="font-display font-black text-slate-800 dark:text-white text-lg sm:text-2xl mt-1">
                {battingTeamKey === "teamA" ? match.teamA.name : match.teamB.name}
              </h3>
              <div className="font-display font-black text-4xl sm:text-5xl text-slate-900 dark:text-white tracking-tight mt-2 flex items-baseline">
                {inn.totalRuns}/{inn.wickets}
                <span className="text-sm font-normal text-slate-400 dark:text-slate-500 ml-3">
                  Inns {innNo} ({inn.oversUsed} ov)
                </span>
              </div>
            </div>

            <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-center border-t sm:border-t-0 border-slate-100 dark:border-slate-800/80 pt-4 sm:pt-0">
              <div className="text-left sm:text-right mr-6 sm:mr-0 sm:mb-4">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest block">Run Rate (RR)</span>
                <span className="font-display font-black text-lg text-slate-800 dark:text-white">{runRate}</span>
              </div>

              {isLimited && oversRemaining && (
                <div className="text-right">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest block">Overs Remaining</span>
                  <span className="font-display font-black text-lg text-rose-500">{oversRemaining} <span className="text-xs text-slate-400 font-normal">(of {limitOvers})</span></span>
                </div>
              )}
            </div>
          </div>

          {/* Innings 4 Target message */}
          {innNo === 4 && targetRuns && (
            <div className="mt-6 p-4 bg-teal-50/40 dark:bg-teal-950/20 border border-teal-500/10 rounded-2xl flex flex-col sm:flex-row sm:items-center sm:justify-between text-xs gap-2">
              <span className="font-bold text-teal-800 dark:text-teal-400 uppercase tracking-wider">Target score: {targetRuns} Runs</span>
              <span className="text-slate-500 dark:text-slate-400 font-medium">
                Need <strong className="text-teal-600 dark:text-teal-400">{reqRuns}</strong> runs off <strong className="text-teal-600 dark:text-teal-400">{ballsRemaining}</strong> balls (Required Rate: <strong className="text-teal-600 dark:text-teal-400">{reqRate}</strong>)
              </span>
            </div>
          )}

          {/* Over Tally display */}
          <div className="mt-8 pt-5 border-t border-slate-100 dark:border-slate-800">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">This Over:</span>
            <div className="flex items-center space-x-2 mt-2.5 overflow-x-auto pb-1">
              {inn.thisOverBalls.map((symbol, idx) => (
                <div
                  key={idx}
                  className={`w-9 h-9 rounded-full flex items-center justify-center font-display font-extrabold text-xs shrink-0 border ${
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

        {/* Dynamic Match Status Banner */}
        {innNo >= 2 && (
          <div className="bg-sky-50/50 dark:bg-sky-950/20 border border-sky-100 dark:border-sky-900/50 rounded-2xl p-4 flex items-center justify-between text-xs mb-6 animate-pop">
            <span className="font-semibold text-sky-850 dark:text-sky-400">Match Status:</span>
            <span className="text-sky-750 dark:text-sky-450 font-extrabold tracking-wide uppercase">
              {getLiveMatchStatusText()}
            </span>
          </div>
        )}

        {/* Live Strikers and Bowler detail Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Batsmen cards */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm md:col-span-2 space-y-4">
            <h5 className="font-display font-extrabold text-xs uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-slate-800 pb-2 mb-4">
              Batting Crease
            </h5>
            
            {/* Striker */}
            <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-900 rounded-2xl">
              <div>
                <div className="font-display font-bold text-slate-800 dark:text-white flex items-center space-x-1.5">
                  <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse"></span>
                  <span>{striker?.playerName || "Selecting striker..."}</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">Striker</div>
              </div>
              <div className="flex space-x-4 text-xs font-semibold text-slate-800 dark:text-slate-200">
                <div>Runs: <strong className="text-base">{striker?.runs ?? 0}</strong></div>
                <div>Balls: <strong>{striker?.balls ?? 0}</strong></div>
                <div>SR: <strong>{striker?.balls > 0 ? ((striker.runs / striker.balls) * 100).toFixed(1) : "0.0"}</strong></div>
              </div>
            </div>

            {/* Non-Striker / Last Man solo batting */}
            {inn.lastManActive ? (
              <div className="flex items-center justify-center p-3 bg-amber-50/20 dark:bg-amber-950/10 border border-dashed border-amber-500/20 rounded-2xl text-center">
                <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider flex items-center space-x-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                  <span>Last Man Active (Solo Batting)</span>
                </span>
              </div>
            ) : (
              <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-900 rounded-2xl">
                <div>
                  <div className="font-display font-bold text-slate-650 dark:text-slate-300 pl-3.5">
                    {nonStriker?.playerName || "Selecting non-striker..."}
                  </div>
                  <div className="text-[10px] text-slate-400 pl-3.5 mt-0.5">Non-Striker</div>
                </div>
                <div className="flex space-x-4 text-xs font-semibold text-slate-500 dark:text-slate-400">
                  <div>Runs: <strong>{nonStriker?.runs ?? 0}</strong></div>
                  <div>Balls: <strong>{nonStriker?.balls ?? 0}</strong></div>
                  <div>SR: <strong>{nonStriker?.balls > 0 ? ((nonStriker.runs / nonStriker.balls) * 100).toFixed(1) : "0.0"}</strong></div>
                </div>
              </div>
            )}
          </div>

          {/* Bowler Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm flex flex-col justify-between">
            <h5 className="font-display font-extrabold text-xs uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-slate-800 pb-2 mb-4">
              Bowling Spell
            </h5>
            {bowler ? (
              <div className="space-y-3 flex-1 flex flex-col justify-center">
                <div className="font-display font-bold text-slate-800 dark:text-white text-center text-base">
                  {bowler.playerName}
                </div>
                <div className="grid grid-cols-4 gap-2 text-center text-xs pt-3 border-t border-slate-100 dark:border-slate-800">
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
              <div className="py-6 border border-dashed border-slate-200 dark:border-slate-800 text-slate-400 text-xs italic rounded-xl text-center">
                Selecting bowler for this over...
              </div>
            )}
          </div>
        </div>

        {/* Live Scorecards */}
        {renderScorecard()}
      </div>
    );
  }

  // -------------------------------------------------------------
  // LAYOUT 3: FINISHED MATCH VIEW (SCORECARD & MOTM)
  // -------------------------------------------------------------
  if (match.status === "finished") {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 animate-pop">
        {/* Back Button */}
        <button onClick={onBack} className="flex items-center space-x-2 text-slate-500 hover:text-slate-900 dark:hover:text-white font-medium text-sm mb-6 transition-all">
          <ArrowLeft size={16} />
          <span>Back to Matches</span>
        </button>

        {/* Finished Result Banner */}
        <div className="bg-gradient-to-r from-teal-800 to-slate-950 dark:from-slate-900 dark:to-slate-950 border border-slate-800 rounded-3xl p-6 sm:p-8 text-white shadow-xl mb-8 relative text-center">
          <div className="absolute top-0 right-0 w-32 h-32 bg-teal-500/10 rounded-full blur-2xl"></div>
          
          <span className="inline-flex items-center space-x-1.5 bg-teal-500/15 border border-teal-500/30 px-3.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider text-teal-400 mb-3">
            <Trophy size={13} />
            <span>Match Completed</span>
          </span>

          <h2 className="font-display font-black text-2xl sm:text-3xl tracking-tight text-white mb-2">
            {match.result ? `${match.result.winnerName} won by ${match.result.margin}` : "Match Drawn"}
          </h2>
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mt-1">{match.name} • {match.venue}</p>

          <div className="mt-6 flex justify-center space-x-8 text-xs font-semibold text-slate-400 border-t border-slate-800 pt-5">
            <div>
              {match.teamA.name}: <span className="text-white text-sm font-bold ml-1">{match.scores.teamA.runs}/{match.scores.teamA.wickets}</span> ({match.scores.teamA.overs} ov)
            </div>
            <div>
              {match.teamB.name}: <span className="text-white text-sm font-bold ml-1">{match.scores.teamB.runs}/{match.scores.teamB.wickets}</span> ({match.scores.teamB.overs} ov)
            </div>
          </div>
        </div>

        {/* Man of the Match Highlight Card */}
        {match.manOfTheMatch && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm mb-8 flex items-start space-x-4 animate-pop">
            <div className="w-12 h-12 bg-amber-500/10 text-amber-500 rounded-2xl flex items-center justify-center shrink-0">
              <Award size={24} />
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Man of the Match</span>
              <h4 className="font-display font-black text-slate-800 dark:text-white text-base mt-0.5">
                {match.manOfTheMatch.name}
              </h4>
              <p className="text-slate-500 dark:text-slate-400 text-xs mt-1.5 leading-normal">
                {match.manOfTheMatch.reason}
              </p>
            </div>
          </div>
        )}

        {/* Scorecards */}
        {renderScorecard()}
      </div>
    );
  }

  return null;
}
