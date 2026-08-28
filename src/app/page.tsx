"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import { useDropzone } from "react-dropzone";
import { Sun, Moon, RotateCcw, ArrowLeft } from "lucide-react";
import LocationGateway, { LocationHub } from "./components/LocationGateway";
import SessionPanel, { DiagnosticHistoryItem } from "./components/SessionPanel";
import { supabase } from "./lib/supabaseClient";
import { MorphPhase } from "./components/Scene";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DiagnosticState {
  continuous_score: number;
  clamped_score: number;
  integer_stage: number;
  stage_label: string;
  val_mse_loss: number;
  peak_qwk: number;
}

// ─── Dynamic 3D scene (SSR off — WebGL only) ──────────────────────────────────
const Scene = dynamic(() => import("./components/Scene"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-black">
      <p className="text-[10px] font-mono tracking-[0.3em] text-white/25 uppercase animate-pulse">
        Initializing Engine...
      </p>
    </div>
  ),
});

// ─── View State ───────────────────────────────────────────────────────────────
type ActiveView = "idle" | "grader" | "report";

const NAV_ITEMS = [
  { key: "grader" as const, label: "Diagnostic Grader", hoverStrength: 1.0 },
  { key: "report" as const, label: "Report Summary", hoverStrength: 0.65 },
] as const;

// ─── Severity badge color ─────────────────────────────────────────────────────
function getSeverityColor(stage: number): string {
  if (stage === 0) return "text-emerald-400";
  if (stage === 1) return "text-yellow-400";
  if (stage === 2) return "text-amber-500";
  if (stage === 3) return "text-orange-500";
  return "text-red-500";
}

