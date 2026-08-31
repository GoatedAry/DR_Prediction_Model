"use client";

import { useEffect, useState } from "react";
import { X, Download, Printer, FileText } from "lucide-react";
import { PatientReportData, getClinicalPdfBlobUrl, generateClinicalPdfReport } from "../lib/generatePdfReport";
import { useLanguage } from "../context/LanguageContext";

interface PdfPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme?: "dark" | "light";
  reportData: PatientReportData | null;
}

export default function PdfPreviewModal({
  isOpen,
  onClose,
  theme = "dark",
  reportData,
}: PdfPreviewModalProps) {
  const { language, t } = useLanguage();
  const isLight = theme === "light";
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    let isCancelled = false;

    if (!isOpen || !reportData) {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
        setBlobUrl(null);
      }
      return;
    }

    setIsGenerating(true);
    getClinicalPdfBlobUrl(reportData, language)
      .then((url) => {
        if (!isCancelled) {
          setBlobUrl(url);
          setIsGenerating(false);
        }
      })
      .catch((e) => {
        console.error("Failed to generate PDF blob URL for preview:", e);
        if (!isCancelled) setIsGenerating(false);
      });

    return () => {
      isCancelled = true;
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [isOpen, reportData, language]);

  if (!isOpen || !reportData) return null;

  const handleDownload = async () => {
    if (reportData) {
      await generateClinicalPdfReport(reportData, language);
    }
  };

  const handlePrint = () => {
    if (blobUrl) {
      const iframe = document.getElementById("netra-pdf-preview-frame") as HTMLIFrameElement;
      if (iframe && iframe.contentWindow) {
        iframe.contentWindow.print();
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 md:p-6 select-none animate-in fade-in duration-200">
      <div
        className={`w-full max-w-5xl h-[92vh] flex flex-col border shadow-2xl font-mono ${
          isLight ? "bg-white border-neutral-300 text-neutral-900" : "bg-neutral-950 border-neutral-800 text-white"
        }`}
      >
        {/* ── Modal Header ── */}
        <div
          className={`flex items-center justify-between px-5 py-3.5 border-b shrink-0 ${
            isLight ? "border-neutral-200 bg-neutral-50" : "border-neutral-800 bg-black"
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <FileText size={16} className={isLight ? "text-neutral-700" : "text-neutral-300"} />
            <div className="flex flex-col min-w-0">
              <span className="font-bold text-xs uppercase tracking-wider truncate">
                {language === "hi" ? "क्लिनिकल पीडीएफ पूर्वावलोकन: " : "CLINICAL PDF PREVIEW: "}
                {reportData.patientName || (language === "hi" ? "अज्ञात रोगी" : "PATIENT REPORT")}
              </span>
              <span className={`text-[10px] ${isLight ? "text-neutral-500" : "text-neutral-400"}`}>
                ID: {reportData.patientId || "N/A"} • {language === "hi" ? "स्टेज" : "Stage"} {reportData.integer_stage}: {reportData.stage_label}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handlePrint}
              className={`px-3 py-1.5 border text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer ${
                isLight
                  ? "border-neutral-300 bg-white hover:bg-neutral-100 text-neutral-800"
                  : "border-neutral-700 bg-neutral-900 hover:bg-neutral-800 text-neutral-200"
              }`}
              title="Print Clinical Report"
            >
              <Printer size={12} /> [ {t("print", "Print")} ]
            </button>

            <button
              onClick={handleDownload}
              className={`px-3 py-1.5 border text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer ${
                isLight
                  ? "border-black bg-black text-white hover:bg-neutral-800"
                  : "border-white bg-white text-black hover:bg-neutral-200"
              }`}
              title="Download PDF File"
            >
              <Download size={12} /> [ {t("download", "Download")} ]
            </button>

            <button
              onClick={onClose}
              className={`p-1.5 border transition-all cursor-pointer ml-1 ${
                isLight
                  ? "border-neutral-300 hover:border-black text-neutral-700 hover:text-black"
                  : "border-neutral-800 hover:border-white text-neutral-400 hover:text-white"
              }`}
              title="Close Preview"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* ── PDF Preview Frame ── */}
        <div className="flex-1 w-full h-full relative bg-neutral-900/90 overflow-hidden">
          {blobUrl && !isGenerating ? (
            <iframe
              id="netra-pdf-preview-frame"
              src={blobUrl}
              className="w-full h-full border-0"
              title="PDF Preview"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-xs font-mono text-neutral-400">
              {language === "hi" ? "उच्च गुणवत्ता पीडीएफ रिपोर्ट तैयार की जा रही है..." : "GENERATING HIGH-RESOLUTION PDF PREVIEW..."}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
