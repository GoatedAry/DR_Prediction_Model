"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { RotateCcw } from "lucide-react";

interface TechViewTakeoverProps {
  theme?: "dark" | "light";
  onClose: () => void;
}

const FLOWCHART_STEPS = [
  { id: "s1", num: "01", name: "Raw Image", sub: "3216×2136 Fundus" },
  { id: "s2", num: "02", name: "Green Channel", sub: "540nm Extraction" },
  { id: "s3", num: "03", name: "Median Filter", sub: "3×3 Denoising" },
  { id: "s4", num: "04", name: "CLAHE", sub: "Local Contrast" },
  { id: "s5", num: "05", name: "ResNet-50", sub: "Ordinal Backbone" },
  { id: "s6", num: "06", name: "Continuous Score", sub: "MSE Regressor [0–4]" },
  { id: "s7", num: "07", name: "DR Stage 0-4", sub: "Clinical ICDRSS Triage" },
];

export default function TechViewTakeover({
  theme = "dark",
  onClose,
}: TechViewTakeoverProps) {
  const isLight = theme === "light";
  const [animationPhase, setAnimationPhase] = useState<"eye" | "flowchart">("eye");
  const [activeStep, setActiveStep] = useState(0);

  // Trigger transformation from eye/grid to flowchart after initial 800ms presentation
  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimationPhase("flowchart");
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  // Step sequencer in flowchart mode
  useEffect(() => {
    if (animationPhase !== "flowchart") return;
    const interval = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % FLOWCHART_STEPS.length);
    }, 2200);
    return () => clearInterval(interval);
  }, [animationPhase]);

  const handleReplay = () => {
    setAnimationPhase("eye");
    setActiveStep(0);
    setTimeout(() => {
      setAnimationPhase("flowchart");
    }, 800);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
      className={`relative w-full h-full flex flex-col justify-between p-6 md:p-10 font-mono z-30 overflow-y-auto ${
        isLight ? "bg-white text-black" : "bg-black text-white"
      }`}
    >
      {/* ── Top Clinical Text Banner ── */}
      <div className="w-full max-w-5xl mx-auto flex flex-col gap-6">
        <div className="flex items-center justify-between border-b border-inherit pb-3">
          <div className="flex items-center gap-2.5">
            <span className="px-2 py-0.5 border border-inherit text-xs font-bold uppercase tracking-wider">
              SIH26038 SPECIFICATION
            </span>
            <span className="text-xs uppercase tracking-widest opacity-60">
              Methodology & Architecture
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleReplay}
              className={`flex items-center gap-1.5 px-3 py-1.5 border text-xs uppercase font-bold transition-all cursor-pointer ${
                isLight ? "border-neutral-300 hover:border-black text-neutral-700 bg-white" : "border-neutral-700 hover:border-white text-neutral-300 bg-neutral-950"
              }`}
              title="Replay Morph Animation"
            >
              <RotateCcw size={12} />
              <span>Replay</span>
            </button>
            <button
              onClick={onClose}
              className={`px-3.5 py-1.5 border text-xs uppercase font-bold transition-all cursor-pointer ${
                isLight ? "bg-black text-white hover:bg-neutral-800 border-black" : "bg-white text-black hover:bg-neutral-200 border-white"
              }`}
            >
              [ Close ]
            </button>
          </div>
        </div>

        {/* Clinical Overview Grid (Exact Text) */}
        <div className={`p-6 border flex flex-col gap-4 ${
          isLight ? "border-neutral-300 bg-neutral-50/70" : "border-neutral-800 bg-neutral-950/60"
        }`}>
          {/* PROBLEM STATEMENT */}
          <div className="flex flex-col gap-1">
            <span className="font-bold text-xs md:text-sm uppercase tracking-wider opacity-90">
              PROBLEM STATEMENT:
            </span>
            <p className={`text-xs md:text-sm leading-relaxed ${isLight ? "text-neutral-700" : "text-neutral-300"}`}>
              Diabetic Retinopathy is a leading cause of preventable blindness. Early detection is critical but bottlenecked by a severe shortage of ophthalmologists in rural areas.
            </p>
          </div>

          {/* THE SOLUTION */}
          <div className="flex flex-col gap-1">
            <span className="font-bold text-xs md:text-sm uppercase tracking-wider opacity-90">
              THE SOLUTION:
            </span>
            <p className={`text-xs md:text-sm leading-relaxed ${isLight ? "text-neutral-700" : "text-neutral-300"}`}>
              This platform eliminates cost and availability barriers, providing instantaneous, clinical-grade triage screening for rural health centers to prevent irreversible vision loss.
            </p>
          </div>

          {/* THE TECH STACK */}
          <div className="flex flex-col gap-1">
            <span className="font-bold text-xs md:text-sm uppercase tracking-wider opacity-90">
              THE TECH STACK:
            </span>
            <p className={`text-xs md:text-sm leading-relaxed ${isLight ? "text-neutral-700" : "text-neutral-300"}`}>
              Next.js, Local FastAPI, ResNet-50 Ordinal Regression, Median Filter, CLAHE. Peak QWK Score: <strong className="font-bold underline">0.8992</strong>.
            </p>
          </div>
        </div>
      </div>

      {/* ── Eye-to-Graph Morph Animation Section ── */}
      <div className="w-full max-w-5xl mx-auto my-auto py-6 flex flex-col items-center justify-center">
        <div className="w-full text-center mb-4">
          <span className="text-xs uppercase tracking-widest opacity-60">
            {animationPhase === "eye" ? "Eye Matrix Capture Scan" : "Ordinal Neural Flowchart"}
          </span>
        </div>

        <div className={`relative w-full max-w-4xl h-56 border p-6 flex items-center justify-center overflow-hidden transition-colors duration-700 ${
          isLight ? "border-neutral-300 bg-neutral-50" : "border-neutral-800 bg-neutral-950"
        }`}>
          {/* Phase 1: Eye Matrix Initial State */}
          {animationPhase === "eye" && (
            <motion.div
              key="eye-state"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 1.1, opacity: 0 }}
              transition={{ duration: 0.5 }}
              className="flex items-center justify-center relative w-40 h-40"
            >
              {/* Outer Circular Scanner Ring */}
              <div className="absolute inset-0 rounded-full border border-dashed border-inherit animate-spin" style={{ animationDuration: "12s" }} />
              {/* Inner Eye Iris Circle */}
              <div className={`w-24 h-24 rounded-full border flex items-center justify-center ${
                isLight ? "border-black/40 bg-black/5" : "border-white/40 bg-white/5"
              }`}>
                <div className={`w-8 h-8 rounded-full ${isLight ? "bg-black/80" : "bg-white/80"}`} />
              </div>
              {/* 5x5 Matrix Overlay Lines */}
              <div className="absolute inset-0 grid grid-cols-5 grid-rows-5 pointer-events-none p-1">
                {Array.from({ length: 25 }).map((_, i) => (
                  <div key={i} className="border border-inherit opacity-30" />
                ))}
              </div>
            </motion.div>
          )}

          {/* Phase 2: Transformed Linear Flowchart */}
          {animationPhase === "flowchart" && (
            <motion.div
              key="flowchart-state"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="w-full flex flex-col md:flex-row items-center justify-between gap-2"
            >
              {FLOWCHART_STEPS.map((step, idx) => {
                const isStepActive = activeStep === idx;
                return (
                  <React.Fragment key={step.id}>
                    <motion.div
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: idx * 0.08, duration: 0.35 }}
                      onClick={() => setActiveStep(idx)}
                      className={`flex-1 p-2.5 border text-center flex flex-col justify-between gap-1 transition-all duration-300 cursor-pointer ${
                        isStepActive
                          ? (isLight ? "border-black bg-white shadow-md ring-1 ring-black" : "border-white bg-neutral-900 shadow-lg ring-1 ring-white")
                          : (isLight ? "border-neutral-200 bg-white/60 hover:border-neutral-400" : "border-neutral-800 bg-black/60 hover:border-neutral-700")
                      }`}
                    >
                      <span className={`text-[10px] font-bold tracking-wider ${
                        isStepActive ? "opacity-100" : "opacity-40"
                      }`}>
                        STEP {step.num}
                      </span>
                      <span className="font-bold text-xs tracking-tight">
                        {step.name}
                      </span>
                      <span className={`text-[9.5px] ${isLight ? "text-neutral-500" : "text-neutral-400"}`}>
                        {step.sub}
                      </span>
                    </motion.div>

                    {idx < FLOWCHART_STEPS.length - 1 && (
                      <span className="hidden md:inline text-xs opacity-50 px-0.5">
                        →
                      </span>
                    )}
                  </React.Fragment>
                );
              })}
            </motion.div>
          )}
        </div>
      </div>

      {/* ── Bottom Action Return Button ── */}
      <div className="w-full max-w-5xl mx-auto flex items-center justify-between pt-4 border-t border-inherit text-xs">
        <span className="opacity-60">SIH26038 • Explainable AI for Diabetic Retinopathy Screening</span>
        <button
          onClick={onClose}
          className={`px-5 py-2.5 border text-xs font-bold uppercase tracking-widest transition-all cursor-pointer ${
            isLight
              ? "bg-black text-white hover:bg-neutral-800 border-black"
              : "bg-white text-black hover:bg-neutral-200 border-white"
          }`}
        >
          [ Return to Diagnostic Screening ]
        </button>
      </div>
    </motion.div>
  );
}
