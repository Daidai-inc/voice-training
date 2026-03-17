"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { WaveformPeaks } from "@/types/audio";
import { extractPeaks, formatTime } from "@/lib/audio-utils";
import { COLORS } from "@/lib/constants";

interface AlignmentViewProps {
  buffer1: AudioBuffer;
  buffer2: AudioBuffer;
  /** トラック2の開始オフセット（秒） — buffer1のタイムライン上の位置 */
  offset: number;
  onOffsetChange: (offset: number) => void;
}

export default function AlignmentView({
  buffer1,
  buffer2,
  offset,
  onOffsetChange,
}: AlignmentViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, offset: 0 });

  // ズーム: 1px あたり何秒か（pixelsPerSecond の逆数的な管理）
  const [pixelsPerSecond, setPixelsPerSecond] = useState(0);

  const dur1 = buffer1.duration;
  const dur2 = buffer2.duration;

  // 全体のタイムライン長（秒）: トラック1の長さ + 前後にパディング
  const padding = Math.max(dur2, 5); // トラック2をはみ出しても良いようにパディング
  const totalDuration = dur1 + padding * 2;

  // コンテナ幅からpixelsPerSecondを初期化
  useEffect(() => {
    if (!containerRef.current) return;
    const width = containerRef.current.getBoundingClientRect().width;
    // 初期値: トラック1が画面の70%を占めるくらい
    setPixelsPerSecond(Math.max((width * 0.7) / dur1, 5));
  }, [dur1]);

  const canvasWidth = Math.max(totalDuration * pixelsPerSecond, 100);
  const canvasHeight = 180;

  // ピークデータ
  const peaks1 = useMemo(
    () => extractPeaks(buffer1, Math.floor(dur1 * pixelsPerSecond)),
    [buffer1, dur1, pixelsPerSecond]
  );
  const peaks2 = useMemo(
    () => extractPeaks(buffer2, Math.floor(dur2 * pixelsPerSecond)),
    [buffer2, dur2, pixelsPerSecond]
  );

  // トラック1のX開始位置（パディング分ずらす）
  const track1StartX = padding * pixelsPerSecond;
  // トラック2のX開始位置
  const track2StartX = (padding + offset) * pixelsPerSecond;
  const track2Width = dur2 * pixelsPerSecond;

  // 描画
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvasWidth * dpr;
    canvas.height = canvasHeight * dpr;
    canvas.style.width = `${canvasWidth}px`;
    canvas.style.height = `${canvasHeight}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    // 背景
    ctx.fillStyle = COLORS.surface;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    const halfH = canvasHeight / 2;
    const trackH = halfH - 10;

    // タイムラインの目盛り
    drawTimeline(ctx, canvasWidth, canvasHeight, pixelsPerSecond, padding);

    // トラック1の波形（上半分）
    ctx.save();
    ctx.translate(track1StartX, 5);
    drawWaveform(ctx, peaks1, trackH, COLORS.brand, 0.7);
    ctx.restore();

    // トラック2の波形（下半分）— ドラッグ可能な領域を強調
    ctx.save();
    ctx.translate(track2StartX, halfH + 5);

    // 背景ハイライト（ドラッグ可能を示す）
    ctx.fillStyle = isDragging
      ? "rgba(59, 130, 246, 0.15)"
      : "rgba(59, 130, 246, 0.05)";
    ctx.fillRect(-4, -5, track2Width + 8, trackH + 10);

    // ドラッグハンドル（左端に矢印）
    ctx.fillStyle = COLORS.reference;
    ctx.beginPath();
    ctx.moveTo(-2, trackH / 2 - 10);
    ctx.lineTo(-2, trackH / 2 + 10);
    ctx.lineTo(6, trackH / 2);
    ctx.closePath();
    ctx.fill();

    drawWaveform(ctx, peaks2, trackH, COLORS.reference, 0.7);
    ctx.restore();

    // 位置合わせ線（トラック2の開始位置）
    ctx.strokeStyle = COLORS.reference;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(track2StartX, 0);
    ctx.lineTo(track2StartX, canvasHeight);
    ctx.stroke();
    ctx.setLineDash([]);

    // ラベル
    ctx.font = "11px system-ui, sans-serif";
    ctx.fillStyle = COLORS.brand;
    ctx.fillText("トラック 1", track1StartX + 4, 16);
    ctx.fillStyle = COLORS.reference;
    ctx.fillText(
      `トラック 2 (${offset >= 0 ? "+" : ""}${offset.toFixed(1)}秒)`,
      track2StartX + 4,
      halfH + 16
    );

    // ドラッグヒント
    if (!isDragging) {
      ctx.fillStyle = "rgba(148, 163, 184, 0.6)";
      ctx.font = "10px system-ui, sans-serif";
      ctx.fillText("← ドラッグで位置調整 →", track2StartX + 4, canvasHeight - 6);
    }
  }, [
    canvasWidth,
    canvasHeight,
    peaks1,
    peaks2,
    track1StartX,
    track2StartX,
    track2Width,
    pixelsPerSecond,
    padding,
    offset,
    isDragging,
  ]);

  useEffect(() => {
    draw();
  }, [draw]);

  // ドラッグ操作
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left + (containerRef.current?.scrollLeft ?? 0);
      const y = e.clientY - rect.top;

      // トラック2の領域内かチェック（下半分）
      const halfH = canvasHeight / 2;
      if (y < halfH) return; // 上半分はスルー

      setIsDragging(true);
      dragStartRef.current = { x, offset };
      canvas.setPointerCapture(e.pointerId);
    },
    [offset, canvasHeight]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging || !canvasRef.current) return;

      const rect = canvasRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left + (containerRef.current?.scrollLeft ?? 0);
      const dx = x - dragStartRef.current.x;
      const dtSeconds = dx / pixelsPerSecond;
      const newOffset = dragStartRef.current.offset + dtSeconds;

      // 制限: トラック2はトラック1の範囲内 ± 少し
      const minOffset = -dur2 * 0.5;
      const maxOffset = dur1 + dur2 * 0.5;
      onOffsetChange(
        Math.round(Math.max(minOffset, Math.min(maxOffset, newOffset)) * 10) / 10
      );
    },
    [isDragging, pixelsPerSecond, dur1, dur2, onOffsetChange]
  );

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // ズームコントロール
  const handleZoomIn = useCallback(() => {
    setPixelsPerSecond((prev) => Math.min(prev * 1.5, 200));
  }, []);

  const handleZoomOut = useCallback(() => {
    setPixelsPerSecond((prev) => Math.max(prev / 1.5, 2));
  }, []);

  // トラック2の位置までスクロール
  useEffect(() => {
    if (!containerRef.current || isDragging) return;
    const scrollTo = Math.max(0, track2StartX - 100);
    containerRef.current.scrollLeft = scrollTo;
  }, [track2StartX, isDragging]);

  return (
    <div className="space-y-2">
      {/* ズーム + オフセット表示 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={handleZoomOut}
            className="w-7 h-7 flex items-center justify-center rounded bg-[var(--color-surface-light)] text-[var(--color-text-muted)] hover:text-white text-sm transition-colors"
          >
            -
          </button>
          <button
            onClick={handleZoomIn}
            className="w-7 h-7 flex items-center justify-center rounded bg-[var(--color-surface-light)] text-[var(--color-text-muted)] hover:text-white text-sm transition-colors"
          >
            +
          </button>
          <span className="text-[10px] text-[var(--color-text-muted)]">ズーム</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--color-text-muted)]">
            開始位置: {formatTime(offset)}
            {offset > 0 && ` (トラック1の ${formatTime(offset)} 地点から)`}
          </span>
          <button
            onClick={() => onOffsetChange(0)}
            className="text-[10px] text-[var(--color-text-muted)] hover:text-white transition-colors px-1.5 py-0.5 rounded bg-[var(--color-surface-light)]"
          >
            リセット
          </button>
        </div>
      </div>

      {/* 波形タイムライン（横スクロール） */}
      <div
        ref={containerRef}
        className="overflow-x-auto rounded-lg border border-gray-700"
        style={{ cursor: isDragging ? "grabbing" : "default" }}
      >
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          style={{ cursor: "grab" }}
        />
      </div>
    </div>
  );
}

function drawWaveform(
  ctx: CanvasRenderingContext2D,
  peaks: WaveformPeaks,
  height: number,
  color: string,
  alpha: number
) {
  const centerY = height / 2;
  ctx.fillStyle = color;
  ctx.globalAlpha = alpha;

  for (let i = 0; i < peaks.positive.length; i++) {
    const top = centerY - peaks.positive[i] * centerY;
    const bottom = centerY - peaks.negative[i] * centerY;
    ctx.fillRect(i, top, 1, Math.max(bottom - top, 1));
  }

  ctx.globalAlpha = 1;
}

function drawTimeline(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  pps: number,
  padding: number
) {
  // 目盛り間隔を自動調整
  let interval = 1;
  if (pps < 5) interval = 30;
  else if (pps < 10) interval = 15;
  else if (pps < 20) interval = 10;
  else if (pps < 50) interval = 5;
  else if (pps < 100) interval = 2;

  ctx.strokeStyle = "rgba(148, 163, 184, 0.1)";
  ctx.fillStyle = "rgba(148, 163, 184, 0.4)";
  ctx.font = "9px system-ui, sans-serif";
  ctx.lineWidth = 0.5;

  const startSec = -padding;
  const endSec = width / pps - padding;
  const firstTick = Math.ceil(startSec / interval) * interval;

  for (let sec = firstTick; sec <= endSec; sec += interval) {
    const x = (sec + padding) * pps;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();

    if (sec >= 0) {
      ctx.fillText(formatTime(sec), x + 2, height - 2);
    }
  }
}
