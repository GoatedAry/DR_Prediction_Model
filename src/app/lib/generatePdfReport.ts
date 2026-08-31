import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";

export interface PatientReportData {
  patientId: string;
  patientName: string;
  age?: string;
  gender?: string;
  mobileNumber?: string;
  timestamp: string;
  integer_stage: number;
  stage_label: string;
  confidence: number;
  probabilities?: number[];
  quality_gate?: {
    sharpness: number;
    illumination: number;
    artifacts: number;
    passed: boolean;
  };
  val_mse_loss?: number | null;
  peak_qwk?: number;
  rawImageBase64?: string | null;
  gradcamBase64?: string | null;
  bounding_boxes?: Array<{ x: number; y: number; width: number; height: number }>;
  hubLocation?: string;
}

export type PdfLanguage = "en" | "hi";

export interface StageInfo {
  stage: string;
  title: string;
  desc: string;
  action: string;
}

export function getLocalizedReportStrings(lang: PdfLanguage = "en") {
  const isHi = lang === "hi";
  return {
    brandName: "NETRA",
    reportSubtitle: isHi ? "डायग्नोस्टिक स्कैन रिपोर्ट" : "DIAGNOSTIC SCAN REPORT",
    patientInfoTitle: isHi ? "रोगी की जानकारी (PATIENT INFORMATION)" : "PATIENT INFORMATION",
    nameLabel: isHi ? "नाम:" : "Name:",
    ageLabel: isHi ? "आयु:" : "Age:",
    genderLabel: isHi ? "लिंग:" : "Gender:",
    idLabel: isHi ? "आईडी:" : "ID:",
    mobileLabel: isHi ? "मोबाइल:" : "Mobile:",
    centerLabel: isHi ? "केंद्र:" : "Center:",
    diagnosticResultTitle: isHi ? "डायग्नोस्टिक परिणाम:" : "DIAGNOSTIC RESULT:",
    confidenceLabel: isHi ? "मॉडल सटीकता:" : "Model Confidence:",
    nextStepLabel: isHi ? "अगला कदम:" : "Next Step:",
    retinalScansTitle: isHi ? "रेटिनल स्कैन (RETINAL SCANS)" : "RETINAL SCANS",
    figARaw: isHi ? "चित्र A: मूल फंडस स्कैन" : "FIGURE A: RAW FUNDUS SCAN",
    figBHeatmap: isHi ? "चित्र B: लीज़न हीटमैप ओवरले" : "FIGURE B: HEATMAP LESION OVERLAY",
    understandingStagesTitle: isHi
      ? "डायबिटिक रेटिनोपैथी के 5 चरणों को समझें"
      : "UNDERSTANDING THE 5 STAGES OF DIABETIC RETINOPATHY",
    yourScanBadge: isHi ? "[ आपका स्कैन ]" : "[ YOUR SCAN ]",
    footerText: isHi
      ? "NETRA Diagnostic System • Clinical Retinal Screening Record"
      : "NETRA Diagnostic System • Clinical Retinal Screening Record",
    anonymousPatient: isHi ? "अज्ञात रोगी" : "Anonymous Patient",
    stages: [
      {
        stage: isHi ? "स्टेज 0" : "Stage 0",
        title: isHi ? "सामान्य (No DR)" : "No DR (Normal)",
        desc: isHi
          ? "स्वस्थ रेटिना, सामान्य रक्त वाहिकाएं। मधुमेह संबंधी कोई क्षति नहीं।"
          : "Healthy retina with normal blood vessels. No diabetes-related damage found.",
        action: isHi ? "वार्षिक नियमित जांच" : "Routine annual checkup",
      },
      {
        stage: isHi ? "स्टेज 1" : "Stage 1",
        title: isHi ? "हल्का गैर-प्रोलिफेरेटिव" : "Mild Non-Proliferative",
        desc: isHi
          ? "रेटिना की सूक्ष्म वाहिकाओं में प्रारंभिक उभार (माइक्रोएन्यूरिज्म)।"
          : "Early tiny swellings (microaneurysms) in small retinal blood vessels.",
        action: isHi ? "6-12 महीनों में जांच" : "Checkup in 6–12 months",
      },
      {
        stage: isHi ? "स्टेज 2" : "Stage 2",
        title: isHi ? "मध्यम गैर-प्रोलिफेरेटिव" : "Moderate Non-Proliferative",
        desc: isHi
          ? "रक्त वाहिकाओं में सूजन या रिसाव, रोग वृद्धि का संकेत।"
          : "Blood vessels start swelling or leaking fluid, signaling disease progression.",
        action: isHi ? "3 माह में क्लिनिक समीक्षा" : "Clinic review within 3 months",
      },
      {
        stage: isHi ? "स्टेज 3" : "Stage 3",
        title: isHi ? "गंभीर गैर-प्रोलिफेरेटिव" : "Severe Non-Proliferative",
        desc: isHi
          ? "अवरुद्ध रक्त वाहिकाओं के कारण रेटिना को पर्याप्त ऑक्सीजन नहीं मिलती।"
          : "Many blocked blood vessels deprive retinal areas of normal blood and oxygen.",
        action: isHi ? "2-4 हफ्तों में विशेषज्ञ परामर्श" : "Specialist visit in 2–4 weeks",
      },
      {
        stage: isHi ? "स्टेज 4" : "Stage 4",
        title: isHi ? "प्रोलिफेरेटिव DR" : "Proliferative DR",
        desc: isHi
          ? "गंभीर स्तर जहां नई नाजुक रक्त वाहिकाएं विकसित होकर रक्तस्राव कर सकती हैं।"
          : "Advanced stage where fragile new blood vessels grow and can bleed into the eye.",
        action: isHi ? "तत्काल नेत्र विशेषज्ञ उपचार" : "Urgent ophthalmology care",
      },
    ],
    stageLabels: [
      isHi ? "सामान्य (कोई DR नहीं)" : "No DR (Normal)",
      isHi ? "हल्का गैर-प्रोलिफेरेटिव DR" : "Mild Non-Proliferative",
      isHi ? "मध्यम गैर-प्रोलिफेरेटिव DR" : "Moderate Non-Proliferative",
      isHi ? "गंभीर गैर-प्रोलिफेरेटिव DR" : "Severe Non-Proliferative",
      isHi ? "प्रोलिफेरेटिव डायबिटिक रेटिनोपैथी" : "Proliferative Diabetic Retinopathy",
    ],
    recommendations: [
      isHi
        ? "स्वस्थ रेटिना। रेटिनोपैथी का कोई लक्षण नहीं मिला। वार्षिक नियमित जांच की सलाह।"
        : "Healthy retina. No signs of retinopathy. Routine annual checkup recommended.",
      isHi
        ? "रेटिना की सूक्ष्म रक्त वाहिकाओं में प्रारंभिक परिवर्तन। 6-12 महीनों में अनुवर्ती जांच।"
        : "Early tiny vessel changes detected. Follow-up eye checkup recommended in 6-12 months.",
      isHi
        ? "मध्यम रक्त वाहिका रिसाव। 3 महीने के भीतर विस्तृत नेत्र परीक्षण की सलाह।"
        : "Moderate vessel leakage detected. Dilated eye exam recommended within 3 months.",
      isHi
        ? "गंभीर रक्त वाहिका रुकावट। 2-4 सप्ताह के भीतर रेटिना विशेषज्ञ से परामर्श लें।"
        : "Significant retinal vessel blockage. Retina specialist review recommended within 2-4 weeks.",
      isHi
        ? "उन्नत स्तर की नाजुक वाहिकाओं का विकास। तत्काल नेत्र रोग विशेषज्ञ से उपचार कराएं।"
        : "Advanced fragile vessel growth detected. Immediate ophthalmologist consultation advised.",
    ],
  };
}

