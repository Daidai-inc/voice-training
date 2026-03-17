"use client";

import { useRef, useEffect, useCallback } from "react";
import { WaveformPeaks } from "@/types/audio";
import {
  renderStaticWaveform,
  renderRealtimeWaveform,
} from "@/lib/waveform-renderer";

interface WaveformCanvasProps {
  peaks?: WaveformPeaks;
  realtimeData?: Float32Array | null;
  color: string;
  label?: string;
  playbackProgress?: number;
  height?: number;
}

export default function WaveformCanvas({
  peaks,
  realtimeData,
  color,
  label,
  playbackProgress,
  height = 150,
}: WaveformCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    const width = rect.width;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.scale(dpr, dpr);

    if (realtimeData) {
      renderRealtimeWaveform(ctx, {
        width,
        height,
        color,
        realtimeData,
        label,
      });
    } else if (peaks) {
      renderStaticWaveform(ctx, {
        width,
        height,
        color,
        peaks,
        playbackProgress,
        label,
      });
    } else {
      // 空の状態
      renderStaticWaveform(ctx, {
        width,
        height,
        color,
        label,
      });
    }
  }, [peaks, realtimeData, color, label, playbackProgress, height]);

  useEffect(() => {
    draw();
  }, [draw]);

  useEffect(() => {
    const handleResize = () => draw();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [draw]);

  return (
    <div ref={containerRef} className="w-full rounded-lg overflow-hidden">
      <canvas ref={canvasRef} className="block w-full" />
    </div>
  );
}
