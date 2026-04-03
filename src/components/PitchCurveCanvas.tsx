"use client";

import { useEffect, useRef, useCallback } from "react";
import { PitchCurve } from "@/types/audio";
import { hzToCents } from "@/lib/audio";
import { COLORS } from "@/lib/constants";

interface PitchCurveCanvasProps {
  curve1: PitchCurve | null;
  curve2: PitchCurve | null;
  offset2Sec?: number;
  currentTime?: number;
  duration?: number;
  height?: number;
  onSeek?: (time: number) => void;
}

export default function PitchCurveCanvas({
  curve1,
  curve2,
  offset2Sec = 0,
  currentTime = 0,
  duration = 0,
  height = 160,
  onSeek,
}: PitchCurveCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    const width = Math.floor(rect.width);
    if (width === 0) { requestAnimationFrame(draw); return; }

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

    // 全有声フレームのセント値を集めて表示範囲を決定
    const allCents: number[] = [];
    [curve1, curve2].forEach(c => {
      if (!c) return;
      for (let i = 0; i < c.pitches.length; i++) {
        if (c.pitches[i] > 0) allCents.push(hzToCents(c.pitches[i]));
      }
    });

    if (allCents.length === 0) {
      ctx.fillStyle = "#555";
      ctx.font = "12px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("ピッチ解析後に表示されます", width / 2, height / 2);
      return;
    }

    const minCents = Math.min(...allCents) - 200;
    const maxCents = Math.max(...allCents) + 200;
    const centsRange = maxCents - minCents;

    const totalDur = duration || 1;
    const timeToX = (t: number) => (t / totalDur) * width;
    const centsToY = (c: number) => height - ((c - minCents) / centsRange) * height;

    // グリッド（半音ごと）
    ctx.strokeStyle = "rgba(255,255,255,0.05)";
    ctx.lineWidth = 1;
    const semitone = 100;
    const startSemi = Math.ceil(minCents / semitone);
    const endSemi = Math.floor(maxCents / semitone);
    for (let s = startSemi; s <= endSemi; s++) {
      const y = centsToY(s * semitone);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // curve1（お手本）を薄く描画
    if (curve1) {
      ctx.strokeStyle = COLORS.brand;
      ctx.globalAlpha = 0.4;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      let started = false;
      for (let i = 0; i < curve1.pitches.length; i++) {
        if (curve1.pitches[i] <= 0) { started = false; continue; }
        const x = timeToX(curve1.times[i]);
        const y = centsToY(hzToCents(curve1.pitches[i]));
        if (!started) { ctx.moveTo(x, y); started = true; }
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // curve2（自分の声）を描画、curve1との差でカラーコーディング
    if (curve2) {
      ctx.lineWidth = 2;
      for (let i = 1; i < curve2.pitches.length; i++) {
        const p2 = curve2.pitches[i];
        if (p2 <= 0) continue;

        const t2 = curve2.times[i] + offset2Sec;
        const x = timeToX(t2);
        const y = centsToY(hzToCents(p2));
        const xPrev = timeToX(curve2.times[i - 1] + offset2Sec);
        const yPrev = curve2.pitches[i - 1] > 0
          ? centsToY(hzToCents(curve2.pitches[i - 1]))
          : y;

        // curve1の対応フレームを探してセント差を算出
        let color: string = COLORS.reference;
        if (curve1) {
          const idx1 = Math.round((t2 * curve1.sampleRate) / curve1.hopSize);
          if (idx1 >= 0 && idx1 < curve1.pitches.length && curve1.pitches[idx1] > 0) {
            const diff = hzToCents(p2) - hzToCents(curve1.pitches[idx1]);
            if (Math.abs(diff) <= 50) {
              color = "#4ade80"; // 緑: ±50セント以内（正確）
            } else if (diff > 50) {
              color = "#f87171"; // 赤: 高すぎ
            } else {
              color = "#60a5fa"; // 青: 低すぎ
            }
          }
        }

        ctx.strokeStyle = color;
        ctx.beginPath();
        ctx.moveTo(xPrev, yPrev);
        ctx.lineTo(x, y);
        ctx.stroke();
      }
    }

    // プレイヘッド
    if (duration > 0) {
      const px = timeToX(currentTime);
      ctx.strokeStyle = "rgba(255,255,255,0.7)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(px, 0);
      ctx.lineTo(px, height);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // 凡例
    const legend = [
      { color: COLORS.brand, label: "お手本", alpha: 0.5 },
      { color: "#4ade80", label: "±半音以内" },
      { color: "#f87171", label: "高すぎ" },
      { color: "#60a5fa", label: "低すぎ" },
    ];
    ctx.font = "9px sans-serif";
    let lx = 6;
    legend.forEach(({ color, label, alpha }) => {
      ctx.globalAlpha = alpha ?? 1;
      ctx.fillStyle = color;
      ctx.fillRect(lx, 4, 10, 4);
      ctx.globalAlpha = 1;
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.fillText(label, lx + 13, 10);
      lx += ctx.measureText(label).width + 26;
    });
  }, [curve1, curve2, offset2Sec, currentTime, duration, height]);

  useEffect(() => { draw(); }, [draw]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => draw());
    observer.observe(container);
    return () => observer.disconnect();
  }, [draw]);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onSeek || duration <= 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    onSeek(((e.clientX - rect.left) / rect.width) * duration);
  };

  return (
    <div ref={containerRef} className="w-full" style={{ height }}>
      <canvas
        ref={canvasRef}
        onClick={handleClick}
        className="rounded cursor-pointer"
        style={{ width: "100%", height: "100%" }}
      />
    </div>
  );
}
