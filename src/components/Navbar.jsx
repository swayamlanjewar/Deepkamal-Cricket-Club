import React, { useState, useEffect } from "react";
import { useTheme } from "./ThemeContext";
import { 
  Trophy, Users, Calendar, Radio, Sparkles, 
  Menu, X, Sun, Moon, LogIn, LogOut, ClipboardList, UserCheck
} from "lucide-react";
import { subscribeMatches, clearAllData } from "../services/db";
import { subscribeAuthState, logoutAdmin } from "../services/auth";

export default function Navbar({ activeTab, setActiveTab, checkedInPlayer, onOpenCheckIn }) {
  const { theme, toggleTheme, sessionVibe, gradientClass } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [liveCount, setLiveCount] = useState(0);
  const [adminUser, setAdminUser] = useState(null);

  useEffect(() => {
    const unsubMatches = subscribeMatches((matches) => {
      const active = matches.filter(m => m.status === "live").length;
      setLiveCount(active);
    });

    const unsubAuth = subscribeAuthState((user) => {
      setAdminUser(user);
    });

    return () => {
      unsubMatches();
      unsubAuth();
    };
  }, []);

  const handleNavClick = (tab) => {
    setActiveTab(tab);
    setIsOpen(false);
  };

  const handleLogout = async () => {
    if (window.confirm("Are you sure you want to logout as admin scorer?")) {
      await logoutAdmin();
      setActiveTab("matches");
    }
  };

  const navItems = [
    { id: "matches", label: "Matches", icon: Calendar, badge: liveCount > 0 },
    { id: "players", label: "Players", icon: Users },
    { id: "standings", label: "Standings", icon: Trophy },
    { id: "highlights", label: "Highlights", icon: Sparkles },
    { id: "registration", label: "Register", icon: ClipboardList }
  ];

  return (
    <nav className="sticky top-0 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-all duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Vibe */}
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => handleNavClick("matches")}>
            <div className="p-2 bg-teal-600 rounded-lg text-white font-bold shadow-md shadow-teal-600/20">
              MT
            </div>
            <div>
              <span className="font-display font-extrabold text-lg sm:text-xl tracking-tight text-slate-900 dark:text-white">
                Monsoon Tour
              </span>
              <div className="flex items-center space-x-1">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                  {sessionVibe}
                </span>
              </div>
            </div>
          </div>

          {/* Desktop Navigation Links */}
          <div className="hidden md:flex items-center space-x-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={`relative flex items-center space-x-2 px-3.5 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${
                    isActive 
                      ? "text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/40" 
                      : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  <Icon size={16} />
                  <span>{item.label}</span>
                  {item.badge && (
                    <span className="absolute -top-1 -right-1 flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                    </span>
                  )}
                </button>
              );
            })}

            {/* Admin Scoring Tab */}
            <button
              onClick={() => handleNavClick("scoring")}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${
                activeTab === "scoring"
                  ? "text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40" 
                  : "text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              <Radio size={16} className={activeTab === "scoring" ? "animate-pulse" : ""} />
              <span>Scoring Panel</span>
            </button>
          </div>

          {/* Right Header Actions */}
          <div className="hidden md:flex items-center space-x-4">
            {/* Checked In Player Name */}
            {checkedInPlayer ? (
              <div className="flex items-center space-x-1.5 text-xs bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-full text-slate-700 dark:text-slate-300 font-medium">
                <UserCheck size={14} className="text-teal-600 dark:text-teal-400" />
                <span>Hi, {checkedInPlayer.name}</span>
              </div>
            ) : (
              <button
                onClick={onOpenCheckIn}
                className="text-xs text-teal-600 dark:text-teal-400 hover:underline font-medium"
              >
                Player Check-In
              </button>
            )}

            {/* Light/Dark Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Toggle theme"
            >
              {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
            </button>

            {/* Admin Info / Logout */}
            {adminUser && (
              <button
                onClick={handleLogout}
                className="flex items-center space-x-1 text-xs text-rose-600 hover:text-rose-700 dark:text-rose-400 font-medium hover:underline border-l border-slate-200 dark:border-slate-700 pl-4"
              >
                <LogOut size={13} />
                <span>Logout Admin</span>
              </button>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="flex items-center space-x-2 md:hidden">
            {/* Checked-in status */}
            {checkedInPlayer && (
              <div className="text-[11px] bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-full text-slate-600 dark:text-slate-400">
                {checkedInPlayer.name.split(" ")[0]}
              </div>
            )}
            <button
              onClick={toggleTheme}
              className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
            </button>
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="Toggle mobile menu"
            >
              {isOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Navigation */}
      {isOpen && (
        <div className="md:hidden bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 animate-pop">
          <div className="px-2 pt-2 pb-3 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg font-medium text-base transition-all duration-200 ${
                    isActive 
                      ? "text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/40" 
                      : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800"
                  }`}
                >
                  <Icon size={18} />
                  <span className="flex-1 text-left">{item.label}</span>
                  {item.badge && (
                    <span className="flex h-2.5 w-2.5 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                    </span>
                  )}
                </button>
              );
            })}

            {/* Mobile Scoring Panel Link */}
            <button
              onClick={() => handleNavClick("scoring")}
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg font-medium text-base transition-all duration-200 ${
                activeTab === "scoring"
                  ? "text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40" 
                  : "text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-50 dark:hover:bg-slate-800"
              }`}
            >
              <Radio size={18} />
              <span className="text-left">Scoring Panel</span>
            </button>

            {/* Mobile Check-In / Status */}
            {!checkedInPlayer ? (
              <button
                onClick={() => { onOpenCheckIn(); setIsOpen(false); }}
                className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-teal-600 dark:text-teal-400 font-medium text-base hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <ClipboardList size={18} />
                <span>Player Check-In</span>
              </button>
            ) : null}

            {/* Admin Logout */}
            {adminUser && (
              <button
                onClick={() => { handleLogout(); setIsOpen(false); }}
                className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-rose-600 dark:text-rose-400 font-medium text-base hover:bg-slate-50 dark:hover:bg-slate-800 border-t border-slate-100 dark:border-slate-800"
              >
                <LogOut size={18} />
                <span>Logout Scorer Admin</span>
              </button>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
