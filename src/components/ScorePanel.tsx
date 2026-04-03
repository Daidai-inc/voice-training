"use client";

import { useEffect, useRef } from "react";
import { VoiceScore } from "@/types/audio";
import { COLORS } from "@/lib/constants";

interface ScorePanelProps {
  score: VoiceScore;
}

const AXES = [
  { key: "pitchAccuracy", label: "音程精度" },
  { key: "stability",     label: "安定性" },
  { key: "timing",        label: "タイミング" },
  { key: "range",         label: "音域" },
] as const;

export default function ScorePanel({ score }: ScorePanelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const size = 160;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    const cx = size / 2;
    const cy = size / 2;
    const r = size / 2 - 20;
    const n = AXES.length;

    ctx.clearRect(0, 0, size, size);

    // グリッド円
    [0.25, 0.5, 0.75, 1].forEach((frac) => {
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const angle = (2 * Math.PI * i) / n - Math.PI / 2;
        const x = cx + r * frac * Math.cos(angle);
        const y = cy + r * frac * Math.sin(angle);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.strokeStyle = "rgba(255,255,255,0.1)";
      ctx.stroke();
    });

    // 軸
    AXES.forEach((_, i) => {
      const angle = (2 * Math.PI * i) / n - Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + r * Math.cos(angle), cy + r * Math.sin(angle));
      ctx.strokeStyle = "rgba(255,255,255,0.15)";
      ctx.stroke();
    });

    // スコア領域
    ctx.beginPath();
    AXES.forEach(({ key }, i) => {
      const val = score[key] / 100;
      const angle = (2 * Math.PI * i) / n - Math.PI / 2;
      const x = cx + r * val * Math.cos(angle);
      const y = cy + r * val * Math.sin(angle);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fillStyle = `${COLORS.reference}44`;
    ctx.fill();
    ctx.strokeStyle = COLORS.reference;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // ラベル
    ctx.font = "9px sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    AXES.forEach(({ label }, i) => {
      const angle = (2 * Math.PI * i) / n - Math.PI / 2;
      const lx = cx + (r + 14) * Math.cos(angle);
      const ly = cy + (r + 14) * Math.sin(angle);
      ctx.fillText(label, lx, ly);
    });
  }, [score]);

  const overall = Math.round(
    (score.pitchAccuracy + score.stability + score.timing + score.range) / 4
  );

  return (
    <div className="flex items-center gap-6">
      {/* レーダーチャート */}
      <canvas ref={canvasRef} />

      {/* 数値 */}
      <div className="flex-1 space-y-2">
        <div className="text-center">
          <div className="text-3xl font-bold" style={{ color: COLORS.reference }}>{overall}</div>
          <div className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>総合スコア</div>
        </div>
        {AXES.map(({ key, label }) => (
          <div key={key} className="flex items-center gap-2">
            <span className="text-[10px] w-16" style={{ color: "var(--color-text-muted)" }}>{label}</span>
            <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ backgroundColor: "var(--color-surface-light)" }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${score[key]}%`, backgroundColor: COLORS.reference }}
              />
            </div>
            <span className="text-[10px] w-7 text-right font-mono" style={{ color: "var(--color-text-muted)" }}>
              {score[key]}
            </span>
          </div>
        ))}
        {/* ビブラート */}
        <div className="pt-1 border-t" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
          <span className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>
            ビブラート:{" "}
            {score.vibrato.detected
              ? `検出 ${score.vibrato.rate}Hz / 深度${score.vibrato.depth}¢`
              : "未検出"}
          </span>
        </div>
      </div>
    </div>
  );
}
