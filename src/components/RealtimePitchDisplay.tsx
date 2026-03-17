"use client";

import { useEffect, useState, useRef } from "react";
import { detectPitchRealtime, PitchPoint } from "@/lib/pitch-detector";

interface RealtimePitchDisplayProps {
  analyserNode: AnalyserNode | null;
  isActive: boolean;
}

export default function RealtimePitchDisplay({
  analyserNode,
  isActive,
}: RealtimePitchDisplayProps) {
  const [currentPitch, setCurrentPitch] = useState<PitchPoint | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!analyserNode || !isActive) {
      setCurrentPitch(null);
      return;
    }

    // 200msごとに検出（60fpsではなく5fps相当）
    intervalRef.current = setInterval(() => {
      const pitch = detectPitchRealtime(analyserNode);
      setCurrentPitch(pitch);
    }, 200);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [analyserNode, isActive]);

  if (!isActive) return null;

  return (
    <div className="flex items-center gap-4 p-3 rounded-lg bg-[var(--color-surface-light)]">
      <div className="text-center min-w-[80px]">
        <div className="text-3xl font-bold text-[var(--color-brand)]">
          {currentPitch ? currentPitch.note : "--"}
        </div>
        {currentPitch && (
          <div className="text-xs text-[var(--color-text-muted)]">
            {currentPitch.frequency.toFixed(1)} Hz
          </div>
        )}
      </div>

      {currentPitch && (
        <div className="flex-1">
          <div className="relative h-4 bg-gray-700 rounded-full overflow-hidden">
            <div className="absolute left-1/2 top-0 w-0.5 h-full bg-white/30" />
            <div
              className="absolute top-1 h-2 w-2 rounded-full bg-[var(--color-brand)] transition-all duration-150"
              style={{ left: `${50 + currentPitch.cents}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-[var(--color-text-muted)] mt-0.5">
            <span>-50</span>
            <span>0</span>
            <span>+50</span>
          </div>
        </div>
      )}

      {!currentPitch && (
        <span className="text-sm text-[var(--color-text-muted)]">
          声を出すとピッチが表示されます
        </span>
      )}
    </div>
  );
}
