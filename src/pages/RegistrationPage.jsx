import React, { useState } from "react";
import { User, Phone, CheckCircle2, AlertCircle, KeyRound } from "lucide-react";
import { registerPlayer } from "../services/db";
import { isConfigValid } from "../lib/firebase";

export default function RegistrationPage({ onRegisterSuccess }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [role, setRole] = useState("batsman");
  
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess(false);

    // Clean and validate phone number (10 digits)
    const cleanedPhone = phone.replace(/\D/g, "");
    if (cleanedPhone.length < 10) {
      setError("Please enter a valid 10-digit phone number.");
      return;
    }

    if (!name.trim()) {
      setError("Please enter your name.");
      return;
    }

    setLoading(true);

    try {
      const registered = await registerPlayer({
        name: name.trim(),
        phone: cleanedPhone,
        teamId: "",
        teamName: "",
        role: role,
        accessCode: accessCode.trim()
      });

      // Clear form
      setName("");
      setPhone("");
      setRole("batsman");
      setAccessCode("");
      setSuccess(true);

      // Auto check-in the newly registered player!
      const playerCheckIn = { id: registered.id, name: registered.name, phone: registered.phone };
      localStorage.setItem("cricket_checked_in_player", JSON.stringify(playerCheckIn));
      onRegisterSuccess(playerCheckIn);

    } catch (err) {
      // Show plain inline error for invalid club code, keeping it generic
      if (err.code === "permission-denied" || (err.message && (err.message.toLowerCase().includes("permission") || err.message.toLowerCase().includes("club code")))) {
        setError("Invalid club code. Please check with your club admin.");
      } else {
        setError(err.message || "Registration failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-10 shadow-xl transition-all duration-300">
        <div className="mb-8 text-center">
          <h2 className="font-display font-extrabold text-2xl sm:text-3xl text-slate-900 dark:text-white">
            Player Registration
          </h2>
          <p className="text-slate-500 dark:text-slate-400 mt-2 text-sm">
            Sign up to be recruited into match squads, track your career statistics, and comment on highlights.
          </p>
        </div>

        {/* Club Code Requirement Notice */}
        <div className="flex items-start space-x-3 p-4 bg-teal-50 dark:bg-teal-950/20 border border-teal-200/50 dark:border-teal-900/30 rounded-2xl text-teal-850 dark:text-teal-400 mb-6 font-medium text-xs leading-relaxed">
          <KeyRound size={18} className="shrink-0 mt-0.5 text-teal-650 dark:text-teal-400" />
          <div>
            Only Deepkamal Club members can register on this platform. Ask your captain or admin for the club code if you don't have it.
          </div>
        </div>

        {!isConfigValid && (
          <div className="flex items-start space-x-3 p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/50 rounded-2xl text-blue-700 dark:text-blue-400 mb-6">
            <AlertCircle size={18} className="shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-sm">Local Registration (No Cross-Device Sync)</p>
              <p className="text-xs text-blue-600 dark:text-blue-500 mt-1">
                Players registered here only appear on this device. To sync your profile across all devices and browsers, configure Firebase in your .env file.
              </p>
            </div>
          </div>
        )}

        {success && (
          <div className="flex items-start space-x-3 p-5 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/50 rounded-2xl text-emerald-700 dark:text-emerald-400 mb-6 animate-pop">
            <CheckCircle2 className="shrink-0 mt-0.5" size={20} />
            <div>
              <p className="font-semibold text-sm">Registration Successful!</p>
              <p className="text-xs text-emerald-600 dark:text-emerald-500 mt-1">
                You're registered! You'll appear in the Players list shortly.
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-start space-x-3 p-5 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-2xl text-red-600 dark:text-red-400 mb-6 animate-pop">
            <AlertCircle className="shrink-0 mt-0.5" size={20} />
            <div>
              <p className="font-semibold text-sm">Registration Failed</p>
              <p className="text-xs text-red-500 mt-1">{error}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
              Full Name
            </label>
            <div className="relative">
              <User className="absolute left-4 top-3.5 text-slate-400 dark:text-slate-500" size={18} />
              <input
                type="text"
                placeholder="e.g. Virat Kohli"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full pl-11 pr-4 py-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm transition-all"
                required
              />
            </div>
          </div>

          {/* Phone */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
              Phone Number
            </label>
            <div className="relative">
              <Phone className="absolute left-4 top-3.5 text-slate-400 dark:text-slate-500" size={18} />
              <input
                type="tel"
                placeholder="e.g. 9876543210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full pl-11 pr-4 py-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm transition-all"
                required
              />
            </div>
          </div>

          {/* Club Code */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
              Club Code
            </label>
            <div className="relative">
              <KeyRound className="absolute left-4 top-3.5 text-slate-400 dark:text-slate-500" size={18} />
              <input
                type="text"
                placeholder="Enter club access code"
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value)}
                className="w-full pl-11 pr-4 py-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm transition-all"
                required
              />
            </div>
          </div>

          {/* Playing Role */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
              Playing Role
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { id: "batsman", label: "Batsman" },
                { id: "bowler", label: "Bowler" },
                { id: "all-rounder", label: "All-Rounder" },
                { id: "wicketkeeper", label: "Wicketkeeper" }
              ].map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setRole(r.id)}
                  className={`py-3.5 px-2 text-center rounded-2xl border text-xs font-semibold transition-all ${
                    role === r.id
                      ? "border-teal-600 dark:border-teal-400 bg-teal-50/50 dark:bg-teal-950/20 text-teal-600 dark:text-teal-400 shadow-sm"
                      : "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-4 text-white font-medium rounded-2xl text-sm transition-all shadow-lg ${
              loading 
                ? "bg-slate-400 dark:bg-slate-800 cursor-not-allowed" 
                : "bg-teal-600 hover:bg-teal-700 active:scale-[0.98] shadow-teal-600/20"
            }`}
          >
            {loading ? "Registering..." : "Submit Registration"}
          </button>
        </form>
      </div>
    </div>
  );
}
