"use client";

import { useEffect, useState } from "react";

export interface DiagnosticHistoryItem {
  id: string;
  timestamp: string;
  stage: number;
  stageLabel: string;
  confidence: number;
  previewUrl?: string | null;
  val_mse_loss?: number | null;
  peak_qwk?: number;
}

interface SessionPanelProps {
  theme?: "dark" | "light";
  userEmail?: string;
  history?: DiagnosticHistoryItem[];
  onSelectHistoryItem?: (item: DiagnosticHistoryItem) => void;
}

function getStageTheme(stage: number, isLight: boolean) {
  switch (stage) {
    case 0:
      return isLight
        ? "bg-emerald-100 text-emerald-800 border-emerald-300"
        : "bg-emerald-950/40 text-emerald-400 border-emerald-600/40";
    case 1:
      return isLight
        ? "bg-yellow-100 text-yellow-800 border-yellow-300"
        : "bg-yellow-950/40 text-yellow-400 border-yellow-600/40";
    case 2:
      return isLight
        ? "bg-amber-100 text-amber-800 border-amber-300"
        : "bg-amber-950/40 text-amber-400 border-amber-600/40";
    case 3:
      return isLight
        ? "bg-orange-100 text-orange-800 border-orange-300"
        : "bg-orange-950/40 text-orange-400 border-orange-600/40";
    case 4:
    default:
      return isLight
        ? "bg-red-100 text-red-800 border-red-300"
        : "bg-red-950/40 text-red-400 border-red-600/40";
  }
}

export default function SessionPanel({
  theme = "dark",
  userEmail = "OPERATOR",
  history = [],
  onSelectHistoryItem,
}: SessionPanelProps) {
  const isLight = theme === "light";
  const [loginTime, setLoginTime] = useState<string>("");
  const [loginDate, setLoginDate] = useState<string>("");

  useEffect(() => {
    const now = new Date();
    setLoginTime(now.toLocaleTimeString("en-US", { hour12: false }));
    setLoginDate(now.toISOString().split("T")[0]);
  }, []);

  return (
    <div
      className={`w-72 max-h-[50vh] flex flex-col p-4 border font-mono text-[10px] select-none backdrop-blur-md transition-colors duration-300 pointer-events-auto ${
        isLight
          ? "bg-white/90 border-neutral-300 text-neutral-900 shadow-sm"
          : "bg-black/80 border-neutral-800 text-white shadow-md"
      }`}
    >
      {/* Header */}
      <div className="pb-2 border-b border-inherit mb-2.5">
        <span className="font-bold tracking-[0.18em] uppercase text-[10px]">
          SESSION
        </span>
      </div>

      {/* 1. Time of Login */}
      <div className="flex flex-col gap-1.5 pb-2.5 border-b border-inherit mb-2.5 text-[9px]">
        <div className="flex justify-between">
          <span className={isLight ? "text-neutral-500 uppercase" : "text-neutral-400 uppercase"}>User:</span>
          <span className="font-medium truncate max-w-[140px]">{userEmail?.toLowerCase().includes("guest") ? "Guest" : userEmail}</span>
        </div>
        <div className="flex justify-between">
          <span className={isLight ? "text-neutral-500 uppercase" : "text-neutral-400 uppercase"}>Login:</span>
          <span className="font-medium">{loginDate} {loginTime || "--:--:--"}</span>
        </div>
      </div>

      {/* 2. Session Log History */}
      <div className="flex flex-col gap-2 flex-1 min-h-0">
        <div className="flex items-center justify-between">
          <span className={`font-bold tracking-wider text-[9px] uppercase ${
            isLight ? "text-neutral-700" : "text-neutral-300"
          }`}>
            History Log
          </span>
          <span className={isLight ? "text-neutral-400 text-[8.5px]" : "text-neutral-500 text-[8.5px]"}>
            {history.length} Record{history.length !== 1 ? "s" : ""}
          </span>
        </div>

        <div className={`overflow-y-auto flex flex-col gap-1.5 border p-1.5 flex-1 min-h-[90px] ${
          isLight ? "border-neutral-200 bg-neutral-50/50" : "border-neutral-800 bg-neutral-950/40"
        }`}>
          {history.length === 0 ? (
            <div className={`py-6 text-center text-[9px] ${
              isLight ? "text-neutral-400" : "text-neutral-600"
            }`}>
              NO PREVIOUS RUNS
            </div>
          ) : (
            history.map((item) => (
              <button
                key={item.id}
                onClick={() => onSelectHistoryItem?.(item)}
                className={`p-2 border flex items-center justify-between text-[8.5px] text-left transition-all cursor-pointer ${
                  isLight
                    ? "border-neutral-200 bg-white hover:border-black hover:bg-neutral-100"
                    : "border-neutral-800 bg-neutral-900/60 hover:border-white hover:bg-neutral-800"
                }`}
                title="Click to view full screen report"
              >
                <div className="flex items-center gap-2">
                  <span className={`px-1.5 py-0.5 border text-[8px] font-bold uppercase tracking-wider shrink-0 ${getStageTheme(item.stage, isLight)}`}>
                    Stage {item.stage}
                  </span>
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium tracking-wide">
                      {item.stageLabel}
                    </span>
                    <span className={isLight ? "text-neutral-400" : "text-neutral-500"}>
                      {item.timestamp}
                    </span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className={`font-medium ${isLight ? "text-neutral-900" : "text-neutral-200"}`}>
                    {(item.confidence * 100).toFixed(0)}%
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
