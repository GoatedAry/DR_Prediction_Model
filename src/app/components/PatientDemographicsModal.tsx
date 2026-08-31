"use client";

import { useState } from "react";
import { FileText, X } from "lucide-react";
import { generateClinicalPdfReport, PatientReportData } from "../lib/generatePdfReport";
import { useLanguage } from "../context/LanguageContext";

interface PatientDemographicsModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportData: Partial<PatientReportData>;
  theme?: "dark" | "light";
}

export default function PatientDemographicsModal({
  isOpen,
  onClose,
  reportData,
  theme = "dark",
}: PatientDemographicsModalProps) {
  const { language, t } = useLanguage();
  const isLight = theme === "light";

  const [patientName, setPatientName] = useState(
    reportData.patientName && reportData.patientName !== "Anonymous" && reportData.patientName !== "Guest Patient"
      ? reportData.patientName
      : ""
  );
  const [age, setAge] = useState(reportData.age || "");
  const [gender, setGender] = useState(reportData.gender || "Male");
  const [mobileNumber, setMobileNumber] = useState(reportData.mobileNumber || "");
  const [isGenerating, setIsGenerating] = useState(false);

  if (!isOpen) return null;

  const handleGeneratePdf = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);

    try {
      await generateClinicalPdfReport(
        {
          patientId: reportData.patientId || `NET-${Math.floor(100000 + Math.random() * 900000)}`,
          patientName: patientName.trim() || (language === "hi" ? "अज्ञात रोगी" : "Anonymous Patient"),
          age: age.trim(),
          gender: gender,
          mobileNumber: mobileNumber.trim(),
          timestamp: reportData.timestamp || new Date().toLocaleTimeString("en-US", { hour12: false }),
          integer_stage: reportData.integer_stage ?? 0,
          stage_label: reportData.stage_label || "No DR (Normal)",
          confidence: reportData.confidence ?? 0.94,
          probabilities: reportData.probabilities,
          quality_gate: reportData.quality_gate,
          val_mse_loss: reportData.val_mse_loss,
          peak_qwk: reportData.peak_qwk,
          rawImageBase64: reportData.rawImageBase64,
          gradcamBase64: reportData.gradcamBase64,
          bounding_boxes: reportData.bounding_boxes,
          hubLocation: reportData.hubLocation || "Netra Clinical Workstation",
        },
        language
      );
      onClose();
    } catch (err) {
      console.error("PDF generation failed", err);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md font-mono select-none">
      <div
        className={`w-full max-w-md border p-6 shadow-2xl flex flex-col gap-5 ${
          isLight
            ? "border-neutral-300 bg-white text-neutral-900 shadow-neutral-400/30"
            : "border-neutral-800 bg-neutral-950 text-white shadow-black/90"
        }`}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-inherit">
          <div className="flex items-center gap-2">
            <FileText size={15} className={isLight ? "text-neutral-700" : "text-neutral-300"} />
            <span className="text-xs font-bold uppercase tracking-widest">
              {language === "hi" ? "आधिकारिक क्लिनिकल पीडीएफ रिपोर्ट" : "OFFICIAL CLINICAL PDF REPORT"}
            </span>
          </div>
          <button
            onClick={onClose}
            className={`p-1 border text-xs cursor-pointer ${
              isLight
                ? "border-neutral-300 hover:bg-neutral-100 text-neutral-600"
                : "border-neutral-800 hover:bg-neutral-800 text-neutral-400"
            }`}
          >
            <X size={13} />
          </button>
        </div>

        <p
          className={`text-[11px] leading-relaxed ${
            isLight ? "text-neutral-600" : "text-neutral-400"
          }`}
        >
          {language === "hi"
            ? "आधिकारिक अस्पताल-ग्रेड पीडीएफ रिपोर्ट हेतु रोगी का विवरण सत्यापित करें (मूल फंडस, ग्रैड-कैम हीटमैप और लीज़न बॉक्स शामिल)।"
            : "Confirm patient demographics for the official hospital-grade PDF report (including raw fundus, Grad-CAM heatmap, and explainability bounding boxes)."}
        </p>

        {/* Input Form */}
        <form onSubmit={handleGeneratePdf} className="flex flex-col gap-3.5">
          {/* Patient Name */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase tracking-wider text-neutral-400 font-bold">
              {language === "hi" ? "रोगी का पूरा नाम *" : "Patient Full Name *"}
            </label>
            <input
              type="text"
              required
              value={patientName}
              onChange={(e) => setPatientName(e.target.value)}
              placeholder={language === "hi" ? "रोगी का पूरा नाम" : "Patient Full Name"}
              className={`p-2.5 border text-xs font-mono outline-none ${
                isLight
                  ? "border-neutral-300 bg-neutral-50 text-black focus:border-black"
                  : "border-neutral-800 bg-black text-white focus:border-white"
              }`}
            />
          </div>

          {/* Age & Gender Side-by-Side */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase tracking-wider text-neutral-400 font-bold">
                {language === "hi" ? "आयु" : "Age"}
              </label>
              <input
                type="number"
                min="1"
                max="120"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder={language === "hi" ? "आयु" : "Age"}
                className={`p-2.5 border text-xs font-mono outline-none ${
                  isLight
                    ? "border-neutral-300 bg-neutral-50 text-black focus:border-black"
                    : "border-neutral-800 bg-black text-white focus:border-white"
                }`}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase tracking-wider text-neutral-400 font-bold">
                {language === "hi" ? "लिंग" : "Gender"}
              </label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                className={`p-2.5 border text-xs font-mono outline-none cursor-pointer ${
                  isLight
                    ? "border-neutral-300 bg-neutral-50 text-black focus:border-black"
                    : "border-neutral-800 bg-black text-white focus:border-white"
                }`}
              >
                <option value="Male">{language === "hi" ? "पुरुष (Male)" : "Male"}</option>
                <option value="Female">{language === "hi" ? "महिला (Female)" : "Female"}</option>
                <option value="Other">{language === "hi" ? "अन्य (Other)" : "Other"}</option>
              </select>
            </div>
          </div>

          {/* Mobile Number */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase tracking-wider text-neutral-400 font-bold">
              {language === "hi" ? "मोबाइल नंबर" : "Mobile Number"}
            </label>
            <input
              type="tel"
              value={mobileNumber}
              onChange={(e) => setMobileNumber(e.target.value)}
              placeholder={language === "hi" ? "मोबाइल नंबर" : "Mobile Number"}
              className={`p-2.5 border text-xs font-mono outline-none ${
                isLight
                  ? "border-neutral-300 bg-neutral-50 text-black focus:border-black"
                  : "border-neutral-800 bg-black text-white focus:border-white"
              }`}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-inherit mt-1">
            <button
              type="button"
              onClick={onClose}
              className={`px-4 py-2 border text-xs uppercase font-bold tracking-wider cursor-pointer ${
                isLight
                  ? "border-neutral-300 text-neutral-700 hover:bg-neutral-100"
                  : "border-neutral-800 text-neutral-400 hover:bg-neutral-800 hover:text-white"
              }`}
            >
              [ {language === "hi" ? "रद्द करें" : "Cancel"} ]
            </button>

            <button
              type="submit"
              disabled={isGenerating}
              className={`px-5 py-2 border text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                isLight
                  ? "bg-black text-white hover:bg-neutral-800 border-black"
                  : "bg-white text-black hover:bg-neutral-200 border-white"
              }`}
            >
              {isGenerating
                ? (language === "hi" ? "तैयार हो रहा है..." : "Generating...")
                : (language === "hi" ? "[ पीडीएफ डाउनलोड करें ]" : "[ Download PDF Report ]")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
