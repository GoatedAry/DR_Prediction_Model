"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";

export interface DiagnosticState {
  continuous_score: number;
  clamped_score: number;
  integer_stage: number;
  stage_label: string;
  val_mse_loss: number;
  peak_qwk: number;
  gradcam_base64: string;
}

interface TelemetryPanelProps {
  data: DiagnosticState;
}

function TelemetryRow({
  label,
  value,
  index,
}: {
  label: string;
  value: string;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.05 * index, duration: 0.3, ease: "easeOut" as const }}
      className="flex justify-between items-baseline px-3 py-2"
      style={{ borderBottom: "1px solid rgba(255,255,255,0.10)" }}
    >
      <span className="text-[10px] font-mono tracking-widest uppercase text-white/50">
        {label}
      </span>
      <span className="text-[11px] font-mono font-bold tabular-nums text-white">
        {value}
      </span>
    </motion.div>
  );
}

export default function TelemetryPanel({ data }: TelemetryPanelProps) {
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [showMetrics, setShowMetrics] = useState(true);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    // Revoke previous object URL to avoid memory leaks
    if (uploadedImage) URL.revokeObjectURL(uploadedImage);

    const url = URL.createObjectURL(file);
    setUploadedImage(url);
    setShowMetrics(false);
    setProcessing(true);

    setTimeout(() => {
      setProcessing(false);
      setShowMetrics(true);
    }, 3000);
  }, [uploadedImage]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [] },
    multiple: false,
    noClick: false,
  });

  return (
    <div className="absolute inset-0 pointer-events-none z-10 flex items-stretch">

      {/* ── Left Telemetry Sidebar ─────────────────────────────────── */}
      <motion.aside
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" as const }}
        className="pointer-events-auto flex flex-col w-72 bg-black overflow-y-auto overflow-x-hidden flex-shrink-0"
        style={{ borderRight: "1px solid rgba(255,255,255,0.18)" }}
      >

        {/* Header — inverted white block */}
        <div
          className="flex items-center justify-between px-4 py-3 bg-white text-black flex-shrink-0"
          style={{ borderBottom: "1px solid rgba(0,0,0,0.15)" }}
        >
          <div>
            <p className="text-[9px] font-mono tracking-[0.2em] uppercase opacity-50">
              Diagnostic System
            </p>
            <h2 className="text-sm font-mono font-black tracking-tight leading-none uppercase mt-0.5">
              DR · GRADER
            </h2>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="block w-1.5 h-1.5 bg-black animate-pulse" />
            <span className="text-[9px] font-mono tracking-widest uppercase opacity-50">
              Live
            </span>
          </div>
        </div>

        {/* Primary Score Block */}
        <div
          className="px-4 py-5 flex-shrink-0"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.18)" }}
        >
          <p className="text-[9px] font-mono tracking-[0.2em] uppercase text-white/40 mb-1">
            Continuous Score
          </p>
          <p className="text-5xl font-mono font-black text-white leading-none tabular-nums">
            {data.continuous_score.toFixed(3)}
          </p>
          <div className="mt-3 flex items-center gap-3">
            <span
              className="text-[10px] font-mono tracking-widest uppercase text-black bg-white px-2 py-0.5"
              style={{ border: "1px solid white" }}
            >
              {data.stage_label}
            </span>
            <span className="text-[10px] font-mono text-white/40">
              Stage {data.integer_stage}
            </span>
          </div>
        </div>

        {/* ── Animated Metrics / Processing State ──────────────────── */}
        <AnimatePresence mode="wait">
          {processing ? (
            <motion.div
              key="processing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="flex flex-col items-start px-4 py-6 gap-3 flex-shrink-0"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.18)" }}
            >
              <p className="text-[10px] font-mono tracking-[0.15em] uppercase text-white animate-pulse leading-relaxed">
                PROCESSING TENSOR GRADIENTS...
              </p>
              {/* Five-dot pulsing indicator */}
              <div className="flex gap-1.5">
                {[0, 1, 2, 3, 4].map((i) => (
                  <motion.span
                    key={i}
                    className="block w-1 h-1 bg-white"
                    animate={{ opacity: [0.15, 1, 0.15] }}
                    transition={{
                      duration: 0.9,
                      repeat: Infinity,
                      delay: i * 0.14,
                      ease: "easeInOut" as const,
                    }}
                  />
                ))}
              </div>
            </motion.div>
          ) : showMetrics ? (
            <motion.div
              key="metrics"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col"
            >
              <TelemetryRow label="Clamped Score" value={data.clamped_score.toFixed(3)} index={0} />
              <TelemetryRow label="Integer Stage" value={String(data.integer_stage)} index={1} />
              <TelemetryRow label="Val MSE Loss" value={data.val_mse_loss.toFixed(4)} index={2} />
              <TelemetryRow label="Peak QWK" value={data.peak_qwk.toFixed(4)} index={3} />
              <TelemetryRow
                label="GradCAM"
                value={data.gradcam_base64 ? "LOADED" : "EMPTY"}
                index={4}
              />
            </motion.div>
          ) : null}
        </AnimatePresence>

        {/* ── Dropzone ─────────────────────────────────────────────── */}
        <div
          className="px-3 py-3 mt-auto flex-shrink-0"
          style={{ borderTop: "1px solid rgba(255,255,255,0.18)" }}
        >
          <div
            {...getRootProps()}
            className="cursor-pointer flex flex-col items-center justify-center py-6 px-3 gap-3 transition-all duration-150"
            style={{
              border: `1px solid ${isDragActive ? "#ffffff" : "rgba(255,255,255,0.35)"}`,
              background: isDragActive ? "rgba(255,255,255,0.04)" : "transparent",
            }}
          >
            <input {...getInputProps()} />

            {uploadedImage ? (
              /* Thumbnail when image is loaded */
              <div className="flex flex-col items-center gap-2 w-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={uploadedImage}
                  alt="Uploaded fundus"
                  className="w-full object-cover"
                  style={{ maxHeight: "80px", filter: "grayscale(0.3)" }}
                />
                <p className="text-[9px] font-mono tracking-[0.2em] uppercase text-white/40">
                  ✓ IMAGE LOADED — DROP TO REPLACE
                </p>
              </div>
            ) : (
              <p className="text-[9px] font-mono tracking-[0.15em] uppercase text-center text-white/50 leading-loose">
                DROP FUNDUS IMAGE
                <br />
                OR CLICK TO BROWSE
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between px-4 py-2 flex-shrink-0"
          style={{ borderTop: "1px solid rgba(255,255,255,0.18)" }}
        >
          <span className="text-[9px] font-mono text-white/25 tracking-widest uppercase">
            ENGINE · CORE · v1.0
          </span>
        </div>
      </motion.aside>

      {/* ── Top-right renderer tag ──────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.15, ease: "easeOut" as const }}
        className="pointer-events-none absolute top-0 right-0 bg-black"
        style={{
          borderLeft: "1px solid rgba(255,255,255,0.18)",
          borderBottom: "1px solid rgba(255,255,255,0.18)",
        }}
      >
        <div className="px-5 py-3">
          <p className="text-[9px] font-mono tracking-[0.2em] uppercase text-white/35">
            Renderer
          </p>
          <p className="text-[11px] font-mono text-white tracking-wide">
            WebGL · Wireframe
          </p>
        </div>
      </motion.div>

    </div>
  );
}
