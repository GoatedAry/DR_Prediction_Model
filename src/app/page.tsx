"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import { useDropzone } from "react-dropzone";
import { MapPin, Sun, Moon } from "lucide-react";
import LocationGateway from "./components/LocationGateway";
import { supabase } from "./lib/supabaseClient";

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
        Initializing...
      </p>
    </div>
  ),
});

// ─── View State ───────────────────────────────────────────────────────────────
type ActiveView = "idle" | "grader" | "report" | "telemetry";

const NAV_ITEMS = [
  { key: "grader" as const, label: "Diagnostic Grader", hoverStrength: 1.0 },
  { key: "report" as const, label: "Report Summary", hoverStrength: 0.65 },
  { key: "telemetry" as const, label: "Model Telemetry", hoverStrength: 0.35 },
] as const;

// ─── Severity badge color ─────────────────────────────────────────────────────
function getSeverityColor(stage: number): string {
  if (stage === 0) return "text-green-400";
  if (stage === 1) return "text-yellow-400";
  if (stage === 2) return "text-amber-500";
  if (stage === 3) return "text-orange-500";
  return "text-red-500";
}

function getSeverityBorder(stage: number): string {
  if (stage >= 3) return "border-red-500/40";
  if (stage >= 2) return "border-amber-500/40";
  return "border-white/10";
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function Home() {
  // Theme configuration state
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  // Authentication states
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [user, setUser] = useState<any>(null);
  const [authStep, setAuthStep] = useState<"checking" | "ready">("checking");
  const [authMode, setAuthMode] = useState<"email" | "phone">("email");
  const [otpSent, setOtpSent] = useState(false);

  // Guest limitations state
  const [savedCount, setSavedCount] = useState(0);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

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
  const [dismissTarget, setDismissTarget] = useState(1.0); // Starts dispersed pre-login
  const [showEye, setShowEye] = useState(false); // Hides eye pre-login
  const [contentReady, setContentReady] = useState(false);
  const [eyeReady, setEyeReady] = useState(true);

  // CSS staged fade-in / slide-up for authenticated panels
  const [dashboardVisible, setDashboardVisible] = useState(false);

  // Grader state
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<DiagnosticState | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // ── Sync HTML/Body class and background for clean transitions ────────────────
  useEffect(() => {
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

  // ── Welcome Coalescing Eye Matrix Animation ──────────────────────────────────
  const handleLoginSuccess = async (activeUser: any) => {
    setUser(activeUser);
    setAuthError(null);
    setAuthSuccess(null);

    // 1. Mount/reveal the eye by transitioning showEye to true (starts dispersed)
    setShowEye(true);
    setDismissTarget(1.0);
    setEyeReady(false);
    setContentReady(false);

    // 2. Smoothly coalesce eye particles into formed state
    setTimeout(() => {
      setDismissTarget(0.0);
    }, 150);

    // 3. Staged transition: wait until welcome animation completes (1s), then slide up dashboard
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
        // Don't log out if guest user is actively logged in
        setUser((prevUser: any) => {
          if (prevUser?.isGuest) {
            return prevUser;
          }
          setDashboardVisible(false);
          setShowEye(false);
          setDismissTarget(1.0);
          return null;
        });
      }
      setAuthStep("ready");
    });

    return () => subscription.unsubscribe();
  }, []);

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

    // E.164 Clean Format Validation (+91 followed by exactly 10 digits)
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
    } else {
      await supabase.auth.signOut();
    }
    handleNavClick("idle");
  };

  // ── Guest save reports checker ──────────────────────────────────────────────
  const handleSaveReport = () => {
    setErrorMsg(null);
    setSaveMessage(null);

    if (user?.isGuest) {
      if (savedCount >= 1) {
        setErrorMsg("GUEST LIMIT REACHED. PLEASE SIGN IN WITH AN ACCOUNT OR MOBILE NUMBER FOR MORE DATA STORAGE.");
        return;
      }
      setSavedCount((prev) => prev + 1);
      setSaveMessage("SUCCESS: DIAGNOSTIC REPORT SAVED SUCCESSFULLY (1/1 GUEST LIMIT)");
    } else {
      setSaveMessage("SUCCESS: DIAGNOSTIC REPORT SAVED SUCCESSFULLY");
    }
  };

  // ── Navigation handler ──────────────────────────────────────────────────────
  const handleNavClick = (view: ActiveView) => {
    if (view === activeView) return;

    if (view === "idle") {
      // Return home: hide content panel, reform eye
      setContentReady(false);
      setDismissTarget(0);
      setActiveView("idle");
      setEyeReady(false);
      // Reset grader state
      setResults(null);
      setPreviewUrl(null);
      setErrorMsg(null);
      setSaveMessage(null);
    } else {
      // Activate a tool view: dismiss eye, then show content
      setActiveView(view);
      setDismissTarget(1);
      setContentReady(false);
      setEyeReady(false);
    }
  };

  // ── Scene animation callbacks ───────────────────────────────────────────────
  const handleDismissComplete = useCallback(() => {
    setContentReady(true);
  }, []);

  const handleReformComplete = useCallback(() => {
    setEyeReady(true);
  }, []);

  // ── Dropzone handler ────────────────────────────────────────────────────────
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    // Create client-side preview URL
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);

    setLoading(true);
    setErrorMsg(null);
    setSaveMessage(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("http://127.0.0.1:8000/predict", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const data: DiagnosticState = await response.json();
      setResults(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to contact prediction server.";
      console.error(err);
      setErrorMsg(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [] },
    multiple: false,
  });

  // ── Guard checks while session initializes ──────────────────────────────────
  if (authStep === "checking") {
    return (
      <div className="w-full h-full flex items-center justify-center bg-black min-h-screen text-white font-mono uppercase text-[9px] tracking-widest">
        INITIALIZING SECURE LINK...
      </div>
    );
  }

  // ── Force Auth Gateway UI first if not logged in ─────────────────────────────
  if (!user) {
    return (
      <main className={`relative flex items-center justify-center h-screen select-none font-mono ${
        theme === "light" ? "bg-white text-black" : "bg-black text-white"
      }`}>
        {/* WebGL background Scene */}
        <div className="absolute inset-0 z-0">
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
          {/* Header & Theme switcher */}
          <div className={`flex items-center justify-between pb-3 border-b ${
            theme === "light" ? "border-black/10" : "border-white/10"
          }`}>
            <span className="text-[10px] tracking-[0.2em] font-bold uppercase">
              Authentication Portal
            </span>
            <button
              onClick={() => setTheme(theme === "light" ? "dark" : "light")}
              className={`p-1.5 border transition-all cursor-pointer ${
                theme === "light"
                  ? "border-black/10 hover:border-black/30 text-black"
                  : "border-white/10 hover:border-white/30 text-white"
              }`}
              title="Toggle Theme"
            >
              {theme === "light" ? <Moon size={11} /> : <Sun size={11} />}
            </button>
          </div>

          {/* Feedback */}
          {authError && (
            <div className="border border-red-500/30 bg-red-950/20 text-red-400 p-2 text-[9px] uppercase tracking-wide">
              Error: {authError}
            </div>
          )}
          {authSuccess && (
            <div className="border border-emerald-500/30 bg-emerald-950/20 text-emerald-400 p-2 text-[9px] uppercase tracking-wide">
              Success: {authSuccess}
            </div>
          )}

          {/* Form */}
          {authMode === "email" ? (
            <form onSubmit={handleEmailSignIn} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[8px] opacity-40 tracking-wider">EMAIL ADDRESS</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="enter email"
                  className={`border px-3 py-2 text-xs focus:outline-none rounded-none font-sans ${
                    theme === "light"
                      ? "bg-white border-black/20 text-black focus:border-black/40"
                      : "bg-black border-white/20 text-white focus:border-white/40"
                  }`}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[8px] opacity-40 tracking-wider">PASSWORD</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="enter password"
                  className={`border px-3 py-2 text-xs focus:outline-none rounded-none font-sans ${
                    theme === "light"
                      ? "bg-white border-black/20 text-black focus:border-black/40"
                      : "bg-black border-white/20 text-white focus:border-white/40"
                  }`}
                />
              </div>

              <button
                type="submit"
                className={`border transition-colors py-2 text-xs uppercase font-bold tracking-wider cursor-pointer rounded-none mt-2 ${
                  theme === "light"
                    ? "border-black/30 text-black bg-white hover:bg-neutral-100"
                    : "border-white/30 text-white bg-black hover:bg-neutral-900"
                }`}
              >
                [ SIGN IN ]
              </button>
            </form>
          ) : (
            <div className="flex flex-col gap-4">
              {!otpSent ? (
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[8px] opacity-40 tracking-wider">PHONE NUMBER</label>
                    <div className={`flex border px-3 py-2 rounded-none ${
                      theme === "light" ? "border-black/20 bg-white" : "border-white/20 bg-black"
                    }`}>
                      <span className="opacity-40 select-none mr-2 font-mono text-xs">+91</span>
                      <input
                        type="tel"
                        maxLength={10}
                        value={phone}
                        onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                        placeholder="enter 10-digit mobile"
                        className="bg-transparent focus:outline-none font-sans text-xs w-full placeholder-white/20"
                      />
                    </div>
                  </div>

                  <button
                    onClick={handleSendOtp}
                    className={`border transition-colors py-2 text-xs uppercase font-bold tracking-wider cursor-pointer rounded-none ${
                      theme === "light"
                        ? "border-black/30 text-black bg-white hover:bg-neutral-100"
                        : "border-white/30 text-white bg-black hover:bg-neutral-900"
                    }`}
                  >
                    [ SEND OTP ]
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[8px] opacity-40 tracking-wider">ENTER 6-DIGIT OTP</label>
                    <input
                      type="text"
                      maxLength={6}
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                      placeholder="enter otp"
                      className={`border px-3 py-2 text-xs focus:outline-none rounded-none font-sans ${
                        theme === "light"
                          ? "bg-white border-black/20 text-black focus:border-black/40"
                          : "bg-black border-white/20 text-white focus:border-white/40"
                      }`}
                    />
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={handleVerifyOtp}
                      className={`flex-1 border transition-colors py-2 text-xs uppercase font-bold tracking-wider cursor-pointer rounded-none ${
                        theme === "light"
                          ? "border-black/30 text-black bg-white hover:bg-neutral-100"
                          : "border-white/30 text-white bg-black hover:bg-neutral-900"
                      }`}
                    >
                      [ VERIFY ]
                    </button>
                    <button
                      onClick={() => {
                        setOtpSent(false);
                        setOtp("");
                      }}
                      className={`border px-3 py-2 text-xs uppercase font-bold tracking-wider cursor-pointer rounded-none ${
                        theme === "light"
                          ? "border-black/10 text-black/50 bg-white hover:bg-neutral-100 hover:text-black"
                          : "border-white/10 text-white/50 bg-black hover:bg-neutral-900 hover:text-white"
                      }`}
                    >
                      [ BACK ]
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Social Logins + Guest button */}
          {(!otpSent || authMode === "email") && (
            <div className={`flex flex-col gap-2.5 border-t pt-4 ${
              theme === "light" ? "border-black/10" : "border-white/10"
            }`}>
              <span className="text-[8px] opacity-30 text-center tracking-widest uppercase">
                OR CONTINUE WITH
              </span>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => handleOAuthSignIn("google")}
                  className={`flex items-center justify-center border transition-all py-2 text-[10px] uppercase font-bold tracking-wider cursor-pointer rounded-none text-center ${
                    theme === "light"
                      ? "border-black/15 text-black/60 hover:text-black hover:border-black/30 bg-white"
                      : "border-white/15 text-white/60 hover:text-white hover:border-white/30 bg-black"
                  }`}
                >
                  <svg className="w-3 h-3 mr-2" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
                  </svg>
                  [ SIGN IN WITH GOOGLE ]
                </button>
                <button
                  onClick={() => handleOAuthSignIn("github")}
                  className={`flex items-center justify-center border transition-all py-2 text-[10px] uppercase font-bold tracking-wider cursor-pointer rounded-none text-center ${
                    theme === "light"
                      ? "border-black/15 text-black/60 hover:text-black hover:border-black/30 bg-white"
                      : "border-white/15 text-white/60 hover:text-white hover:border-white/30 bg-black"
                  }`}
                >
                  <svg className="w-3 h-3 mr-2 text-current" viewBox="0 0 24 24" fill="currentColor">
                    <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.167 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.579.688.481C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
                  </svg>
                  [ SIGN IN WITH GITHUB ]
                </button>
                <button
                  type="button"
                  onClick={handleGuestSignIn}
                  className={`border transition-colors py-2 text-xs uppercase font-bold tracking-wider cursor-pointer rounded-none text-center ${
                    theme === "light"
                      ? "border-black/15 text-black bg-white hover:bg-neutral-100"
                      : "border-white/15 text-white bg-black hover:bg-neutral-900"
                  }`}
                >
                  [ GUEST LOGIN ]
                </button>
              </div>
            </div>
          )}

          {/* Toggle */}
          <button
            onClick={() => {
              setAuthMode(authMode === "email" ? "phone" : "email");
              setAuthError(null);
              setAuthSuccess(null);
              setOtpSent(false);
            }}
            className={`text-[9px] transition-colors cursor-pointer text-left uppercase font-mono tracking-wider pt-2 ${
              theme === "light" ? "text-black/50 hover:text-black" : "text-white/40 hover:text-white"
            }`}
          >
            {authMode === "email" ? "> USE MOBILE NUMBER INSTEAD" : "> USE EMAIL/PASSWORD INSTEAD"}
          </button>
        </div>
      </main>
    );
  }

  // ── Render Authenticated Portal layout ───────────────────────────────────────
  return (
    <main className={`flex flex-col h-screen select-none transition-all duration-700 ease-out transform ${
      theme === "light" ? "bg-white text-black" : "bg-black text-white"
    }`}>
      {/* ══════════════════════════════════════════════════════════════════════
          Top Navigation Bar
          ══════════════════════════════════════════════════════════════════════ */}
      <nav className={`relative h-14 min-h-[56px] border-b flex items-center px-6 z-50 shrink-0 transition-all duration-700 ${
        theme === "light" ? "border-black/10 bg-white" : "border-white/10 bg-black"
      } ${dashboardVisible ? "translate-y-0 opacity-100" : "-translate-y-4 opacity-0"}`}>
        {/* Left: Logo + Title */}
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
            [N] PROJECT NAME
          </span>
        </div>

        <div className="flex-1" />

        {/* Center: Nav Buttons in Segmented Container */}
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

        {/* Right: Location Badge + Login Status */}
        <div className="flex items-center gap-3">
          <LocationGateway
            inline
            theme={theme}
            onLocationSelect={(hub) => console.log("[LOCATION]", hub)}
          />

          <div className="flex items-center gap-2">
            <span className={`font-mono text-[9px] uppercase tracking-widest ${
              theme === "light" ? "text-neutral-900 font-semibold" : "text-neutral-500"
            }`}>
              {user.email || user.phone || "GUEST NODE"}
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

            {/* Compact Sun/Moon Theme switcher */}
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
        {/* ── 3D Canvas (always mounted for seamless transitions) ── */}
        <div className="absolute inset-0">
          <Scene
            hoverStrength={hoverStrength}
            dismissTarget={dismissTarget}
            showEye={showEye}
            theme={theme}
            onDismissComplete={handleDismissComplete}
            onReformComplete={handleReformComplete}
          />
        </div>

        {/* ── Idle State: Upload CTA & Minimalist Metric Strip ── */}
        <AnimatePresence>
          {dashboardVisible && activeView === "idle" && (
            <>
              {/* Central CTA Button */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                transition={{ duration: 0.4, delay: 0.1 }}
                className="absolute bottom-24 left-1/2 -translate-x-1/2 z-10"
              >
                <button
                  onClick={() => handleNavClick("grader")}
                  className={`font-mono text-xs tracking-widest uppercase border px-8 py-3.5 transition-all duration-200 cursor-pointer backdrop-blur-sm bg-transparent rounded-none ${
                    theme === "light"
                      ? "text-black border-neutral-500 hover:border-black hover:bg-neutral-100/50 bg-white"
                      : "text-white border-white/30 hover:border-neutral-400 hover:bg-neutral-900/50"
                  }`}
                >
                  Upload Fundus Scan
                </button>
              </motion.div>

              {/* Bottom Minimalist Metric Strip */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4, delay: 0.2 }}
                className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-10 flex items-center divide-x font-mono text-[11px] tracking-wider select-none whitespace-nowrap ${
                  theme === "light" ? "divide-neutral-400 text-neutral-900 font-semibold" : "divide-neutral-800 text-neutral-400"
                }`}
              >
                <span className="whitespace-nowrap pr-4 uppercase">FORMATS: DICOM, PNG, JPEG</span>
                <span className="whitespace-nowrap pl-4 uppercase">NODE: CONNECTED (821115)</span>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* ── Active Content Panels ── */}
        <AnimatePresence>
          {dashboardVisible && contentReady && activeView !== "idle" && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 15 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className={`absolute inset-0 z-20 overflow-y-auto ${
                theme === "light" ? "bg-white text-black" : "bg-black text-white"
              }`}
            >
              {/* ── Diagnostic Grader View ── */}
              {activeView === "grader" && (
                <div className="min-h-full flex flex-col items-center justify-center p-8 gap-8 max-w-5xl mx-auto">
                  {!results ? (
                    /* Upload Zone */
                    <div className="w-full max-w-lg flex flex-col gap-6">
                      <div className="text-center">
                        <h2 className="font-mono text-sm tracking-[0.15em] uppercase mb-2">
                          Diagnostic Grader
                        </h2>
                        <p className={`text-[10px] tracking-wide ${theme === "light" ? "text-black/50" : "text-white/40"}`}>
                          Upload a fundus scan image for automated DR staging analysis
                        </p>
                      </div>

                      <div
                        {...getRootProps()}
                        className={`border border-dashed p-14 flex flex-col items-center justify-center cursor-pointer transition-colors duration-150 ${
                          isDragActive
                            ? (theme === "light" ? "border-black bg-black/5" : "border-white bg-white/5")
                            : (theme === "light" ? "border-black/20 hover:border-black/50" : "border-white/15 hover:border-white/40")
                        }`}
                      >
                        <input {...getInputProps()} />
                        <p className={`text-[10px] font-mono tracking-[0.18em] text-center uppercase leading-loose whitespace-pre-line ${
                          theme === "light" ? "text-black/60" : "text-white/50"
                        }`}>
                          {isDragActive
                            ? "Drop scan here"
                            : "Drop fundus scan\nor click to browse"}
                        </p>
                      </div>

                      {loading && (
                        <div className="flex flex-col items-center gap-3 py-4">
                          <p className={`text-[10px] font-mono tracking-wider animate-pulse uppercase ${
                            theme === "light" ? "text-black/75" : "text-white/60"
                          }`}>
                            Analyzing scan...
                          </p>
                          <div className="flex gap-1.5">
                            {[0, 1, 2, 3, 4].map((i) => (
                              <motion.span
                                key={i}
                                className={`block w-1 h-1 ${theme === "light" ? "bg-black" : "bg-white"}`}
                                animate={{ opacity: [0.15, 1, 0.15] }}
                                transition={{
                                  duration: 0.9,
                                  repeat: Infinity,
                                  delay: i * 0.14,
                                  ease: "easeInOut",
                                }}
                              />
                            ))}
                          </div>
                        </div>
                      )}

                      {errorMsg && (
                        <div className="p-3 border border-red-500/30 bg-red-950/20 text-red-400 font-mono text-[9.5px] uppercase tracking-wide">
                          {errorMsg}
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Results View: Side-by-side */
                    <div className="w-full flex flex-col lg:flex-row gap-8 items-start">
                      {/* Left: Image Preview */}
                      <div className="flex-1 flex flex-col gap-4">
                        <h3 className={`font-mono text-[10px] tracking-widest uppercase ${theme === "light" ? "text-black/40" : "text-white/40"}`}>
                          Uploaded Scan
                        </h3>
                        {previewUrl && (
                          <div className={`border p-2 ${theme === "light" ? "border-black/10" : "border-white/10"}`}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={previewUrl}
                              alt="Fundus scan preview"
                              className="w-full max-h-[400px] object-contain"
                            />
                          </div>
                        )}
                      </div>

                      {/* Right: Diagnostic Report Card */}
                      <div className="flex-1 flex flex-col gap-6">
                        <div>
                          <p className={`text-[9px] font-mono tracking-[0.25em] uppercase ${theme === "light" ? "text-black/40" : "text-white/40"}`}>
                            Inference Result
                          </p>
                          <h2 className="text-sm font-mono font-semibold tracking-[0.1em] uppercase mt-1">
                            DR Diagnostic Report
                          </h2>
                        </div>

                        {/* Severity Badge */}
                        <div
                          className={`inline-flex items-center gap-3 border px-4 py-2 w-fit ${getSeverityBorder(
                            results.integer_stage
                          )}`}
                        >
                          <span
                            className={`text-sm font-mono font-bold ${getSeverityColor(
                              results.integer_stage
                            )}`}
                          >
                            Stage {results.integer_stage}
                          </span>
                          <span className={`text-[9px] font-mono uppercase tracking-widest ${theme === "light" ? "text-black/50" : "text-white/50"}`}>
                            {results.stage_label}
                          </span>
                        </div>

                        {/* Inline Alert / Messages */}
                        {errorMsg && (
                          <div className="p-3 border border-red-500/30 bg-red-950/20 text-red-400 font-mono text-[9.5px] uppercase tracking-wide">
                            {errorMsg}
                          </div>
                        )}

                        {saveMessage && (
                          <div className={`p-3 border font-mono text-[9.5px] uppercase tracking-wide ${
                            theme === "light"
                              ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                              : "border-emerald-500/30 bg-emerald-950/20 text-emerald-400"
                          }`}>
                            {saveMessage}
                          </div>
                        )}

                        {/* Save CTA for diagnostic reports */}
                        <button
                          onClick={handleSaveReport}
                          className={`border font-mono text-[9px] tracking-[0.2em] py-3 uppercase w-full transition-colors duration-200 cursor-pointer ${
                            theme === "light"
                              ? "border-black/30 text-black bg-white hover:bg-neutral-100"
                              : "border-white/30 text-white bg-black hover:bg-neutral-900"
                          }`}
                        >
                          [ SAVE DIAGNOSTIC RESULT ]
                        </button>

                        {/* Data Table */}
                        <table className="w-full text-left font-mono border-collapse">
                          <tbody>
                            {[
                              ["Continuous Score", results.continuous_score.toFixed(3)],
                              ["Clamped Score", results.clamped_score.toFixed(3)],
                              ["Integer Stage", String(results.integer_stage)],
                              ["Stage Label", results.stage_label],
                              ["Val MSE Loss", results.val_mse_loss.toFixed(4)],
                              ["Peak QWK", results.peak_qwk.toFixed(4)],
                            ].map(([label, value]) => (
                              <tr key={label} className={`border-b ${theme === "light" ? "border-black/10" : "border-white/10"}`}>
                                <td className={`py-3 text-[10px] tracking-[0.15em] uppercase ${theme === "light" ? "text-black/40" : "text-white/40"}`}>
                                  {label}
                                </td>
                                <td className="py-3 text-xs text-right tabular-nums">
                                  {value}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>

                        <button
                          onClick={() => {
                            setResults(null);
                            setPreviewUrl(null);
                            setErrorMsg(null);
                            setSaveMessage(null);
                          }}
                          className={`border font-mono text-[9px] tracking-[0.2em] py-3 uppercase hover:bg-white hover:text-black transition-colors duration-200 cursor-pointer ${
                            theme === "light"
                              ? "border-black text-black bg-white"
                              : "border-white text-white bg-black"
                          }`}
                        >
                          Analyze Another Scan
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── Report Summary View (Placeholder) ── */}
              {activeView === "report" && (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center">
                    <h2 className="font-mono text-sm tracking-[0.15em] uppercase mb-3">
                      Report Summary
                    </h2>
                    <p className={`text-[10px] font-mono tracking-wider uppercase ${theme === "light" ? "text-black/30" : "text-white/30"}`}>
                      Coming Soon
                    </p>
                  </div>
                </div>
              )}

              {/* ── Model Telemetry View (Placeholder) ── */}
              {activeView === "telemetry" && (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center">
                    <h2 className="font-mono text-sm tracking-[0.15em] uppercase mb-3">
                      Model Telemetry
                    </h2>
                    <p className={`text-[10px] font-mono tracking-wider uppercase ${theme === "light" ? "text-black/30" : "text-white/30"}`}>
                      Coming Soon
                    </p>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}
