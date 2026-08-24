"use client";

import { useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import { useDropzone } from "react-dropzone";
import { X } from "lucide-react";

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
    <div className="w-screen h-screen flex items-center justify-center bg-black">
      <p className="text-[10px] font-mono tracking-[0.3em] text-white/25 uppercase animate-pulse">
        Initializing...
      </p>
    </div>
  ),
});

// ─── Navigation buttons ───────────────────────────────────────────────────────
const NAV_ITEMS = [
  "DR DIAGNOSTIC GRADER",
  "AI REPORT SUMMARY",
  "MODEL TELEMETRY",
] as const;

type NavItem = (typeof NAV_ITEMS)[number];

// Map each button to a relative hover strength factor:
// - DR DIAGNOSTIC GRADER (highest) -> 1.0 (strongest pulsation/swell)
// - AI REPORT SUMMARY (middle)    -> 0.65 (moderate pulsation/swell)
// - MODEL TELEMETRY (lowest)      -> 0.35 (subtle pulsation/swell)
const HOVER_STRENGTH_MAP: Record<NavItem, number> = {
  "DR DIAGNOSTIC GRADER": 1.0,
  "AI REPORT SUMMARY": 0.65,
  "MODEL TELEMETRY": 0.35,
};

function NavButton({
  label,
  onClick,
  onHoverChange,
}: {
  label: NavItem;
  onClick: () => void;
  onHoverChange: (strength: number) => void;
}) {
  const [hovered, setHovered] = useState(false);

  const handleMouseEnter = () => {
    setHovered(true);
    onHoverChange(HOVER_STRENGTH_MAP[label]);
  };

  const handleMouseLeave = () => {
    setHovered(false);
    onHoverChange(0);
  };

  return (
    <button
      onClick={onClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        /* Typography */
        fontFamily: "'Courier New', Courier, monospace",
        fontSize: "9.5px",
        fontWeight: 700,
        letterSpacing: "0.18em",
        textTransform: "uppercase",

        /* Color */
        color: "white",
        background: "black",
        border: "1px solid white",

        /* Layout */
        display: "block",
        padding: "9px 20px",
        cursor: "pointer",
        whiteSpace: "nowrap",
        userSelect: "none",
        textAlign: "left",
        width: "100%",

        /* Hover zoom */
        transform: hovered
          ? "scale(1.08) translateX(5px)"
          : "scale(1)    translateX(0px)",
        transformOrigin: "left center",
        transition: "transform 0.22s cubic-bezier(0.16, 1, 0.3, 1)",
        willChange: "transform",
      }}
    >
      {label}
    </button>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function Home() {
  const [hoverStrength, setHoverStrength] = useState(0);
  const [showOverlay, setShowOverlay] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<DiagnosticState | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleButtonClick = (label: NavItem) => {
    console.log(`[NAV] ${label}`);
    if (label === "DR DIAGNOSTIC GRADER") {
      setShowOverlay(true);
      setErrorMsg(null);
    }
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

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
      setShowOverlay(false);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Failed to contact prediction server.");
    } finally {
      setLoading(false);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [] },
    multiple: false,
  });

  return (
    <main className="relative w-screen h-screen bg-black overflow-hidden select-none">
      {/* ── 3D Canvas ── */}
      <div className="absolute inset-0 z-0">
        <Scene hoverStrength={hoverStrength} />
      </div>

      {/* ── Left-side navigation button stack ── */}
      <div
        className="absolute left-0 inset-y-0 z-10 pointer-events-none
                   flex flex-col items-start justify-center gap-[10px] pl-8"
      >
        {NAV_ITEMS.map((label) => (
          <div key={label} className="pointer-events-auto">
            <NavButton
              label={label}
              onClick={() => handleButtonClick(label)}
              onHoverChange={setHoverStrength}
            />
          </div>
        ))}
      </div>

      {/* ── Center Glassmorphic Upload Overlay ── */}
      <AnimatePresence>
        {showOverlay && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 backdrop-blur-md"
          >
            <div
              className="relative w-full max-w-md bg-black/80 p-8 border border-white/15"
              style={{
                boxShadow: "0 0 40px rgba(0, 0, 0, 0.8)",
              }}
            >
              {/* Close Button */}
              <button
                onClick={() => setShowOverlay(false)}
                className="absolute top-4 right-4 text-white/50 hover:text-white transition-colors"
                disabled={loading}
              >
                <X size={16} />
              </button>

              <h3 className="text-xs font-mono font-bold tracking-[0.2em] text-white uppercase mb-6">
                Diagnostic File Transceiver
              </h3>

              {loading ? (
                <div className="flex flex-col items-center justify-center py-12 gap-4">
                  <p className="text-[10px] font-mono tracking-[0.15em] text-white animate-pulse">
                    TRANSMITTING TENSORS TO FASTAPI....
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
              ) : (
                <div
                  {...getRootProps()}
                  className={`border border-dashed p-10 flex flex-col items-center justify-center cursor-pointer transition-colors duration-150 ${
                    isDragActive ? "border-white bg-white/5" : "border-white/20 hover:border-white/55"
                  }`}
                >
                  <input {...getInputProps()} />
                  <p className="text-[10px] font-mono tracking-[0.18em] text-white/50 text-center uppercase leading-loose">
                    {isDragActive
                      ? "DROP SCAN HERE"
                      : "DROP FUNDUS SCAN\nOR CLICK TO BROWSE"}
                  </p>
                </div>
              )}

              {errorMsg && (
                <div className="mt-4 p-3 border border-red-500/50 bg-red-950/30 text-red-400 font-mono text-[9.5px] uppercase tracking-wide">
                  ERROR: {errorMsg}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Right-side Stark White Data Table ── */}
      <AnimatePresence>
        {results && (
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 50 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="absolute right-0 inset-y-0 w-80 bg-black border-l border-white/15 z-10 p-8 flex flex-col justify-center"
          >
            {/* Close Button */}
            <button
              onClick={() => setResults(null)}
              className="absolute top-8 right-8 text-white/40 hover:text-white transition-colors"
            >
              <X size={16} />
            </button>

            <div className="mb-8">
              <p className="text-[9px] font-mono tracking-[0.25em] text-white/40 uppercase">
                Inference Result
              </p>
              <h2 className="text-[13px] font-mono font-bold tracking-[0.1em] text-white uppercase mt-1">
                DR Diagnostic Data
              </h2>
            </div>

            {/* Stark White Data Table */}
            <table className="w-full text-left font-mono border-collapse">
              <tbody>
                <tr className="border-b border-white/15">
                  <td className="py-3 text-[10px] tracking-[0.15em] text-white/40 uppercase">Continuous Score</td>
                  <td className="py-3 text-xs text-white text-right tabular-nums">{results.continuous_score.toFixed(3)}</td>
                </tr>
                <tr className="border-b border-white/15">
                  <td className="py-3 text-[10px] tracking-[0.15em] text-white/40 uppercase">Clamped Score</td>
                  <td className="py-3 text-xs text-white text-right tabular-nums">{results.clamped_score.toFixed(3)}</td>
                </tr>
                <tr className="border-b border-white/15">
                  <td className="py-3 text-[10px] tracking-[0.15em] text-white/40 uppercase">Integer Stage</td>
                  <td className="py-3 text-xs text-white text-right tabular-nums">{results.integer_stage}</td>
                </tr>
                <tr className="border-b border-white/15">
                  <td className="py-3 text-[10px] tracking-[0.15em] text-white/40 uppercase">Stage Label</td>
                  <td className="py-3 text-xs text-white text-right uppercase tracking-wider">{results.stage_label}</td>
                </tr>
                <tr className="border-b border-white/15">
                  <td className="py-3 text-[10px] tracking-[0.15em] text-white/40 uppercase">Val MSE Loss</td>
                  <td className="py-3 text-xs text-white text-right tabular-nums">{results.val_mse_loss.toFixed(4)}</td>
                </tr>
                <tr className="border-b border-white/15">
                  <td className="py-3 text-[10px] tracking-[0.15em] text-white/40 uppercase">Peak QWK</td>
                  <td className="py-3 text-xs text-white text-right tabular-nums">{results.peak_qwk.toFixed(4)}</td>
                </tr>
              </tbody>
            </table>

            <button
              onClick={() => {
                setResults(null);
                setShowOverlay(true);
              }}
              className="mt-8 border border-white text-white bg-black font-mono text-[9px] tracking-[0.2em] py-3 uppercase hover:bg-white hover:text-black transition-colors duration-200"
            >
              Analyze Another Scan
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
