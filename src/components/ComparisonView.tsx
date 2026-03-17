"use client";

import { useRef, useEffect, useCallback } from "react";
import { ViewMode, WaveformPeaks } from "@/types/audio";
import { renderOverlay } from "@/lib/waveform-renderer";
import { COLORS } from "@/lib/constants";
import WaveformCanvas from "./WaveformCanvas";

interface ComparisonViewProps {
  recordedPeaks?: WaveformPeaks;
  referencePeaks?: WaveformPeaks;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  playbackProgress?: number;
}

export default function ComparisonView({
  recordedPeaks,
  referencePeaks,
  viewMode,
  onViewModeChange,
  playbackProgress,
}: ComparisonViewProps) {
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const drawOverlay = useCallback(() => {
    const canvas = overlayCanvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || viewMode !== "overlay") return;

    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    const width = rect.width;
    const height = 200;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.scale(dpr, dpr);

    renderOverlay(
      ctx,
      width,
      height,
      recordedPeaks,
      referencePeaks,
      COLORS.brand,
      COLORS.reference,
      playbackProgress
    );
  }, [recordedPeaks, referencePeaks, viewMode, playbackProgress]);

  useEffect(() => {
    drawOverlay();
  }, [drawOverlay]);

  useEffect(() => {
    const handleResize = () => drawOverlay();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [drawOverlay]);

  const hasData = recordedPeaks || referencePeaks;

  if (!hasData) {
    return (
      <div className="flex items-center justify-center h-48 rounded-lg bg-[var(--color-surface)] text-[var(--color-text-muted)] text-sm">
        録音とお手本の両方を用意すると、ここで比較できます
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* 表示モード切替 */}
      <div className="flex gap-2">
        <button
          onClick={() => onViewModeChange("side-by-side")}
          className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
            viewMode === "side-by-side"
              ? "bg-[var(--color-reference)] text-white"
              : "bg-[var(--color-surface-light)] text-[var(--color-text-muted)] hover:text-white"
          }`}
        >
          並列表示
        </button>
        <button
          onClick={() => onViewModeChange("overlay")}
          className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
            viewMode === "overlay"
              ? "bg-[var(--color-reference)] text-white"
              : "bg-[var(--color-surface-light)] text-[var(--color-text-muted)] hover:text-white"
          }`}
        >
          重ね合わせ
        </button>
      </div>

      {viewMode === "side-by-side" ? (
        <div className="space-y-2">
          <WaveformCanvas
            peaks={recordedPeaks}
            color={COLORS.brand}
            label="あなたの歌声"
            playbackProgress={playbackProgress}
            height={120}
          />
          <WaveformCanvas
            peaks={referencePeaks}
            color={COLORS.reference}
            label="お手本"
            playbackProgress={playbackProgress}
            height={120}
          />
        </div>
      ) : (
        <div ref={containerRef} className="w-full rounded-lg overflow-hidden">
          <canvas ref={overlayCanvasRef} className="block w-full" />
        </div>
      )}
    </div>
  );
}