/**
 * Creates an off-screen HTML element representation of the clinical report
 * with exact A4 proportions and native browser typography support for both Devanagari and Latin text.
 */
export function createReportHtmlElement(data: PatientReportData, lang: PdfLanguage = "en"): HTMLElement {
  const strings = getLocalizedReportStrings(lang);
  const container = document.createElement("div");

  container.style.width = "794px"; // Standard 96 DPI A4 width
  container.style.minHeight = "1123px"; // Standard 96 DPI A4 height
  container.style.padding = "28px 32px";
  container.style.boxSizing = "border-box";
  container.style.backgroundColor = "#ffffff";
  container.style.color = "#111827";
  container.style.fontFamily = "'Montserrat', 'Noto Sans Devanagari', 'Helvetica Neue', Arial, sans-serif";
  container.style.display = "flex";
  container.style.flexDirection = "column";
  container.style.justifyContent = "space-between";
  container.style.position = "absolute";
  container.style.left = "-99999px";
  container.style.top = "0";

  const stageIdx = Math.min(Math.max(data.integer_stage, 0), 4);
  const activeLabel = strings.stageLabels[stageIdx];
  const activeRec = strings.recommendations[stageIdx];

  // Severity banner colors
  let bannerBg = "#f8fafc";
  let bannerBorder = "#cbd5e1";
  let bannerText = "#1e293b";

  if (stageIdx === 1) {
    bannerBg = "#fefce8";
    bannerBorder = "#facc15";
    bannerText = "#854d0e";
  } else if (stageIdx === 2) {
    bannerBg = "#fffbeb";
    bannerBorder = "#f59e0b";
    bannerText = "#92400e";
  } else if (stageIdx === 3) {
    bannerBg = "#fff7ed";
    bannerBorder = "#f97316";
    bannerText = "#9a3412";
  } else if (stageIdx === 4) {
    bannerBg = "#fef2f2";
    bannerBorder = "#dc2626";
    bannerText = "#b91c1c";
  }

  container.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 14px;">
      <!-- 1. Header Banner -->
      <div style="background-color: #0f1419; color: #ffffff; padding: 10px 14px; display: flex; justify-content: space-between; align-items: center; border: 1px solid #0f1419;">
        <div>
          <div style="font-size: 16px; font-weight: 800; letter-spacing: 0.18em; line-height: 1;">${strings.brandName}</div>
          <div style="font-size: 9px; color: #94a3b8; letter-spacing: 0.1em; margin-top: 3px; font-weight: 500;">${strings.reportSubtitle}</div>
        </div>
        <div style="text-align: right; font-family: monospace;">
          <div style="font-size: 9.5px; font-weight: 700; color: #ffffff;">ID: ${data.patientId || "NET-TEMP"}</div>
          <div style="font-size: 8.5px; color: #94a3b8; margin-top: 2px;">${data.timestamp || new Date().toLocaleString()}</div>
        </div>
      </div>

      <!-- 2. Patient Demographics Box -->
      <div style="border: 1px solid #d1d5db; background-color: #f8fafc; padding: 8px 12px; font-size: 9px; font-family: monospace;">
        <div style="font-weight: 700; color: #64748b; font-size: 8px; letter-spacing: 0.1em; margin-bottom: 6px;">${strings.patientInfoTitle}</div>
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px;">
          <div><strong style="color: #111827;">${strings.nameLabel}</strong> <span style="color: #374151;">${data.patientName || strings.anonymousPatient}</span></div>
          <div><strong style="color: #111827;">${strings.ageLabel}</strong> <span style="color: #374151;">${data.age ? `${data.age} Yrs` : "N/A"}</span></div>
          <div><strong style="color: #111827;">${strings.genderLabel}</strong> <span style="color: #374151;">${data.gender || "N/A"}</span></div>
          <div><strong style="color: #111827;">${strings.idLabel}</strong> <span style="color: #374151; font-weight: 700;">${data.patientId || "NET-TEMP"}</span></div>
          <div><strong style="color: #111827;">${strings.mobileLabel}</strong> <span style="color: #374151;">${data.mobileNumber || "N/A"}</span></div>
          <div><strong style="color: #111827;">${strings.centerLabel}</strong> <span style="color: #374151;">${data.hubLocation || "Primary Hub"}</span></div>
        </div>
      </div>

      <!-- 3. Diagnostic Result Severity Banner -->
      <div style="border: 1px solid ${bannerBorder}; background-color: ${bannerBg}; padding: 10px 12px; border-left: 4px solid ${bannerBorder};">
        <div style="font-size: 11.5px; font-weight: 800; color: ${bannerText}; letter-spacing: 0.05em;">
          ${strings.diagnosticResultTitle} STAGE ${stageIdx} — ${activeLabel.toUpperCase()}
        </div>
        <div style="font-size: 9px; color: #374151; margin-top: 4px;">
          <strong>${strings.confidenceLabel}</strong> ${(data.confidence * 100).toFixed(1)}% &nbsp;•&nbsp; <strong>${strings.nextStepLabel}</strong> ${activeRec}
        </div>
      </div>

      <!-- 4. Scans & Heatmaps (Side by Side) -->
      <div>
        <div style="font-size: 9.5px; font-weight: 800; color: #111827; letter-spacing: 0.08em; margin-bottom: 6px;">${strings.retinalScansTitle}</div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <div style="border: 1px solid #d1d5db; background-color: #f8fafc; padding: 6px; text-align: center;">
            <div style="width: 100%; height: 180px; background-color: #000000; display: flex; align-items: center; justify-content: center; overflow: hidden;">
              ${
                data.rawImageBase64
                  ? `<img src="${data.rawImageBase64}" style="width: 100%; height: 100%; object-fit: contain;" />`
                  : `<span style="color: #94a3b8; font-size: 9px;">Raw Scan</span>`
              }
            </div>
            <div style="font-size: 8px; font-weight: 700; color: #475569; margin-top: 5px; letter-spacing: 0.08em; text-align: left;">${strings.figARaw}</div>
          </div>

          <div style="border: 1px solid #d1d5db; background-color: #f8fafc; padding: 6px; text-align: center;">
            <div style="width: 100%; height: 180px; background-color: #000000; display: flex; align-items: center; justify-content: center; overflow: hidden;">
              ${
                data.gradcamBase64
                  ? `<img src="${data.gradcamBase64}" style="width: 100%; height: 100%; object-fit: contain;" />`
                  : `<span style="color: #94a3b8; font-size: 9px;">Heatmap Overlay</span>`
              }
            </div>
            <div style="font-size: 8px; font-weight: 700; color: #475569; margin-top: 5px; letter-spacing: 0.08em; text-align: left;">${strings.figBHeatmap}</div>
          </div>
        </div>
      </div>

      <!-- 5. 5-Stage Reference Table -->
      <div>
        <div style="font-size: 9.5px; font-weight: 800; color: #111827; letter-spacing: 0.08em; margin-bottom: 6px;">${strings.understandingStagesTitle}</div>
        <div style="display: flex; flex-direction: column; gap: 4px;">
          ${strings.stages
            .map((st, idx) => {
              const isCurrent = idx === stageIdx;
              return `
                <div style="display: flex; align-items: center; justify-content: space-between; padding: 6px 10px; border: 1px solid ${
                  isCurrent ? "#1e293b" : "#e2e8f0"
                }; background-color: ${isCurrent ? "#f1f5f9" : "#ffffff"}; font-size: 8.5px;">
                  <div style="font-weight: 700; width: 145px; color: ${isCurrent ? "#0f172a" : "#475569"}; shrink: 0;">
                    ${st.stage}: ${st.title}
                  </div>
                  <div style="flex: 1; padding: 0 10px; color: ${isCurrent ? "#0f172a" : "#64748b"}; font-weight: ${
                isCurrent ? "600" : "400"
              };">
                    ${st.desc}
                  </div>
                  <div style="text-align: right; font-weight: 700; font-size: 8px; color: ${
                    isCurrent ? "#0f172a" : "#64748b"
                  }; white-space: nowrap;">
                    ${isCurrent ? `<span style="background-color: #0f172a; color: #ffffff; padding: 1px 5px; margin-right: 4px;">${strings.yourScanBadge}</span>` : ""}
                    ${st.action}
                  </div>
                </div>
              `;
            })
            .join("")}
        </div>
      </div>
    </div>

    <!-- 6. Footer -->
    <div style="border-top: 1px solid #e2e8f0; padding-top: 8px; font-size: 8px; color: #94a3b8; display: flex; justify-content: space-between; font-family: monospace;">
      <div>${strings.footerText}</div>
      <div>Page 1 / 1</div>
    </div>
  `;

  return container;
}

/**
 * Builds the clinical PDF document asynchronously using html2canvas.
 * Guarantees 100% correct glyph shaping and layout for both English and Hindi.
 */
export async function buildClinicalPdfDocAsync(
  data: PatientReportData,
  lang: PdfLanguage = "en"
): Promise<jsPDF> {
  const element = createReportHtmlElement(data, lang);
  document.body.appendChild(element);

  try {
    const canvas = await html2canvas(element, {
      scale: 2, // 2x DPI for crisp print quality
      useCORS: true,
      logging: false,
      backgroundColor: "#ffffff",
    });

    const imgData = canvas.toDataURL("image/jpeg", 0.95);

    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const pageWidth = doc.internal.pageSize.getWidth(); // 210
    const pageHeight = doc.internal.pageSize.getHeight(); // 297

    doc.addImage(imgData, "JPEG", 0, 0, pageWidth, pageHeight);
    return doc;
  } finally {
    if (element.parentNode) {
      element.parentNode.removeChild(element);
    }
  }
}

/**
 * Exports/Downloads the Clinical Diagnostic PDF Report in the selected language.
 */
export async function generateClinicalPdfReport(data: PatientReportData, lang: PdfLanguage = "en") {
  const doc = await buildClinicalPdfDocAsync(data, lang);
  const filename = `NETRA_Report_${data.patientId || "Scan"}_${lang.toUpperCase()}.pdf`;
  doc.save(filename);
}

/**
 * Generates an object URL for in-app PDF previewing in the selected language.
 */
export async function getClinicalPdfBlobUrl(
  data: PatientReportData,
  lang: PdfLanguage = "en"
): Promise<string> {
  const doc = await buildClinicalPdfDocAsync(data, lang);
  const blob = doc.output("blob");
  return URL.createObjectURL(blob);
}
