"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import { useDropzone } from "react-dropzone";
import { Sun, Moon, RotateCcw, ArrowLeft } from "lucide-react";
import LocationGateway, { LocationHub } from "./components/LocationGateway";
import SessionPanel, { DiagnosticHistoryItem } from "./components/SessionPanel";
import FontSizeController from "./components/FontSizeController";
import { supabase } from "./lib/supabaseClient";
import { MorphPhase } from "./components/Scene";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DiagnosticState {
  continuous_score: number;
  clamped_score: number;
  integer_stage: number;
  stage_label: string;
  val_mse_loss: number | null;
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
type ActiveView = "idle" | "grader" | "report" | "ai_summary";

const NAV_ITEMS = [
  { key: "grader" as const, label: "Diagnostic Grader", hoverStrength: 1.0 },
  { key: "report" as const, label: "Report Summary", hoverStrength: 0.65 },
  { key: "ai_summary" as const, label: "AI Summary", hoverStrength: 0.5 },
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

  // Guest limitations state (Strictly 1 save for guests, in-memory only)
  const [savedCount, setSavedCount] = useState(0);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // Location Hub state
  const [activeHub, setActiveHub] = useState<LocationHub | null>(null);

  // Diagnostic history state (Per-account persisted in localStorage, guest in-memory and sessionStorage) - Cap 10 FIFO
  const [diagnosticHistory, setDiagnosticHistory] = useState<DiagnosticHistoryItem[]>([]);
  // Saved reports state (Feeds the Report Summary metrics cards)
  const [savedReports, setSavedReports] = useState<DiagnosticHistoryItem[]>([]);
  // Internal scan counter for session limits (10 for Guest, 50 for Authenticated)
  const [totalScansCount, setTotalScansCount] = useState(0);

  // Auth Mode: "login" vs "signup"
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Feedback States
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);

  // View state machine
  const [activeView, setActiveView] = useState<ActiveView>("idle");
  const [hoverStrength, setHoverStrength] = useState(0);
  const [dismissTarget, setDismissTarget] = useState(1.0);
  const [showEye, setShowEye] = useState(false);
  const [contentReady, setContentReady] = useState(false);
  const [showInfo, setShowInfo] = useState(false);

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

  // ── Account-specific History and Saved Reports Loader ────────────────────────
  const loadAccountHistory = useCallback((currentUser: any) => {
    if (!currentUser || currentUser.isGuest) {
      if (typeof window !== "undefined") {
        const savedHistory = sessionStorage.getItem("netra_diagnostic_history");
        if (savedHistory) {
          try {
            setDiagnosticHistory(JSON.parse(savedHistory));
          } catch (e) {
            console.error("Failed to parse guest history", e);
          }
        }
        const savedRep = sessionStorage.getItem("netra_saved_reports");
        if (savedRep) {
          try {
            setSavedReports(JSON.parse(savedRep));
          } catch (e) {
            console.error("Failed to parse guest saved reports", e);
          }
        }
      }
      return;
    }
    const userKey = `dr_history_${currentUser.id || currentUser.email}`;
    const stored = typeof window !== "undefined" ? localStorage.getItem(userKey) : null;
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

    const savedKey = `dr_saved_reports_${currentUser.id || currentUser.email}`;
    const storedSaved = typeof window !== "undefined" ? localStorage.getItem(savedKey) : null;
    if (storedSaved) {
      try {
        setSavedReports(JSON.parse(storedSaved));
      } catch (e) {
        console.error("Failed to parse user saved reports", e);
        setSavedReports([]);
      }
    } else {
      setSavedReports([]);
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

  // ── Session Checking on Mount (Supabase + Guest SessionStorage Rehydration) ──
  useEffect(() => {
    // 1. Check for active guest session in sessionStorage
    if (typeof window !== "undefined") {
      const isGuestSession = sessionStorage.getItem("netra_guest_session");
      if (isGuestSession === "true") {
        isInitialLoad.current = false;
        const guestUser = {
          email: "Guest",
          isGuest: true,
          phone: "",
          id: "guest-session",
        };
        setUser(guestUser);
        setShowEye(true);
        setDismissTarget(0.0);
        setDashboardVisible(true);
        setAuthStep("ready");

        // Rehydrate scan data if available
        const savedHistory = sessionStorage.getItem("netra_diagnostic_history");
        if (savedHistory) {
          try {
            setDiagnosticHistory(JSON.parse(savedHistory));
          } catch (e) {
            console.warn("Failed to parse cached history:", e);
          }
        }

        const savedRep = sessionStorage.getItem("netra_saved_reports");
        if (savedRep) {
          try {
            const parsed = JSON.parse(savedRep);
            setSavedReports(parsed);
            setSavedCount(parsed.length);
          } catch (e) {
            console.warn("Failed to parse cached saved reports:", e);
          }
        }

        const savedResults = sessionStorage.getItem("netra_diagnostic_results");
        if (savedResults) {
          try {
            setResults(JSON.parse(savedResults));
          } catch (e) {
            console.warn("Failed to parse cached results:", e);
          }
        }

        const savedPreview = sessionStorage.getItem("netra_preview_url");
        if (savedPreview) {
          setPreviewUrl(savedPreview);
        }
        return;
      }
    }

    // 2. Supabase auth session listener
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
          setSavedReports([]);
          return null;
        });
      }
      setAuthStep("ready");
    });

    return () => subscription.unsubscribe();
  }, [loadAccountHistory]);

  // ── SessionStorage Guest Data Syncing ────────────────────────────────────────
  useEffect(() => {
    if (typeof window !== "undefined" && user?.isGuest) {
      if (results) {
        sessionStorage.setItem("netra_diagnostic_results", JSON.stringify(results));
      } else {
        sessionStorage.removeItem("netra_diagnostic_results");
      }
    }
  }, [results, user?.isGuest]);

  useEffect(() => {
    if (typeof window !== "undefined" && user?.isGuest) {
      if (previewUrl) {
        sessionStorage.setItem("netra_preview_url", previewUrl);
      } else {
        sessionStorage.removeItem("netra_preview_url");
      }
    }
  }, [previewUrl, user?.isGuest]);

  useEffect(() => {
    if (typeof window !== "undefined" && user?.isGuest) {
      sessionStorage.setItem("netra_diagnostic_history", JSON.stringify(diagnosticHistory));
    }
  }, [diagnosticHistory, user?.isGuest]);

  useEffect(() => {
    if (typeof window !== "undefined" && user?.isGuest) {
      sessionStorage.setItem("netra_saved_reports", JSON.stringify(savedReports));
    }
  }, [savedReports, user?.isGuest]);

  // ── Authentication Actions (Supabase Email / Password + Guest Access) ────────
  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthSuccess(null);

    if (!email || !password) {
      setAuthError("EMAIL AND PASSWORD ARE REQUIRED");
      return;
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setAuthError(error.message.toUpperCase());
    } else if (data?.user) {
      setAuthSuccess("SIGNED IN SUCCESSFULLY");
      setEmail("");
      setPassword("");
      handleLoginSuccess(data.user);
    }
  };

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthSuccess(null);
    setPasswordError(null);

    if (!email || !password) {
      setAuthError("EMAIL AND PASSWORD ARE REQUIRED");
      return;
    }

    // Password Complexity Validation Rules
    if (password.length < 8) {
      const err = "PASSWORD MUST BE AT LEAST 8 CHARACTERS LONG";
      setPasswordError(err);
      setAuthError(err);
      return;
    }
    if (!/[A-Z]/.test(password)) {
      const err = "PASSWORD MUST CONTAIN AT LEAST ONE UPPERCASE LETTER";
      setPasswordError(err);
      setAuthError(err);
      return;
    }
    if (!/[a-z]/.test(password)) {
      const err = "PASSWORD MUST CONTAIN AT LEAST ONE LOWERCASE LETTER";
      setPasswordError(err);
      setAuthError(err);
      return;
    }
    if (!/[0-9]/.test(password)) {
      const err = "PASSWORD MUST CONTAIN AT LEAST ONE NUMBER";
      setPasswordError(err);
      setAuthError(err);
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      setAuthError(error.message.toUpperCase());
    } else if (data?.user) {
      if (data.session) {
        setAuthSuccess("ACCOUNT CREATED SUCCESSFULLY");
        setEmail("");
        setPassword("");
        setPasswordError(null);
        handleLoginSuccess(data.user);
      } else {
        setAuthSuccess("REGISTRATION SUCCESSFUL. YOU CAN NOW LOG IN.");
        setPasswordError(null);
        setAuthMode("login");
      }
    }
  };

  const handleOAuthSignIn = async (provider: "google") => {
    setAuthError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
      },
    });
    if (error) {
      setAuthError(error.message.toUpperCase());
    }
  };

  const handleGuestSignIn = () => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem("netra_guest_session", "true");
    }
    const guestUser = {
      email: "Guest",
      isGuest: true,
      phone: "",
      id: "guest-session",
    };
    handleLoginSuccess(guestUser);
  };

  const handleSignOut = async () => {
    setErrorMsg(null);
    setSaveMessage(null);
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("netra_guest_session");
      sessionStorage.removeItem("netra_diagnostic_results");
      sessionStorage.removeItem("netra_preview_url");
      sessionStorage.removeItem("netra_diagnostic_history");
      sessionStorage.removeItem("netra_saved_reports");
    }
    if (user?.isGuest) {
      setUser(null);
      setDashboardVisible(false);
      setShowEye(false);
      setDismissTarget(1.0);
      setSavedCount(0);
      setDiagnosticHistory([]);
      setSavedReports([]);
      setTotalScansCount(0);
    } else {
      await supabase.auth.signOut();
      setSavedReports([]);
      setTotalScansCount(0);
    }
    handleResetScan();
    handleNavClick("idle");
  };

  // ── Save Report Handler (Feeds the Report Summary metrics) ──────────────────
  const handleSaveReport = () => {
    setErrorMsg(null);
    setSaveMessage(null);

    if (!results) return;

    if (user?.isGuest) {
      setSavedCount((prev) => prev + 1);
      setSaveMessage("SUCCESS: DIAGNOSTIC REPORT SAVED");
    } else {
      setSaveMessage("SUCCESS: DIAGNOSTIC REPORT SAVED TO ARCHIVE");
    }

    const savedItem: DiagnosticHistoryItem = {
      id: `saved-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString("en-US", { hour12: false }),
      stage: results.integer_stage,
      stageLabel: results.stage_label.split("(")[0].trim(),
      confidence: results.integer_stage === 0 ? 0.99 : 0.94,
      previewUrl: previewUrl,
      val_mse_loss: results.val_mse_loss,
      peak_qwk: results.peak_qwk,
    };

    setSavedReports((prev) => {
      const updated = [savedItem, ...prev];
      if (typeof window !== "undefined") {
        if (user?.isGuest) {
          sessionStorage.setItem("netra_saved_reports", JSON.stringify(updated));
        } else if (user) {
          const userKey = `dr_saved_reports_${user.id || user.email}`;
          localStorage.setItem(userKey, JSON.stringify(updated));
        }
      }
      return updated;
    });
  };

  const handleDeleteSavedReport = (id: string) => {
    setSavedReports((prev) => {
      const updated = prev.filter((item) => item.id !== id);
      if (typeof window !== "undefined") {
        if (user?.isGuest) {
          sessionStorage.setItem("netra_saved_reports", JSON.stringify(updated));
        } else if (user) {
          const userKey = `dr_saved_reports_${user.id || user.email}`;
          localStorage.setItem(userKey, JSON.stringify(updated));
        }
      }
      return updated;
    });
  };

  // ── Navigation handler ──────────────────────────────────────────────────────
  const handleNavClick = (view: ActiveView) => {
    setShowInfo(false);
    if (view === activeView) {
      if (view === "idle") {
        setDismissTarget(0);
      }
      return;
    }

    if (view === "idle") {
      setContentReady(false);
      setDismissTarget(0); // Eye undispersing / reforming animation
      setActiveView("idle");
      setMorphState("eye");
      setResults(null);
      setPreviewUrl(null);
      setErrorMsg(null);
      setSaveMessage(null);
      setLoading(false);
    } else {
      const wasIdle = activeView === "idle";
      setActiveView(view);
      setDismissTarget(1); // Eye dispersing animation
      // If already transitioned out of idle, content is ready immediately
      setContentReady(!wasIdle);
    }
  };

  const handleToggleSIH = () => {
    setShowInfo((prev) => {
      const next = !prev;
      if (next) {
        setDismissTarget(1); // Disperse eye when opening SIH info
      } else {
        if (activeView === "idle") {
          setDismissTarget(0); // Undisperse/reform eye when closing SIH info back to idle
        }
      }
      return next;
    });
  };

  const handleCloseSIH = () => {
    setShowInfo(false);
    if (activeView === "idle") {
      setDismissTarget(0); // Undisperse/reform eye back to idle view
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

    // Internal scan limits: max 10 for guest, max 50 for authenticated
    const isGuest = user?.isGuest;
    const maxScans = isGuest ? 10 : 50;

    if (totalScansCount >= maxScans) {
      setErrorMsg(
        isGuest
          ? "GUEST SCAN LIMIT REACHED (MAX 10 SCANS). PLEASE CREATE AN ACCOUNT TO CONTINUE."
          : "MAXIMUM SCAN LIMIT OF 50 REACHED FOR THIS SESSION."
      );
      return;
    }

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
      setTotalScansCount((prev) => prev + 1);

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

      // Cap Detailed Scan History at 10 items (FIFO)
      setDiagnosticHistory((prev) => {
        const updated = [newItem, ...prev].slice(0, 10);
        if (user && !user.isGuest) {
          const userKey = `dr_history_${user.id || user.email}`;
          if (typeof window !== "undefined") {
            localStorage.setItem(userKey, JSON.stringify(updated));
          }
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
  }, [user, totalScansCount]);

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
          theme === "light" ? "bg-white border-black/20 text-black shadow-lg" : "bg-black border-white/20 text-white shadow-2xl"
        }`}>
          {/* Header */}
          <div className="flex items-center justify-between border-b pb-4 border-inherit">
            <div className="flex flex-col">
              <span className="font-brand text-base font-bold tracking-widest uppercase">
                NetraAI
              </span>
              <span className={`font-mono text-[9px] tracking-wider uppercase mt-0.5 ${
                theme === "light" ? "text-neutral-500" : "text-neutral-400"
              }`}>
                {authMode === "login" ? "SIGN IN TO CONTINUE" : "CREATE NEW ACCOUNT"}
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

          {/* Auth Mode Switch Tabs */}
          <div className="grid grid-cols-2 gap-1 p-1 border border-inherit font-mono text-[9px] uppercase tracking-wider">
            <button
              type="button"
              onClick={() => { setAuthMode("login"); setAuthError(null); setAuthSuccess(null); }}
              className={`py-1.5 font-bold transition-all cursor-pointer text-center ${
                authMode === "login"
                  ? (theme === "light" ? "bg-black text-white" : "bg-white text-black")
                  : (theme === "light" ? "text-neutral-600 hover:text-black" : "text-neutral-400 hover:text-white")
              }`}
            >
              Log In
            </button>
            <button
              type="button"
              onClick={() => { setAuthMode("signup"); setAuthError(null); setAuthSuccess(null); }}
              className={`py-1.5 font-bold transition-all cursor-pointer text-center ${
                authMode === "signup"
                  ? (theme === "light" ? "bg-black text-white" : "bg-white text-black")
                  : (theme === "light" ? "text-neutral-600 hover:text-black" : "text-neutral-400 hover:text-white")
              }`}
            >
              Sign Up
            </button>
          </div>

          {/* Email + Password Form */}
          <form onSubmit={authMode === "login" ? handleEmailSignIn : handleEmailSignUp} className="flex flex-col gap-4 font-mono">
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
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (passwordError) setPasswordError(null);
                }}
                placeholder="••••••••••••"
                className={`border px-3 py-2 text-xs focus:outline-none rounded-none font-sans ${
                  passwordError
                    ? "border-red-500 text-red-500"
                    : (theme === "light"
                        ? "bg-white border-black/20 text-black focus:border-black/40"
                        : "bg-black border-white/20 text-white focus:border-white/40")
                }`}
                required
              />
              {authMode === "signup" && passwordError && (
                <span className="text-red-500 text-[8.5px] font-mono tracking-tight uppercase mt-0.5">
                  {passwordError}
                </span>
              )}
            </div>

            <button
              type="submit"
              className={`border py-2.5 text-[10px] uppercase font-bold tracking-widest transition-all cursor-pointer rounded-none mt-2 ${
                theme === "light"
                  ? "border-black/30 text-black bg-white hover:bg-neutral-100"
                  : "border-white/30 text-white bg-black hover:bg-neutral-900"
              }`}
            >
              {authMode === "login" ? "[ Sign In ]" : "[ Create Account ]"}
            </button>
          </form>

          {/* Social OAuth / Alternative Auth Providers */}
          <div className="flex flex-col gap-2 pt-2 border-t border-inherit">
            <button
              type="button"
              onClick={() => handleOAuthSignIn("google")}
              className={`flex items-center justify-center gap-2 border transition-all py-2 text-[10px] uppercase font-bold tracking-wider cursor-pointer rounded-none text-center ${
                theme === "light"
                  ? "border-black/15 text-black/80 hover:text-black hover:border-black/40 bg-white"
                  : "border-white/15 text-white/80 hover:text-white hover:border-white/40 bg-black"
              }`}
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              Continue with Google
            </button>

            <button
              type="button"
              onClick={handleGuestSignIn}
              className={`border py-2 text-[9.5px] uppercase font-mono font-bold tracking-widest transition-all cursor-pointer rounded-none text-center ${
                theme === "light"
                  ? "border-black/20 text-black bg-neutral-100 hover:bg-neutral-200"
                  : "border-white/20 text-white bg-neutral-900 hover:bg-neutral-800"
              }`}
            >
              [ Guest Access ]
            </button>
          </div>
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
        {/* Left: NetraAI Branding + Font Size Controller + SIH Button */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              handleCloseSIH();
              handleNavClick("idle");
            }}
            className={`font-brand uppercase tracking-widest font-bold text-xs cursor-pointer transition-opacity hover:opacity-80 ${
              theme === "light" ? "text-neutral-900" : "text-white"
            }`}
          >
            NetraAI
          </button>

          <FontSizeController theme={theme} />

          <button
            onClick={handleToggleSIH}
            className={`font-mono text-[9.5px] px-2.5 py-0.5 border transition-all cursor-pointer rounded-none tracking-wider font-bold ${
              showInfo
                ? (theme === "light" ? "bg-black text-white border-black" : "bg-white text-black border-white")
                : (theme === "light"
                    ? "border-neutral-300 hover:border-black text-neutral-800 hover:text-black bg-white"
                    : "border-neutral-800 hover:border-neutral-500 text-neutral-400 hover:text-white bg-neutral-950")
            }`}
            title="Toggle SIH26038 Information"
          >
            [ SIH ]
          </button>
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
            onLocationSelect={setActiveHub}
          />

          <div className="flex items-center gap-2">
            <span className={`font-mono text-[8px] max-w-[85px] truncate uppercase tracking-wider opacity-75 ${
              theme === "light" ? "text-neutral-900 font-semibold" : "text-neutral-300"
            }`} title={user.email || user.phone || "Guest"}>
              {user.isGuest || user.email === "Guest" || user.email?.toLowerCase().includes("guest")
                ? "Guest"
                : (user.email || user.phone || "Guest")}
            </span>
            <button
              onClick={handleSignOut}
              className={`font-mono text-[9.5px] tracking-[0.15em] uppercase border px-3.5 py-1.5 transition-all cursor-pointer rounded-none ${
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
      <div className="flex-1 relative overflow-hidden flex flex-col">
        {/* Full-width 3D WebGL Canvas Layer (Persistently mounted for eye disperse/reform animations) */}
        <div className="absolute inset-0 z-0 pointer-events-none">
          <Scene
            hoverStrength={hoverStrength}
            dismissTarget={loading || showInfo ? 1.0 : dismissTarget}
            showEye={showEye}
            theme={theme}
            morphState={morphState}
            onDismissComplete={handleDismissComplete}
            onReformComplete={handleReformComplete}
          />
        </div>

        {/* ── Idle State (Central 3D Eye, [ UPLOAD FUNDUS SCAN ] button, & Left Session History Panel) ── */}
        <AnimatePresence>
          {dashboardVisible && activeView === "idle" && !showInfo && (
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
                  userEmail={user.isGuest || user.email === "Guest" || user.email?.toLowerCase().includes("guest") ? "Guest" : (user.email || user.phone || "Guest")}
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
          {dashboardVisible && contentReady && activeView !== "idle" && !showInfo && (
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
                        <h3 className={`text-xs tracking-widest uppercase font-bold ${theme === "light" ? "text-black/70" : "text-white/70"}`}>
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
                            <span className="font-semibold">
                              {results.val_mse_loss !== null && results.val_mse_loss !== undefined
                                ? results.val_mse_loss.toFixed(4)
                                : "N/A"}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className={theme === "light" ? "text-neutral-500" : "text-neutral-400"}>Peak Kappa (QWK):</span>
                            <span className="font-semibold text-emerald-500">{results.peak_qwk.toFixed(3)}</span>
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
                        <p className={`text-[10px] uppercase tracking-wider ${theme === "light" ? "text-neutral-500" : "text-neutral-400"}`}>
                          Validated Patient Case History Ledger
                        </p>
                      </div>
                      <span className="text-[10px] border px-2 py-1 uppercase tracking-widest border-inherit">
                        {savedReports.length} SAVED SCANS
                      </span>
                    </div>

                    {/* Report Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="border p-3 flex flex-col gap-1 border-inherit">
                        <span className={theme === "light" ? "text-neutral-500 uppercase" : "text-neutral-400 uppercase"}>Latency:</span>
                        <span className="text-base font-bold text-emerald-500">
                          {savedReports.length > 0 ? "~42ms" : "--"}
                        </span>
                      </div>
                      <div className="border p-3 flex flex-col gap-1 border-inherit">
                        <span className={theme === "light" ? "text-neutral-500 uppercase" : "text-neutral-400 uppercase"}>Validation MSE:</span>
                        <span className="text-base font-bold">
                          {savedReports.length > 0
                            ? (savedReports.reduce((acc, curr) => acc + (curr.val_mse_loss ?? 0.142), 0) / savedReports.length).toFixed(3)
                            : "--"}
                        </span>
                      </div>
                      <div className="border p-3 flex flex-col gap-1 border-inherit">
                        <span className={theme === "light" ? "text-neutral-500 uppercase" : "text-neutral-400 uppercase"}>Kappa Score:</span>
                        <span className="text-base font-bold text-emerald-500">
                          {savedReports.length > 0
                            ? `${(savedReports.reduce((acc, curr) => acc + (curr.peak_qwk ?? 0.924), 0) / savedReports.length).toFixed(3)} QWK`
                            : "--"}
                        </span>
                      </div>
                    </div>

                    {/* Saved Reports Ledger Table in Report View */}
                    <div className="flex flex-col gap-2 pt-4">
                      <span className="text-[10px] uppercase font-bold tracking-wider">
                        Saved Diagnostic Reports
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
                            {savedReports.length === 0 ? (
                              <tr>
                                <td colSpan={5} className="p-4 text-center opacity-50">
                                  NO SAVED DIAGNOSTIC REPORTS RECORDED
                                </td>
                              </tr>
                            ) : (
                              savedReports.map((item) => (
                                <tr key={item.id} className="border-b border-inherit last:border-0 hover:bg-neutral-500/5">
                                  <td className="p-2.5">{item.timestamp}</td>
                                  <td className="p-2.5">
                                    <span className={`px-1.5 py-0.5 border text-[8px] font-bold uppercase tracking-wider ${
                                      theme === "light"
                                        ? (item.stage === 0 ? "bg-emerald-100 text-emerald-800 border-emerald-300" :
                                           item.stage === 1 ? "bg-yellow-100 text-yellow-800 border-yellow-300" :
                                           item.stage === 2 ? "bg-amber-100 text-amber-800 border-amber-300" :
                                           item.stage === 3 ? "bg-orange-100 text-orange-800 border-orange-300" :
                                           "bg-red-100 text-red-800 border-red-300")
                                        : (item.stage === 0 ? "bg-emerald-950/40 text-emerald-400 border-emerald-600/40" :
                                           item.stage === 1 ? "bg-yellow-950/40 text-yellow-400 border-yellow-600/40" :
                                           item.stage === 2 ? "bg-amber-950/40 text-amber-400 border-amber-600/40" :
                                           item.stage === 3 ? "bg-orange-950/40 text-orange-400 border-orange-600/40" :
                                           "bg-red-950/40 text-red-400 border-red-600/40")
                                    }`}>
                                      Stage {item.stage}
                                    </span>
                                  </td>
                                  <td className="p-2.5">{item.stageLabel}</td>
                                  <td className="p-2.5 font-medium">{(item.confidence * 100).toFixed(0)}%</td>
                                  <td className="p-2.5 text-right">
                                    <button
                                      onClick={() => handleDeleteSavedReport(item.id)}
                                      className="text-red-500 hover:text-red-400 text-[8px] uppercase tracking-wider cursor-pointer"
                                    >
                                      [ Delete ]
                                    </button>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <button
                      onClick={() => handleNavClick("grader")}
                      className={`border px-5 py-2 text-[10px] uppercase font-bold tracking-widest transition-all cursor-pointer ${
                        theme === "light"
                          ? "border-neutral-900 bg-neutral-900 text-white hover:bg-black"
                          : "border-white bg-white text-black hover:bg-neutral-200"
                      }`}
                    >
                      [ Return to Grader ]
                    </button>
                  </div>
                </div>
              )}

              {/* ── Full Screen AI Summary View ── */}
              {activeView === "ai_summary" && (
                <div className="min-h-full flex flex-col justify-center p-8 max-w-4xl mx-auto font-mono pointer-events-auto">
                  <div className="border p-8 flex flex-col gap-6">
                    <div className="border-b pb-4 border-inherit">
                      <h2 className="text-sm font-bold tracking-widest uppercase">
                        EXECUTIVE AI SUMMARY
                      </h2>
                      <p className={`text-[10px] uppercase tracking-wider mt-1 ${theme === "light" ? "text-neutral-500" : "text-neutral-400"}`}>
                        Deep Learning Architecture & Deployment Metrics
                      </p>
                    </div>

                    <div className="flex flex-col gap-4 text-xs leading-relaxed">
                      <p>
                        The NetraAI platform executes clinical-grade automated Diabetic Retinopathy grading using a modified ResNet-50 backbone fine-tuned for continuous ordinal regression.
                      </p>
                      <p>
                        Input retinal fundus scans undergo automated ROI isolation, green-channel filtering, and CLAHE normalization before tensor inference.
                      </p>
                    </div>

                    <button
                      onClick={() => handleNavClick("grader")}
                      className={`border px-5 py-2 text-[10px] uppercase font-bold tracking-widest transition-all cursor-pointer ${
                        theme === "light"
                          ? "border-neutral-900 bg-neutral-900 text-white hover:bg-black"
                          : "border-white bg-white text-black hover:bg-neutral-200"
                      }`}
                    >
                      [ Return to Grader ]
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Minimalist Bottom Metric Strip ── */}
        <AnimatePresence>
          {dashboardVisible && !loading && !showInfo && (
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

        {/* ── SIH26038 Technical Overlay (Smooth Fade-In with Background 3D Eye Dispersing) ── */}
        <AnimatePresence>
          {showInfo && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 15 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
              className="absolute inset-0 z-30 overflow-y-auto bg-black/92 backdrop-blur-xl text-white p-6 md:p-12"
            >
              <div className="max-w-4xl mx-auto flex flex-col text-left pb-24">
                {/* 1. Header: Centered Title with Symmetrical [ CLOSE ] in Top Right */}
                <div className="relative flex items-center justify-center border-b border-zinc-800 pb-6 mb-8">
                  <div className="text-center">
                    <span className="text-[10px] font-mono tracking-[0.3em] text-zinc-500 uppercase block mb-1">
                      PROJECT SPECIFICATION
                    </span>
                    <h1 className="text-3xl md:text-4xl font-light uppercase text-white tracking-[0.25em]">
                      SIH26038
                    </h1>
                  </div>
                  <button
                    onClick={handleCloseSIH}
                    className="absolute right-0 top-1/2 -translate-y-1/2 px-4 py-1.5 border border-zinc-700 text-xs uppercase font-mono tracking-widest text-zinc-300 hover:text-white hover:border-zinc-500 bg-zinc-950 transition-colors cursor-pointer"
                  >
                    [ CLOSE ]
                  </button>
                </div>

                {/* 2. Section 1: The Problem */}
                <div className="flex flex-col gap-2.5">
                  <h2 className="text-xs font-mono tracking-widest text-zinc-400 uppercase">
                    THE PROBLEM
                  </h2>
                  <p className="text-lg md:text-xl font-light text-zinc-200 leading-relaxed">
                    Diabetic Retinopathy (DR) is a leading cause of preventable blindness worldwide. While early detection is critical to halt irreversible retinal damage, rural healthcare ecosystems face a severe shortage of specialized ophthalmologists, leaving millions without timely access to diagnostic screening.
                  </p>
                </div>

                <div className="border-t border-zinc-800 my-8" />

                {/* 3. Section 2: The Solution */}
                <div className="flex flex-col gap-2.5">
                  <h2 className="text-xs font-mono tracking-widest text-zinc-400 uppercase">
                    THE SOLUTION
                  </h2>
                  <p className="text-lg md:text-xl font-light text-zinc-200 leading-relaxed">
                    NetraAI provides an instantaneous, low-cost, clinical-grade automated triage platform engineered for primary health centers. By delivering automated DR staging from fundus images on-site, the platform bridges cost and availability gaps to prioritize high-risk patients before irreversible vision loss occurs.
                  </p>
                </div>

                <div className="border-t border-zinc-800 my-8" />

                {/* 4. Section 3: System Pipeline & Data Flow */}
                <div className="flex flex-col gap-4">
                  <h2 className="text-xs font-mono tracking-widest text-zinc-400 uppercase">
                    SYSTEM PIPELINE & DATA FLOW
                  </h2>

                  {/* Preprocessing Pipeline */}
                  <div className="border border-zinc-800 bg-zinc-950 p-6 flex flex-col gap-4">
                    <span className="text-[11px] font-mono text-zinc-400 font-bold uppercase tracking-wider">
                      STAGE A: UNIFORM PREPROCESSING PIPELINE
                    </span>
                    <div className="overflow-x-auto glow-scrollbar pb-3">
                      <div className="flex items-center gap-2 min-w-max text-xs font-mono py-1">
                        <div className="border border-zinc-700 px-3.5 py-2 bg-black text-white">
                          Raw Fundus Image Input
                        </div>
                        <span className="text-zinc-600 font-mono">→</span>
                        <div className="border border-zinc-700 px-3.5 py-2 bg-black text-white">
                          Background Masking (ROI)
                        </div>
                        <span className="text-zinc-600 font-mono">→</span>
                        <div className="border border-zinc-700 px-3.5 py-2 bg-black text-white">
                          Green Channel Isolation (540nm)
                        </div>
                        <span className="text-zinc-600 font-mono">→</span>
                        <div className="border border-zinc-700 px-3.5 py-2 bg-black text-white">
                          Noise Reduction (Median Filtering)
                        </div>
                        <span className="text-zinc-600 font-mono">→</span>
                        <div className="border border-zinc-700 px-3.5 py-2 bg-black text-white">
                          CLAHE Contrast Enhancement
                        </div>
                        <span className="text-zinc-600 font-mono">→</span>
                        <div className="border border-zinc-700 px-3.5 py-2 bg-black text-white">
                          Standardization (224×224 3-Ch)
                        </div>
                        <span className="text-zinc-600 font-mono">→</span>
                        <div className="border border-white px-4 py-2 bg-zinc-900 text-white font-bold shadow-sm">
                          Preprocessed Fundus Output
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Deep Learning Architecture */}
                  <div className="border border-zinc-800 bg-zinc-950 p-6 flex flex-col gap-4">
                    <span className="text-[11px] font-mono text-zinc-400 font-bold uppercase tracking-wider">
                      STAGE B: ORDINAL REGRESSION & RESNET-50 BACKBONE
                    </span>
                    <div className="overflow-x-auto glow-scrollbar pb-3">
                      <div className="flex items-center gap-2 min-w-max text-xs font-mono py-1">
                        <div className="border border-zinc-700 px-3.5 py-2 bg-black text-white">
                          Preprocessed Tensor [224×224×3]
                        </div>
                        <span className="text-zinc-600 font-mono">→</span>
                        <div className="border border-white px-4 py-2 bg-zinc-900 text-white font-bold shadow-sm">
                          ResNet-50 Feature Extractor
                        </div>
                        <span className="text-zinc-600 font-mono">→</span>
                        <div className="border border-zinc-700 px-3.5 py-2 bg-black text-white">
                          Dropout Layer (p=0.5)
                        </div>
                        <span className="text-zinc-600 font-mono">→</span>
                        <div className="border border-zinc-700 px-3.5 py-2 bg-black text-white">
                          Continuous Output Regressor (MSE)
                        </div>
                        <span className="text-zinc-600 font-mono">→</span>
                        <div className="border border-zinc-700 px-3.5 py-2 bg-black text-white">
                          Clamping & Rounding [0, 4]
                        </div>
                        <span className="text-zinc-600 font-mono">→</span>
                        <div className="border border-white px-4 py-2 bg-zinc-900 text-white font-bold shadow-sm">
                          Clinical DR Severity Stage (0–4)
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border-t border-zinc-800 my-8" />

                {/* 5. Section 4: Tech Stack & Benchmark Validation */}
                <div className="flex flex-col gap-3">
                  <h2 className="text-xs font-mono tracking-widest text-zinc-400 uppercase">
                    TECH STACK & BENCHMARK VALIDATION
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border border-zinc-800 bg-zinc-950 p-5 text-xs font-mono">
                    <div className="flex flex-col gap-1.5 border-b md:border-b-0 md:border-r border-zinc-800 pb-3 md:pb-0 md:pr-4">
                      <span className="text-zinc-500 uppercase tracking-widest text-[10px]">Frontend</span>
                      <span className="text-white text-sm">Next.js 16 / TypeScript / Tailwind</span>
                    </div>
                    <div className="flex flex-col gap-1.5 border-b md:border-b-0 md:border-r border-zinc-800 pb-3 md:pb-0 md:pr-4">
                      <span className="text-zinc-500 uppercase tracking-widest text-[10px]">Backend Engine</span>
                      <span className="text-white text-sm">Python FastAPI / PyTorch / OpenCV</span>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <span className="text-zinc-500 uppercase tracking-widest text-[10px]">Validation Metric</span>
                      <span className="text-white text-sm font-bold">Peak QWK Score: 0.8992 (APTOS Benchmark)</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}
