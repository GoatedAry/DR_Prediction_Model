"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { MapPin, Building, Check, X } from "lucide-react";

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface LocationHub {
  city: string;
  pin: string;
  hospitals: number;
  probability: number;
}

interface LocationGatewayProps {
  onLocationSelect?: (hub: LocationHub) => void;
  inline?: boolean;
  theme?: "dark" | "light";
}

// ─── Preset Hubs ──────────────────────────────────────────────────────────────

const PRESET_HUBS: LocationHub[] = [
  { city: "Patna (Bihar Hub)", pin: "800001", hospitals: 24, probability: 0.89 },
  { city: "Delhi (NCR Central)", pin: "110001", hospitals: 58, probability: 0.94 },
  { city: "Mumbai (Western Region)", pin: "400001", hospitals: 47, probability: 0.92 },
  { city: "Allahabad (UP Hub)", pin: "211001", hospitals: 18, probability: 0.78 },
  { city: "Bengaluru (South Hub)", pin: "560001", hospitals: 36, probability: 0.91 },
];

// Estimate hospital count & scanner availability from PIN prefix
function estimateRegionalStats(pinCode: string): { hospitals: number; probability: number } {
  const stateCode = pinCode.charAt(0);
  switch (stateCode) {
    case "1": return { hospitals: 42, probability: 0.93 };
    case "2": return { hospitals: 26, probability: 0.81 };
    case "3": return { hospitals: 19, probability: 0.74 };
    case "4": return { hospitals: 45, probability: 0.90 };
    case "5": return { hospitals: 38, probability: 0.88 };
    case "6": return { hospitals: 34, probability: 0.87 };
    case "7": return { hospitals: 22, probability: 0.79 };
    case "8": return { hospitals: 28, probability: 0.84 };
    default:  return { hospitals: 12, probability: 0.68 };
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function LocationGateway({ onLocationSelect, inline = false, theme = "dark" }: LocationGatewayProps) {
  const [activeHub, setActiveHub] = useState<LocationHub | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  
  // Form input states
  const [pinInput, setPinInput] = useState("");
  const [resolving, setResolving] = useState(false);
  const [resolvedResult, setResolvedResult] = useState<LocationHub | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Client-side hydration of active hub
  useEffect(() => {
    const stored = localStorage.getItem("medical_active_hub");
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as LocationHub;
        setActiveHub(parsed);
        if (onLocationSelect) onLocationSelect(parsed);
      } catch (e) {
        console.error("Failed to parse stored hub", e);
      }
    }
  }, [onLocationSelect]);

  // Select and save a hub
  const selectHub = (hub: LocationHub) => {
    localStorage.setItem("medical_active_hub", JSON.stringify(hub));
    setActiveHub(hub);
    setIsOpen(false);
    
    // Reset forms
    setPinInput("");
    setResolving(false);
    setResolvedResult(null);
    setErrorMsg("");

    if (onLocationSelect) {
      onLocationSelect(hub);
    }
  };

  const handleResolvePin = async () => {
    setErrorMsg("");
    setResolvedResult(null);

    if (!/^[1-9][0-9]{5}$/.test(pinInput)) {
      setErrorMsg("Please enter a valid 6-digit Indian postal code.");
      return;
    }

    setResolving(true);

    try {
      const response = await fetch(`https://api.postalpincode.in/pincode/${pinInput}`);
      const data = await response.json();

      if (!data || !Array.isArray(data) || data[0]?.Status !== "Success" || !data[0]?.PostOffice?.length) {
        setErrorMsg("Invalid postal code. No post office found for this PIN.");
        setResolving(false);
        return;
      }

      const po = data[0].PostOffice[0];
      const name: string = po.Name ?? "";
      const district: string = po.District ?? "";
      const state: string = po.State ?? "";
      const stats = estimateRegionalStats(pinInput);

      const resolved: LocationHub = {
        city: `${name}, ${district} (${state})`,
        pin: pinInput,
        hospitals: stats.hospitals,
        probability: stats.probability,
      };

      setResolvedResult(resolved);
    } catch (err) {
      console.error("Postal API fetch failed:", err);
      setErrorMsg("Could not reach the postal lookup service. Please try again.");
    } finally {
      setResolving(false);
    }
  };

  const modalPortal = (isOpen && mounted) ? createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div 
        className={`w-full max-w-lg border flex flex-col font-sans p-6 rounded-none max-h-[90vh] ${
          theme === "light"
            ? "bg-zinc-100 border-black/15 text-black"
            : "bg-zinc-950 border-white/10 text-white"
        }`}
        style={{ boxShadow: "0 10px 30px rgba(0, 0, 0, 0.5)" }}
      >
        {/* Header */}
        <div className={`flex items-start justify-between pb-4 border-b flex-shrink-0 ${
          theme === "light" ? "border-black/10" : "border-white/10"
        }`}>
          <div className="flex flex-col gap-1">
            <h2 className="text-sm font-semibold tracking-wider uppercase font-mono">
              Regional Screening Center Locator
            </h2>
            <p className={`text-[10px] leading-relaxed max-w-sm ${theme === "light" ? "text-black/60" : "text-white/50"}`}>
              Select your region to route diagnostic results to the nearest available facility.
            </p>
          </div>
          <button 
            onClick={() => setIsOpen(false)}
            className={`transition-colors cursor-pointer p-1 ${theme === "light" ? "text-black/40 hover:text-black" : "text-white/40 hover:text-white"}`}
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="py-6 flex flex-col gap-6 overflow-y-auto max-h-[70vh]">
          
          {/* Preset Regional Hub List */}
          <div className="flex flex-col gap-3">
            <h3 className={`text-[10px] font-mono tracking-widest uppercase ${theme === "light" ? "text-black/40" : "text-white/40"}`}>
              Available Regional Hubs
            </h3>
            <div className={`flex flex-col gap-2 max-h-[220px] overflow-y-auto pr-1 border ${theme === "light" ? "border-black/5" : "border-white/5"}`}>
              {PRESET_HUBS.map((hub) => {
                const isSelected = activeHub?.pin === hub.pin;
                return (
                  <div
                    key={hub.pin}
                    onClick={() => selectHub(hub)}
                    className={`group border p-3 flex items-center justify-between cursor-pointer transition-all duration-150 rounded-none ${
                      isSelected 
                        ? (theme === "light" ? "bg-black text-white border-black" : "bg-white text-black border-white") 
                        : (theme === "light" ? "bg-white border-black/5 hover:border-black/20 text-black" : "bg-black border-white/5 hover:border-white/20 text-white")
                    }`}
                  >
                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-semibold tracking-wide">{hub.city}</span>
                      <div className="flex gap-4 text-[9px] font-mono tracking-wider opacity-60">
                        <span className="flex items-center gap-1">
                          <MapPin size={9} /> PIN: {hub.pin}
                        </span>
                        <span className="flex items-center gap-1">
                          <Building size={9} /> {hub.hospitals} Active Facilities
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex flex-col items-end">
                        <span className="text-[8px] opacity-40 uppercase tracking-widest font-mono">Availability</span>
                        <span className="text-xs font-semibold font-mono">{(hub.probability * 100).toFixed(0)}%</span>
                      </div>
                      {isSelected && (
                        <Check size={14} className={theme === "light" ? "text-white" : "text-black"} />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Custom Indian PIN Code Resolver */}
          <div className="flex flex-col gap-3 pt-2">
            <h3 className={`text-[10px] font-mono tracking-widest uppercase ${theme === "light" ? "text-black/40" : "text-white/40"}`}>
              Find Nearest Center by PIN Code
            </h3>

            <div className="flex gap-2">
              <input
                type="text"
                maxLength={6}
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ""))}
                placeholder="Enter 6-digit postal code"
                disabled={resolving}
                className={`flex-1 border px-4 py-2.5 text-xs font-mono tracking-widest uppercase focus:outline-none rounded-none disabled:opacity-50 ${
                  theme === "light"
                    ? "bg-white border-black/10 text-black focus:border-black/30"
                    : "bg-black border-white/10 text-white focus:border-white/30"
                }`}
              />
              <button
                onClick={handleResolvePin}
                disabled={pinInput.length !== 6 || resolving}
                className={`border px-6 py-2.5 text-xs font-mono tracking-widest uppercase transition-all duration-150 rounded-none disabled:opacity-30 disabled:cursor-not-allowed ${
                  theme === "light"
                    ? "bg-black text-white hover:bg-neutral-800 border-black"
                    : "bg-white text-black hover:bg-neutral-200 border-white"
                }`}
              >
                Resolve
              </button>
            </div>

            {/* Error & Resolved Result UI */}
            {errorMsg && (
              <div className="text-[10px] font-mono text-red-500 uppercase">
                Error: {errorMsg}
              </div>
            )}

            {resolvedResult && (
              <div
                onClick={() => selectHub(resolvedResult)}
                className={`border p-3 flex items-center justify-between cursor-pointer transition-all duration-150 rounded-none ${
                  theme === "light"
                    ? "bg-neutral-50 hover:bg-neutral-100 border-black/10 text-black"
                    : "bg-zinc-900 hover:bg-zinc-800 border-white/10 text-white"
                }`}
              >
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-semibold tracking-wide">
                    {resolvedResult.city}
                  </span>
                  <div className="flex gap-4 text-[9px] font-mono opacity-60">
                    <span>PIN: {resolvedResult.pin}</span>
                    <span>{resolvedResult.hospitals} Facilities</span>
                  </div>
                </div>
                <span className="text-xs font-mono font-semibold">
                  [Select Resolved Center]
                </span>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <>
      {/* ── Location Indicator Badge ── */}
      {inline ? (
        <button
          onClick={() => setIsOpen(true)}
          className={`font-mono text-[9px] tracking-wider uppercase flex items-center gap-1.5 select-none cursor-pointer border px-3 py-1.5 transition-colors ${
            theme === "light"
              ? "border-black/15 bg-white text-black hover:border-black/30"
              : "border-white/10 bg-neutral-950 text-white hover:border-white/30"
          }`}
        >
          <MapPin size={10} className={theme === "light" ? "text-black/50" : "text-white/50"} />
          <span className="font-semibold">
            {activeHub ? `${activeHub.pin} (${activeHub.city.split(" ")[0]})` : "Not Set"}
          </span>
        </button>
      ) : (
        <div
          className={`font-mono text-[10px] tracking-wider uppercase flex items-center gap-3 select-none absolute top-6 right-6 z-30 border p-3.5 ${
            theme === "light"
              ? "border-black/10 bg-white/95 text-black"
              : "border-white/10 bg-black/90 text-white"
          }`}
        >
          <div className={`flex items-center gap-1.5 ${theme === "light" ? "text-black/40" : "text-white/40"}`}>
            <MapPin size={11} className={theme === "light" ? "text-black/60" : "text-white/60"} />
            <span>Region:</span>
          </div>
          <span className="font-semibold">
            {activeHub ? `${activeHub.pin} (${activeHub.city.split(" ")[0]})` : "Not Set"}
          </span>
          <button
            onClick={() => setIsOpen(true)}
            className={`font-bold px-1 transition-colors hover:underline cursor-pointer ${
              theme === "light" ? "text-black hover:text-black/80" : "text-white hover:text-white/80"
            }`}
          >
            [Change Region]
          </button>
        </div>
      )}

      {modalPortal}
    </>
  );
}