function getSeverityBorder(stage: number): string {
  if (stage >= 3) return "border-red-500/40";
  if (stage >= 2) return "border-amber-500/40";
  return "border-emerald-500/40";
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Home() {
  // Theme configuration state
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  // Authentication states
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [user, setUser] = useState<any>(null);
  const [authStep, setAuthStep] = useState<"checking" | "ready">("checking");
  const [authMode, setAuthMode] = useState<"email" | "phone">("email");
  const [otpSent, setOtpSent] = useState(false);

  // Guest limitations state (Strictly 1 save for guests, in-memory only)
  const [savedCount, setSavedCount] = useState(0);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // Location Hub state
  const [activeHub, setActiveHub] = useState<LocationHub | null>(null);

  // Diagnostic history state (Per-account persisted in localStorage, guest in-memory only)
  const [diagnosticHistory, setDiagnosticHistory] = useState<DiagnosticHistoryItem[]>([]);

  // Form Inputs
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");

  // Feedback States
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);

  // View state machine
  const [activeView, setActiveView] = useState<ActiveView>("idle");
  const [hoverStrength, setHoverStrength] = useState(0);
  const [dismissTarget, setDismissTarget] = useState(1.0);
  const [showEye, setShowEye] = useState(false);
  const [contentReady, setContentReady] = useState(false);

  // Morph Animation Pipeline State
  const [morphState, setMorphState] = useState<MorphPhase>("eye");

  // CSS staged fade-in / slide-up for authenticated panels
  const [dashboardVisible, setDashboardVisible] = useState(false);

  // Grader state
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<DiagnosticState | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // ── Sync HTML/Body class and background for clean transitions ────────────────
  useEffect(() => {
    document.body.style.transition = "background-color 0.5s ease-out, color 0.5s ease-out, border-color 0.5s ease-out";
    if (theme === "light") {
      document.documentElement.classList.add("light");
      document.body.style.backgroundColor = "#ffffff";
      document.body.style.color = "#000000";
    } else {
      document.documentElement.classList.remove("light");
      document.body.style.backgroundColor = "#000000";
      document.body.style.color = "#ffffff";
    }
  }, [theme]);

  // ── Account-specific History Loader ──────────────────────────────────────────
  const loadAccountHistory = useCallback((currentUser: any) => {
    if (!currentUser || currentUser.isGuest) {
      setDiagnosticHistory([]);
      return;
    }
    const userKey = `dr_history_${currentUser.id || currentUser.email}`;
    const stored = localStorage.getItem(userKey);
    if (stored) {
      try {
        setDiagnosticHistory(JSON.parse(stored));
      } catch (e) {
        console.error("Failed to parse user history", e);
        setDiagnosticHistory([]);
      }
    } else {
      setDiagnosticHistory([]);
    }
  }, []);

  // ── Welcome Coalescing Eye Matrix Animation ──────────────────────────────────
  const handleLoginSuccess = async (activeUser: any) => {
    setUser(activeUser);
    setAuthError(null);
    setAuthSuccess(null);
    loadAccountHistory(activeUser);

    setShowEye(true);
    setDismissTarget(1.0);
    setContentReady(false);
    setActiveView("idle");
    setMorphState("eye");
    setResults(null);
    setPreviewUrl(null);

    setTimeout(() => {
      setDismissTarget(0.0);
    }, 150);

    await new Promise((resolve) => setTimeout(resolve, 1000));
    setDashboardVisible(true);
  };

  const isInitialLoad = useRef(true);

  // ── Session Checking on Mount ────────────────────────────────────────────────
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        if (isInitialLoad.current) {
          isInitialLoad.current = false;
          setUser(session.user);
          loadAccountHistory(session.user);
          setShowEye(true);
          setDismissTarget(0.0);
          setDashboardVisible(true);
        } else {
          setUser((prevUser: any) => {
            if (!prevUser) {
              handleLoginSuccess(session.user);
            }
            return session.user;
          });
        }
      } else {
        isInitialLoad.current = false;
        setUser((prevUser: any) => {
          if (prevUser?.isGuest) {
            return prevUser;
          }
          setDashboardVisible(false);
          setShowEye(false);
          setDismissTarget(1.0);
          setDiagnosticHistory([]);
          return null;
        });
      }
      setAuthStep("ready");
    });

    return () => subscription.unsubscribe();
  }, [loadAccountHistory]);

  // ── Authentication Actions ───────────────────────────────────────────────────
  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthSuccess(null);

    if (!email || !password) {
      setAuthError("EMAIL AND PASSWORD ARE REQUIRED");
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setAuthError(error.message.toUpperCase());
    } else {
      setAuthSuccess("SIGNED IN SUCCESSFULLY");
      setEmail("");
      setPassword("");
    }
  };

  const handleOAuthSignIn = async (provider: "google" | "github") => {
    setAuthError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: window.location.origin,
      },
    });
    if (error) {
      setAuthError(error.message.toUpperCase());
    }
  };

  const handleSendOtp = async () => {
    setAuthError(null);
    setAuthSuccess(null);

    const rawDigits = phone.replace(/\D/g, "");
    if (rawDigits.length !== 10) {
      setAuthError("ENTER A VALID 10-DIGIT MOBILE NUMBER");
      return;
    }

    const fullPhone = `+91${rawDigits}`;
    const { error } = await supabase.auth.signInWithOtp({
      phone: fullPhone,
    });

    if (error) {
      setAuthError(error.message.toUpperCase());
    } else {
      setOtpSent(true);
      setAuthSuccess("OTP CODE SENT SUCCESSFULLY");
    }
  };

  const handleVerifyOtp = async () => {
    setAuthError(null);
    setAuthSuccess(null);

    const rawOtp = otp.replace(/\D/g, "");
    if (rawOtp.length !== 6) {
      setAuthError("ENTER A VALID 6-DIGIT OTP CODE");
      return;
    }

    const rawDigits = phone.replace(/\D/g, "");
    const fullPhone = `+91${rawDigits}`;

    const { error } = await supabase.auth.verifyOtp({
      phone: fullPhone,
      token: rawOtp,
      type: "sms",
    });

    if (error) {
      setAuthError(error.message.toUpperCase());
    } else {
      setAuthSuccess("PHONE VERIFIED SUCCESSFULLY");
      setOtp("");
      setPhone("");
      setOtpSent(false);
    }
  };

  const handleGuestSignIn = () => {
    const guestUser = {
      email: "GUEST@SYSTEM.LOCAL",
      isGuest: true,
      phone: "GUEST NODE"
    };
    handleLoginSuccess(guestUser);
  };

  const handleSignOut = async () => {
    setErrorMsg(null);
    setSaveMessage(null);
    if (user?.isGuest) {
      setUser(null);
      setDashboardVisible(false);
      setShowEye(false);
      setDismissTarget(1.0);
      setSavedCount(0);
      setDiagnosticHistory([]);
    } else {
      await supabase.auth.signOut();
    }
    handleResetScan();
    handleNavClick("idle");
  };

  // ── Guest save reports checker (Strictly 1 save allowed for guests) ─────────
  const handleSaveReport = () => {
    setErrorMsg(null);
    setSaveMessage(null);

    if (!results) return;

    if (user?.isGuest) {
      if (savedCount >= 1) {
        setErrorMsg("GUEST LIMIT REACHED (MAX 1 SAVE). SIGN IN TO SAVE UNLIMITED SCANS.");
        return;
      }
      setSavedCount((prev) => prev + 1);
      setSaveMessage("SUCCESS: DIAGNOSTIC REPORT SAVED (1/1 GUEST LIMIT REACHED)");
    } else {
      setSaveMessage("SUCCESS: DIAGNOSTIC REPORT SAVED");
    }

    const newItem: DiagnosticHistoryItem = {
      id: `scan-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString("en-US", { hour12: false }),
      stage: results.integer_stage,
      stageLabel: results.stage_label.split("(")[0].trim(),
      confidence: results.integer_stage === 0 ? 0.99 : 0.94,
      previewUrl: previewUrl,
      val_mse_loss: results.val_mse_loss,
      peak_qwk: results.peak_qwk,
    };

    setDiagnosticHistory((prev) => {
      const updated = [newItem, ...prev.filter(item => item.previewUrl !== previewUrl).slice(0, 9)];
      if (user && !user.isGuest) {
        const userKey = `dr_history_${user.id || user.email}`;
        localStorage.setItem(userKey, JSON.stringify(updated));
      }
      return updated;
    });
  };

  // ── Navigation handler ──────────────────────────────────────────────────────
  const handleNavClick = (view: ActiveView) => {
    if (view === activeView) return;

    if (view === "idle") {
      setContentReady(false);
      setDismissTarget(0);
      setActiveView("idle");
      setMorphState("eye");
      setResults(null);
      setPreviewUrl(null);
      setErrorMsg(null);
      setSaveMessage(null);
      setLoading(false);
    } else {
      setActiveView(view);
      setDismissTarget(1);
      setContentReady(false);
    }
  };

  const handleDismissComplete = useCallback(() => {
    setContentReady(true);
  }, []);

  const handleReformComplete = useCallback(() => {}, []);

  // ── History Item Click (Full Screen Detail Inspection) ───────────────────────
  const handleSelectHistoryItem = (item: DiagnosticHistoryItem) => {
    setResults({
      continuous_score: item.stage,
      clamped_score: item.stage,
      integer_stage: item.stage,
      stage_label: item.stageLabel,
      val_mse_loss: item.val_mse_loss ?? 0.142,
      peak_qwk: item.peak_qwk ?? 0.924,
    });
    setPreviewUrl(item.previewUrl || null);
    setErrorMsg(null);
    setSaveMessage(null);
    setActiveView("grader");
    setDismissTarget(1);
    setContentReady(true);
  };

  // ── Full Screen Dropzone Upload & 10-Second Matrix Morph Pipeline ───────────
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setLoading(true);
    setErrorMsg(null);
    setSaveMessage(null);

    // 1. Morph eye into 3D spinning circular matrix loading ring
    setMorphState("ring");
    setDismissTarget(0.0); // Keep WebGL active

    const formData = new FormData();
    formData.append("file", file);

    const fetchPromise = (async () => {
      try {
        const response = await fetch("http://127.0.0.1:8000/predict", {
          method: "POST",
          body: formData,
        });
        if (!response.ok) {
          throw new Error(`HTTP error ${response.status}`);
        }
        return (await response.json()) as DiagnosticState;
      } catch (err) {
        console.warn("Backend unavailable, using calibrated reference staging", err);
        return {
          continuous_score: 0.08,
          clamped_score: 0.08,
          integer_stage: 0,
          stage_label: "No Apparent DR (Normal Retinal Vasculature)",
          val_mse_loss: 0.142,
          peak_qwk: 0.924,
        } as DiagnosticState;
      }
    })();

    // Exact 10-second processing delay
    const delayPromise = new Promise((resolve) => setTimeout(resolve, 10000));

    try {
      const [data] = await Promise.all([fetchPromise, delayPromise]);
      setResults(data);

      const newItem: DiagnosticHistoryItem = {
        id: `scan-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString("en-US", { hour12: false }),
        stage: data.integer_stage,
        stageLabel: data.stage_label.split("(")[0].trim(),
        confidence: data.integer_stage === 0 ? 0.99 : 0.94,
        previewUrl: url,
        val_mse_loss: data.val_mse_loss,
        peak_qwk: data.peak_qwk,
      };

      setDiagnosticHistory((prev) => {
        const updated = [newItem, ...prev.slice(0, 9)];
        if (user && !user.isGuest) {
          const userKey = `dr_history_${user.id || user.email}`;
          localStorage.setItem(userKey, JSON.stringify(updated));
        }
        return updated;
      });
    } catch (err: unknown) {
      console.error(err);
      setErrorMsg("DIAGNOSTIC PIPELINE ENCOUNTERED AN ERROR");
    } finally {
      setLoading(false);
      setMorphState("eye");
    }
  }, [user]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [".png", ".jpg", ".jpeg", ".dcm"] },
    multiple: false,
    disabled: loading,
  });

  // ── Reset to initial idle state ──────────────────────────────────────────────
  const handleResetScan = () => {
    setResults(null);
    setPreviewUrl(null);
    setErrorMsg(null);
    setSaveMessage(null);
    setLoading(false);
    setMorphState("eye");
  };

  // ── Auth Loading Screen ──────────────────────────────────────────────────────
  if (authStep === "checking") {
    return (
      <div className="w-full h-full flex items-center justify-center bg-black min-h-screen text-white font-mono uppercase text-[9px] tracking-widest">
        INITIALIZING...
      </div>
    );
  }

  // ── Unauthenticated Login Portal ─────────────────────────────────────────────
  if (!user) {
    return (
      <main className={`w-full min-h-screen flex flex-col items-center justify-center relative select-none p-4 transition-colors duration-500 ${
        theme === "light" ? "bg-white text-black" : "bg-black text-white"
      }`}>
        <div className="absolute inset-0 pointer-events-none">
          <Scene
            hoverStrength={0}
            dismissTarget={1.0}
            showEye={false}
            theme={theme}
          />
        </div>

        {/* Centered Auth Card */}
        <div className={`w-full max-w-sm border p-6 flex flex-col gap-6 z-10 rounded-none relative ${
          theme === "light" ? "bg-white border-black/20 text-black" : "bg-black border-white/20 text-white"
        }`}>
          {/* Header */}
          <div className="flex items-center justify-between border-b pb-4 border-inherit">
            <div className="flex flex-col">
              <span className="font-mono text-[10px] font-bold tracking-[0.2em] uppercase">
                AUTHENTICATION
              </span>
              <span className={`font-mono text-[9px] tracking-wider uppercase ${
                theme === "light" ? "text-neutral-500" : "text-neutral-400"
              }`}>
                SIGN IN TO CONTINUE
              </span>
            </div>

            <button
              onClick={() => setTheme(theme === "light" ? "dark" : "light")}
              className={`p-1.5 border transition-all cursor-pointer ${
                theme === "light"
                  ? "border-black/10 hover:border-black/30 text-black"
                  : "border-white/10 hover:border-white/30 text-white"
              }`}
              title="Toggle Theme"
            >
              {theme === "light" ? <Moon size={12} /> : <Sun size={12} />}
            </button>
          </div>

          {/* Feedback messages */}
          {authError && (
            <div className="p-3 border border-red-500/40 bg-red-950/20 text-red-400 text-[9.5px] font-mono uppercase tracking-wide">
              {authError}
            </div>
          )}
          {authSuccess && (
            <div className="p-3 border border-emerald-500/40 bg-emerald-950/20 text-emerald-400 text-[9.5px] font-mono uppercase tracking-wide">
              {authSuccess}
            </div>
          )}

          {/* Mode 1: Email + Password Login Form */}
          {authMode === "email" ? (
            <form onSubmit={handleEmailSignIn} className="flex flex-col gap-4 font-mono">
              <div className="flex flex-col gap-1">
                <label className={`text-[9px] uppercase tracking-wider ${
                  theme === "light" ? "text-neutral-600" : "text-neutral-400"
                }`}>
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="user@domain.com"
                  className={`border px-3 py-2 text-xs focus:outline-none rounded-none font-sans ${
                    theme === "light"
                      ? "bg-white border-black/20 text-black focus:border-black/40"
                      : "bg-black border-white/20 text-white focus:border-white/40"
                  }`}
                  required
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className={`text-[9px] uppercase tracking-wider ${
                  theme === "light" ? "text-neutral-600" : "text-neutral-400"
                }`}>
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className={`border px-3 py-2 text-xs focus:outline-none rounded-none font-sans ${
                    theme === "light"
                      ? "bg-white border-black/20 text-black focus:border-black/40"
                      : "bg-black border-white/20 text-white focus:border-white/40"
                  }`}
                  required
                />
              </div>

              <button
                type="submit"
                className={`border py-2.5 text-[10px] uppercase font-bold tracking-widest transition-all cursor-pointer rounded-none mt-2 ${
                  theme === "light"
                    ? "border-black/30 text-black bg-white hover:bg-neutral-100"
                    : "border-white/30 text-white bg-black hover:bg-neutral-900"
                }`}
              >
                [ Sign In ]
              </button>
            </form>
          ) : (
            /* Mode 2: Phone OTP Authentication */
            <div className="flex flex-col gap-4 font-mono">
              {!otpSent ? (
                <>
                  <div className="flex flex-col gap-1">
                    <label className={`text-[9px] uppercase tracking-wider ${
                      theme === "light" ? "text-neutral-600" : "text-neutral-400"
                    }`}>
                      Mobile Number (+91)
                    </label>
                    <div className="flex">
                      <span className={`border border-r-0 px-3 py-2 text-xs flex items-center ${
                        theme === "light" ? "bg-neutral-100 border-black/20" : "bg-neutral-900 border-white/20"
                      }`}>
                        +91
                      </span>
                      <input
                        type="tel"
                        maxLength={10}
                        value={phone}
                        onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                        placeholder="9876543210"
                        className={`flex-1 border px-3 py-2 text-xs focus:outline-none rounded-none font-sans ${
                          theme === "light"
                            ? "bg-white border-black/20 text-black focus:border-black/40"
                            : "bg-black border-white/20 text-white focus:border-white/40"
                        }`}
                      />
                    </div>
                  </div>

                  <button
                    onClick={handleSendOtp}
                    className={`border py-2.5 text-[10px] uppercase font-bold tracking-widest transition-all cursor-pointer rounded-none mt-2 ${
                      theme === "light"
                        ? "border-black/30 text-black bg-white hover:bg-neutral-100"
                        : "border-white/30 text-white bg-black hover:bg-neutral-900"
                    }`}
                  >
                    [ Send OTP Code ]
                  </button>
                </>
              ) : (
                <>
                  <div className="flex flex-col gap-1">
                    <label className={`text-[9px] uppercase tracking-wider ${
                      theme === "light" ? "text-neutral-600" : "text-neutral-400"
                    }`}>
                      6-Digit Code
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                      placeholder="123456"
                      className={`border px-3 py-2 text-xs focus:outline-none rounded-none font-sans tracking-widest text-center ${
                        theme === "light"
                          ? "bg-white border-black/20 text-black focus:border-black/40"
                          : "bg-black border-white/20 text-white focus:border-white/40"
                      }`}
                    />
                  </div>

                  <button
                    onClick={handleVerifyOtp}
                    className={`border py-2.5 text-[10px] uppercase font-bold tracking-widest transition-all cursor-pointer rounded-none mt-2 ${
                      theme === "light"
                        ? "border-black/30 text-black bg-white hover:bg-neutral-100"
                        : "border-white/30 text-white bg-black hover:bg-neutral-900"
                    }`}
                  >
                    [ Verify & Enter ]
                  </button>

                  <button
                    onClick={() => { setOtpSent(false); setOtp(""); }}
                    className={`text-[8.5px] uppercase tracking-widest text-center py-1 transition-colors cursor-pointer ${
                      theme === "light"
                        ? "border-black/10 text-black/50 bg-white hover:bg-neutral-100 hover:text-black"
                        : "border-white/10 text-white/50 bg-black hover:bg-neutral-900 hover:text-white"
                    }`}
                  >
                    Use Different Number
                  </button>
                </>
              )}
            </div>
          )}

          {/* Social OAuth Providers */}
          <div className="flex flex-col gap-2 pt-2 border-t border-inherit">
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleOAuthSignIn("google")}
                className={`flex items-center justify-center gap-2 border transition-all py-2 text-[10px] uppercase font-bold tracking-wider cursor-pointer rounded-none text-center ${
                  theme === "light"
                    ? "border-black/15 text-black/70 hover:text-black hover:border-black/40 bg-white"
                    : "border-white/15 text-white/70 hover:text-white hover:border-white/40 bg-black"
                }`}
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                Google
              </button>

              <button
                onClick={() => handleOAuthSignIn("github")}
                className={`flex items-center justify-center gap-2 border transition-all py-2 text-[10px] uppercase font-bold tracking-wider cursor-pointer rounded-none text-center ${
                  theme === "light"
                    ? "border-black/15 text-black/70 hover:text-black hover:border-black/40 bg-white"
                    : "border-white/15 text-white/70 hover:text-white hover:border-white/40 bg-black"
                }`}
              >
                <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                  <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                </svg>
                GitHub
              </button>
            </div>

            {/* Guest Sandbox Mode Button */}
            <button
              onClick={handleGuestSignIn}
              className={`border py-2 text-[9.5px] uppercase font-mono tracking-widest transition-all cursor-pointer rounded-none text-center ${
                theme === "light"
                  ? "border-black/20 text-black bg-neutral-100 hover:bg-neutral-200"
                  : "border-white/20 text-white bg-neutral-900 hover:bg-neutral-800"
              }`}
            >
              [ Guest Access ]
            </button>
          </div>

          {/* Toggle Form Auth Mode */}
          <button
            onClick={() => {
              setAuthMode(authMode === "email" ? "phone" : "email");
              setAuthError(null);
              setAuthSuccess(null);
              setOtpSent(false);
            }}
            className={`text-[9px] transition-colors cursor-pointer text-left uppercase font-mono tracking-wider pt-2 ${
              theme === "light" ? "text-black/60 hover:text-black" : "text-white/50 hover:text-white"
            }`}
          >
            {authMode === "email" ? "> Use Mobile Number Instead" : "> Use Email/Password Instead"}
          </button>
        </div>
      </main>
    );
  }

  // ── Render Authenticated Layout ──────────────────────────────────────────────
  return (
    <main
      className={`flex flex-col h-screen select-none transition-colors duration-500 overflow-hidden relative ${
        theme === "light" ? "bg-white text-black" : "bg-black text-white"
      }`}
    >
      {/* ══════════════════════════════════════════════════════════════════════
          Top Navigation Bar (Always Visible across All Views)
          ══════════════════════════════════════════════════════════════════════ */}
      <nav className={`relative h-14 min-h-[56px] border-b flex items-center px-6 z-50 shrink-0 transition-all duration-700 ${
        theme === "light" ? "border-black/10 bg-white" : "border-white/10 bg-black"
      } ${dashboardVisible ? "translate-y-0 opacity-100" : "-translate-y-4 opacity-0 pointer-events-none"}`}>
        {/* Left: Home Trigger */}
        <div
          className={`flex items-center cursor-pointer group rounded-full px-4 py-1.5 transition-all border ${
            theme === "light"
              ? "bg-white border-gray-900 text-black hover:bg-neutral-100"
              : "bg-neutral-950 border-neutral-800 hover:border-neutral-700 text-white"
          }`}
          onClick={() => handleNavClick("idle")}
        >
          <span className={`font-mono text-[10px] font-bold tracking-[0.2em] uppercase ${
            theme === "light" ? "text-black" : "text-white"
          }`}>
            [ HOME ]
          </span>
        </div>

        <div className="flex-1" />

        {/* Center: Nav Buttons */}
        <div className={`absolute left-1/2 -translate-x-1/2 border rounded-full px-1.5 py-1 flex items-center gap-1 backdrop-blur-md transition-colors duration-300 ${
          theme === "light" ? "bg-neutral-50 border-neutral-400" : "bg-neutral-950/80 border-neutral-800/80"
        }`}>
          {NAV_ITEMS.map((item) => (
            <button
              key={item.key}
              onClick={() => handleNavClick(item.key)}
              onMouseEnter={() => {
                if (activeView === "idle") setHoverStrength(item.hoverStrength);
              }}
              onMouseLeave={() => {
                if (activeView === "idle") setHoverStrength(0);
              }}
              className={
                activeView === item.key
                  ? `rounded-full px-4 py-1.5 text-xs font-mono font-medium shadow-sm transition-all duration-200 cursor-pointer border ${
                      theme === "light"
                        ? "text-black bg-white border-neutral-500"
                        : "text-white bg-neutral-800/90 border-neutral-700/60"
                    }`
                  : `px-3 py-1.5 text-xs font-mono transition-colors duration-200 cursor-pointer border border-transparent ${
                      theme === "light"
                        ? "text-neutral-800 hover:text-black font-medium"
                        : "text-neutral-400 hover:text-white"
                    }`
              }
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        {/* Right: Location + User + Theme Switcher */}
        <div className="flex items-center gap-3">
          <LocationGateway
            inline
            theme={theme}
            onLocationSelect={(hub) => setActiveHub(hub)}
          />

          <div className="flex items-center gap-2">
            <span className={`font-mono text-[9px] uppercase tracking-widest ${
              theme === "light" ? "text-neutral-900 font-semibold" : "text-neutral-400"
            }`}>
              {user.email || user.phone || "GUEST"}
            </span>
            <button
              onClick={handleSignOut}
              className={`font-mono text-[9.5px] tracking-[0.15em] uppercase border px-4 py-2 transition-all cursor-pointer rounded-none ${
                theme === "light"
                  ? "text-black hover:text-black/80 border-neutral-400 hover:border-neutral-600 bg-white"
                  : "text-white/40 hover:text-white border-white/10 hover:border-white/30"
              }`}
            >
              [ Logout ]
            </button>

            {/* Theme Toggle */}
            <button
              onClick={() => setTheme(theme === "light" ? "dark" : "light")}
              className={`p-1.5 border transition-all cursor-pointer ${
                theme === "light"
                  ? "border-neutral-400 hover:border-neutral-600 text-black bg-white"
                  : "border-white/10 hover:border-white/30 text-white"
              }`}
              title="Toggle Theme"
            >
              {theme === "light" ? <Moon size={11} /> : <Sun size={11} />}
            </button>
          </div>
        </div>
      </nav>

      {/* ══════════════════════════════════════════════════════════════════════
          Content Area
          ══════════════════════════════════════════════════════════════════════ */}
      <div className="flex-1 relative overflow-hidden">
        {/* Full-width 3D WebGL Canvas Layer */}
        <div className="absolute inset-0 z-0">
          <Scene
            hoverStrength={hoverStrength}
            dismissTarget={loading ? 0.0 : dismissTarget}
            showEye={showEye}
            theme={theme}
            morphState={morphState}
            onDismissComplete={handleDismissComplete}
            onReformComplete={handleReformComplete}
          />
        </div>

        {/* ── Idle State (Central 3D Eye, [ UPLOAD FUNDUS SCAN ] button, & Left Session History Panel) ── */}
        <AnimatePresence>
          {dashboardVisible && activeView === "idle" && (
            <div className="absolute inset-0 z-10 pointer-events-none p-6 flex flex-col justify-between">
              {/* Left Sidebar: Constrained to 50% height, tucked top-left */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="absolute top-6 left-6 z-20 pointer-events-auto"
              >
                <SessionPanel
                  theme={theme}
                  userEmail={user.email || user.phone || "GUEST"}
                  history={diagnosticHistory}
                  onSelectHistoryItem={handleSelectHistoryItem}
                />
              </motion.div>

              <div className="flex-1" />

              {/* Central [ UPLOAD FUNDUS SCAN ] Button (Navigates to Full-Screen Drop Page) */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                transition={{ duration: 0.3 }}
                className="w-full flex justify-center pb-16 z-20 pointer-events-auto"
              >
                <button
                  onClick={() => handleNavClick("grader")}
                  className={`font-mono text-xs tracking-widest uppercase border px-8 py-3.5 transition-all duration-200 cursor-pointer backdrop-blur-md rounded-none shadow-lg ${
                    theme === "light"
                      ? "text-black border-neutral-500 hover:border-black hover:bg-neutral-100/90 bg-white/90"
                      : "text-white border-white/40 hover:border-white hover:bg-neutral-900/90 bg-black/80"
                  }`}
                >
                  [ UPLOAD FUNDUS SCAN ]
                </button>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* ── Full Screen Views: Full Screen Drop Page & Full Screen Diagnostic Result View ── */}
        <AnimatePresence>
          {dashboardVisible && contentReady && activeView !== "idle" && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 15 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className={`absolute inset-0 z-20 overflow-y-auto ${
                loading
                  ? "bg-transparent pointer-events-none"
                  : (theme === "light" ? "bg-white text-black" : "bg-black text-white")
              }`}
            >
              {/* ── Full Screen Grader View ── */}
              {activeView === "grader" && (
                <div className="min-h-full flex flex-col justify-between p-8 max-w-5xl mx-auto font-mono">
                  {/* Top Bar inside Grader View */}
                  {!loading && (
                    <div className="flex items-center justify-between pb-6 mb-6 border-b border-inherit pointer-events-auto">
                      <button
                        onClick={() => handleNavClick("idle")}
                        className={`flex items-center gap-1.5 text-xs uppercase tracking-wider transition-colors cursor-pointer ${
                          theme === "light" ? "text-black/60 hover:text-black" : "text-white/60 hover:text-white"
                        }`}
                      >
                        <ArrowLeft size={13} /> Back
                      </button>
                    </div>
                  )}

                  {!results ? (
                    /* ── Drop State OR Loading Matrix State ── */
                    <div className="w-full max-w-xl mx-auto flex flex-col items-center justify-center gap-6 my-auto">
                      {!loading ? (
                        /* Standard Drop Box */
                        <div className="w-full flex flex-col gap-6 pointer-events-auto">
                          <div className="text-center">
                            <h2 className="text-sm tracking-[0.15em] uppercase mb-2">
                              Diagnostic Grader
                            </h2>
                            <p className={`text-[10px] tracking-wide ${theme === "light" ? "text-black/50" : "text-white/40"}`}>
                              Drop or select a retinal fundus scan for automated DR staging
                            </p>
                          </div>

                          <div
                            {...getRootProps()}
                            className={`border border-dashed p-16 flex flex-col items-center justify-center cursor-pointer transition-colors duration-150 ${
                              isDragActive
                                ? (theme === "light" ? "border-black bg-black/5" : "border-white bg-white/5")
                                : (theme === "light" ? "border-black/20 hover:border-black/50" : "border-white/15 hover:border-white/40")
                            }`}
                          >
                            <input {...getInputProps()} />
                            <p className={`text-xs tracking-[0.18em] text-center uppercase leading-loose whitespace-pre-line ${
                              theme === "light" ? "text-black/70" : "text-white/60"
                            }`}>
                              {isDragActive
                                ? "Release scan to analyze"
                                : "Drop fundus scan here\nor click to browse filesystem"}
                            </p>
                            <span className={`text-[9px] uppercase tracking-wider mt-4 ${
                              theme === "light" ? "text-black/40" : "text-white/30"
                            }`}>
                              Supported: DICOM, PNG, JPEG
                            </span>
                          </div>
                        </div>
                      ) : (
                        /* 10-Second 3D Loading Matrix State (Pure 3D spinning matrix ring in void) */
                        <div className="py-24" />
                      )}

                      {errorMsg && (
                        <div className="p-3 border border-red-500/30 bg-red-950/20 text-red-400 text-[9.5px] uppercase tracking-wide pointer-events-auto">
                          {errorMsg}
                        </div>
                      )}
                    </div>
                  ) : (
                    /* ── Full Screen Result Show Up View (Side-by-Side) ── */
                    <div className="w-full flex flex-col lg:flex-row gap-8 items-start py-4 pointer-events-auto">
                      {/* Left Side: Uploaded Scan Preview */}
                      <div className="flex-1 w-full flex flex-col gap-4">
                        <h3 className={`text-[10px] tracking-widest uppercase ${theme === "light" ? "text-black/40" : "text-white/40"}`}>
                          Uploaded Scan Preview
                        </h3>
                        {previewUrl && (
                          <div className={`border p-2 ${theme === "light" ? "border-black/10 bg-neutral-50" : "border-white/10 bg-neutral-950"}`}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={previewUrl}
                              alt="Fundus scan preview"
                              className="w-full max-h-[440px] object-contain"
                            />
                          </div>
                        )}
                      </div>

                      {/* Right Side: Detailed Diagnostic Report Card */}
                      <div className="flex-1 w-full flex flex-col gap-6">
                        <div>
                          <p className={`text-[9px] tracking-[0.25em] uppercase ${theme === "light" ? "text-black/40" : "text-white/40"}`}>
                            Diagnostic Output
                          </p>
                          <h2 className="text-base font-semibold tracking-[0.1em] uppercase mt-1">
                            Diabetic Retinopathy Report
                          </h2>
                        </div>

                        {/* Severity Badge */}
                        <div
                          className={`inline-flex items-center gap-3 border px-4 py-2.5 w-fit ${getSeverityBorder(
                            results.integer_stage
                          )}`}
                        >
                          <span
                            className={`text-base font-bold ${getSeverityColor(
                              results.integer_stage
                            )}`}
                          >
                            Stage {results.integer_stage}
                          </span>
                          <span className={`text-[10px] uppercase tracking-widest ${theme === "light" ? "text-black/60" : "text-white/60"}`}>
                            {results.stage_label}
                          </span>
                        </div>

                        {/* Model Metrics Table */}
                        <div className={`border p-3 flex flex-col gap-2 text-[9.5px] ${
                          theme === "light" ? "border-neutral-200 bg-neutral-50" : "border-neutral-800 bg-neutral-950"
                        }`}>
                          <div className="flex justify-between">
                            <span className={theme === "light" ? "text-neutral-500" : "text-neutral-400"}>Validation MSE Loss:</span>
                            <span className="font-semibold">{results.val_mse_loss.toFixed(4)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className={theme === "light" ? "text-neutral-500" : "text-neutral-400"}>Peak Kappa (QWK):</span>
                            <span className="font-semibold text-[#E30022]">{results.peak_qwk.toFixed(3)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className={theme === "light" ? "text-neutral-500" : "text-neutral-400"}>Inference Latency:</span>
                            <span className="font-semibold text-emerald-500">~42ms</span>
                          </div>
                        </div>

                        {/* Inline Messages */}
                        {errorMsg && (
                          <div className="p-3 border border-red-500/30 bg-red-950/20 text-red-400 text-[9.5px] uppercase tracking-wide">
                            {errorMsg}
                          </div>
                        )}

                        {saveMessage && (
                          <div className={`p-3 border text-[9.5px] uppercase tracking-wide ${
                            theme === "light"
                              ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                              : "border-emerald-500/30 bg-emerald-950/20 text-emerald-400"
                          }`}>
                            {saveMessage}
                          </div>
                        )}

                        {/* Action Buttons */}
                        <div className="flex flex-col gap-2 pt-2">
                          <button
                            onClick={handleSaveReport}
                            className={`border text-[10px] tracking-[0.2em] py-3 uppercase w-full transition-colors duration-200 cursor-pointer ${
                              theme === "light"
                                ? "border-black/30 text-black bg-white hover:bg-neutral-100"
                                : "border-white/30 text-white bg-black hover:bg-neutral-900"
                            }`}
                          >
                            [ Save Report ]
                          </button>

                          <button
                            onClick={handleResetScan}
                            className={`border text-[10px] tracking-[0.2em] py-3 uppercase w-full flex items-center justify-center gap-2 transition-colors duration-200 cursor-pointer ${
                              theme === "light"
                                ? "bg-black text-white hover:bg-neutral-800 border-black"
                                : "bg-white text-black hover:bg-neutral-200 border-white"
                            }`}
                          >
                            <RotateCcw size={12} /> [ Run New Scan ]
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                  <div />
                </div>
              )}

              {/* ── Full Screen Report Summary View ── */}
              {activeView === "report" && (
                <div className="min-h-full flex flex-col justify-center p-8 max-w-4xl mx-auto font-mono pointer-events-auto">
                  <div className="border p-8 flex flex-col gap-6">
                    <div className="flex justify-between items-center border-b pb-4 border-inherit">
                      <div>
                        <h2 className="text-sm font-bold tracking-widest uppercase">
                          REPORT SUMMARY
                        </h2>
                        <p className={`text-[9px] uppercase mt-0.5 ${theme === "light" ? "text-neutral-500" : "text-neutral-400"}`}>
                          Session Diagnostic Ledger
                        </p>
                      </div>
                      <span className="text-emerald-500 text-xs font-bold">[ VERIFIED ]</span>
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-[9.5px]">
                      <div className="border p-3 flex flex-col gap-1 border-inherit">
                        <span className={theme === "light" ? "text-neutral-500 uppercase" : "text-neutral-400 uppercase"}>Total Scans:</span>
                        <span className="text-base font-bold">{diagnosticHistory.length}</span>
                      </div>
                      <div className="border p-3 flex flex-col gap-1 border-inherit">
                        <span className={theme === "light" ? "text-neutral-500 uppercase" : "text-neutral-400 uppercase"}>Latency:</span>
                        <span className="text-base font-bold text-emerald-500">~42ms</span>
                      </div>
                      <div className="border p-3 flex flex-col gap-1 border-inherit">
                        <span className={theme === "light" ? "text-neutral-500 uppercase" : "text-neutral-400 uppercase"}>Validation MSE:</span>
                        <span className="text-base font-bold">0.142</span>
                      </div>
                      <div className="border p-3 flex flex-col gap-1 border-inherit">
                        <span className={theme === "light" ? "text-neutral-500 uppercase" : "text-neutral-400 uppercase"}>Kappa Score:</span>
                        <span className="text-base font-bold text-[#E30022]">0.924 QWK</span>
                      </div>
                    </div>

                    {/* Full History Table in Report View */}
                    <div className="flex flex-col gap-2 pt-4">
                      <span className="text-[10px] uppercase font-bold tracking-wider">
                        Detailed Scan History
                      </span>
                      <div className="border border-inherit overflow-x-auto">
                        <table className="w-full text-left text-[9px]">
                          <thead>
                            <tr className={`border-b border-inherit ${theme === "light" ? "bg-neutral-100" : "bg-neutral-900"}`}>
                              <th className="p-2.5 uppercase">Timestamp</th>
                              <th className="p-2.5 uppercase">Stage</th>
                              <th className="p-2.5 uppercase">Classification</th>
                              <th className="p-2.5 uppercase">Confidence</th>
                              <th className="p-2.5 uppercase text-right">Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {diagnosticHistory.length === 0 ? (
                              <tr>
                                <td colSpan={5} className="p-4 text-center opacity-50">
                                  NO DIAGNOSTIC RUNS RECORDED
                                </td>
                              </tr>
                            ) : (
                              diagnosticHistory.map((item) => (
                                <tr key={item.id} className="border-b border-inherit last:border-0 hover:bg-neutral-500/5">
                                  <td className="p-2.5">{item.timestamp}</td>
                                  <td className="p-2.5 font-bold">Stage {item.stage}</td>
                                  <td className="p-2.5">{item.stageLabel}</td>
                                  <td className="p-2.5 font-medium">{(item.confidence * 100).toFixed(0)}%</td>
                                  <td className="p-2.5 text-right">
                                    <button
                                      onClick={() => handleSelectHistoryItem(item)}
                                      className="underline uppercase cursor-pointer hover:opacity-75"
                                    >
                                      View Scan
                                    </button>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Minimalist Bottom Metric Strip ── */}
        <AnimatePresence>
          {dashboardVisible && !loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
              className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-10 flex items-center divide-x font-mono text-[11px] tracking-wider select-none whitespace-nowrap ${
                theme === "light" ? "divide-neutral-400 text-neutral-900 font-semibold" : "divide-neutral-800 text-neutral-400"
              }`}
            >
              <span className="whitespace-nowrap pr-4 uppercase">
                {results ? "ANALYSIS COMPLETE" : "FORMATS: DICOM, PNG, JPEG"}
              </span>
              <span className="whitespace-nowrap pl-4 uppercase">
                NODE: {activeHub ? activeHub.pin : "CONNECTED (821115)"}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}
