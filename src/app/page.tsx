"use client";

import { useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import { useDropzone } from "react-dropzone";
import LocationGateway from "./components/LocationGateway";

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
  // View state machine
  const [activeView, setActiveView] = useState<ActiveView>("idle");
  const [hoverStrength, setHoverStrength] = useState(0);
  const [dismissTarget, setDismissTarget] = useState(0);
  const [contentReady, setContentReady] = useState(false);
  const [eyeReady, setEyeReady] = useState(true);

  // Grader state
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<DiagnosticState | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

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

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <main className="flex flex-col h-screen bg-black text-white select-none">
      {/* ══════════════════════════════════════════════════════════════════════
          Top Navigation Bar
          ══════════════════════════════════════════════════════════════════════ */}
      <nav className="relative h-14 min-h-[56px] border-b border-white/10 flex items-center px-6 z-50 bg-black shrink-0">
        {/* Left: Logo + Title */}
        <div
          className="flex items-center cursor-pointer group bg-neutral-950 border border-neutral-800 rounded-full px-4 py-1.5 hover:border-neutral-700 transition-all"
          onClick={() => handleNavClick("idle")}
        >
          <span className="font-mono text-[10px] font-bold tracking-[0.2em] text-white">
            [?] PROJECT NAME
          </span>
        </div>

        <div className="flex-1" />

        {/* Center: Nav Buttons in Segmented Container */}
        <div className="absolute left-1/2 -translate-x-1/2 bg-neutral-950/80 border border-neutral-800/80 rounded-full px-1.5 py-1 flex items-center gap-1 backdrop-blur-md">
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
                  ? "text-white bg-neutral-800/90 border border-neutral-700/60 rounded-full px-4 py-1.5 text-xs font-mono font-medium shadow-sm transition-all duration-200 cursor-pointer"
                  : "text-neutral-400 hover:text-white px-3 py-1.5 text-xs font-mono transition-colors duration-200 cursor-pointer border border-transparent"
              }
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        {/* Right: Location Badge + Login */}
        <div className="flex items-center gap-4">
          <LocationGateway
            inline
            onLocationSelect={(hub) => console.log("[LOCATION]", hub)}
          />
          <button className="font-mono text-[9.5px] tracking-[0.15em] uppercase text-white/40 hover:text-white border border-white/10 hover:border-white/30 px-4 py-2 transition-all cursor-pointer">
            Login
          </button>
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
            onDismissComplete={handleDismissComplete}
            onReformComplete={handleReformComplete}
          />
        </div>

        {/* ── Idle State: Upload CTA & Minimalist Metric Strip ── */}
        <AnimatePresence>
          {activeView === "idle" && eyeReady && (
            <>
              {/* Central CTA Button */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                transition={{ duration: 0.4, delay: 0.3 }}
                className="absolute bottom-24 left-1/2 -translate-x-1/2 z-10"
              >
                <button
                  onClick={() => handleNavClick("grader")}
                  className="font-mono text-xs tracking-widest uppercase text-white border border-white/30 px-8 py-3.5 hover:border-neutral-400 hover:bg-neutral-900 transition-all duration-200 cursor-pointer backdrop-blur-sm bg-black/30 rounded-none"
                >
                  Upload Fundus Scan
                </button>
              </motion.div>

              {/* Bottom Minimalist Metric Strip */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4, delay: 0.4 }}
                className="fixed bottom-6 left-1/2 -translate-x-1/2 z-10 flex items-center divide-x divide-neutral-800 font-mono text-[11px] tracking-wider text-neutral-400 select-none whitespace-nowrap"
              >
                <span className="whitespace-nowrap pr-4 uppercase">FORMATS: DICOM, PNG, JPEG</span>
                <span className="whitespace-nowrap pl-4 uppercase">NODE: CONNECTED (821115)</span>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* ── Active Content Panels ── */}
        <AnimatePresence>
          {contentReady && activeView !== "idle" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="absolute inset-0 z-20 bg-black overflow-y-auto"
            >
              {/* ── Diagnostic Grader View ── */}
              {activeView === "grader" && (
                <div className="min-h-full flex flex-col items-center justify-center p-8 gap-8 max-w-5xl mx-auto">
                  {!results ? (
                    /* Upload Zone */
                    <div className="w-full max-w-lg flex flex-col gap-6">
                      <div className="text-center">
                        <h2 className="font-mono text-sm tracking-[0.15em] uppercase text-white mb-2">
                          Diagnostic Grader
                        </h2>
                        <p className="text-[10px] text-white/40 tracking-wide">
                          Upload a fundus scan image for automated DR staging analysis
                        </p>
                      </div>

                      <div
                        {...getRootProps()}
                        className={`border border-dashed p-14 flex flex-col items-center justify-center cursor-pointer transition-colors duration-150 ${
                          isDragActive
                            ? "border-white bg-white/5"
                            : "border-white/15 hover:border-white/40"
                        }`}
                      >
                        <input {...getInputProps()} />
                        <p className="text-[10px] font-mono tracking-[0.18em] text-white/50 text-center uppercase leading-loose whitespace-pre-line">
                          {isDragActive
                            ? "Drop scan here"
                            : "Drop fundus scan\nor click to browse"}
                        </p>
                      </div>

                      {loading && (
                        <div className="flex flex-col items-center gap-3 py-4">
                          <p className="text-[10px] font-mono tracking-wider text-white/60 animate-pulse uppercase">
                            Analyzing scan...
                          </p>
                          <div className="flex gap-1.5">
                            {[0, 1, 2, 3, 4].map((i) => (
                              <motion.span
                                key={i}
                                className="block w-1 h-1 bg-white"
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
                        <h3 className="font-mono text-[10px] tracking-widest text-white/40 uppercase">
                          Uploaded Scan
                        </h3>
                        {previewUrl && (
                          <div className="border border-white/10 p-2">
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
                          <p className="text-[9px] font-mono tracking-[0.25em] text-white/40 uppercase">
                            Inference Result
                          </p>
                          <h2 className="text-sm font-mono font-semibold tracking-[0.1em] text-white uppercase mt-1">
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
                          <span className="text-[9px] font-mono uppercase tracking-widest text-white/50">
                            {results.stage_label}
                          </span>
                        </div>

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
                              <tr key={label} className="border-b border-white/10">
                                <td className="py-3 text-[10px] tracking-[0.15em] text-white/40 uppercase">
                                  {label}
                                </td>
                                <td className="py-3 text-xs text-white text-right tabular-nums">
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
                          }}
                          className="border border-white text-white bg-black font-mono text-[9px] tracking-[0.2em] py-3 uppercase hover:bg-white hover:text-black transition-colors duration-200 cursor-pointer"
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
                    <h2 className="font-mono text-sm tracking-[0.15em] uppercase text-white mb-3">
                      Report Summary
                    </h2>
                    <p className="text-[10px] font-mono text-white/30 tracking-wider uppercase">
                      Coming Soon
                    </p>
                  </div>
                </div>
              )}

              {/* ── Model Telemetry View (Placeholder) ── */}
              {activeView === "telemetry" && (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center">
                    <h2 className="font-mono text-sm tracking-[0.15em] uppercase text-white mb-3">
                      Model Telemetry
                    </h2>
                    <p className="text-[10px] font-mono text-white/30 tracking-wider uppercase">
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
