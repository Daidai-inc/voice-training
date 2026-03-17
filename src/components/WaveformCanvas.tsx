"use client";

import { useRef, useEffect, useCallback } from "react";
import { WaveformPeaks } from "@/types/audio";
import { COLORS } from "@/lib/constants";

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
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const width = container.offsetWidth;
    if (width <= 0) {
      // レイアウト未確定 → 少し待って再試行
      rafRef.current = requestAnimationFrame(draw);
      return;
    }

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    // 背景
    ctx.fillStyle = COLORS.surface;
    ctx.fillRect(0, 0, width, height);

    // 中心線
    ctx.strokeStyle = COLORS.centerLine;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();
    ctx.setLineDash([]);

    const centerY = height / 2;

    if (realtimeData) {
      const sliceWidth = width / realtimeData.length;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      let x = 0;
      for (let i = 0; i < realtimeData.length; i++) {
        const y = centerY - realtimeData[i] * centerY;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
        x += sliceWidth;
      }
      ctx.stroke();
    } else if (peaks && peaks.positive.length > 0) {
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.8;
      const scaleX = width / peaks.positive.length;
      for (let i = 0; i < peaks.positive.length; i++) {
        const top = centerY - peaks.positive[i] * centerY;
        const bottom = centerY - peaks.negative[i] * centerY;
        ctx.fillRect(
          i * scaleX,
          top,
          Math.max(scaleX, 1),
          Math.max(bottom - top, 1)
        );
      }
      ctx.globalAlpha = 1;
    }

    if (playbackProgress !== undefined && playbackProgress > 0) {
      ctx.strokeStyle = COLORS.playhead;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(playbackProgress * width, 0);
      ctx.lineTo(playbackProgress * width, height);
      ctx.stroke();
    }

    if (label) {
      ctx.font = "12px system-ui, sans-serif";
      ctx.fillStyle = color;
      ctx.globalAlpha = 1;
      ctx.fillText(label, 8, 18);
    }
  }, [peaks, realtimeData, color, label, playbackProgress, height]);

  // データ変更時に描画
  useEffect(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [draw]);

  // リサイズ時に再描画
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(draw);
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [draw]);

  return (
    <div
      ref={containerRef}
      className="w-full rounded-lg overflow-hidden"
      style={{ minHeight: height }}
    >
      <canvas ref={canvasRef} className="block" />
    </div>
  );
}
