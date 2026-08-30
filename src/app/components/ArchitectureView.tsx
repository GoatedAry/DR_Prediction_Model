"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause, RotateCcw, ArrowRight, CheckCircle2, Eye, ShieldCheck, Activity } from "lucide-react";

interface ArchitectureViewProps {
  theme?: "dark" | "light";
  onNavigateToGrader: () => void;
  onNavigateHome: () => void;
}

const BENCHMARKS = [
  { author: "Oulhadj et al. (2022)", method: "Deformable Registration Multi-CNN", qwk: 0.7500, label: "0.7500 QWK", isOurs: false },
  { author: "Dixit & Jha (2025)", method: "Squeeze-Excitation EfficientNet-B3", qwk: 0.8800, label: "0.8800 QWK", isOurs: false },
  { author: "Bodapati & Balaji (2023)", method: "Self-Stacking Attention Ensemble", qwk: 0.8965, label: "0.8965 QWK", isOurs: false },
  { author: "Proposed Framework (SIH26038)", method: "Stage-Aware Ordinal ResNet-50", qwk: 0.8992, label: "0.8992 QWK (BEST)", isOurs: true },
];

const STAGES = [
  { stage: "Stage 0", name: "No DR", desc: "Healthy retinal vasculature. Zero microaneurysms detected.", color: "border-emerald-500 text-emerald-400" },
  { stage: "Stage 1", name: "Mild NPDR", desc: "Microaneurysms only (isolated focal capillary swelling).", color: "border-yellow-500 text-yellow-400" },
  { stage: "Stage 2", name: "Moderate NPDR", desc: "Hard exudates, cotton-wool spots, intraretinal hemorrhages.", color: "border-amber-500 text-amber-400" },
  { stage: "Stage 3", name: "Severe NPDR", desc: "4-2-1 Rule: >20 hemorrhages in 4 quadrants or venous beading in ≥2.", color: "border-orange-500 text-orange-400" },
  { stage: "Stage 4", name: "Proliferative DR", desc: "Neovascularization, vitreous hemorrhage, urgent surgical referral.", color: "border-red-500 text-red-400" },
];

const PIPELINE_STAGES = [
  {
    id: 0,
    title: "1. RAW FUNDUS ACQUISITION",
    subtitle: "Village PHC Fundus Camera",
    metric: "3216×2136 RGB",
    detail: "Captures multi-field posterior pole retinal photography from non-mydriatic fundus cameras in rural clinics.",
  },
  {
    id: 1,
    title: "2. PREPROCESSING ENGINE",
    subtitle: "OpenCV 540nm + CLAHE",
    metric: "224×224×3 Tensor",
    detail: "Isolates optical green channel (hemoglobin absorption peak) & applies 8×8 CLAHE to expose subtle microaneurysms.",
  },
  {
    id: 2,
    title: "3. ORDINAL REGRESSION",
    subtitle: "ResNet-50 Backbone",
    metric: "23.5M Params (MSE Loss)",
    detail: "Dense latent embeddings mapped to continuous ordinal score [0.0–4.0] with quadratic distance penalty.",
  },
  {
    id: 3,
    title: "4. CLINICAL STAGING",
    subtitle: "ICDRSS 5-Grade Triage",
    metric: "Stage 2 (Moderate NPDR)",
    detail: "Instant continuous output clamped and rounded to discrete ICDRSS grade for frontline healthcare workers.",
  },
];

