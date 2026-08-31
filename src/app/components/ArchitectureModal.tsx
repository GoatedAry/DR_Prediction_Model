"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface ArchitectureModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme?: "dark" | "light";
}

const WORKFLOW_STEPS = [
  {
    step: "01",
    label: "Rural Patient Scan",
    sub: "Fundus Scope / Camera",
    desc: "Captures high-resolution posterior pole photograph at village PHC.",
  },
  {
    step: "02",
    label: "Adaptive Preprocessing",
    sub: "OpenCV (540nm + CLAHE)",
    desc: "Isolates green channel and enhances microvascular lesion contrast.",
  },
  {
    step: "03",
    label: "Ordinal ResNet-50",
    sub: "PyTorch Ordinal Backbone",
    desc: "Predicts continuous disease severity score [0.0 – 4.0] with MSE loss.",
  },
  {
    step: "04",
    label: "Clinical Stage Output",
    sub: "ICDRSS 5-Grade Triage",
    desc: "Instant diagnostic staging, confidence score, and ledger archiving.",
  },
];

const BENCHMARKS = [
  { author: "Oulhadj et al. (2022)", method: "Deformable Registration Multi-CNN", qwk: 0.7500, label: "0.7500 QWK", isOurs: false },
  { author: "Dixit & Jha (2025)", method: "Squeeze-Excitation EfficientNet-B3", qwk: 0.8800, label: "0.8800 QWK", isOurs: false },
  { author: "Bodapati & Balaji (2023)", method: "Self-Stacking Attention Ensemble", qwk: 0.8965, label: "0.8965 QWK", isOurs: false },
  { author: "Proposed Framework (SIH26038)", method: "Stage-Aware Ordinal ResNet-50", qwk: 0.8992, label: "0.8992 QWK", isOurs: true },
];

const STAGES = [
  { stage: "Stage 0", name: "No DR", desc: "Healthy retinal vasculature. Zero microaneurysms or hemorrhages detected." },
  { stage: "Stage 1", name: "Mild NPDR", desc: "Microaneurysms only (isolated focal capillary ballooning)." },
  { stage: "Stage 2", name: "Moderate NPDR", desc: "Hard exudates, cotton-wool spots, multiple intraretinal hemorrhages." },
  { stage: "Stage 3", name: "Severe NPDR", desc: "4-2-1 Rule: >20 hemorrhages in 4 quadrants, venous beading in ≥2 quadrants." },
  { stage: "Stage 4", name: "Proliferative DR", desc: "Neovascularization, vitreous hemorrhage, high risk of complete vision loss." },
];

