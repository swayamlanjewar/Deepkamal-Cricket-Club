import React, { createContext, useContext, useState, useEffect } from "react";

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem("cricket_theme");
    if (saved) return saved;
    // Check system preference
    if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
      return "dark";
    }
    return "light";
  });

  const [currentHour, setCurrentHour] = useState(() => new Date().getHours());

  useEffect(() => {
    // Update hour periodically
    const timer = setInterval(() => {
      setCurrentHour(new Date().getHours());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    localStorage.setItem("cricket_theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === "light" ? "dark" : "light"));
  };

  const isDaytime = currentHour >= 6 && currentHour < 18;
  const sessionVibe = isDaytime ? "Day Session" : "Floodlit Session";
  
  // Decide header gradient based on theme & time of day
  // If dark mode, we always use a cool night floodlight vibe.
  // If light mode, we use a bright daytime sky gradient if it's day, or warm twilight if it's night.
  const gradientClass = theme === "dark" 
    ? "gradient-header-night" 
    : (isDaytime ? "gradient-header-day" : "bg-gradient-to-r from-amber-600 to-indigo-900");

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, isDaytime, sessionVibe, gradientClass }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