export default function ArchitectureView({
  theme = "dark",
  onNavigateToGrader,
  onNavigateHome,
}: ArchitectureViewProps) {
  const isLight = theme === "light";
  const [activeStep, setActiveStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [progress, setProgress] = useState(0);

  // Smooth animated simulation pipeline loop
  useEffect(() => {
    if (!isPlaying) return;

    const stepInterval = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % 4);
      setProgress(0);
    }, 3200);

    const progressInterval = setInterval(() => {
      setProgress((prev) => (prev >= 100 ? 0 : prev + 3.125));
    }, 100);

    return () => {
      clearInterval(stepInterval);
      clearInterval(progressInterval);
    };
  }, [isPlaying]);

  const handleReset = () => {
    setActiveStep(0);
    setProgress(0);
    setIsPlaying(true);
  };

  return (
    <div className="w-full max-w-6xl mx-auto flex flex-col gap-8 font-mono pb-20 select-none">
      {/* ── Top Header Banner ── */}
      <div className={`p-6 border flex flex-col md:flex-row justify-between items-start md:items-center gap-4 backdrop-blur-md ${
        isLight ? "bg-white/90 border-neutral-300 shadow-sm" : "bg-neutral-950/80 border-neutral-800 shadow-xl"
      }`}>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 border text-xs font-bold uppercase tracking-wider">
              SIH26038 SPECIFICATION
            </span>
            <span className="text-xs uppercase tracking-widest opacity-60">
              Research Pipeline
            </span>
          </div>
          <h1 className="text-base md:text-lg font-bold uppercase tracking-wide">
            Explainable AI for Diabetic Retinopathy Screening in Rural India
          </h1>
          <p className={`text-xs ${isLight ? "text-neutral-600" : "text-neutral-400"}`}>
            Stage-Aware Diagnosis via Continuous Ordinal Regression (ResNet-50) • arXiv:2511.14398v1
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={onNavigateHome}
            className={`px-4 py-2 border text-xs uppercase font-bold transition-all cursor-pointer ${
              isLight
                ? "border-neutral-300 hover:border-black text-neutral-800 hover:text-black bg-white"
                : "border-neutral-700 hover:border-white text-neutral-300 hover:text-white bg-neutral-900"
            }`}
          >
            [ Home ]
          </button>
          <button
            onClick={onNavigateToGrader}
            className={`px-4 py-2 border text-xs uppercase font-bold transition-all cursor-pointer ${
              isLight
                ? "bg-black text-white hover:bg-neutral-800 border-black"
                : "bg-white text-black hover:bg-neutral-200 border-white"
            }`}
          >
            [ Launch Grader ]
          </button>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          1. SIH PROBLEM STATEMENT
          ══════════════════════════════════════════════════════════════════════ */}
      <div className={`p-6 md:p-8 border flex flex-col gap-5 backdrop-blur-md ${
        isLight ? "bg-white/90 border-neutral-300" : "bg-neutral-950/80 border-neutral-800"
      }`}>
        <div className="flex items-center justify-between border-b border-inherit pb-3">
          <span className="font-bold text-sm md:text-base uppercase tracking-wider">
            1. Problem Statement (SIH26038)
          </span>
          <span className="text-xs uppercase tracking-widest opacity-60">
            Rural Tele-Ophthalmology
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-xs md:text-sm leading-relaxed">
          <div className="flex flex-col gap-2">
            <span className="font-bold uppercase tracking-wide opacity-90">
              The Rural Healthcare Crisis:
            </span>
            <p className={isLight ? "text-neutral-700" : "text-neutral-300"}>
              India has over <strong>77 million diabetic patients</strong>, with Diabetic Retinopathy (DR) representing the leading cause of preventable blindness. In rural India, there is <strong>less than 1 ophthalmologist per 100,000 citizens</strong>. Primary Health Centers (PHCs) lack retinal specialists, allowing microvascular damage to progress to irreversible Proliferative DR before patients are screened.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <span className="font-bold uppercase tracking-wide opacity-90">
              The Engineering Solution:
            </span>
            <p className={isLight ? "text-neutral-700" : "text-neutral-300"}>
              An automated, stage-aware deep learning framework that formulates DR grading as <strong>continuous ordinal regression</strong> using a fine-tuned ResNet-50 backbone. Coupled with Green-Channel isolation and CLAHE enhancement, the system provides frontline healthcare workers with immediate, distance-penalized diagnostic triage on the 5-stage ICDRSS scale.
            </p>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          2. ANIMATED END-TO-END SCREENING PIPELINE SIMULATOR
          ══════════════════════════════════════════════════════════════════ */}
      <div className={`p-6 md:p-8 border flex flex-col gap-6 backdrop-blur-md ${
        isLight ? "bg-white/90 border-neutral-300" : "bg-neutral-950/80 border-neutral-800"
      }`}>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-inherit pb-4">
          <div>
            <span className="font-bold text-sm md:text-base uppercase tracking-wider">
              2. Interactive Screening Pipeline Simulator
            </span>
            <p className={`text-xs mt-0.5 ${isLight ? "text-neutral-500" : "text-neutral-400"}`}>
              Watch live data packets flow from fundus camera acquisition to verified 5-stage clinical triage
            </p>
          </div>

          {/* Interactive Simulation Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className={`flex items-center gap-1.5 px-3 py-1.5 border text-xs font-bold uppercase transition-all cursor-pointer ${
                isPlaying
                  ? (isLight ? "border-black text-black bg-neutral-100" : "border-white text-white bg-neutral-900")
                  : (isLight ? "border-neutral-300 hover:border-black text-neutral-700 bg-white" : "border-neutral-700 hover:border-white text-neutral-300 bg-black")
              }`}
            >
              {isPlaying ? <Pause size={13} /> : <Play size={13} />}
              <span>{isPlaying ? "Pause" : "Play"}</span>
            </button>

            <button
              onClick={handleReset}
              className={`flex items-center gap-1 px-2.5 py-1.5 border text-xs uppercase transition-all cursor-pointer ${
                isLight ? "border-neutral-300 hover:border-black text-neutral-700 bg-white" : "border-neutral-700 hover:border-white text-neutral-300 bg-black"
              }`}
              title="Reset Simulation"
            >
              <RotateCcw size={13} />
            </button>
          </div>
        </div>

        {/* 4 Interactive Pipeline Blocks */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {PIPELINE_STAGES.map((st) => {
            const isActive = activeStep === st.id;
            return (
              <div
                key={st.id}
                onClick={() => {
                  setActiveStep(st.id);
                  setProgress(0);
                }}
                className={`p-5 border flex flex-col justify-between gap-4 transition-all duration-300 cursor-pointer relative ${
                  isActive
                    ? (isLight
                        ? "border-black bg-neutral-50 shadow-md ring-2 ring-black"
                        : "border-white bg-neutral-900/90 shadow-xl ring-2 ring-white")
                    : (isLight
                        ? "border-neutral-200 bg-white/70 hover:border-neutral-400 opacity-80"
                        : "border-neutral-800 bg-black/60 hover:border-neutral-700 opacity-70")
                }`}
              >
                {/* Header with Step Indicator & Pulse */}
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-bold tracking-widest ${
                    isActive ? (isLight ? "text-black" : "text-white") : "opacity-50"
                  }`}>
                    PHASE 0{st.id + 1}
                  </span>
                  {isActive && (
                    <span className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-400">
                      <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                      ACTIVE
                    </span>
                  )}
                </div>

                {/* Title & Subtitle */}
                <div className="flex flex-col gap-1">
                  <span className="font-bold text-xs md:text-sm uppercase tracking-tight">
                    {st.title}
                  </span>
                  <span className={`text-xs ${isLight ? "text-neutral-600" : "text-neutral-400"}`}>
                    {st.subtitle}
                  </span>
                </div>

                {/* Data Metric Badge */}
                <div className={`px-2.5 py-1.5 border text-xs font-bold font-mono ${
                  isLight ? "border-neutral-300 bg-white text-neutral-900" : "border-neutral-700 bg-black text-neutral-100"
                }`}>
                  {st.metric}
                </div>

                {/* Description */}
                <p className={`text-xs leading-relaxed ${isLight ? "text-neutral-700" : "text-neutral-300"}`}>
                  {st.detail}
                </p>

                {/* Live Step Progress Line */}
                {isActive && (
                  <div className={`absolute bottom-0 left-0 right-0 h-1 ${isLight ? "bg-neutral-300" : "bg-neutral-800"}`}>
                    <div
                      style={{ width: `${progress}%` }}
                      className={`h-full transition-all duration-100 ${isLight ? "bg-black" : "bg-white"}`}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Live Vector Signal Route */}
        <div className={`p-4 border flex items-center justify-between text-xs font-mono overflow-x-auto ${
          isLight ? "border-neutral-200 bg-neutral-100/70" : "border-neutral-800 bg-black/80"
        }`}>
          <div className={`flex items-center gap-2 ${activeStep === 0 ? "font-bold text-emerald-400" : "opacity-60"}`}>
            <span>RAW SCOPE SCAN</span>
            <span className="animate-pulse">━━━━▶</span>
          </div>
          <div className={`flex items-center gap-2 ${activeStep === 1 ? "font-bold text-emerald-400" : "opacity-60"}`}>
            <span>540nm + CLAHE</span>
            <span className="animate-pulse">━━━━▶</span>
          </div>
          <div className={`flex items-center gap-2 ${activeStep === 2 ? "font-bold text-emerald-400" : "opacity-60"}`}>
            <span>ORDINAL RESNET-50</span>
            <span className="animate-pulse">━━━━▶</span>
          </div>
          <div className={`flex items-center gap-2 ${activeStep === 3 ? "font-bold text-emerald-400" : "opacity-60"}`}>
            <span>STAGE 2 NPDR (0.8992 QWK)</span>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          3. SOTA BENCHMARKS & 5-STAGE CLINICAL SCALE
          ══════════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Benchmark Performance Card */}
        <div className={`p-6 md:p-8 border flex flex-col gap-5 backdrop-blur-md ${
          isLight ? "bg-white/90 border-neutral-300" : "bg-neutral-950/80 border-neutral-800"
        }`}>
          <div className="flex items-center justify-between border-b border-inherit pb-3">
            <div>
              <span className="font-bold text-sm md:text-base uppercase tracking-wider">
                3. SOTA Benchmark Validation
              </span>
              <p className={`text-xs mt-0.5 ${isLight ? "text-neutral-500" : "text-neutral-400"}`}>
                Quadratic Weighted Kappa (QWK) on APTOS-2019 Dataset
              </p>
            </div>
            <span className="text-xs px-2 py-0.5 border border-inherit font-bold">
              APTOS-2019
            </span>
          </div>

          <p className={`text-xs md:text-sm leading-relaxed ${isLight ? "text-neutral-700" : "text-neutral-300"}`}>
            Quadratic Weighted Kappa (QWK) is the clinical gold standard because it penalizes distant misclassifications quadratically. Confusing Stage 0 (No DR) with Stage 4 (Proliferative DR) receives an exponential penalty of 1.0.
          </p>

          {/* Prominently Highlighted Visual Bars */}
          <div className="flex flex-col gap-3 pt-1">
            {BENCHMARKS.map((item, idx) => {
              const widthPct = Math.round(item.qwk * 100);
              return (
                <div
                  key={idx}
                  className={`p-3.5 border flex flex-col gap-2 ${
                    item.isOurs
                      ? (isLight
                          ? "border-black bg-white shadow-md ring-2 ring-black"
                          : "border-white bg-neutral-900 shadow-xl ring-2 ring-white")
                      : (isLight
                          ? "border-neutral-200 bg-white/60"
                          : "border-neutral-800 bg-neutral-950/40 opacity-75")
                  }`}
                >
                  <div className="flex justify-between items-center text-xs md:text-sm">
                    <span className={item.isOurs ? "font-bold uppercase" : "font-medium"}>
                      {item.author}
                    </span>
                    <span className={item.isOurs ? "font-bold text-emerald-400 font-mono" : "font-mono opacity-80"}>
                      {item.label}
                    </span>
                  </div>

                  <div className={`w-full h-4 border p-0.5 ${
                    isLight ? "border-neutral-300 bg-neutral-200/60" : "border-neutral-800 bg-black"
                  }`}>
                    <div
                      style={{ width: `${widthPct}%` }}
                      className={`h-full transition-all duration-700 ${
                        item.isOurs
                          ? (isLight ? "bg-black" : "bg-emerald-400")
                          : (isLight ? "bg-neutral-400" : "bg-neutral-600")
                      }`}
                    />
                  </div>

                  <span className={`text-xs ${isLight ? "text-neutral-600" : "text-neutral-400"}`}>
                    {item.method}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* 5-Stage Disease Scale */}
        <div className={`p-6 md:p-8 border flex flex-col gap-5 backdrop-blur-md ${
          isLight ? "bg-white/90 border-neutral-300" : "bg-neutral-950/80 border-neutral-800"
        }`}>
          <div className="flex items-center justify-between border-b border-inherit pb-3">
            <div>
              <span className="font-bold text-sm md:text-base uppercase tracking-wider">
                ICDRSS 5-Stage Clinical Grading
              </span>
              <p className={`text-xs mt-0.5 ${isLight ? "text-neutral-500" : "text-neutral-400"}`}>
                International Clinical Severity Scale for Diabetic Retinopathy
              </p>
            </div>
            <span className="text-xs px-2 py-0.5 border border-inherit font-bold">
              ICDRSS
            </span>
          </div>

          <div className="flex flex-col gap-3">
            {STAGES.map((s, idx) => (
              <div
                key={idx}
                className={`p-3.5 border flex items-start gap-3.5 ${
                  isLight ? "border-neutral-200 bg-white" : "border-neutral-800 bg-neutral-900/60"
                }`}
              >
                <span className={`px-2 py-1 border text-xs font-bold shrink-0 uppercase tracking-wider ${
                  isLight ? "border-black bg-neutral-100 text-black" : "border-white bg-black text-white"
                }`}>
                  {s.stage}
                </span>
                <div className="flex flex-col gap-1">
                  <span className="font-bold text-xs md:text-sm">{s.name}</span>
                  <p className={`text-xs leading-relaxed ${isLight ? "text-neutral-700" : "text-neutral-300"}`}>
                    {s.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          4. TECHNICAL SYSTEM STACK
          ══════════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
        <div className={`p-4 border flex flex-col gap-2 backdrop-blur-md ${
          isLight ? "bg-white/90 border-neutral-300" : "bg-neutral-950/80 border-neutral-800"
        }`}>
          <span className="font-bold uppercase tracking-wide text-xs">Frontend Platform</span>
          <span className={isLight ? "text-neutral-700 leading-relaxed" : "text-neutral-300 leading-relaxed"}>
            Next.js 16 (App Router), TypeScript, Tailwind CSS, Three.js WebGL
          </span>
        </div>
        <div className={`p-4 border flex flex-col gap-2 backdrop-blur-md ${
          isLight ? "bg-white/90 border-neutral-300" : "bg-neutral-950/80 border-neutral-800"
        }`}>
          <span className="font-bold uppercase tracking-wide text-xs">Database & Auth</span>
          <span className={isLight ? "text-neutral-700 leading-relaxed" : "text-neutral-300 leading-relaxed"}>
            Supabase Auth (PostgreSQL), Diagnostic History Ledger
          </span>
        </div>
        <div className={`p-4 border flex flex-col gap-2 backdrop-blur-md ${
          isLight ? "bg-white/90 border-neutral-300" : "bg-neutral-950/80 border-neutral-800"
        }`}>
          <span className="font-bold uppercase tracking-wide text-xs">Inference Backend</span>
          <span className={isLight ? "text-neutral-700 leading-relaxed" : "text-neutral-300 leading-relaxed"}>
            Python FastAPI runtime, PyTorch ResNet-50 Ordinal Engine
          </span>
        </div>
        <div className={`p-4 border flex flex-col gap-2 backdrop-blur-md ${
          isLight ? "bg-white/90 border-neutral-300" : "bg-neutral-950/80 border-neutral-800"
        }`}>
          <span className="font-bold uppercase tracking-wide text-xs">Preprocessing Engine</span>
          <span className={isLight ? "text-neutral-700 leading-relaxed" : "text-neutral-300 leading-relaxed"}>
            OpenCV (cv2) Green Channel, Adaptive CLAHE, Median Denoising
          </span>
        </div>
      </div>
    </div>
  );
}
