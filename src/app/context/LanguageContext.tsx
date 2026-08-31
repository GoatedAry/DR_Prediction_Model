"use client";

import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from "react";

export type Language = "en" | "hi";

export interface Translations {
  [key: string]: {
    en: string;
    hi: string;
  };
}

export const DICTIONARY: Translations = {
  // ── Navigation & Header ──
  brand_name: { en: "NETRAAI", hi: "NETRAAI" },
  nav_grader: { en: "Diagnostic Grader", hi: "डायग्नोस्टिक ग्रेडर" },
  nav_reports: { en: "Reports", hi: "रिपोर्ट्स" },
  nav_architecture: { en: "AI Summary", hi: "AI सारांश" },
  nav_ai_summary: { en: "AI Summary", hi: "AI सारांश" },
  nav_sih: { en: "SIH Hub", hi: "SIH Hub" },
  nav_home: { en: "Home", hi: "Home" },
  sign_out: { en: "Logout", hi: "Logout" },
  guest: { en: "Guest", hi: "Guest" },
  toggle_language: { en: "EN / हि", hi: "हि / EN" },

  // ── Dropzone & Idle View ──
  drop_scan_title: { en: "DROP FUNDUS SCAN HERE", hi: "DROP FUNDUS SCAN HERE" },
  drop_scan_release: { en: "RELEASE SCAN TO INGEST", hi: "RELEASE SCAN TO INGEST" },
  drop_scan_browse: { en: "or click to browse filesystem", hi: "फ़ाइल सिस्टम से चुनें / click to browse" },
  drop_scan_formats: { en: "FORMATS: DICOM, PNG, JPEG", hi: "FORMATS: DICOM, PNG, JPEG" },
  diagnostic_grader_title: { en: "Diagnostic Grader", hi: "Diagnostic Grader" },
  diagnostic_grader_desc: {
    en: "Drop or select a retinal fundus scan for automated DR staging",
    hi: "स्वचालित डायबिटिक रेटिनोपैथी ग्रेडिंग हेतु रेटिनल स्कैन चुनें",
  },

  // ── Session Telemetry Panel (Keep system keys in English) ──
  session_title: { en: "SESSION", hi: "SESSION" },
  session_user: { en: "User:", hi: "User:" },
  session_login_date: { en: "Login Date:", hi: "Login Date:" },
  session_login_time: { en: "Login Time:", hi: "Login Time:" },
  session_history_title: { en: "HISTORY LOG", hi: "HISTORY LOG" },
  session_no_scans: { en: "NO SCANS RECORDED", hi: "NO SCANS RECORDED" },
  session_no_scans_desc: {
    en: "Drop a fundus scan to begin session telemetry.",
    hi: "Drop a fundus scan to begin session telemetry.",
  },
  session_save_report: { en: "Save Report", hi: "Save Report" },
  session_saved: { en: "SAVED", hi: "SAVED" },

  // ── Patient Log Table (Keep system keys & Stage in English) ──
  patient_log_title: { en: "PATIENT LOG", hi: "PATIENT LOG" },
  patient_log_full: { en: "3/3 FULL", hi: "3/3 FULL" },
  patient_log_records: { en: "Records", hi: "Records" },
  patient_log_search: { en: "Filter by Name or Mobile...", hi: "Filter by Name or Mobile..." },
  patient_log_search_full: { en: "Search by ID, Name, Mobile...", hi: "Search by ID, Name, Mobile..." },
  patient_log_empty: { en: "NO PATIENT SCANS LOGGED", hi: "NO PATIENT SCANS LOGGED" },
  patient_log_limit_title: { en: "[ LIMIT ] GUEST STORAGE FULL (3/3)", hi: "[ LIMIT ] GUEST STORAGE FULL (3/3)" },
  patient_log_limit_desc: {
    en: "Log in or register to save unlimited records.",
    hi: "Log in or register to save unlimited records.",
  },
  patient_audit: { en: "Patient Audit", hi: "Patient Audit" },
  patient_log_audit_db: { en: "Patient Audit", hi: "Patient Audit" },
  review_scan: { en: "Review Scan", hi: "Review Scan" },
  review: { en: "Review", hi: "Review" },
  preview_pdf: { en: "Preview PDF", hi: "Preview PDF" },
  pdf: { en: "PDF", hi: "PDF" },
  back: { en: "Back", hi: "Back" },
  col_patient_id: { en: "Patient ID", hi: "Patient ID" },
  col_name: { en: "Patient Name", hi: "Patient Name" },
  col_mobile: { en: "Mobile", hi: "Mobile" },
  col_stage: { en: "Stage & Classification", hi: "Stage & Classification" },
  col_confidence: { en: "Confidence", hi: "Confidence" },
  col_priority: { en: "Clinical Priority", hi: "Clinical Priority" },
  col_timestamp: { en: "Scan Time", hi: "Scan Time" },
  col_action: { en: "Action", hi: "Action" },

  // ── 5 Stages of DR & Clinical Descriptions ──
  stage_0_title: { en: "Stage 0: Normal", hi: "Stage 0: Normal (सामान्य)" },
  stage_0_short: { en: "Stage 0", hi: "Stage 0" },
  stage_0_desc: {
    en: "Healthy retina with normal blood vessels. No diabetes-related damage found.",
    hi: "स्वस्थ रेटिना एवं सामान्य रक्त वाहिकाएं। मधुमेह संबंधी कोई क्षति नहीं।",
  },
  stage_0_action: { en: "Routine annual checkup", hi: "Routine annual checkup (वार्षिक जांच)" },

  stage_1_title: { en: "Stage 1: Mild NPDR", hi: "Stage 1: Mild NPDR (हल्का)" },
  stage_1_short: { en: "Stage 1", hi: "Stage 1" },
  stage_1_desc: {
    en: "Early tiny swellings (microaneurysms) in small retinal blood vessels.",
    hi: "रेटिना की छोटी रक्त वाहिकाओं में प्रारंभिक सूक्ष्म उभार (माइक्रोएन्यूरिज्म)।",
  },
  stage_1_action: { en: "Checkup in 6–12 months", hi: "Checkup in 6–12 months (6-12 माह)" },

  stage_2_title: { en: "Stage 2: Moderate NPDR", hi: "Stage 2: Moderate NPDR (मध्यम)" },
  stage_2_short: { en: "Stage 2", hi: "Stage 2" },
  stage_2_desc: {
    en: "Blood vessels start swelling or leaking fluid, signaling disease progression.",
    hi: "रक्त वाहिकाओं में सूजन या रिसाव, रोग वृद्धि का संकेत।",
  },
  stage_2_action: { en: "Clinic review within 3 months", hi: "Clinic review within 3 months (3 माह)" },

  stage_3_title: { en: "Stage 3: Severe NPDR", hi: "Stage 3: Severe NPDR (गंभीर)" },
  stage_3_short: { en: "Stage 3", hi: "Stage 3" },
  stage_3_desc: {
    en: "Many blocked blood vessels deprive retinal areas of normal blood and oxygen.",
    hi: "अवरुद्ध रक्त वाहिकाओं के कारण रेटिना को पर्याप्त रक्त व ऑक्सीजन नहीं मिलती।",
  },
  stage_3_action: { en: "Specialist visit in 2–4 weeks", hi: "Specialist visit in 2–4 weeks (2-4 हफ्ते)" },

  stage_4_title: { en: "Stage 4: Proliferative DR", hi: "Stage 4: Proliferative DR (प्रोलिफेरेटिव)" },
  stage_4_short: { en: "Stage 4", hi: "Stage 4" },
  stage_4_desc: {
    en: "Advanced stage where fragile new blood vessels grow and can bleed into the eye.",
    hi: "गंभीर स्तर जहां नई नाजुक रक्त वाहिकाएं विकसित होकर रक्तस्राव कर सकती हैं।",
  },
  stage_4_action: { en: "Urgent ophthalmology care", hi: "Urgent ophthalmology care (तत्काल उपचार)" },

  // ── Priority Badges ──
  priority_normal: { en: "NORMAL", hi: "NORMAL" },
  priority_low: { en: "LOW (ROUTINE)", hi: "LOW (ROUTINE)" },
  priority_moderate: { en: "MODERATE", hi: "MODERATE" },
  priority_high: { en: "HIGH PRIORITY", hi: "HIGH PRIORITY" },
  priority_urgent: { en: "URGENT REFERRAL", hi: "URGENT REFERRAL" },

  // ── Workstation Diagnostic Output ──
  diagnostic_result: { en: "DIAGNOSTIC RESULT", hi: "DIAGNOSTIC RESULT" },
  severity_level: { en: "SEVERITY LEVEL", hi: "SEVERITY LEVEL" },
  model_confidence: { en: "Confidence", hi: "Confidence" },
  quality_gate: { en: "QUALITY GATE", hi: "QUALITY GATE" },
  sharpness: { en: "Sharpness", hi: "Sharpness" },
  illumination: { en: "Illumination", hi: "Illumination" },
  artifacts: { en: "Artifacts", hi: "Artifacts" },
  passed: { en: "PASSED", hi: "PASSED" },
  failed: { en: "FAILED", hi: "FAILED" },
  raw_scan_fig: { en: "FIGURE A: RAW FUNDUS SCAN", hi: "FIGURE A: RAW FUNDUS SCAN" },
  heatmap_lesion_fig: { en: "FIGURE B: HEATMAP LESION OVERLAY", hi: "FIGURE B: HEATMAP LESION OVERLAY" },
  view_raw: { en: "Raw Scan", hi: "Raw Scan" },
  view_gradcam: { en: "Heatmap Overlay", hi: "Heatmap Overlay" },
  view_json: { en: "Heatmap JSON", hi: "Heatmap JSON" },
  save_report_archive: { en: "Save Report", hi: "Save Report" },
  report_saved_badge: { en: "SAVED", hi: "SAVED" },
  pdf_report_btn: { en: "PDF Report", hi: "PDF Report" },
  rescan_btn: { en: "Rescan", hi: "Rescan" },
  understanding_5_stages: {
    en: "UNDERSTANDING THE 5 STAGES OF DIABETIC RETINOPATHY",
    hi: "UNDERSTANDING THE 5 STAGES OF DIABETIC RETINOPATHY",
  },
  your_scan_badge: { en: "[ YOUR SCAN ]", hi: "[ YOUR SCAN ]" },
  patient_info: { en: "PATIENT INFORMATION", hi: "PATIENT INFORMATION" },
  name: { en: "Name:", hi: "Name:" },
  age: { en: "Age:", hi: "Age:" },
  gender: { en: "Gender:", hi: "Gender:" },
  mobile: { en: "Mobile:", hi: "Mobile:" },
  id: { en: "ID:", hi: "ID:" },
  center: { en: "Center:", hi: "Center:" },
  retinal_scans: { en: "RETINAL SCANS", hi: "RETINAL SCANS" },
  clinical_record_footer: {
    en: "NETRA Diagnostic System • Clinical Retinal Screening Record",
    hi: "NETRA Diagnostic System • Clinical Retinal Screening Record",
  },
  print: { en: "Print", hi: "Print" },
  download: { en: "Download", hi: "Download" },
  close: { en: "Close", hi: "Close" },
  anonymous_patient: { en: "Anonymous Patient", hi: "Anonymous Patient" },
  next_step: { en: "Next Step:", hi: "Next Step:" },
  report_summary_title: { en: "Reports", hi: "रिपोर्ट्स" },
  total_audited: { en: "TOTAL AUDITED PATIENT RECORDS", hi: "TOTAL AUDITED PATIENT RECORDS" },
  distribution: { en: "STAGE DISTRIBUTION", hi: "STAGE DISTRIBUTION" },
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  t: (key: string, fallback?: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>("en");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedLang = localStorage.getItem("netra_language") as Language | null;
      if (savedLang === "en" || savedLang === "hi") {
        setLanguageState(savedLang);
      }
    }
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    if (typeof window !== "undefined") {
      localStorage.setItem("netra_language", lang);
    }
  };

  const toggleLanguage = () => {
    const nextLang = language === "en" ? "hi" : "en";
    setLanguage(nextLang);
  };

  const t = useMemo(() => {
    return (key: string, fallback?: string): string => {
      const entry = DICTIONARY[key];
      if (entry) {
        return entry[language] || entry.en || fallback || key;
      }
      return fallback || key;
    };
  }, [language]);

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      toggleLanguage,
      t,
    }),
    [language, t]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
