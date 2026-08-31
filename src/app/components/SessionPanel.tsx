"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "../context/LanguageContext";

export interface DiagnosticHistoryItem {
  id: string;
  patientId?: string;
  patientName?: string;
  mobileNumber?: string;
  timestamp: string;
  stage: number;
  stageLabel: string;
  confidence: number;
  probabilities?: number[];
  previewUrl?: string | null;
  gradcam_base64?: string;
  quality_gate?: {
    sharpness: number;
    illumination: number;
    artifacts: number;
    passed: boolean;
  };
  val_mse_loss?: number | null;
  peak_qwk?: number;
  bounding_boxes?: Array<{ x: number; y: number; width: number; height: number }>;
}

interface SessionPanelProps {
  theme?: "dark" | "light";
  userEmail?: string;
  history?: DiagnosticHistoryItem[];
  savedItemIds?: string[];
  onSaveHistoryItem?: (item: DiagnosticHistoryItem) => void;
}

function getStageTheme(stage: number, isLight: boolean) {
  switch (stage) {
    case 0:
      return isLight
        ? "bg-neutral-100 text-neutral-800 border-neutral-300"
        : "bg-neutral-900 text-neutral-200 border-neutral-700";
    case 1:
      return isLight
        ? "bg-yellow-100 text-yellow-800 border-yellow-400"
        : "bg-yellow-950/60 text-yellow-300 border-yellow-500/50";
    case 2:
      return isLight
        ? "bg-amber-100 text-amber-800 border-amber-400"
        : "bg-amber-950/60 text-amber-300 border-amber-500/50";
    case 3:
      return isLight
        ? "bg-orange-100 text-orange-800 border-orange-400"
        : "bg-orange-950/60 text-orange-300 border-orange-500/50";
    case 4:
    default:
      return isLight
        ? "bg-red-600 text-white border-red-600 font-bold"
        : "bg-red-600 text-white border-red-500 font-bold shadow-[0_0_12px_rgba(239,68,68,0.6)]";
  }
}

export default function SessionPanel({
  theme = "dark",
  userEmail = "OPERATOR",
  history = [],
  savedItemIds = [],
  onSaveHistoryItem,
}: SessionPanelProps) {
  const { language, t } = useLanguage();
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
      className={`w-[350px] md:w-[390px] lg:w-[430px] xl:w-[450px] max-h-[calc(100vh-140px)] flex flex-col p-4 border font-mono select-none backdrop-blur-xl transition-all duration-300 pointer-events-auto rounded-none shadow-xl ${
        isLight
          ? "bg-white/95 border-neutral-300 text-neutral-900 shadow-neutral-300/40"
          : "bg-neutral-950/90 border-neutral-800 text-white shadow-black/70"
      }`}
    >
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="pb-2.5 border-b border-inherit">
        <span className="font-bold tracking-[0.18em] uppercase text-xs">
          {t("session_title", "SESSION")}
        </span>
      </div>

      {/* ── User & Login Details ────────────────────────────────────────── */}
      <div className="flex flex-col gap-1.5 py-2.5 border-b border-inherit text-xs">
        <div className="flex items-center justify-between">
          <span
            className={
              isLight
                ? "text-neutral-500 uppercase text-[10px] tracking-wider"
                : "text-neutral-400 uppercase text-[10px] tracking-wider"
            }
          >
            {t("session_user", "User:")}
          </span>
          <span className="font-medium text-xs truncate">
            {userEmail?.toLowerCase().includes("guest") ? t("guest", "Guest") : userEmail}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span
            className={
              isLight
                ? "text-neutral-500 uppercase text-[10px] tracking-wider"
                : "text-neutral-400 uppercase text-[10px] tracking-wider"
            }
          >
            {t("session_login_date", "Login Date:")}
          </span>
          <span className="font-medium text-xs">
            {loginDate || "--"}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span
            className={
              isLight
                ? "text-neutral-500 uppercase text-[10px] tracking-wider"
                : "text-neutral-400 uppercase text-[10px] tracking-wider"
            }
          >
            {t("session_login_time", "Login Time:")}
          </span>
          <span className="font-medium text-xs">
            {loginTime || "--:--:--"}
          </span>
        </div>
      </div>

      {/* ── History Log ─────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2 flex-1 min-h-0 pt-2.5">
        <div className="flex items-center justify-between">
          <span
            className={`font-bold tracking-wider text-xs uppercase ${
              isLight ? "text-neutral-800" : "text-neutral-200"
            }`}
          >
            {t("session_history_title", "DIAGNOSTIC HISTORY")}
          </span>
          <span
            className={`text-[10px] font-mono border px-2 py-0.5 uppercase tracking-wider ${
              isLight
                ? "border-neutral-300 text-neutral-600 bg-neutral-50"
                : "border-neutral-800 text-neutral-400 bg-black"
            }`}
          >
            {history.length} {t("patient_log_records", "Records")}
          </span>
        </div>

        <div
          className={`overflow-y-auto flex flex-col gap-1.5 border p-1.5 max-h-[calc(100vh-280px)] ${
            isLight
              ? "border-neutral-200 bg-neutral-50/70"
              : "border-neutral-800 bg-black/60"
          }`}
        >
          {history.length === 0 ? (
            <div
              className={`py-8 text-center text-xs font-mono ${
                isLight ? "text-neutral-400" : "text-neutral-500"
              }`}
            >
              {t("session_no_scans", "NO SCANS RECORDED")}
            </div>
          ) : (
            history.map((item) => {
              const isSaved = savedItemIds.includes(item.id);

              return (
                <div
                  key={item.id}
                  className={`p-2 border flex items-center justify-between text-xs text-left transition-all ${
                    isLight
                      ? "border-neutral-200 bg-white"
                      : "border-neutral-800 bg-neutral-900/80"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`px-1.5 py-0.5 border text-[9px] font-bold uppercase tracking-wider shrink-0 ${getStageTheme(
                        item.stage,
                        isLight
                      )}`}
                    >
                      Stage {item.stage}
                    </span>
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <span className="font-medium text-[11px] tracking-wide truncate">
                        {item.patientName || item.stageLabel}
                      </span>
                      <span
                        className={`text-[9.5px] ${
                          isLight ? "text-neutral-500" : "text-neutral-400"
                        }`}
                      >
                        {item.timestamp}
                      </span>
                    </div>
                  </div>

                  <div className="text-right shrink-0 flex items-center gap-2">
                    <span
                      className={`font-semibold text-xs ${
                        isLight ? "text-neutral-900" : "text-neutral-200"
                      }`}
                    >
                      {(item.confidence * 100).toFixed(1)}%
                    </span>
                    <button
                      type="button"
                      onClick={() => onSaveHistoryItem?.(item)}
                      disabled={isSaved}
                      className={`px-2 py-1 border text-[9px] font-mono font-bold uppercase tracking-wider transition-all cursor-pointer ${
                        isSaved
                          ? (isLight
                              ? "border-neutral-300 bg-neutral-100 text-neutral-500 cursor-default"
                              : "border-neutral-800 bg-neutral-900 text-neutral-500 cursor-default")
                          : (isLight
                              ? "border-neutral-400 bg-white text-neutral-900 hover:border-black hover:bg-black hover:text-white"
                              : "border-neutral-700 bg-neutral-950 text-neutral-200 hover:border-white hover:bg-white hover:text-black")
                      }`}
                    >
                      {isSaved ? `[ ${t("session_saved", "SAVED")} ]` : `[ ${t("session_save_report", "SAVE REPORT")} ]`}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
