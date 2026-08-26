"use client";

import { useState, useEffect } from "react";
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
}

// ─── Preset Hubs ──────────────────────────────────────────────────────────────

const PRESET_HUBS: LocationHub[] = [
  { city: "Patna (Bihar Hub)", pin: "800001", hospitals: 24, probability: 0.89 },
  { city: "Delhi (NCR Central)", pin: "110001", hospitals: 58, probability: 0.94 },
  { city: "Mumbai (Western Region)", pin: "400001", hospitals: 47, probability: 0.92 },
  { city: "Allahabad (UP Hub)", pin: "211001", hospitals: 18, probability: 0.78 },
  { city: "Bengaluru (South Hub)", pin: "560001", hospitals: 36, probability: 0.91 },
];

// Estimate hospital count & scanner availability from PIN prefix (no public API for these)
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

export default function LocationGateway({ onLocationSelect, inline = false }: LocationGatewayProps) {
  const [activeHub, setActiveHub] = useState<LocationHub | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  
  // Form input states
  const [pinInput, setPinInput] = useState("");
  const [resolving, setResolving] = useState(false);
  const [resolvedResult, setResolvedResult] = useState<LocationHub | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

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

  return (
    <>
      {/* ── Location Indicator Badge ── */}
      <div
        className={`font-mono text-[10px] tracking-wider uppercase flex items-center gap-3 select-none ${
          inline
            ? ""
            : "absolute top-6 right-6 z-30 border border-white/10 bg-black/90 p-3.5"
        }`}
      >
        <div className="flex items-center gap-1.5 text-white/40">
          <MapPin size={11} className="text-white/60" />
          <span>Region:</span>
        </div>
        <span className="text-white font-semibold">
          {activeHub ? `${activeHub.pin} (${activeHub.city.split(" ")[0]})` : "Not Set"}
        </span>
        <button
          onClick={() => setIsOpen(true)}
          className="text-white hover:text-white/80 font-bold px-1 transition-colors hover:underline cursor-pointer"
        >
          [Change Region]
        </button>
      </div>

      {/* ── Location Selection Modal (Clean Medical Interface) ── */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div 
            className="w-full max-w-lg bg-zinc-950 border border-white/10 flex flex-col font-sans text-white p-6"
            style={{
              boxShadow: "0 10px 30px rgba(0, 0, 0, 0.5)"
            }}
          >
            {/* Header */}
            <div className="flex items-start justify-between pb-4 border-b border-white/10">
              <div className="flex flex-col gap-1">
                <h2 className="text-sm font-semibold tracking-wider text-white uppercase font-mono">
                  Regional Screening Center Locator
                </h2>
                <p className="text-[10px] text-white/50 leading-relaxed max-w-sm">
                  Select your region to route diagnostic results to the nearest available facility.
                </p>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="text-white/40 hover:text-white transition-colors cursor-pointer p-1"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="py-6 flex flex-col gap-6 overflow-y-auto max-h-[70vh]">
              
              {/* Preset Regional Hub List */}
              <div className="flex flex-col gap-3">
                <h3 className="text-[10px] font-mono tracking-widest text-white/40 uppercase">
                  Available Regional Hubs
                </h3>
                <div className="flex flex-col gap-2 max-h-[220px] overflow-y-auto pr-1 border border-white/5">
                  {PRESET_HUBS.map((hub) => {
                    const isSelected = activeHub?.pin === hub.pin;
                    return (
                      <div
                        key={hub.pin}
                        onClick={() => selectHub(hub)}
                        className={`group border p-3 flex items-center justify-between cursor-pointer transition-all duration-150 rounded-none ${
                          isSelected 
                            ? "bg-white text-black border-white" 
                            : "bg-black border-white/5 hover:border-white/20 text-white"
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
                            <Check size={14} className="text-black" />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Custom Indian PIN Code Resolver */}
              <div className="flex flex-col gap-3 pt-2">
                <h3 className="text-[10px] font-mono tracking-widest text-white/40 uppercase">
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
                    className="flex-1 bg-black border border-white/10 px-4 py-2.5 text-xs font-mono tracking-widest uppercase focus:outline-none focus:border-white/30 rounded-none text-white disabled:opacity-50"
                  />
                  <button
                    onClick={handleResolvePin}
                    disabled={pinInput.length !== 6 || resolving}
                    className="border border-white hover:bg-white hover:text-black transition-colors font-mono text-[10px] tracking-widest font-bold px-6 py-2.5 uppercase cursor-pointer disabled:opacity-40 disabled:hover:bg-black disabled:hover:text-white"
                  >
                    {resolving ? "Looking up..." : "Apply"}
                  </button>
                </div>

                {errorMsg && (
                  <div className="text-red-400 text-[9px] uppercase tracking-wide">
                    {errorMsg}
                  </div>
                )}

                {/* Resolved Result Actions */}
                {resolvedResult && (
                  <div 
                    onClick={() => selectHub(resolvedResult)}
                    className="border border-white/20 bg-white/5 p-4 flex items-center justify-between cursor-pointer hover:border-white/40 transition-all rounded-none"
                  >
                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-semibold text-white tracking-wide">
                        {resolvedResult.city}
                      </span>
                      <div className="flex gap-4 text-[9px] font-mono opacity-60">
                        <span>PIN: {resolvedResult.pin}</span>
                        <span>Facilities: {resolvedResult.hospitals}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="flex flex-col items-end">
                        <span className="text-[8px] opacity-40 uppercase tracking-widest font-mono">Scanner Estimate</span>
                        <span className="text-xs font-semibold font-mono text-white">
                          {(resolvedResult.probability * 100).toFixed(0)}%
                        </span>
                      </div>
                      <span className="text-white text-[9px] tracking-widest border border-white/20 px-2.5 py-1 uppercase hover:bg-white hover:text-black font-mono">
                        Select
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
