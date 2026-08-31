"use client";

import { useState, useEffect, useMemo } from "react";
import { User, Phone, CheckCircle, UserPlus, X } from "lucide-react";
import { DiagnosticHistoryItem } from "./SessionPanel";

interface PatientIntakeModalProps {
  theme?: "dark" | "light";
  isOpen: boolean;
  onClose: () => void;
  existingRecords: DiagnosticHistoryItem[];
  onSubmitIntake: (patient: {
    patientId: string;
    patientName: string;
    mobileNumber: string;
    isExisting: boolean;
  }) => void;
}

export default function PatientIntakeModal({
  theme = "dark",
  isOpen,
  onClose,
  existingRecords,
  onSubmitIntake,
}: PatientIntakeModalProps) {
  const isLight = theme === "light";

  const [patientName, setPatientName] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");

  // Check if mobile number matches an existing record in real-time
  const matchedExistingPatient = useMemo(() => {
    const cleanMobile = mobileNumber.trim();
    if (cleanMobile.length < 5) return null;
    return existingRecords.find(
      (r) => r.mobileNumber && r.mobileNumber.trim() === cleanMobile
    );
  }, [mobileNumber, existingRecords]);

  // Auto-fill name if existing patient is found
  useEffect(() => {
    if (matchedExistingPatient && matchedExistingPatient.patientName) {
      setPatientName(matchedExistingPatient.patientName);
    }
  }, [matchedExistingPatient]);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setPatientName("");
      setMobileNumber("");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleProceedWithData = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const cleanName = patientName.trim() || "Anonymous Patient";
    const cleanMobile = mobileNumber.trim() || "";

    let patientId = "";
    let isExisting = false;

    if (matchedExistingPatient && matchedExistingPatient.patientId) {
      patientId = matchedExistingPatient.patientId;
      isExisting = true;
    } else {
      const randomNum = Math.floor(100000 + Math.random() * 900000);
      patientId = `NET-${randomNum}`;
    }

    onSubmitIntake({
      patientId,
      patientName: cleanName,
      mobileNumber: cleanMobile,
      isExisting,
    });
  };

  const handleProceedAsGuest = () => {
    const randomNum = Math.floor(100000 + Math.random() * 900000);
    onSubmitIntake({
      patientId: `NET-${randomNum}`,
      patientName: "Guest Patient",
      mobileNumber: "",
      isExisting: false,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md font-mono select-none">
      <div
        className={`w-full max-w-md border p-6 shadow-2xl transition-all duration-200 ${
          isLight
            ? "bg-white border-neutral-300 text-neutral-900 shadow-neutral-300/40"
            : "bg-neutral-950 border-neutral-800 text-white shadow-black/80"
        }`}
      >
        {/* ── Modal Header ─────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between pb-3 border-b border-inherit">
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] tracking-[0.2em] text-neutral-500 uppercase">
              SCAN INGESTION GATEWAY
            </span>
            <h2 className="text-xs font-bold tracking-[0.15em] uppercase">
              PATIENT INTAKE
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-neutral-500/10 transition-colors text-neutral-400 hover:text-white cursor-pointer"
          >
            <X size={15} />
          </button>
        </div>

        {/* ── Status Banner (Existing vs New Patient) ────────────────────────── */}
        <div className="my-3.5">
          {matchedExistingPatient ? (
            <div className="p-2 border border-emerald-500/40 bg-emerald-950/20 text-emerald-300 text-[11px] flex items-center gap-2">
              <CheckCircle size={13} className="text-emerald-400 shrink-0" />
              <div>
                <span className="font-bold">EXISTING RECORD MATCHED: </span>
                <span>{matchedExistingPatient.patientId}</span>
              </div>
            </div>
          ) : (
            <div className="p-2 border border-neutral-800 bg-neutral-900/60 text-neutral-400 text-[10.5px] flex items-center gap-2">
              <UserPlus size={13} className="text-neutral-400 shrink-0" />
              <span>Enter patient details or proceed as guest</span>
            </div>
          )}
        </div>

        {/* ── Intake Form ─────────────────────────────────────────────────── */}
        <form onSubmit={handleProceedWithData} className="flex flex-col gap-3.5">
          {/* Patient Name */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase tracking-wider text-neutral-400 flex items-center gap-1.5 font-bold">
              <User size={11} /> Patient Name
            </label>
            <input
              type="text"
              value={patientName}
              onChange={(e) => setPatientName(e.target.value)}
              placeholder="Patient Name"
              className={`w-full px-3 py-2 text-xs font-mono border outline-none transition-colors ${
                isLight
                  ? "bg-white border-neutral-300 text-black focus:border-black"
                  : "bg-black border-neutral-800 text-white focus:border-neutral-500"
              }`}
              autoFocus
            />
          </div>

          {/* Mobile Number */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase tracking-wider text-neutral-400 flex items-center gap-1.5 font-bold">
              <Phone size={11} /> Mobile Number
            </label>
            <input
              type="tel"
              value={mobileNumber}
              onChange={(e) => setMobileNumber(e.target.value)}
              placeholder="Mobile Number"
              className={`w-full px-3 py-2 text-xs font-mono border outline-none transition-colors ${
                isLight
                  ? "bg-white border-neutral-300 text-black focus:border-black"
                  : "bg-black border-neutral-800 text-white focus:border-neutral-500"
              }`}
            />
          </div>

          {/* Prominent Action Buttons */}
          <div className="flex flex-col gap-2 pt-2">
            <button
              type="submit"
              className={`py-2.5 text-xs uppercase font-bold tracking-wider border transition-all cursor-pointer ${
                isLight
                  ? "border-black bg-black text-white hover:bg-neutral-800"
                  : "border-white bg-white text-black hover:bg-neutral-200"
              }`}
            >
              [ Submit & Run Diagnosis ]
            </button>

            <button
              type="button"
              onClick={handleProceedAsGuest}
              className={`py-2 text-xs uppercase font-bold tracking-wider border transition-all cursor-pointer ${
                isLight
                  ? "border-neutral-300 text-neutral-700 bg-neutral-100 hover:bg-neutral-200"
                  : "border-neutral-800 text-neutral-300 bg-neutral-900/80 hover:bg-neutral-800 hover:text-white"
              }`}
            >
              Proceed as Guest →
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
