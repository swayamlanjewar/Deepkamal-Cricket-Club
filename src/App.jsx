import React, { useState, useEffect } from "react";
import { ThemeProvider, useTheme } from "./components/ThemeContext";
import Navbar from "./components/Navbar";
import CheckInModal from "./components/CheckInModal";

// Pages
import MatchesPage from "./pages/MatchesPage";
import MatchDetailsPage from "./pages/MatchDetailsPage";
import PlayersPage from "./pages/PlayersPage";
import StandingsPage from "./pages/StandingsPage";
import HighlightsPage from "./pages/HighlightsPage";
import RegistrationPage from "./pages/RegistrationPage";
import ScoringPanelPage from "./pages/ScoringPanelPage";

import { Sun, Moon, Calendar, MapPin, Clock } from "lucide-react";

function AppContent() {
  const { theme, toggleTheme, sessionVibe, gradientClass } = useTheme();
  const [activeTab, setActiveTab] = useState("matches");
  const [selectedMatchId, setSelectedMatchId] = useState(null);
  
  // Checked-in Player state
  const [checkedInPlayer, setCheckedInPlayer] = useState(null);
  const [isCheckInOpen, setIsCheckInOpen] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("cricket_checked_in_player");
    if (saved) {
      setCheckedInPlayer(JSON.parse(saved));
    }
  }, []);

  const handleCheckInSuccess = (player) => {
    setCheckedInPlayer(player);
  };

  const handleRegisterSuccess = (player) => {
    setCheckedInPlayer(player);
    setActiveTab("matches"); // Redirect to matches on signup
  };

  const renderActiveTab = () => {
    if (selectedMatchId) {
      return (
        <MatchDetailsPage 
          matchId={selectedMatchId} 
          onBack={() => setSelectedMatchId(null)} 
        />
      );
    }

    switch (activeTab) {
      case "matches":
        return <MatchesPage onSelectMatch={(id) => setSelectedMatchId(id)} />;
      case "players":
        return <PlayersPage />;
      case "standings":
        return <StandingsPage />;
      case "highlights":
        return (
          <HighlightsPage 
            checkedInPlayer={checkedInPlayer} 
            onOpenCheckIn={() => setIsCheckInOpen(true)} 
          />
        );
      case "registration":
        return <RegistrationPage onRegisterSuccess={handleRegisterSuccess} />;
      case "scoring":
        return <ScoringPanelPage />;
      default:
        return <MatchesPage onSelectMatch={(id) => setSelectedMatchId(id)} />;
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      {/* Stadium Vibe Header */}
      <header className={`py-12 px-6 text-white text-center relative overflow-hidden transition-all duration-500 shadow-lg ${gradientClass}`}>
        {/* Glow light pools in dark mode */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-white/5 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none"></div>
        
        <div className="max-w-4xl mx-auto relative z-10 animate-pop">
          <div className="inline-flex items-center space-x-2 bg-black/15 dark:bg-white/10 backdrop-blur-md px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest shadow-inner border border-white/5">
            {theme === "light" ? <Sun size={13} className="text-amber-300" /> : <Moon size={13} className="text-teal-300" />}
            <span>{sessionVibe} Match Hours</span>
          </div>
          
          <h1 className="font-display font-extrabold text-3xl sm:text-5xl mt-4 tracking-tight leading-none text-white drop-shadow-sm">
            Monsoon Tour Tournament
          </h1>
          <p className="text-white/80 max-w-lg mx-auto text-xs sm:text-sm mt-3.5 leading-relaxed font-medium">
            Local Cricket Club Test format tournament tracker. Record live scores, analyze career stats, and post media highlights.
          </p>
        </div>
      </header>

      {/* Navigation */}
      <Navbar 
        activeTab={selectedMatchId ? "matches" : activeTab} 
        setActiveTab={(tab) => { setSelectedMatchId(null); setActiveTab(tab); }}
        checkedInPlayer={checkedInPlayer}
        onOpenCheckIn={() => setIsCheckInOpen(true)}
      />

      {/* Main View Container */}
      <main className="flex-grow bg-slate-50 dark:bg-slate-950/40 pb-16 transition-colors duration-300">
        {renderActiveTab()}
      </main>

      {/* Footer */}
      <footer className="py-6 border-t border-slate-200 dark:border-slate-800 text-center text-xs text-slate-400 font-semibold bg-white dark:bg-slate-900 transition-colors duration-300">
        <p>© 2026 Monsoon Tour Cricket Club. Designed for high performance club cricket.</p>
      </footer>

      {/* Global Check-in popup */}
      <CheckInModal 
        isOpen={isCheckInOpen} 
        onClose={() => setIsCheckInOpen(false)} 
        onCheckInSuccess={handleCheckInSuccess} 
      />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}
