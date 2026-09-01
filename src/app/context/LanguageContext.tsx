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
  brand_name: { en: "NETRAAI", hi: "नेत्रा AI" },
  nav_grader: { en: "Diagnostic Grader", hi: "डायग्नोस्टिक ग्रेडर" },
  nav_reports: { en: "Reports", hi: "रिपोर्ट्स" },
  nav_architecture: { en: "AI Summary", hi: "AI सारांश" },
  nav_ai_summary: { en: "AI Summary", hi: "AI सारांश" },
  nav_sih: { en: "SIH Hub", hi: "SIH हब" },
  nav_home: { en: "Home", hi: "मुख्य पृष्ठ" },
  sign_out: { en: "Logout", hi: "लॉगआउट" },
  guest: { en: "Guest", hi: "अतिथि" },
  toggle_language: { en: "EN / हि", hi: "हि / EN" },

  // ── Dropzone & Idle View ──
  drop_scan_title: { en: "DROP FUNDUS SCAN HERE", hi: "रेटिनल फंडस स्कैन यहाँ डालें" },
  drop_scan_release: { en: "RELEASE SCAN TO INGEST", hi: "स्कैन विश्लेषण हेतु छोड़ें" },
  drop_scan_browse: { en: "or click to browse filesystem", hi: "या फ़ाइल चुनने के लिए क्लिक करें" },
  drop_scan_formats: { en: "FORMATS: DICOM, PNG, JPEG", hi: "प्रारूप: DICOM, PNG, JPEG" },
  diagnostic_grader_title: { en: "DIAGNOSTIC GRADER", hi: "डायग्नोस्टिक ग्रेडर" },
  diagnostic_grader_desc: {
    en: "Drop or select a retinal fundus scan for automated DR staging",
    hi: "स्वचालित डायबिटिक रेटिनोपैथी विश्लेषण हेतु फंडस स्कैन चुनें",
  },

  // ── Session Telemetry Panel ──
  session_title: { en: "SESSION", hi: "सत्र विवरण (SESSION)" },
  session_user: { en: "User:", hi: "उपयोगकर्ता:" },
  session_login_date: { en: "Login Date:", hi: "लॉगिन तिथि:" },
  session_login_time: { en: "Login Time:", hi: "लॉगिन समय:" },
  session_history_title: { en: "DIAGNOSTIC HISTORY", hi: "डायग्नोस्टिक इतिहास" },
  session_no_scans: { en: "NO SCANS RECORDED", hi: "कोई स्कैन दर्ज नहीं है" },
  session_no_scans_desc: {
    en: "Drop a fundus scan to begin session telemetry.",
    hi: "सत्र शुरू करने हेतु रेटिनल स्कैन डालें।",
  },
  session_save_report: { en: "Save Report", hi: "रिपोर्ट सहेजें" },
  session_saved: { en: "SAVED", hi: "सहेजा गया" },

  // ── Patient Log Table ──
  patient_log_title: { en: "PATIENT LOG", hi: "मरीज़ ऑडिट लॉग (PATIENT LOG)" },
  patient_log_full: { en: "3/3 FULL", hi: "3/3 पूर्ण" },
  patient_log_records: { en: "Records", hi: "रिकॉर्ड्स" },
  patient_log_search: { en: "Filter by Name or Mobile...", hi: "नाम या मोबाइल नंबर से खोजें..." },
  patient_log_search_full: { en: "Search by ID, Name, Mobile...", hi: "ID, नाम, या मोबाइल से खोजें..." },
  patient_log_empty: { en: "NO PATIENT SCANS LOGGED", hi: "कोई मरीज़ स्कैन उपलब्ध नहीं है" },
  patient_log_limit_title: { en: "[ LIMIT ] GUEST STORAGE FULL (3/3)", hi: "[ सीमा ] अतिथि स्टोरेज पूर्ण (3/3)" },
  patient_log_limit_desc: {
    en: "Log in or register to save unlimited records.",
    hi: "असीमित रिकॉर्ड्स हेतु लॉगिन अथवा पंजीकरण करें।",
  },
  patient_audit: { en: "Patient Audit", hi: "मरीज़ ऑडिट (Patient Audit)" },
  patient_log_audit_db: { en: "Patient Audit", hi: "मरीज़ ऑडिट डेटाबेस" },
  review_scan: { en: "Review Scan", hi: "स्कैन समीक्षा" },
  review: { en: "Review", hi: "समीक्षा" },
  preview_pdf: { en: "Preview PDF", hi: "PDF पूर्वावलोकन" },
  pdf: { en: "PDF", hi: "PDF" },
  back: { en: "Back", hi: "वापस" },
  col_patient_id: { en: "Patient ID", hi: "मरीज़ ID" },
  col_name: { en: "Patient Name", hi: "मरीज़ का नाम" },
  col_mobile: { en: "Mobile", hi: "मोबाइल" },
  col_stage: { en: "Stage & Classification", hi: "चरण एवं वर्गीकरण" },
  col_confidence: { en: "Confidence", hi: "सटीकता (Confidence)" },
  col_priority: { en: "Clinical Priority", hi: "प्राथमिकता" },
  col_timestamp: { en: "Scan Time", hi: "समय" },
  col_action: { en: "Action", hi: "क्रिया" },

  // ── 5 Stages of DR & Clinical Descriptions ──
  stage_0_title: { en: "Stage 0: Normal", hi: "चरण 0: सामान्य (Normal)" },
  stage_0_short: { en: "Stage 0", hi: "चरण 0" },
  stage_0_label: { en: "No DR (Normal)", hi: "डायबिटिक रेटिनोपैथी नहीं (सामान्य)" },
  stage_0_desc: {
    en: "Healthy retina with normal blood vessels. No diabetes-related damage found.",
    hi: "स्वस्थ रेटिना एवं सामान्य रक्त वाहिकाएं। कोई क्षति नहीं।",
  },
  stage_0_action: { en: "Routine annual checkup", hi: "नियमित वार्षिक नेत्र परीक्षण" },

  stage_1_title: { en: "Stage 1: Mild NPDR", hi: "चरण 1: हल्का NPDR (Mild)" },
  stage_1_short: { en: "Stage 1", hi: "चरण 1" },
  stage_1_label: { en: "Mild DR", hi: "हल्की डायबिटिक रेटिनोपैथी (Mild DR)" },
  stage_1_desc: {
    en: "Early tiny swellings (microaneurysms) in small retinal blood vessels.",
    hi: "रेटिना की सूक्ष्म रक्त वाहिकाओं में प्रारंभिक उभार (माइक्रोएन्यूरिज्म)।",
  },
  stage_1_action: { en: "Checkup in 6–12 months", hi: "6 से 12 महीने में पुनः परीक्षण" },

  stage_2_title: { en: "Stage 2: Moderate NPDR", hi: "चरण 2: मध्यम NPDR (Moderate)" },
  stage_2_short: { en: "Stage 2", hi: "चरण 2" },
  stage_2_label: { en: "Moderate DR", hi: "मध्यम डायबिटिक रेटिनोपैथी (Moderate DR)" },
  stage_2_desc: {
    en: "Blood vessels start swelling or leaking fluid, signaling disease progression.",
    hi: "रक्त वाहिकाओं में सूजन या द्रव रिसाव, रोग वृद्धि का संकेत।",
  },
  stage_2_action: { en: "Clinic review within 3 months", hi: "3 महीने के भीतर क्लिनिक में समीक्षा" },

  stage_3_title: { en: "Stage 3: Severe NPDR", hi: "चरण 3: गंभीर NPDR (Severe)" },
  stage_3_short: { en: "Stage 3", hi: "चरण 3" },
  stage_3_label: { en: "Severe DR", hi: "गंभीर डायबिटिक रेटिनोपैथी (Severe DR)" },
  stage_3_desc: {
    en: "Many blocked blood vessels deprive retinal areas of normal blood and oxygen.",
    hi: "अवरुद्ध रक्त वाहिकाओं के कारण रेटिना को पर्याप्त रक्त व ऑक्सीजन की कमी।",
  },
  stage_3_action: { en: "Specialist visit in 2–4 weeks", hi: "2 से 4 सप्ताह में नेत्र रोग विशेषज्ञ से परामर्श" },

  stage_4_title: { en: "Stage 4: Proliferative DR", hi: "चरण 4: प्रोलिफेरेटिव DR (Proliferative)" },
  stage_4_short: { en: "Stage 4", hi: "चरण 4" },
  stage_4_label: { en: "Proliferative DR", hi: "प्रोलिफेरेटिव डायबिटिक रेटिनोपैथी (Stage 4)" },
  stage_4_desc: {
    en: "Advanced stage where fragile new blood vessels grow and can bleed into the eye.",
    hi: "अत्यंत गंभीर चरण जहां नई नाजुक रक्त वाहिकाएं विकसित होकर रक्तस्राव कर सकती हैं।",
  },
  stage_4_action: { en: "Urgent ophthalmology care", hi: "तत्काल आपातकालीन नेत्र चिकित्सा एवं लेजर उपचार" },

  // ── Priority Badges ──
  priority_normal: { en: "NORMAL", hi: "सामान्य" },
  priority_low: { en: "LOW (ROUTINE)", hi: "कम (नियमित)" },
  priority_moderate: { en: "MODERATE", hi: "मध्यम" },
  priority_high: { en: "HIGH PRIORITY", hi: "उच्च प्राथमिकता" },
  priority_urgent: { en: "URGENT REFERRAL", hi: "तत्काल रेफरल" },

  // ── Workstation Diagnostic Output ──
  diagnostic_result: { en: "DIAGNOSTIC RESULT", hi: "डायग्नोस्टिक परिणाम" },
  severity_level: { en: "SEVERITY LEVEL", hi: "गंभीरता स्तर" },
  model_confidence: { en: "Confidence", hi: "सटीकता (Confidence)" },
  quality_gate: { en: "QUALITY GATE", hi: "क्वालिटी गेट (Quality Gate)" },
  sharpness: { en: "Sharpness", hi: "स्पष्टता" },
  illumination: { en: "Illumination", hi: "प्रकाश स्तर" },
  artifacts: { en: "Artifacts", hi: "विकृति मुक्त" },
  passed: { en: "PASSED", hi: "उत्तीर्ण" },
  failed: { en: "FAILED", hi: "अनुत्तीर्ण" },
  raw_scan_fig: { en: "FIGURE A: RAW FUNDUS SCAN", hi: "चित्र A: मूल फंडस स्कैन" },
  heatmap_lesion_fig: { en: "FIGURE B: HEATMAP LESION OVERLAY", hi: "चित्र B: हीटमैप घाव ओवरले" },
  scan_imaging_title: { en: "SCAN IMAGING & EXPLAINABILITY", hi: "स्कैन इमेजिंग एवं व्याख्यात्मक विश्लेषण" },
  view_raw: { en: "Raw Scan", hi: "मूल स्कैन" },
  view_gradcam: { en: "Heatmap Overlay", hi: "हीटमैप ओवरले" },
  view_json: { en: "Heatmap JSON", hi: "हीटमैप JSON" },
  save_report_archive: { en: "Save Report", hi: "रिपोर्ट सहेजें" },
  report_saved_badge: { en: "SAVED", hi: "सहेजा गया" },
  pdf_report_btn: { en: "PDF Report", hi: "PDF रिपोर्ट" },
  rescan_btn: { en: "Rescan", hi: "पुनः स्कैन" },
  validation_loss: { en: "VAL LOSS", hi: "लॉस (MSE)" },
  peak_kappa: { en: "PEAK KAPPA", hi: "कापा (QWK)" },
  clinical_summary_title: { en: "CLINICAL SUMMARY", hi: "नैदानिक सारांश (CLINICAL SUMMARY)" },
  ai_triage_badge: { en: "AI TRIAGE", hi: "AI ट्राइएज" },
  recommended_next_step: { en: "Recommended Action:", hi: "अनुशंसित कार्रवाई:" },
  patient_info: { en: "PATIENT INFORMATION", hi: "मरीज़ की जानकारी" },
  name: { en: "Name:", hi: "नाम:" },
  age: { en: "Age:", hi: "आयु:" },
  gender: { en: "Gender:", hi: "लिंग:" },
  mobile: { en: "Mobile:", hi: "मोबाइल:" },
  id: { en: "ID:", hi: "मरीज़ ID:" },
  center: { en: "Center:", hi: "केंद्र:" },
  retinal_scans: { en: "RETINAL SCANS", hi: "रेटिनल स्कैन" },
  print: { en: "Print", hi: "प्रिंट करें" },
  download: { en: "Download", hi: "डाउनलोड PDF" },
  close: { en: "Close", hi: "बंद करें" },
  anonymous_patient: { en: "Anonymous Patient", hi: "अज्ञात मरीज़" },
  next_step: { en: "Next Step:", hi: "अगला चरण:" },
  report_summary_title: { en: "Reports", hi: "रिपोर्ट्स" },
  total_audited: { en: "TOTAL AUDITED PATIENT RECORDS", hi: "कुल ऑडिट किए गए मरीज़ रिकॉर्ड्स" },
  distribution: { en: "STAGE DISTRIBUTION", hi: "स्टेज वितरण" },
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
