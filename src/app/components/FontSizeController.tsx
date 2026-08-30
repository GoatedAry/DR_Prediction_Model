"use client";

import { useState, useEffect, useRef } from "react";
import { Type, RotateCcw, Minus, Plus } from "lucide-react";

interface FontSizeControllerProps {
  theme?: "dark" | "light";
}

const DEFAULT_SCALE = 110;
const MIN_SCALE = 90;
const MAX_SCALE = 130;
const STEP = 5;

const PRESETS = [
  { label: "90%", value: 90, name: "Compact" },
  { label: "100%", value: 100, name: "Standard" },
  { label: "110%", value: 110, name: "Default" },
  { label: "120%", value: 120, name: "Large" },
  { label: "130%", value: 130, name: "Max" },
];

export default function FontSizeController({ theme = "dark" }: FontSizeControllerProps) {
  const [scale, setScale] = useState<number>(DEFAULT_SCALE);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [mounted, setMounted] = useState<boolean>(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Apply scale to root HTML element
  const applyScale = (newScale: number) => {
    const clamped = Math.min(MAX_SCALE, Math.max(MIN_SCALE, newScale));
    setScale(clamped);
    if (typeof window !== "undefined") {
      localStorage.setItem("dr_font_scale", clamped.toString());
      document.documentElement.style.setProperty("--font-scale", (clamped / 100).toString());
      document.documentElement.style.fontSize = `${(16 * (clamped / 100)).toFixed(2)}px`;
    }
  };

  // Hydrate preference from localStorage
  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem("dr_font_scale");
    if (stored) {
      const parsed = parseInt(stored, 10);
      if (!isNaN(parsed) && parsed >= MIN_SCALE && parsed <= MAX_SCALE) {
        applyScale(parsed);
        return;
      }
    }
    // Apply default scale if no saved preference
    applyScale(DEFAULT_SCALE);
  }, []);

  // Close popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const isLight = theme === "light";

  return (
    <div className="relative" ref={popoverRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        title="Adjust Font Size / Text Scaling"
        className={`flex items-center gap-1 px-2 py-1 rounded-full border transition-all cursor-pointer font-mono text-[9px] uppercase tracking-wider ${
          isLight
            ? "border-neutral-400 hover:border-neutral-700 text-neutral-900 bg-white hover:bg-neutral-50 shadow-xs"
            : "border-white/15 hover:border-white/40 text-white/70 hover:text-white bg-neutral-950/80"
        } ${isOpen ? (isLight ? "ring-1 ring-neutral-900 border-neutral-900 text-black font-semibold" : "border-white/60 text-white") : ""}`}
      >
        <Type size={11} className="opacity-80" />
        <span className="font-semibold">{mounted ? `${scale}%` : "110%"}</span>
      </button>

      {/* Popover Controller */}
      {isOpen && (
        <div
          className={`absolute left-0 top-full mt-2 w-60 p-3.5 border font-mono select-none shadow-2xl z-50 backdrop-blur-md transition-all ${
            isLight
              ? "bg-white/95 border-neutral-300 text-neutral-900 shadow-neutral-200/50"
              : "bg-neutral-950/95 border-neutral-800 text-white shadow-black/80"
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-2.5 border-b border-inherit mb-3">
            <div className="flex items-center gap-1.5">
              <Type size={13} className="text-[#E30022]" />
              <span className="font-bold text-[0.68rem] tracking-widest uppercase">
                TEXT SCALING
              </span>
            </div>
            <span
              className={`text-[0.68rem] font-bold px-1.5 py-0.5 border ${
                isLight
                  ? "border-neutral-300 bg-neutral-100 text-neutral-800"
                  : "border-neutral-700 bg-neutral-900 text-white"
              }`}
            >
              {scale}%
            </span>
          </div>

          {/* Stepper & Slider */}
          <div className="flex flex-col gap-2.5 mb-3.5">
            <div className="flex items-center justify-between text-[0.6rem] opacity-60 uppercase tracking-wider">
              <span>Size: {MIN_SCALE}%</span>
              <span>Max: {MAX_SCALE}%</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => applyScale(scale - STEP)}
                disabled={scale <= MIN_SCALE}
                className={`p-1.5 border transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${
                  isLight
                    ? "border-neutral-300 hover:bg-neutral-100 text-neutral-800"
                    : "border-neutral-800 hover:bg-neutral-900 text-white"
                }`}
                title="Decrease font size"
              >
                <Minus size={11} />
              </button>

              <input
                type="range"
                min={MIN_SCALE}
                max={MAX_SCALE}
                step={STEP}
                value={scale}
                onChange={(e) => applyScale(parseInt(e.target.value, 10))}
                className="flex-1 cursor-pointer accent-[#E30022]"
              />

              <button
                onClick={() => applyScale(scale + STEP)}
                disabled={scale >= MAX_SCALE}
                className={`p-1.5 border transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${
                  isLight
                    ? "border-neutral-300 hover:bg-neutral-100 text-neutral-800"
                    : "border-neutral-800 hover:bg-neutral-900 text-white"
                }`}
                title="Increase font size"
              >
                <Plus size={11} />
              </button>
            </div>
          </div>

          {/* Preset Buttons Grid */}
          <div className="flex flex-col gap-1 mb-3">
            <span className="text-[0.58rem] opacity-50 uppercase tracking-widest mb-0.5">
              Quick Presets
            </span>
            <div className="grid grid-cols-5 gap-1">
              {PRESETS.map((p) => {
                const isActive = scale === p.value;
                return (
                  <button
                    key={p.value}
                    onClick={() => applyScale(p.value)}
                    className={`py-1 text-[0.58rem] border uppercase transition-all cursor-pointer font-medium ${
                      isActive
                        ? isLight
                          ? "bg-neutral-900 text-white border-neutral-900 font-bold"
                          : "bg-white text-black border-white font-bold"
                        : isLight
                        ? "border-neutral-200 bg-neutral-50 hover:bg-neutral-100 text-neutral-700"
                        : "border-neutral-800/80 bg-neutral-900/50 hover:bg-neutral-800 text-neutral-400 hover:text-white"
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Reset Button */}
          <div className="pt-2 border-t border-inherit flex justify-between items-center">
            <button
              onClick={() => applyScale(DEFAULT_SCALE)}
              className={`flex items-center gap-1 text-[0.58rem] tracking-wider uppercase transition-colors cursor-pointer opacity-70 hover:opacity-100 ${
                isLight ? "text-neutral-600 hover:text-black" : "text-neutral-400 hover:text-white"
              }`}
            >
              <RotateCcw size={10} />
              <span>Reset ({DEFAULT_SCALE}%)</span>
            </button>
            <span className="text-[0.55rem] opacity-40 uppercase">Auto-saved</span>
          </div>
        </div>
      )}
    </div>
  );
}