export default function ArchitectureModal({
  isOpen,
  onClose,
  theme = "dark",
}: ArchitectureModalProps) {
  const isLight = theme === "light";
  const [activeWorkflowIdx, setActiveWorkflowIdx] = useState(0);

  // Auto-cycle through workflow steps to create a dynamic animated product demonstration
  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => {
      setActiveWorkflowIdx((prev) => (prev + 1) % WORKFLOW_STEPS.length);
    }, 2800);
    return () => clearInterval(interval);
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-100 flex items-center justify-center p-4 md:p-8 select-none">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/80 backdrop-blur-md"
        />

        {/* Modal Window Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98, y: 15 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className={`relative w-full max-w-5xl max-h-[92vh] flex flex-col border font-mono z-10 overflow-hidden shadow-2xl ${
            isLight
              ? "bg-white border-neutral-300 text-neutral-900"
              : "bg-[#0a0a0a] border-neutral-800 text-neutral-100"
          }`}
        >
          {/* ── Top Bar (Clean & Professional) ── */}
          <div className={`flex items-center justify-between px-6 py-4 border-b shrink-0 ${
            isLight ? "border-neutral-200 bg-neutral-50" : "border-neutral-800 bg-neutral-950"
          }`}>
            <div className="flex items-center gap-3">
              <span className="px-2.5 py-1 border border-inherit text-xs font-bold uppercase tracking-wider">
                SIH26038
              </span>
              <div>
                <h1 className="text-sm md:text-base font-bold uppercase tracking-wide">
                  Diabetic Retinopathy Screening for Rural India
                </h1>
                <p className={`text-xs mt-0.5 ${isLight ? "text-neutral-600" : "text-neutral-400"}`}>
                  Stage-Aware Ordinal Regression Architecture • Reference: arXiv:2511.14398v1
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className={`px-3 py-1.5 border text-xs uppercase font-bold transition-all cursor-pointer ${
                isLight
                  ? "border-neutral-400 hover:border-black text-neutral-900 bg-white hover:bg-neutral-100"
                  : "border-neutral-700 hover:border-white text-neutral-200 bg-neutral-900 hover:bg-neutral-800"
              }`}
            >
              [ Close ]
            </button>
          </div>

          {/* ── Scrollable Body ── */}
          <div className="flex-1 overflow-y-auto p-6 md:p-8 flex flex-col gap-8 text-xs md:text-sm">
            {/* ══════════════════════════════════════════════════════════════════
                1. SIH PROBLEM STATEMENT & CLINICAL CONTEXT
                ══════════════════════════════════════════════════════════════════ */}
            <div className={`p-5 md:p-6 border flex flex-col gap-4 ${
              isLight ? "border-neutral-200 bg-neutral-50" : "border-neutral-800/80 bg-neutral-950/60"
            }`}>
              <div className="flex items-center justify-between border-b border-inherit pb-3">
                <span className="font-bold text-sm md:text-base uppercase tracking-wider">
                  1. Problem Statement (SIH26038)
                </span>
                <span className={`text-xs uppercase tracking-wider ${isLight ? "text-neutral-500" : "text-neutral-400"}`}>
                  Rural Tele-Ophthalmology
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 leading-relaxed">
                <div className="flex flex-col gap-2">
                  <span className="font-bold text-xs uppercase tracking-wide opacity-90">
                    The Rural Healthcare Challenge:
                  </span>
                  <p className={isLight ? "text-neutral-700" : "text-neutral-300"}>
                    Over <strong>77 million adults in India</strong> suffer from diabetes. Diabetic Retinopathy (DR) is the primary cause of preventable blindness. In rural India, there is <strong>less than 1 ophthalmologist per 100,000 citizens</strong>. Patients visiting village Primary Health Centers (PHCs) lack access to retinal specialists, causing irreversible vision loss before clinical intervention occurs.
                  </p>
                </div>

                <div className="flex flex-col gap-2">
                  <span className="font-bold text-xs uppercase tracking-wide opacity-90">
                    The Engineering Solution:
                  </span>
                  <p className={isLight ? "text-neutral-700" : "text-neutral-300"}>
                    An automated, continuous <strong>Ordinal Regression framework (ResNet-50)</strong> that standardizes raw fundus imagery through green-channel filtering and CLAHE enhancement. By formulating DR staging as distance-aware continuous regression, the model penalizes severe diagnostic errors and delivers instant, reliable grading to frontline healthcare workers.
                  </p>
                </div>
              </div>
            </div>

            {/* ══════════════════════════════════════════════════════════════════
                2. ANIMATED END-TO-END PRODUCT WORKFLOW
                ══════════════════════════════════════════════════════════════════ */}
            <div className={`p-5 md:p-6 border flex flex-col gap-5 ${
              isLight ? "border-neutral-200 bg-neutral-50" : "border-neutral-800/80 bg-neutral-950/60"
            }`}>
              <div className="flex items-center justify-between border-b border-inherit pb-3">
                <div>
                  <span className="font-bold text-sm md:text-base uppercase tracking-wider">
                    2. End-to-End Screening Workflow
                  </span>
                  <p className={`text-xs mt-0.5 ${isLight ? "text-neutral-500" : "text-neutral-400"}`}>
                    Live pipeline: from patient fundus photograph to verified clinical triage
                  </p>
                </div>
                <span className="text-xs px-2 py-0.5 border border-inherit uppercase font-semibold">
                  Step 0{activeWorkflowIdx + 1} / 04
                </span>
              </div>

              {/* Animated Horizontal Step Nodes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {WORKFLOW_STEPS.map((item, idx) => {
                  const isActive = activeWorkflowIdx === idx;
                  return (
                    <div
                      key={item.step}
                      onClick={() => setActiveWorkflowIdx(idx)}
                      className={`p-4 border flex flex-col justify-between gap-3 transition-all duration-300 cursor-pointer relative ${
                        isActive
                          ? (isLight
                              ? "border-black bg-white shadow-md ring-1 ring-black"
                              : "border-white bg-neutral-900 shadow-lg ring-1 ring-white")
                          : (isLight
                              ? "border-neutral-200 bg-white/70 hover:border-neutral-400"
                              : "border-neutral-800 bg-neutral-950 hover:border-neutral-700")
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-bold tracking-widest ${
                          isActive ? (isLight ? "text-black" : "text-white") : "opacity-50"
                        }`}>
                          STEP {item.step}
                        </span>
                        {isActive && (
                          <span className={`h-2 w-2 rounded-full ${isLight ? "bg-black" : "bg-white"} animate-ping`} />
                        )}
                      </div>

                      <div className="flex flex-col gap-1">
                        <span className="font-bold text-xs md:text-sm tracking-tight">
                          {item.label}
                        </span>
                        <span className={`text-xs ${isLight ? "text-neutral-600" : "text-neutral-400"}`}>
                          {item.sub}
                        </span>
                      </div>

                      <p className={`text-xs leading-relaxed ${isLight ? "text-neutral-700" : "text-neutral-300"}`}>
                        {item.desc}
                      </p>

                      {/* Animated Active Progress Line */}
                      {isActive && (
                        <motion.div
                          layoutId="activeBar"
                          className={`absolute bottom-0 left-0 right-0 h-1 ${isLight ? "bg-black" : "bg-white"}`}
                          transition={{ duration: 0.3 }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Animated Data Travel Signal Vector */}
              <div className={`p-3 border flex items-center justify-between text-xs font-mono overflow-x-auto ${
                isLight ? "border-neutral-200 bg-white" : "border-neutral-800 bg-neutral-900/50"
              }`}>
                <div className="flex items-center gap-2">
                  <span className="font-bold">INPUT: FUNDUS SCOPE</span>
                  <span className="animate-pulse font-bold">━━━━▶</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold">540nm + CLAHE</span>
                  <span className="animate-pulse font-bold">━━━━▶</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold">RESNET-50 (MSE)</span>
                  <span className="animate-pulse font-bold">━━━━▶</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold">CLINICAL TRIAGE (0–4)</span>
                </div>
              </div>
            </div>

            {/* ══════════════════════════════════════════════════════════════════
                3. HIGHLIGHTED BENCHMARKS (QWK COMPARISON) & 5-STAGE GRADING
                ══════════════════════════════════════════════════════════════════ */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Benchmark Performance Card */}
              <div className={`p-5 md:p-6 border flex flex-col gap-4 ${
                isLight ? "border-neutral-200 bg-neutral-50" : "border-neutral-800/80 bg-neutral-950/60"
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
                    Table 1
                  </span>
                </div>

                <p className={`text-xs leading-relaxed ${isLight ? "text-neutral-700" : "text-neutral-300"}`}>
                  Quadratic Weighted Kappa (QWK) penalizes distant classification errors exponentially, preventing dangerous misclassifications (e.g. Stage 0 vs Stage 4).
                </p>

                {/* Prominently Highlighted Visual Bars */}
                <div className="flex flex-col gap-3.5 pt-1">
                  {BENCHMARKS.map((item, idx) => {
                    const widthPct = Math.round(item.qwk * 100);
                    return (
                      <div
                        key={idx}
                        className={`p-3 border flex flex-col gap-1.5 ${
                          item.isOurs
                            ? (isLight
                                ? "border-black bg-white shadow-md ring-2 ring-black"
                                : "border-white bg-neutral-900 shadow-xl ring-2 ring-white")
                            : (isLight
                                ? "border-neutral-200 bg-white/60"
                                : "border-neutral-800/80 bg-neutral-950/40 opacity-75")
                        }`}
                      >
                        <div className="flex justify-between items-center text-xs">
                          <span className={item.isOurs ? "font-bold text-xs md:text-sm uppercase" : "font-medium"}>
                            {item.author}
                          </span>
                          <span className={item.isOurs ? "font-bold text-xs md:text-sm" : "font-mono"}>
                            {item.label} {item.isOurs && "★ BEST"}
                          </span>
                        </div>

                        <div className={`w-full h-3.5 border p-0.5 ${
                          isLight ? "border-neutral-300 bg-neutral-200/60" : "border-neutral-800 bg-black"
                        }`}>
                          <div
                            style={{ width: `${widthPct}%` }}
                            className={`h-full transition-all duration-700 ${
                              item.isOurs
                                ? (isLight ? "bg-black" : "bg-white")
                                : (isLight ? "bg-neutral-400" : "bg-neutral-600")
                            }`}
                          />
                        </div>

                        <span className={`text-[11px] ${isLight ? "text-neutral-600" : "text-neutral-400"}`}>
                          {item.method}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ICDRSS 5-Stage Disease Scale Card */}
              <div className={`p-5 md:p-6 border flex flex-col gap-4 ${
                isLight ? "border-neutral-200 bg-neutral-50" : "border-neutral-800/80 bg-neutral-950/60"
              }`}>
                <div className="flex items-center justify-between border-b border-inherit pb-3">
                  <div>
                    <span className="font-bold text-sm md:text-base uppercase tracking-wider">
                      ICDRSS 5-Stage Clinical Grading
                    </span>
                    <p className={`text-xs mt-0.5 ${isLight ? "text-neutral-500" : "text-neutral-400"}`}>
                      International Clinical Diabetic Retinopathy Disease Scale
                    </p>
                  </div>
                  <span className="text-xs px-2 py-0.5 border border-inherit font-bold">
                    Standard
                  </span>
                </div>

                <div className="flex flex-col gap-2.5">
                  {STAGES.map((s, idx) => (
                    <div
                      key={idx}
                      className={`p-3 border flex items-start gap-3 ${
                        isLight ? "border-neutral-200 bg-white" : "border-neutral-800 bg-neutral-900/60"
                      }`}
                    >
                      <span className={`px-2 py-1 border text-xs font-bold shrink-0 uppercase tracking-wider ${
                        isLight ? "border-black bg-neutral-100" : "border-white bg-black"
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

            {/* ══════════════════════════════════════════════════════════════════
                4. SYSTEM TECH STACK SUMMARY
                ══════════════════════════════════════════════════════════════════ */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div className={`p-3.5 border flex flex-col gap-1.5 ${
                isLight ? "border-neutral-200 bg-neutral-50" : "border-neutral-800 bg-neutral-950"
              }`}>
                <span className="font-bold uppercase tracking-wide">Frontend Platform</span>
                <span className={isLight ? "text-neutral-700 leading-snug" : "text-neutral-300 leading-snug"}>
                  Next.js 16 (App Router), TypeScript, Tailwind CSS, Three.js WebGL
                </span>
              </div>
              <div className={`p-3.5 border flex flex-col gap-1.5 ${
                isLight ? "border-neutral-200 bg-neutral-50" : "border-neutral-800 bg-neutral-950"
              }`}>
                <span className="font-bold uppercase tracking-wide">Database & Auth</span>
                <span className={isLight ? "text-neutral-700 leading-snug" : "text-neutral-300 leading-snug"}>
                  Supabase Auth (PostgreSQL), Diagnostic History Ledger
                </span>
              </div>
              <div className={`p-3.5 border flex flex-col gap-1.5 ${
                isLight ? "border-neutral-200 bg-neutral-50" : "border-neutral-800 bg-neutral-950"
              }`}>
                <span className="font-bold uppercase tracking-wide">Inference Backend</span>
                <span className={isLight ? "text-neutral-700 leading-snug" : "text-neutral-300 leading-snug"}>
                  Python FastAPI runtime, PyTorch ResNet-50 Ordinal Engine
                </span>
              </div>
              <div className={`p-3.5 border flex flex-col gap-1.5 ${
                isLight ? "border-neutral-200 bg-neutral-50" : "border-neutral-800 bg-neutral-950"
              }`}>
                <span className="font-bold uppercase tracking-wide">Preprocessing Engine</span>
                <span className={isLight ? "text-neutral-700 leading-snug" : "text-neutral-300 leading-snug"}>
                  OpenCV (cv2) Green Channel, Adaptive CLAHE, Median Denoising
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
