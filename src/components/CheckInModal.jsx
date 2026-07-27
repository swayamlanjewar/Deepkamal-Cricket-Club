import React, { useState, useEffect } from "react";
import { X, Phone, UserCheck, AlertCircle } from "lucide-react";
import { subscribePlayers } from "../services/db";

export default function CheckInModal({ isOpen, onClose, onCheckInSuccess }) {
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [players, setPlayers] = useState([]);

  useEffect(() => {
    const unsub = subscribePlayers((list) => {
      setPlayers(list);
    });
    return () => unsub();
  }, []);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");

    const cleanedPhone = phone.replace(/\D/g, "");
    if (!cleanedPhone) {
      setError("Please enter a valid phone number.");
      return;
    }

    const found = players.find(p => p.phone.replace(/\D/g, "") === cleanedPhone);
    
    if (found) {
      const playerData = { id: found.id, name: found.name, phone: found.phone };
      localStorage.setItem("cricket_checked_in_player", JSON.stringify(playerData));
      onCheckInSuccess(playerData);
      onClose();
      setPhone("");
    } else {
      setError("This phone number is not registered. Please register first using the 'Register' tab.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-pop">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center space-x-2">
            <UserCheck className="text-teal-600 dark:text-teal-400" size={20} />
            <h3 className="font-display font-bold text-lg text-slate-900 dark:text-white">
              Player Check-In
            </h3>
          </div>
          <button 
            onClick={onClose} 
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Check-in using your registered phone number to enable **likes** and **comments** on match highlights.
          </p>

          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
              Phone Number
            </label>
            <div className="relative">
              <Phone className="absolute left-3.5 top-3.5 text-slate-400 dark:text-slate-500" size={16} />
              <input
                type="tel"
                placeholder="e.g. 9876543210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm transition-all"
                required
              />
            </div>
          </div>

          {error && (
            <div className="flex items-center space-x-2 p-3.5 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-xl text-red-600 dark:text-red-400 text-xs">
              <AlertCircle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            className="w-full py-3 bg-teal-600 hover:bg-teal-700 active:scale-[0.98] text-white font-medium rounded-xl text-sm transition-all shadow-lg shadow-teal-600/20"
          >
            Confirm Check-In
          </button>
        </form>
      </div>
    </div>
  );
}
