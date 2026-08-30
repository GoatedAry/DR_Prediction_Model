"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";

interface EyeMatrixFlowchartMorphProps {
  isFlowchart: boolean;
  previewUrl: string | null;
  theme?: "dark" | "light";
}

const FLOWCHART_NODES = [
  { id: "node-1", label: "Raw Image", sub: "3216×2136 Fundus", metric: "Input" },
  { id: "node-2", label: "Green Channel", sub: "540nm Optical", metric: "ROI" },
  { id: "node-3", label: "Median Filter", sub: "3×3 Denoising", metric: "Denoise" },
  { id: "node-4", label: "CLAHE", sub: "Local Contrast", metric: "Enhance" },
  { id: "node-5", label: "ResNet-50", sub: "Ordinal Backbone", metric: "23.5M" },
  { id: "node-6", label: "Continuous Score", sub: "MSE Regressor", metric: "[0.0–4.0]" },
  { id: "node-7", label: "DR Stage 0-4", sub: "Clinical Triage", metric: "Output" },
];

export default function EyeMatrixFlowchartMorph({
  isFlowchart,
  previewUrl,
  theme = "dark",
}: EyeMatrixFlowchartMorphProps) {
  const isLight = theme === "light";

  return (
    <div className={`relative w-full h-[460px] border flex items-center justify-center overflow-hidden font-mono ${
      isLight ? "border-neutral-300 bg-neutral-50" : "border-neutral-800 bg-black"
    }`}>
      {/* ── Background Fundus/Eye Image (Fades to 0% when in Tech View) ── */}
      <motion.div
        initial={false}
        animate={{ opacity: isFlowchart ? 0 : 1, scale: isFlowchart ? 0.92 : 1 }}
        transition={{ duration: 0.5, ease: "easeInOut" }}
        className="absolute inset-0 flex items-center justify-center p-3 pointer-events-none"
      >
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt="Fundus scan"
            className="w-full h-full object-contain"
          />
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 opacity-30">
            <div className="w-48 h-48 rounded-full border border-dashed border-emerald-500/50 animate-spin" style={{ animationDuration: "20s" }} />
            <span className="text-[10px] uppercase tracking-widest">Retinal Fundus Sensor</span>
          </div>
        )}
      </motion.div>

      {/* ── State A: 5x5 Matrix Grid Overlay (Active during normal Grader view) ── */}
      <AnimatePresence>
        {!isFlowchart && (
          <motion.div
            key="grid-mode"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            transition={{ duration: 0.4 }}
            className="absolute inset-0 p-4 grid grid-cols-5 grid-rows-5 gap-2 pointer-events-none"
          >
            {Array.from({ length: 25 }).map((_, i) => (
              <motion.div
                key={`grid-cell-${i}`}
                layoutId={`flow-element-${i % 7}`}
                className={`border transition-colors duration-500 relative flex items-center justify-center ${
                  isLight
                    ? "border-black/15 bg-black/[0.02]"
                    : "border-cyan-500/20 bg-cyan-950/[0.05]"
                }`}
              >
                <div className="w-1 h-1 rounded-full bg-cyan-400/40" />
                {i === 12 && (
                  <span className="absolute text-[8px] tracking-widest uppercase opacity-40 text-cyan-400 font-bold">
                    + ROI
                  </span>
                )}
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── State B: Morph into Reconstructed Flowchart Graph (Active in Tech View) ── */}
      <AnimatePresence>
        {isFlowchart && (
          <motion.div
            key="flowchart-mode"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="absolute inset-0 p-4 flex flex-col justify-between z-10"
          >
            {/* Top Header Label */}
            <div className="flex items-center justify-between border-b border-inherit pb-2">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                  Ordinal Pipeline Flowchart
                </span>
              </div>
              <span className={`text-[10px] uppercase ${isLight ? "text-neutral-500" : "text-neutral-400"}`}>
                ResNet-50 Staging
              </span>
            </div>

            {/* Vertical Flowchart Graph with Glowing Cyan/Emerald Borders */}
            <div className="flex-1 flex flex-col justify-center gap-1.5 py-1">
              {FLOWCHART_NODES.map((node, idx) => (
                <div key={node.id} className="flex flex-col items-center">
                  <motion.div
                    layoutId={`flow-element-${idx}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.06, duration: 0.3 }}
                    className={`w-full max-w-sm px-3 py-1.5 border flex items-center justify-between transition-all shadow-sm ${
                      isLight
                        ? "bg-white border-neutral-300 text-neutral-900"
                        : "bg-neutral-950/90 border-cyan-500/50 hover:border-emerald-400 text-neutral-100 shadow-[0_0_10px_rgba(6,182,212,0.15)]"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold font-mono text-cyan-400">
                        0{idx + 1}
                      </span>
                      <span className="text-xs font-bold uppercase tracking-wide">
                        {node.label}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] ${isLight ? "text-neutral-500" : "text-neutral-400"}`}>
                        {node.sub}
                      </span>
                      <span className="text-[9px] px-1.5 py-0.5 border border-emerald-500/40 text-emerald-400 bg-emerald-950/30 font-bold">
                        {node.metric}
                      </span>
                    </div>
                  </motion.div>

                  {/* Animated Connecting Vector Arrow */}
                  {idx < FLOWCHART_NODES.length - 1 && (
                    <div className="h-2.5 flex items-center justify-center text-cyan-400 text-[9px] leading-none animate-pulse">
                      ▼
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Bottom Status Strip */}
            <div className="flex items-center justify-between pt-2 border-t border-inherit text-[9.5px]">
              <span className="text-cyan-400 font-bold uppercase">
                Continuous Regression Output: [0.0 - 4.0]
              </span>
              <span className="text-emerald-400 font-bold">
                QWK 0.8992
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
