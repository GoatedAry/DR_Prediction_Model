"use client";

import { useMemo } from "react";

interface StageProbabilityGraphProps {
  probabilities?: number[];
  predictedStage?: number;
  confidence?: number;
  theme?: "dark" | "light";
}

const STAGE_LABELS = [
  { stage: 0, code: "ST 0", name: "Normal", short: "Stage 0" },
  { stage: 1, code: "ST 1", name: "Mild DR", short: "Stage 1" },
  { stage: 2, code: "ST 2", name: "Mod DR", short: "Stage 2" },
  { stage: 3, code: "ST 3", name: "Sev DR", short: "Stage 3" },
  { stage: 4, code: "ST 4", name: "Prolif DR", short: "Stage 4" },
];

export default function StageProbabilityGraph({
  probabilities,
  predictedStage = 0,
  confidence = 0.94,
  theme = "dark",
}: StageProbabilityGraphProps) {
  const isLight = theme === "light";

  // Calculate normalized probabilities (0.0 to 1.0)
  const normalizedProbabilities = useMemo(() => {
    if (probabilities && probabilities.length === 5) {
      return probabilities.map((p) => Math.max(0, Math.min(1, p)));
    }
    return [0, 1, 2, 3, 4].map((s) => {
      if (s === predictedStage) return confidence;
      const diff = Math.abs(s - predictedStage);
      return Math.max(0.01, (1.0 - confidence) / (diff * 2.5));
    });
  }, [probabilities, predictedStage, confidence]);

  // Peak index
  const peakIndex = useMemo(() => {
    let maxVal = -1;
    let maxIdx = predictedStage;
    normalizedProbabilities.forEach((val, idx) => {
      if (val > maxVal) {
        maxVal = val;
        maxIdx = idx;
      }
    });
    return maxIdx;
  }, [normalizedProbabilities, predictedStage]);

  // SVG Coordinate Geometry
  const svgWidth = 480;
  const svgHeight = 160;
  const padLeft = 46;
  const padRight = 30;
  const padTop = 22;
  const padBottom = 32;

  const plotWidth = svgWidth - padLeft - padRight; // 404
  const plotHeight = svgHeight - padTop - padBottom; // 106

  // Coordinate functions
  const getX = (index: number) => padLeft + (index / 4) * plotWidth;
  const getY = (prob: number) => padTop + (1.0 - prob) * plotHeight;

  // Grid steps (0%, 25%, 50%, 75%, 100%)
  const yTicks = [
    { value: 1.0, label: "100%" },
    { value: 0.75, label: "75%" },
    { value: 0.5, label: "50%" },
    { value: 0.25, label: "25%" },
    { value: 0.0, label: "0%" },
  ];

  // Points array
  const points = normalizedProbabilities.map((prob, i) => ({
    x: getX(i),
    y: getY(prob),
    prob,
    stage: i,
  }));

  // Construct SVG Line Path
  const linePath = points.reduce((acc, pt, i) => {
    return i === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`;
  }, "");

  return (
    <div
      className={`flex flex-col gap-2 p-4 border font-mono select-none transition-colors duration-200 ${
        isLight
          ? "border-neutral-300 bg-white text-black shadow-sm"
          : "border-neutral-800 bg-black text-white shadow-xl"
      }`}
    >
      {/* ── Section Header ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-b pb-2 border-inherit">
        <span
          className={`text-[10px] uppercase tracking-[0.18em] font-bold ${
            isLight ? "text-neutral-900" : "text-neutral-400"
          }`}
        >
          STAGE PROBABILITY DISTRIBUTION (TTA)
        </span>
      </div>

      {/* ── Crisp 2D Vector Line Graph (Simple, High-Contrast, No Gradients) ── */}
      <div className="w-full relative overflow-hidden flex items-center justify-center pt-1">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-auto max-h-[175px] overflow-visible"
        >
          {/* ── Y-Axis Grid Lines & Labels ── */}
          {yTicks.map((tick) => {
            const yPos = getY(tick.value);
            return (
              <g key={tick.value}>
                <line
                  x1={padLeft}
                  y1={yPos}
                  x2={svgWidth - padRight}
                  y2={yPos}
                  stroke={isLight ? "#D1D5DB" : "#22262E"}
                  strokeWidth="1"
                  strokeDasharray={tick.value === 0 ? "none" : "3 3"}
                />
                <text
                  x={padLeft - 8}
                  y={yPos + 3}
                  textAnchor="end"
                  fontSize="9"
                  fontFamily="monospace"
                  fontWeight={isLight ? "600" : "normal"}
                  fill={isLight ? "#374151" : "#717B8A"}
                >
                  {tick.label}
                </text>
              </g>
            );
          })}

          {/* ── X-Axis Vertical Guide Lines ── */}
          {points.map((pt, i) => (
            <line
              key={i}
              x1={pt.x}
              y1={padTop}
              x2={pt.x}
              y2={getY(0)}
              stroke={isLight ? "#E5E7EB" : "#191C22"}
              strokeWidth="1"
              strokeDasharray="2 2"
            />
          ))}

          {/* ── Simple Crisp Vector Stroke Line (No Fill Gradient) ── */}
          <path
            d={linePath}
            fill="none"
            stroke={isLight ? "#000000" : "#FFFFFF"}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* ── Data Points & Labels ── */}
          {points.map((pt) => {
            const isPeak = pt.stage === peakIndex;
            const pctText = `${(pt.prob * 100).toFixed(1)}%`;

            return (
              <g key={pt.stage}>
                {/* Value Text Above Node */}
                <text
                  x={pt.x}
                  y={Math.max(padTop - 5, pt.y - 8)}
                  textAnchor="middle"
                  fontSize={isPeak ? "10" : "8.5"}
                  fontWeight={isPeak ? "bold" : "600"}
                  fontFamily="monospace"
                  fill={isPeak ? (isLight ? "#000000" : "#FFFFFF") : isLight ? "#1F2937" : "#868E96"}
                >
                  {pctText}
                </text>

                {/* Point Circle */}
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={isPeak ? "5.5" : "3.5"}
                  fill={isPeak ? (isLight ? "#000000" : "#FFFFFF") : isLight ? "#FFFFFF" : "#000000"}
                  stroke={isPeak ? (isLight ? "#000000" : "#FFFFFF") : isLight ? "#111827" : "#868E96"}
                  strokeWidth={isPeak ? "2.5" : "1.5"}
                />

                {/* X-Axis Stage Label */}
                <text
                  x={pt.x}
                  y={getY(0) + 14}
                  textAnchor="middle"
                  fontSize="9.5"
                  fontWeight="bold"
                  fontFamily="monospace"
                  fill={isPeak ? (isLight ? "#000000" : "#FFFFFF") : isLight ? "#111827" : "#868E96"}
                >
                  {STAGE_LABELS[pt.stage].code}
                </text>
                <text
                  x={pt.x}
                  y={getY(0) + 24}
                  textAnchor="middle"
                  fontSize="8"
                  fontWeight={isLight ? "600" : "normal"}
                  fontFamily="monospace"
                  fill={isPeak ? (isLight ? "#111827" : "#FFFFFF") : isLight ? "#4B5563" : "#555D6C"}
                >
                  {STAGE_LABELS[pt.stage].name}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
