import React, { useState, useEffect } from "react";
import { Calendar, MapPin, Radio, Clock, Shield, ChevronRight } from "lucide-react";
import { subscribeMatches } from "../services/db";

export default function MatchesPage({ onSelectMatch }) {
  const [matches, setMatches] = useState([]);
  const [activeTab, setActiveTab] = useState("all"); // 'all' | 'live' | 'upcoming' | 'finished'

  useEffect(() => {
    const unsub = subscribeMatches((list) => {
      setMatches(list);
    });
    return () => unsub();
  }, []);

  const live = matches.filter(m => m.status === "live");
  const upcoming = matches.filter(m => m.status === "upcoming");
  const finished = matches.filter(m => m.status === "finished");

  const getFilteredMatches = () => {
    if (activeTab === "live") return live;
    if (activeTab === "upcoming") return upcoming;
    if (activeTab === "finished") return finished;
    return matches;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 animate-pop">
      {/* Page Header */}
      <div className="mb-8">
        <h2 className="font-display font-extrabold text-2xl sm:text-3xl text-slate-900 dark:text-white tracking-tight">
          Match Center
        </h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
          Follow live ball-by-ball updates, countdowns to upcoming fixtures, and review completed scorecards.
        </p>
      </div>

      {/* Tickers & Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 mb-8 overflow-x-auto whitespace-nowrap pb-px">
        {[
          { id: "all", label: "All Matches", count: matches.length },
          { id: "live", label: "Live", count: live.length, badge: live.length > 0 },
          { id: "upcoming", label: "Upcoming", count: upcoming.length },
          { id: "finished", label: "Completed", count: finished.length }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`py-3.5 px-4 font-display font-bold text-sm border-b-2 tracking-wide uppercase mr-6 transition-all ${
              activeTab === tab.id
                ? "border-teal-600 dark:border-teal-400 text-teal-600 dark:text-teal-400 font-extrabold"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            <span>{tab.label}</span>
            <span className={`ml-2 text-xs font-semibold px-2 py-0.5 rounded-full ${
              activeTab === tab.id
                ? (tab.badge ? "bg-red-500 text-white animate-pulse" : "bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400")
                : "bg-slate-100 dark:bg-slate-800 text-slate-500"
            }`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Grid of Matches */}
      {getFilteredMatches().length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl">
          <p className="text-slate-500 dark:text-slate-400 text-sm">No matches found in this category.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {getFilteredMatches().map((m) => (
            <MatchCard key={m.id} match={m} onClick={() => onSelectMatch(m.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

// Single Match Card with countdown timer / live score
function MatchCard({ match, onClick }) {
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    if (match.status !== "upcoming") return;

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
  }, [match.date, match.status]);

  const teamA_score = match.scores?.teamA;
  const teamB_score = match.scores?.teamB;

  return (
    <div
      onClick={onClick}
      className={`bg-white dark:bg-slate-900 border hover:border-teal-500/50 dark:hover:border-teal-400/50 rounded-3xl p-5 shadow-sm hover:shadow-md cursor-pointer transition-all duration-300 transform hover:-translate-y-0.5 group flex flex-col justify-between ${
        match.status === "live" ? "border-rose-500/30 ring-1 ring-rose-500/10 dark:ring-rose-400/10" : "border-slate-200 dark:border-slate-800"
      }`}
    >
      <div>
        {/* Card Header Status */}
        <div className="flex items-center justify-between mb-4">
          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider flex items-center space-x-1">
            <Calendar size={12} className="mr-1" />
            <span>{new Date(match.date).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
          </span>

          {match.status === "live" && (
            <span className="flex items-center space-x-1 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 px-2 py-0.5 rounded-full text-[9px] font-black uppercase text-rose-500 animate-pulse tracking-widest">
              <span className="w-1 h-1 rounded-full bg-rose-500"></span>
              <span>LIVE</span>
            </span>
          )}

          {match.status === "upcoming" && (
            <span className="flex items-center space-x-1 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-full text-[10px] font-bold text-slate-600 dark:text-slate-400">
              <Clock size={11} className="mr-0.5 text-slate-400" />
              <span className="font-mono">{timeLeft}</span>
            </span>
          )}

          {match.status === "finished" && (
            <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full text-[9px] font-bold text-slate-500 uppercase tracking-widest">
              Result
            </span>
          )}
        </div>

        {/* Match Name & Venue */}
        <h3 className="font-display font-extrabold text-base text-slate-900 dark:text-white truncate group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
          {match.name}
        </h3>
        <p className="text-slate-400 text-xs mt-1 flex items-center space-x-1">
          <MapPin size={11} className="shrink-0" />
          <span className="truncate">{match.venue}</span>
        </p>

        {/* Scores details based on state */}
        <div className="mt-5 border-t border-slate-100 dark:border-slate-800/80 pt-4">
          {match.status === "upcoming" ? (
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center space-x-2">
                <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-500 flex items-center justify-center">A</div>
                <span className="font-semibold text-slate-700 dark:text-slate-300">{match.teamA.name}</span>
              </div>
              <span className="text-xs text-slate-400 font-bold">VS</span>
              <div className="flex items-center space-x-2">
                <span className="font-semibold text-slate-700 dark:text-slate-300">{match.teamB.name}</span>
                <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-500 flex items-center justify-center">B</div>
              </div>
            </div>
          ) : (
            <div className="space-y-2.5">
              {/* Team A score row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-sm">
                  <Shield size={14} className="text-slate-400 shrink-0" />
                  <span className={`font-semibold ${
                    match.status === "live" && match.innings?.[match.currentInningsNo]?.battingTeamId === match.teamA.id
                      ? "text-teal-600 dark:text-teal-400" : "text-slate-700 dark:text-slate-300"
                  }`}>
                    {match.teamA.name}
                  </span>
                  {match.status === "live" && match.innings?.[match.currentInningsNo]?.battingTeamId === match.teamA.id && (
                    <span className="w-1.5 h-1.5 bg-teal-500 rounded-full animate-ping"></span>
                  )}
                </div>
                <div className="font-display font-extrabold text-sm text-slate-800 dark:text-slate-200">
                  {teamA_score?.runs}/{teamA_score?.wickets}
                  <span className="text-xs font-normal text-slate-400 ml-1">({teamA_score?.overs} ov)</span>
                </div>
              </div>

              {/* Team B score row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-sm">
                  <Shield size={14} className="text-slate-400 shrink-0" />
                  <span className={`font-semibold ${
                    match.status === "live" && match.innings?.[match.currentInningsNo]?.battingTeamId === match.teamB.id
                      ? "text-teal-600 dark:text-teal-400" : "text-slate-700 dark:text-slate-300"
                  }`}>
                    {match.teamB.name}
                  </span>
                  {match.status === "live" && match.innings?.[match.currentInningsNo]?.battingTeamId === match.teamB.id && (
                    <span className="w-1.5 h-1.5 bg-teal-500 rounded-full animate-ping"></span>
                  )}
                </div>
                <div className="font-display font-extrabold text-sm text-slate-800 dark:text-slate-200">
                  {teamB_score?.runs}/{teamB_score?.wickets}
                  <span className="text-xs font-normal text-slate-400 ml-1">({teamB_score?.overs} ov)</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer result line or countdown info */}
      <div className="mt-5 pt-3.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs">
        {match.status === "finished" && match.result ? (
          <span className="font-bold text-teal-600 dark:text-teal-400">
            {match.result.winnerName} won by {match.result.margin}
          </span>
        ) : match.status === "finished" ? (
          <span className="font-bold text-slate-500">Match Drawn</span>
        ) : match.status === "live" ? (
          <span className="font-semibold text-rose-500 flex items-center space-x-1">
            <Radio size={12} className="animate-pulse" />
            <span>Scorecard updates in real-time</span>
          </span>
        ) : (
          <span className="font-semibold text-slate-500">
            Format: {match.oversMode === "limited" ? `${match.totalOversLimit} Overs Match` : "Unlimited Test"}
          </span>
        )}

        <ChevronRight size={14} className="text-slate-300 group-hover:text-teal-500 group-hover:translate-x-0.5 transition-all" />
      </div>
    </div>
  );
}
