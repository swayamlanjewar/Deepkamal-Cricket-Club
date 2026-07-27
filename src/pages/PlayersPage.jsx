import React, { useState, useEffect } from "react";
import { Search, Shield, Trophy, Award, Heart, ArrowLeft, Star, ChevronDown, RefreshCw, AlertCircle } from "lucide-react";
import { subscribePlayers, subscribeTeams } from "../services/db";
import { isConfigValid } from "../lib/firebase";

export default function PlayersPage() {
  const [players, setPlayers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Search and filters
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [teamFilter, setTeamFilter] = useState("all");

  // Profile tabs
  const [profileTab, setProfileTab] = useState("batting");

  useEffect(() => {
    const unsubPlayers = subscribePlayers((list) => {
      setPlayers(list);
    });
    const unsubTeams = subscribeTeams((list) => {
      setTeams(list);
    });

    return () => {
      unsubPlayers();
      unsubTeams();
    };
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    // Trigger a manual refresh by re-subscribing
    const unsubPlayers = subscribePlayers((list) => {
      setPlayers(list);
    });
    const unsubTeams = subscribeTeams((list) => {
      setTeams(list);
    });
    
    // Cleanup after a short delay
    setTimeout(() => {
      unsubPlayers();
      unsubTeams();
      setIsRefreshing(false);
    }, 1000);
  };

  // Filtered players
  const filteredPlayers = players.filter((player) => {
    const matchesSearch = (player.name || "").toLowerCase().includes(search.toLowerCase());
    const matchesRole = roleFilter === "all" || player.role === roleFilter;
    const matchesTeam = teamFilter === "all" || player.teamId === teamFilter;
    return matchesSearch && matchesRole && matchesTeam;
  });

  const getRoleBadgeColor = (role) => {
    switch (role) {
      case "batsman": return "bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400 border-blue-200 dark:border-blue-900/50";
      case "bowler": return "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/50";
      case "all-rounder": return "bg-purple-50 text-purple-700 dark:bg-purple-950/30 dark:text-purple-400 border-purple-200 dark:border-purple-900/50";
      case "wicketkeeper": return "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 border-amber-200 dark:border-amber-900/50";
      default: return "bg-slate-50 text-slate-700 border-slate-200";
    }
  };

  // Switch back to list
  if (selectedPlayer) {
    const p = selectedPlayer;
    const stats = p.careerStats || {
      batting: {}, bowling: {}, fielding: {}
    };

    return (
      <div className="max-w-5xl mx-auto px-4 py-8 animate-pop">
        {/* Back Button */}
        <button
          onClick={() => setSelectedPlayer(null)}
          className="flex items-center space-x-2 text-slate-500 hover:text-slate-900 dark:hover:text-white font-medium text-sm mb-6 transition-all"
        >
          <ArrowLeft size={16} />
          <span>Back to Player Directory</span>
        </button>

        {/* Profile Card Header */}
        <div className="bg-gradient-to-r from-teal-800 to-slate-950 dark:from-slate-900 dark:to-slate-950 border border-slate-800 rounded-3xl p-6 sm:p-8 text-white shadow-xl mb-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-teal-500/10 rounded-full blur-3xl pointer-events-none"></div>
          
          <div className="flex flex-col sm:flex-row items-center space-y-4 sm:space-y-0 sm:space-x-6 relative z-10 text-center sm:text-left">
            {/* Avatar */}
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-slate-800 border-4 border-slate-700 flex items-center justify-center font-display text-4xl font-extrabold text-teal-400 uppercase">
              {(p.name || "").charAt(0)}
            </div>
            
            <div className="flex-1">
              <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-3 justify-center sm:justify-start">
                <h2 className="font-display font-extrabold text-2xl sm:text-3xl tracking-tight">
                  {p.name}
                </h2>
                <span className={`inline-block border text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full text-white bg-teal-600/30 border-teal-500/50`}>
                  {p.role}
                </span>
              </div>

              <p className="text-slate-300 font-medium text-sm mt-1 flex items-center justify-center sm:justify-start space-x-1.5">
                <Shield size={14} className="text-teal-400" />
                <span>{p.teamName || "Unassigned"}</span>
              </p>
              
              <div className="mt-4 flex items-center justify-center sm:justify-start space-x-6 text-xs text-slate-400">
                <div>
                  <span className="text-white font-bold text-lg">{stats.batting.runs || 0}</span> Runs
                </div>
                <div className="w-px h-8 bg-slate-800"></div>
                <div>
                  <span className="text-white font-bold text-lg">{stats.bowling.wickets || 0}</span> Wickets
                </div>
                <div className="w-px h-8 bg-slate-800"></div>
                <div>
                  <span className="text-white font-bold text-lg">{stats.batting.matches || 0}</span> Matches
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ESPNcricinfo-Style Stats Dashboard */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-lg transition-all duration-300">
          {/* Tabs */}
          <div className="flex border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
            {["batting", "bowling", "fielding"].map((tab) => (
              <button
                key={tab}
                onClick={() => setProfileTab(tab)}
                className={`flex-1 py-4 text-center font-display font-bold text-sm tracking-wide border-b-2 transition-all uppercase ${
                  profileTab === tab
                    ? "border-teal-600 dark:border-teal-400 text-teal-600 dark:text-teal-400 bg-white dark:bg-slate-900"
                    : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100/50 dark:hover:bg-slate-800/30"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="p-6">
            {/* Batting Tab Content */}
            {profileTab === "batting" && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[
                    { label: "Matches", value: stats.batting.matches || 0 },
                    { label: "Innings", value: stats.batting.innings || 0 },
                    { label: "Not Outs (NO)", value: stats.batting.notOuts || 0 },
                    { label: "Runs Scored", value: stats.batting.runs || 0 },
                    { label: "Highest Score", value: stats.batting.highestScore || 0 },
                    { label: "Batting Avg", value: stats.batting.average !== undefined ? stats.batting.average : "-" },
                    { label: "Balls Faced", value: stats.batting.ballsFaced || 0 },
                    { label: "Strike Rate (SR)", value: stats.batting.strikeRate !== undefined ? stats.batting.strikeRate : "-" }
                  ].map((stat, idx) => (
                    <div key={idx} className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-900 rounded-2xl">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{stat.label}</p>
                      <p className="text-xl sm:text-2xl font-display font-extrabold text-slate-800 dark:text-white mt-1">{stat.value}</p>
                    </div>
                  ))}
                </div>

                <div className="border-t border-slate-100 dark:border-slate-800 pt-6">
                  <h4 className="font-display font-bold text-sm uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-4">
                    Milestones & Boundaries
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                    {[
                      { label: "Hundreds (100s)", value: stats.batting.hundreds || 0 },
                      { label: "Fifties (50s)", value: stats.batting.fifties || 0 },
                      { label: "Fours (4s)", value: stats.batting.fours || 0 },
                      { label: "Sixes (6s)", value: stats.batting.sixes || 0 },
                      { label: "Ducks", value: stats.batting.ducks || 0 }
                    ].map((stat, idx) => (
                      <div key={idx} className="p-4 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-center">
                        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{stat.label}</p>
                        <p className="text-xl font-display font-extrabold text-slate-800 dark:text-white mt-1">{stat.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Bowling Tab Content */}
            {profileTab === "bowling" && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[
                    { label: "Matches", value: stats.bowling.matches || 0 },
                    { label: "Innings", value: stats.bowling.innings || 0 },
                    { label: "Overs Bowled", value: stats.bowling.overs || 0 },
                    { label: "Maidens", value: stats.bowling.maidens || 0 },
                    { label: "Runs Conceded", value: stats.bowling.runsConceded || 0 },
                    { label: "Wickets", value: stats.bowling.wickets || 0 },
                    { label: "Bowling Avg", value: stats.bowling.average !== undefined ? stats.bowling.average : "-" },
                    { label: "Economy (Econ)", value: stats.bowling.economy !== undefined ? stats.bowling.economy : "-" }
                  ].map((stat, idx) => (
                    <div key={idx} className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-900 rounded-2xl">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{stat.label}</p>
                      <p className="text-xl sm:text-2xl font-display font-extrabold text-slate-800 dark:text-white mt-1">{stat.value}</p>
                    </div>
                  ))}
                </div>

                <div className="border-t border-slate-100 dark:border-slate-800 pt-6">
                  <h4 className="font-display font-bold text-sm uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-4">
                    Additional Stats
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {[
                      { label: "Best Bowling (Inns)", value: stats.bowling.bestBowlingWickets !== undefined ? `${stats.bowling.bestBowlingWickets}/${stats.bowling.bestBowlingRuns}` : "-" },
                      { label: "Bowling Strike Rate", value: stats.bowling.strikeRate !== undefined ? stats.bowling.strikeRate : "-" },
                      { label: "5-Wicket Hauls", value: stats.bowling.fiveWickets || 0 },
                      { label: "10-Wicket Match", value: stats.bowling.tenWicketsMatch || 0 }
                    ].map((stat, idx) => (
                      <div key={idx} className="p-4 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-center">
                        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{stat.label}</p>
                        <p className="text-xl font-display font-extrabold text-slate-800 dark:text-white mt-1">{stat.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Fielding Tab Content */}
            {profileTab === "fielding" && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                {[
                  { label: "Catches Taken", value: stats.fielding.catches || 0, desc: "Successful catches in the field" },
                  { label: "Stumpings", value: stats.fielding.stumpings || 0, desc: "Wicketkeeper stumpings" },
                  { label: "Run Outs", value: stats.fielding.runOuts || 0, desc: "Direct hit and assisted run outs" }
                ].map((stat, idx) => (
                  <div key={idx} className="p-6 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-900 rounded-2xl text-center">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">{stat.label}</p>
                    <p className="text-3xl font-display font-extrabold text-slate-800 dark:text-white mt-2">{stat.value}</p>
                    <p className="text-[11px] text-slate-400 mt-2">{stat.desc}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 animate-pop">
      {/* Sync Status Banner - Show if using mock database */}
      {!isConfigValid && (
        <div className="flex items-start space-x-3 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-2xl text-amber-700 dark:text-amber-400 mb-6">
          <AlertCircle size={18} className="shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-sm">Using Local Storage (No Cross-Device Sync)</p>
            <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">
              Players registered on this device only appear here. To sync players across devices/browsers, configure Firebase in your .env file. 
              <a href="#" className="underline ml-1">Learn how →</a>
            </p>
          </div>
        </div>
      )}

      {/* Title & Stats Summary Banner */}
      <div className="mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-4 sm:space-y-0">
        <div>
          <h2 className="font-display font-extrabold text-2xl sm:text-3xl text-slate-900 dark:text-white tracking-tight">
            Player Directory
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Browse through all {players.length} registered players and check their ESPNcricinfo-style career stats.
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="flex items-center space-x-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-400 text-white font-semibold rounded-xl text-sm transition-all active:scale-95"
        >
          <RefreshCw size={16} className={isRefreshing ? "animate-spin" : ""} />
          <span>{isRefreshing ? "Syncing..." : "Refresh Players"}</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 mb-8 shadow-sm transition-all duration-300">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3.5 top-3.5 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Search player name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm transition-all"
            />
          </div>

          {/* Role Filter */}
          <div className="relative">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm transition-all appearance-none cursor-pointer font-medium"
            >
              <option value="all">All Playing Roles</option>
              <option value="batsman">Batsmen</option>
              <option value="bowler">Bowlers</option>
              <option value="all-rounder">All-Rounders</option>
              <option value="wicketkeeper">Wicketkeepers</option>
            </select>
            <ChevronDown className="absolute right-4 top-3.5 text-slate-400 pointer-events-none" size={16} />
          </div>

          {/* Team Filter */}
          <div className="relative">
            <select
              value={teamFilter}
              onChange={(e) => setTeamFilter(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm transition-all appearance-none cursor-pointer font-medium"
            >
              <option value="all">All Teams</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-4 top-3.5 text-slate-400 pointer-events-none" size={16} />
          </div>
        </div>
      </div>

      {/* Players Grid */}
      {filteredPlayers.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl">
          <p className="text-slate-500 dark:text-slate-400 text-sm">No players found matching your filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPlayers.map((player) => {
            const stats = player.careerStats || { batting: {}, bowling: {} };
            return (
              <div
                key={player.id}
                onClick={() => {
                  setSelectedPlayer(player);
                  setProfileTab("batting");
                }}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-teal-500/50 dark:hover:border-teal-400/50 rounded-2xl p-5 shadow-sm hover:shadow-md cursor-pointer transition-all duration-200 transform hover:-translate-y-0.5 group"
              >
                <div className="flex items-center space-x-4">
                  {/* Avatar Icon */}
                  <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-display text-lg font-bold text-slate-700 dark:text-slate-300 group-hover:bg-teal-50 dark:group-hover:bg-teal-950 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                    {(player.name || "").charAt(0)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <h3 className="font-display font-bold text-slate-900 dark:text-white truncate group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                      {player.name}
                    </h3>
                    <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mt-0.5 flex items-center space-x-1.5">
                      <Shield size={12} className="text-slate-400" />
                      <span>{player.teamName || "Unassigned"}</span>
                    </p>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <span className={`inline-block border text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${getRoleBadgeColor(player.role)}`}>
                    {player.role}
                  </span>
                  
                  <div className="flex space-x-4 text-xs text-slate-500 dark:text-slate-400 font-medium">
                    <div>
                      Runs: <span className="font-bold text-slate-800 dark:text-white">{stats.batting.runs || 0}</span>
                    </div>
                    <div>
                      Wickets: <span className="font-bold text-slate-800 dark:text-white">{stats.bowling.wickets || 0}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
