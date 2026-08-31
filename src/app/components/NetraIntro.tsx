"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { motion } from "framer-motion";

export const NETRA_INTRO_TIMING = {
  wordmarkIn: 0.0,
  wordmarkInDur: 0.35,
  holdEnd: 0.95,
  outStart: 0.95,
  outDur: 0.35,
  total: 1.3,
} as const;

const T = NETRA_INTRO_TIMING;
const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];

const WORD = "NETRAAI";
const WORD_STYLE = {
  fontFamily: "'Montserrat', 'Helvetica Neue', Arial, sans-serif",
} as const;

function subscribeReducedMotion(cb: () => void) {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

function usePrefersReducedMotion() {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
}

export default function NetraIntro({
  onComplete,
  skippable = false,
  onSkip,
  theme = "light",
}: {
  onComplete: () => void;
  skippable?: boolean;
  onSkip?: () => void;
  theme?: "dark" | "light";
}) {
  const reduced = usePrefersReducedMotion();

  const onCompleteRef = useRef(onComplete);
  const onSkipRef = useRef(onSkip);
  onCompleteRef.current = onComplete;
  onSkipRef.current = onSkip;

  useEffect(() => {
    const timer = setTimeout(() => onCompleteRef.current(), T.total * 1000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!skippable) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onSkipRef.current?.();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [skippable]);

  const isLight = theme === "light";

  return (
    <motion.div
      style={{
        backgroundColor: isLight ? "#ffffff" : "#000000",
        color: isLight ? "#000000" : "#ffffff",
      }}
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center ${
        skippable ? "pointer-events-auto cursor-pointer" : "pointer-events-none"
      }`}
      initial={{ opacity: 1 }}
      animate={{ opacity: 0 }}
      transition={{ delay: T.outStart, duration: T.outDur, ease: "easeInOut" }}
      onClick={skippable ? () => onSkipRef.current?.() : undefined}
      role={skippable ? "button" : undefined}
      aria-label={skippable ? "Skip intro" : undefined}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={
          reduced
            ? { opacity: [0, 1, 1, 0], scale: 1 }
            : {
                opacity: [0, 1, 1, 0],
                scale: [0.95, 1, 1, 1.04],
                filter: ["blur(6px)", "blur(0px)", "blur(0px)", "blur(8px)"],
              }
        }
        transition={{
          duration: T.total,
          times: [0, T.wordmarkInDur / T.total, T.holdEnd / T.total, 1],
          ease: EASE_OUT,
        }}
      >
        <span
          className="text-6xl md:text-8xl font-bold uppercase leading-none tracking-[0.2em]"
          style={{
            ...WORD_STYLE,
            color: isLight ? "#000000" : "#ffffff",
          }}
        >
          {WORD}
        </span>
      </motion.div>
    </motion.div>
  );
}
