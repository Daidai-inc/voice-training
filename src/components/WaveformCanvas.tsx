"use client";

import { useEffect, useRef, useCallback } from "react";
import { WaveformPeaks } from "@/types/audio";
import { COLORS } from "@/lib/constants";

interface WaveformCanvasProps {
  peaks: WaveformPeaks | null;
  color: string;
  currentTime: number;
  duration: number;
  height?: number;
  onSeek?: (time: number) => void;
  overlayPeaks?: WaveformPeaks | null;
  overlayColor?: string;
  overlayOffset?: number; // 秒単位のタイミングオフセット
}

export default function WaveformCanvas({
  peaks,
  color,
  currentTime,
  duration,
  height = 120,
  onSeek,
  overlayPeaks,
  overlayColor,
  overlayOffset = 0,
}: WaveformCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const width = Math.floor(rect.width);

    if (width === 0) {
      // コンテナ幅がまだ0の場合、リトライ
      requestAnimationFrame(draw);
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
    ctx.clearRect(0, 0, width, height);

    // 背景
    ctx.fillStyle = COLORS.surface;
    ctx.fillRect(0, 0, width, height);

    // グリッド線
    ctx.strokeStyle = COLORS.gridLine;
    ctx.lineWidth = 1;
    const centerY = height / 2;
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(width, centerY);
    ctx.stroke();

    // 波形描画関数（offsetSec分だけ右にずらして描画）
    const drawWaveform = (p: WaveformPeaks, c: string, alpha: number = 1, offsetSec: number = 0) => {
      const numBins = p.positive.length;
      if (numBins === 0) return;

      ctx.globalAlpha = alpha;
      ctx.fillStyle = c;

      const offsetX = duration > 0 ? (offsetSec / duration) * width : 0;
      const binWidth = width / numBins;
      for (let i = 0; i < numBins; i++) {
        const x = i * binWidth + offsetX;
        if (x + binWidth < 0 || x > width) continue;
        const posH = p.positive[i] * centerY;
        const negH = -p.negative[i] * centerY;
        ctx.fillRect(x, centerY - posH, Math.max(binWidth - 0.5, 1), posH + negH);
      }
      ctx.globalAlpha = 1;
    };

    // メイン波形
    if (peaks) {
      drawWaveform(peaks, color);
    }

    // オーバーレイ波形（overlayOffsetぶんずらして描画）
    if (overlayPeaks && overlayColor) {
      drawWaveform(overlayPeaks, overlayColor, 0.5, overlayOffset);
    }

    // プレイヘッド
    if (peaks && duration > 0) {
      const progress = currentTime / duration;
      const playheadX = progress * width;
      ctx.strokeStyle = COLORS.playhead;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(playheadX, 0);
      ctx.lineTo(playheadX, height);
      ctx.stroke();
    }
  }, [peaks, color, currentTime, duration, height, overlayPeaks, overlayColor, overlayOffset]);

  useEffect(() => {
    draw();
  }, [draw]);

  // リサイズ対応
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(() => {
      draw();
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [draw]);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onSeek || !peaks || duration <= 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const ratio = x / rect.width;
    onSeek(ratio * duration);
  };

  return (
    <div ref={containerRef} className="w-full" style={{ height }}>
      <canvas
        ref={canvasRef}
        onClick={handleClick}
        className="cursor-pointer rounded"
        data-testid="waveform-canvas"
        style={{ width: "100%", height: "100%" }}
      />
    </div>
  );
}
