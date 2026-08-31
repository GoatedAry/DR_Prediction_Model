"use client";

import { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import { Search, Maximize2, Minimize2 } from "lucide-react";
import { DiagnosticHistoryItem } from "./SessionPanel";
import { useLanguage } from "../context/LanguageContext";

interface PatientLogTableProps {
  theme?: "dark" | "light";
  records: DiagnosticHistoryItem[];
  isGuest?: boolean;
  maxGuestLimit?: number;
  onReviewScan: (item: DiagnosticHistoryItem) => void;
  onPreviewPdf?: (item: DiagnosticHistoryItem) => void;
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

function getPriorityBadge(stage: number, isLight: boolean, t: (k: string, f?: string) => string) {
  switch (stage) {
    case 0:
    case 1:
      return {
        label: stage === 0 ? t("priority_normal", "NORMAL") : t("priority_low", "LOW (ROUTINE)"),
        color: isLight
          ? "border-neutral-300 bg-neutral-100 text-neutral-700 font-medium"
          : "border-neutral-700 bg-neutral-900 text-neutral-300 font-medium",
      };
    case 2:
      return {
        label: t("priority_moderate", "MODERATE"),
        color: isLight
          ? "border-yellow-300 bg-yellow-50 text-yellow-700 font-medium"
          : "border-yellow-500/30 bg-yellow-950/30 text-yellow-400 font-medium",
      };
    case 3:
      return {
        label: t("priority_high", "HIGH PRIORITY"),
        color: isLight
          ? "border-orange-300 bg-orange-50 text-orange-700 font-bold"
          : "border-orange-500/30 bg-orange-950/30 text-orange-400 font-bold",
      };
    case 4:
    default:
      return {
        label: t("priority_urgent", "URGENT REFERRAL"),
        color: isLight
          ? "border-red-600 bg-red-600 text-white font-bold"
          : "border-red-600 bg-red-600 text-white font-bold shadow-[0_0_10px_rgba(239,68,68,0.5)]",
      };
  }
}

export default function PatientLogTable({
  theme = "dark",
  records,
  isGuest = false,
  maxGuestLimit = 3,
  onReviewScan,
  onPreviewPdf,
}: PatientLogTableProps) {
  const { language, t } = useLanguage();
  const isLight = theme === "light";
  const [searchQuery, setSearchQuery] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isGuestFull = isGuest && records.length >= maxGuestLimit;

  const filteredRecords = useMemo(() => {
    if (!searchQuery.trim()) return records;
    const q = searchQuery.toLowerCase().trim();
    return records.filter((item) => {
      const matchName = item.patientName?.toLowerCase().includes(q);
      const matchMobile = item.mobileNumber?.includes(q);
      const matchId = item.patientId?.toLowerCase().includes(q);
      const matchStage = item.stageLabel?.toLowerCase().includes(q);
      return matchName || matchMobile || matchId || matchStage;
    });
  }, [records, searchQuery]);

  const handleReviewAndExit = (item: DiagnosticHistoryItem) => {
    setIsFullscreen(false);
    onReviewScan(item);
  };

  return (
    <>
      {/* ── Standard Sidebar View ─────────────────────────────────────────── */}
      <div
        className={`w-[350px] md:w-[390px] lg:w-[430px] xl:w-[450px] max-h-[calc(100vh-140px)] flex flex-col p-4 border font-mono select-none backdrop-blur-xl transition-all duration-300 pointer-events-auto rounded-none shadow-xl ${
          isLight
            ? "bg-white/95 border-neutral-300 text-neutral-900 shadow-neutral-300/40"
            : "bg-neutral-950/90 border-neutral-800 text-white shadow-black/70"
        }`}
      >
        {/* ── Header: Title, Fullscreen Button & Total Count ───────────────── */}
        <div className="flex items-center justify-between pb-2.5 border-b border-inherit">
          <div className="flex items-center gap-2">
            <span className="font-bold tracking-[0.18em] uppercase text-xs">
              {t("patient_log_title", "PATIENT LOG")}
            </span>
            {isGuest && (
              <span className={`text-[9px] px-1.5 py-0.5 border font-bold uppercase tracking-wider ${
                isGuestFull
                  ? "border-red-600 bg-red-600 text-white font-bold shadow-sm"
                  : (isLight ? "border-amber-400 bg-amber-50 text-amber-800" : "border-amber-500/40 bg-amber-950/40 text-amber-300")
              }`}>
                {isGuestFull ? t("patient_log_full", "3/3 FULL") : `${records.length}/3`}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsFullscreen(true)}
              className={`p-1 border text-[9.5px] uppercase tracking-wider flex items-center gap-1 transition-colors cursor-pointer ${
                isLight
                  ? "border-neutral-300 bg-neutral-100 hover:bg-neutral-200 text-neutral-800"
                  : "border-neutral-800 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white"
              }`}
              title="Expand to Fullscreen"
            >
              <Maximize2 size={11} /> [ ⛶ ]
            </button>
            <span
              className={`text-[10px] font-mono border px-2 py-0.5 uppercase tracking-wider ${
                isLight
                  ? "border-neutral-300 text-neutral-600 bg-neutral-100"
                  : "border-neutral-800 text-neutral-400 bg-black"
              }`}
            >
              {filteredRecords.length}
            </span>
          </div>
        </div>

        {/* ── Guest Capacity Alert Banner ─────────────────────────────────── */}
        {isGuestFull && (
          <div className={`mt-2 p-2 border font-mono flex flex-col gap-0.5 text-[9.5px] ${
            isLight
              ? "border-red-600 bg-red-50 text-red-800 border-l-4 border-l-red-600 font-bold"
              : "border-red-600 bg-red-950/80 text-red-100 border-l-4 border-l-red-500 font-bold"
          }`}>
            <span className="font-bold uppercase tracking-wider text-red-600 dark:text-red-400">{t("patient_log_limit_title", "[ LIMIT ] GUEST STORAGE FULL (3/3)")}</span>
            <span className="opacity-90 text-[8.5px]">{t("patient_log_limit_desc", "Log in to save unlimited records.")}</span>
          </div>
        )}

        {/* ── Search Bar: Real-time filtering ───────────────────────────────── */}
        <div className="py-2.5 border-b border-inherit">
          <div
            className={`flex items-center gap-2 px-2.5 py-1.5 border transition-colors ${
              isLight
                ? "bg-white border-neutral-300 focus-within:border-black"
                : "bg-black/60 border-neutral-800 focus-within:border-white/40"
            }`}
          >
            <Search size={12} className={isLight ? "text-neutral-400" : "text-neutral-500"} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("patient_log_search", "Filter by Name or Mobile...")}
              className={`w-full text-xs font-mono bg-transparent outline-none placeholder:text-[10.5px] ${
                isLight
                  ? "text-black placeholder:text-neutral-400"
                  : "text-white placeholder:text-neutral-600"
              }`}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className={`text-[10px] font-mono hover:opacity-100 opacity-60 cursor-pointer ${
                  isLight ? "text-neutral-600" : "text-neutral-400"
                }`}
              >
                [×]
              </button>
            )}
          </div>
        </div>

        {/* ── Data Table / Log Rows ─────────────────────────────────────────── */}
        <div className="flex flex-col gap-2 flex-1 min-h-0 pt-2.5">
          <div
            className={`overflow-y-auto flex flex-col gap-1.5 border p-1.5 max-h-[calc(100vh-280px)] ${
              isLight
                ? "border-neutral-200 bg-neutral-50/70"
                : "border-neutral-800 bg-black/60"
            }`}
          >
            {filteredRecords.length === 0 ? (
              <div
                className={`py-8 text-center text-xs font-mono ${
                  isLight ? "text-neutral-400" : "text-neutral-500"
                }`}
              >
                {searchQuery ? "NO MATCHING RECORDS" : t("patient_log_empty", "NO PATIENT SCANS LOGGED")}
              </div>
            ) : (
              filteredRecords.map((item) => (
                <div
                  key={item.id}
                  onClick={() => onReviewScan(item)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onReviewScan(item);
                    }
                  }}
                  className={`p-2.5 border flex items-center justify-between text-xs text-left transition-all cursor-pointer group ${
                    isLight
                      ? "border-neutral-200 bg-white hover:border-black hover:bg-neutral-100"
                      : "border-neutral-800 bg-neutral-900/80 hover:border-white hover:bg-neutral-800"
                  }`}
                  title="Click to review full scan"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={`px-2 py-0.5 border text-[9px] font-bold uppercase tracking-wider shrink-0 ${getStageTheme(
                        item.stage,
                        isLight
                      )}`}
                    >
                      Stage {item.stage}
                    </span>
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <span className="font-medium text-xs tracking-wide truncate">
                        {item.patientName || t("anonymous_patient", "Anonymous")}
                      </span>
                      <span
                        className={`text-[10px] ${
                          isLight ? "text-neutral-500" : "text-neutral-400"
                        }`}
                      >
                        {item.patientId || item.timestamp}
                      </span>
                    </div>
                  </div>

                  <div className="text-right shrink-0 flex flex-col items-end gap-1">
                    <span
                      className={`font-semibold text-xs ${
                        isLight ? "text-neutral-900" : "text-neutral-200"
                      }`}
                    >
                      {(item.confidence * 100).toFixed(1)}%
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onPreviewPdf?.(item);
                        }}
                        className={`px-1.5 py-0.5 border text-[8.5px] uppercase tracking-wider transition-colors cursor-pointer font-bold ${
                          isLight
                            ? "border-neutral-300 bg-neutral-100 hover:border-black hover:bg-black hover:text-white text-neutral-800"
                            : "border-neutral-700 bg-neutral-900 hover:border-white hover:bg-white hover:text-black text-neutral-300"
                        }`}
                        title="Preview PDF Report"
                      >
                        [ {t("pdf", "PDF")} ]
                      </button>
                      <span
                        className={`text-[8.5px] uppercase tracking-wider transition-colors ${
                          isLight
                            ? "text-neutral-500 group-hover:text-black"
                            : "text-neutral-500 group-hover:text-white"
                        }`}
                      >
                        [ {t("review", "Review")} ]
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── Fullscreen Takeover View (Mounted directly on document.body using createPortal) ── */}
      {isFullscreen && mounted && createPortal(
        <div
          className={`fixed inset-0 z-[99999] w-screen h-screen p-6 md:p-8 font-mono flex flex-col justify-start select-none overflow-hidden ${
            isLight
              ? "bg-white text-neutral-900"
              : "bg-black text-white"
          }`}
        >
          <div className="w-full max-w-7xl mx-auto flex flex-col gap-4 flex-1 h-full min-h-0">
            {/* Fullscreen Header */}
            <div
              className={`flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 border-b shrink-0 ${
                isLight ? "border-neutral-300" : "border-neutral-800"
              }`}
            >
              <div>
                <h1 className="text-sm md:text-base font-bold tracking-wider uppercase">
                  {t("patient_audit", "Patient Audit")}
                </h1>
              </div>

              <div className="flex items-center gap-3">
                {/* Search Bar in Fullscreen */}
                <div
                  className={`flex items-center gap-2 px-3 py-1.5 border w-64 ${
                    isLight
                      ? "border-neutral-300 bg-white"
                      : "border-neutral-800 bg-neutral-950"
                  }`}
                >
                  <Search size={12} className={isLight ? "text-neutral-400" : "text-neutral-500"} />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t("patient_log_search_full", "Search by ID, Name, Mobile...")}
                    className={`w-full text-xs font-mono bg-transparent outline-none ${
                      isLight
                        ? "text-black placeholder:text-neutral-400"
                        : "text-white placeholder:text-neutral-600"
                    }`}
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="text-xs text-neutral-400 hover:text-black dark:hover:text-white"
                    >
                      [×]
                    </button>
                  )}
                </div>

                <span
                  className={`text-xs border px-3 py-1.5 uppercase tracking-wider ${
                    isLight
                      ? "border-neutral-300 bg-neutral-100 text-neutral-700"
                      : "border-neutral-800 bg-neutral-950 text-neutral-300"
                  }`}
                >
                  {filteredRecords.length} {t("patient_log_records", "Records")}
                </span>

                {/* Exit Fullscreen -> Simple [ Back ] Button */}
                <button
                  onClick={() => setIsFullscreen(false)}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 border text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                    isLight
                      ? "border-neutral-400 bg-neutral-100 hover:bg-black hover:text-white text-neutral-900"
                      : "border-neutral-700 bg-neutral-900 hover:border-white hover:bg-white hover:text-black text-white"
                  }`}
                >
                  <Minimize2 size={12} /> [ {t("back", "Back")} ]
                </button>
              </div>
            </div>

            {/* Fullscreen Guest Limit Banner */}
            {isGuestFull && (
              <div className={`p-3 border font-mono flex items-center justify-between shrink-0 text-xs ${
                isLight
                  ? "border-red-600 bg-red-50 text-red-800 border-l-4 border-l-red-600 font-bold"
                  : "border-red-600 bg-red-950/80 text-red-100 border-l-4 border-l-red-500 font-bold"
              }`}>
                <div className="flex items-center gap-2">
                  <span className="font-bold uppercase tracking-wider text-red-600 dark:text-red-400">{t("patient_log_limit_title", "[ LIMIT ] GUEST STORAGE FULL (3/3)")}</span>
                </div>
                <span className="text-[11px] opacity-90">{t("patient_log_limit_desc", "Please sign in or create an account for unlimited persistent records.")}</span>
              </div>
            )}

            {/* High-Density Horizontal Data Table with Full Visible Layout */}
            <div
              className={`border overflow-x-auto flex-1 min-h-[400px] overflow-y-auto ${
                isLight
                  ? "border-neutral-300 bg-white"
                  : "border-neutral-800 bg-neutral-950/80"
              }`}
            >
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr
                    className={`border-b text-[10px] uppercase font-mono tracking-widest sticky top-0 z-10 ${
                      isLight
                        ? "border-neutral-300 bg-neutral-100 text-neutral-700"
                        : "border-neutral-800 bg-black text-neutral-400"
                    }`}
                  >
                    <th className="p-3.5 font-bold">{t("col_patient_id", "Patient ID")}</th>
                    <th className="p-3.5 font-bold font-sans">{t("col_name", "Patient Name")}</th>
                    <th className="p-3.5 font-bold">{t("col_mobile", "Mobile")}</th>
                    <th className="p-3.5 font-bold">{t("col_stage", "Stage & Classification")}</th>
                    <th className="p-3.5 font-bold text-center">{t("col_confidence", "Confidence")}</th>
                    <th className="p-3.5 font-bold text-center">{t("col_priority", "Clinical Priority")}</th>
                    <th className="p-3.5 font-bold">{t("col_timestamp", "Scan Time")}</th>
                    <th className="p-3.5 font-bold text-right">{t("col_action", "Action")}</th>
                  </tr>
                </thead>
                <tbody
                  className={`divide-y ${
                    isLight ? "divide-neutral-200" : "divide-neutral-800/80"
                  }`}
                >
                  {filteredRecords.length === 0 ? (
                    <tr>
                      <td
                        colSpan={8}
                        className={`py-16 text-center text-xs font-mono ${
                          isLight ? "text-neutral-400" : "text-neutral-500"
                        }`}
                      >
                        {searchQuery
                          ? "NO MATCHING PATIENT RECORDS FOUND"
                          : t("patient_log_empty", "NO PATIENT SCANS LOGGED IN SESSION")}
                      </td>
                    </tr>
                  ) : (
                    filteredRecords.map((item) => {
                      const priority = getPriorityBadge(item.stage, isLight, t);
                      return (
                        <tr
                          key={item.id}
                          className={`transition-colors duration-150 ${
                            isLight
                              ? "hover:bg-neutral-50"
                              : "hover:bg-white/5"
                          }`}
                        >
                          {/* Patient ID */}
                          <td
                            className={`p-3.5 font-mono text-xs font-bold whitespace-nowrap ${
                              isLight ? "text-neutral-800" : "text-neutral-200"
                            }`}
                          >
                            {item.patientId || "NET-TEMP"}
                          </td>

                          {/* Patient Name */}
                          <td
                            className={`p-3.5 font-sans text-sm font-semibold whitespace-nowrap ${
                              isLight ? "text-neutral-900" : "text-white"
                            }`}
                          >
                            {item.patientName || t("anonymous_patient", "Anonymous Patient")}
                          </td>

                          {/* Mobile Number */}
                          <td
                            className={`p-3.5 font-mono text-xs whitespace-nowrap ${
                              isLight ? "text-neutral-600" : "text-neutral-400"
                            }`}
                          >
                            {item.mobileNumber || "--"}
                          </td>

                          {/* Stage Pill + Label */}
                          <td className="p-3.5 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <span
                                className={`px-2 py-0.5 border text-[10px] font-bold uppercase tracking-wider ${getStageTheme(
                                  item.stage,
                                  isLight
                                )}`}
                              >
                                Stage {item.stage}
                              </span>
                              <span
                                className={`text-xs ${
                                  isLight ? "text-neutral-700" : "text-neutral-300"
                                }`}
                              >
                                {item.stageLabel}
                              </span>
                            </div>
                          </td>

                          {/* Confidence Score */}
                          <td
                            className={`p-3.5 text-center font-mono text-xs font-semibold whitespace-nowrap ${
                              isLight ? "text-neutral-900" : "text-neutral-200"
                            }`}
                          >
                            {(item.confidence * 100).toFixed(1)}%
                          </td>

                          {/* Clinical Priority Badge */}
                          <td className="p-3.5 text-center whitespace-nowrap">
                            <span
                              className={`inline-block px-2.5 py-1 border text-[9.5px] font-bold uppercase tracking-wider ${priority.color}`}
                            >
                              {priority.label}
                            </span>
                          </td>

                          {/* Timestamp */}
                          <td
                            className={`p-3.5 font-mono text-xs whitespace-nowrap ${
                              isLight ? "text-neutral-600" : "text-neutral-400"
                            }`}
                          >
                            {item.timestamp}
                          </td>

                          {/* Review Scan & PDF Actions */}
                          <td className="p-3.5 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => onPreviewPdf?.(item)}
                                className={`px-3 py-1.5 border text-[10px] font-mono font-bold uppercase tracking-wider transition-all cursor-pointer ${
                                  isLight
                                    ? "border-neutral-400 bg-neutral-100 hover:border-black hover:bg-black hover:text-white text-neutral-900"
                                    : "border-neutral-700 bg-neutral-900 hover:border-white hover:bg-white hover:text-black text-white"
                                }`}
                                title="Preview PDF Report"
                              >
                                [ {t("preview_pdf", "Preview PDF")} ]
                              </button>

                              <button
                                onClick={() => handleReviewAndExit(item)}
                                className={`px-3 py-1.5 border text-[10px] font-mono font-bold uppercase tracking-wider transition-all cursor-pointer ${
                                  isLight
                                    ? "border-neutral-400 bg-neutral-100 hover:border-black hover:bg-black hover:text-white text-neutral-900"
                                    : "border-neutral-700 bg-neutral-900 hover:border-white hover:bg-white hover:text-black text-white"
                                }`}
                              >
                                [ {t("review_scan", "Review Scan")} ]
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
