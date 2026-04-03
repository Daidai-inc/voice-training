"use client";

import { useEffect, useRef, useCallback, useState } from "react";
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
  onOverlayOffsetChange?: (newOffset: number) => void; // ドラッグでオフセット変更
  // 範囲選択
  selectionStart?: number | null; // 秒
  selectionEnd?: number | null;   // 秒
  onSelectionChange?: (start: number, end: number) => void;
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
  onOverlayOffsetChange,
  selectionStart,
  selectionEnd,
  onSelectionChange,
}: WaveformCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // ドラッグ状態
  const dragRef = useRef<{ startX: number; startOffset: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const gestureOwnerRef = useRef(false); // このインスタンスがmousedownを受けたか

  // 範囲選択状態
  const selectionDragRef = useRef<{ startX: number; startTime: number } | null>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const width = Math.floor(rect.width);

    if (width === 0) {
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

    // 波形描画関数
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

    // オーバーレイ波形
    if (overlayPeaks && overlayColor) {
      drawWaveform(overlayPeaks, overlayColor, 0.5, overlayOffset);

      // ドラッグ可能インジケーター（オフセット変更対応時）
      if (onOverlayOffsetChange) {
        const offsetX = duration > 0 ? (overlayOffset / duration) * width : 0;
        ctx.strokeStyle = overlayColor;
        ctx.globalAlpha = 0.6;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(offsetX, 0);
        ctx.lineTo(offsetX, height);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;

        // ラベル
        ctx.fillStyle = overlayColor;
        ctx.globalAlpha = 0.8;
        ctx.font = "9px sans-serif";
        ctx.fillText(`drag to adjust`, Math.max(2, offsetX + 4), 12);
        ctx.globalAlpha = 1;
      }
    }

    // 範囲選択ハイライト
    if (duration > 0 && selectionStart != null && selectionEnd != null) {
      const x1 = (selectionStart / duration) * width;
      const x2 = (selectionEnd / duration) * width;
      const sx = Math.min(x1, x2);
      const sw = Math.abs(x2 - x1);
      ctx.fillStyle = "rgba(255,255,255,0.15)";
      ctx.fillRect(sx, 0, sw, height);
      // 端のハンドル
      ctx.strokeStyle = "rgba(255,255,255,0.6)";
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx, height); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(sx + sw, 0); ctx.lineTo(sx + sw, height); ctx.stroke();
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
  }, [peaks, color, currentTime, duration, height, overlayPeaks, overlayColor, overlayOffset,
      onOverlayOffsetChange, selectionStart, selectionEnd]);

  useEffect(() => { draw(); }, [draw]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => draw());
    observer.observe(container);
    return () => observer.disconnect();
  }, [draw]);

  const dragMovedRef = useRef(false); // 実際にドラッグ移動したか

  // マウスダウン
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || duration <= 0) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const clickTime = (x / rect.width) * duration;
    dragMovedRef.current = false;
    gestureOwnerRef.current = true; // このインスタンスがジェスチャーを開始

    if (onOverlayOffsetChange) {
      // オーバーレイ波形の存在範囲（offsetX以降）をクリックした場合のみオフセットドラッグ
      // それ以外（空白部分）は範囲選択に渡す（P1修正）
      const offsetX = duration > 0 ? (overlayOffset / duration) * (canvasRef.current?.getBoundingClientRect().width ?? 1) : 0;
      if (x >= offsetX - 10) {
        dragRef.current = { startX: e.clientX, startOffset: overlayOffset };
        setIsDragging(true);
        return;
      }
    }

    if (onSelectionChange) {
      selectionDragRef.current = { startX: x, startTime: clickTime };
      return;
    }
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (dragRef.current && onOverlayOffsetChange) {
      const canvas = canvasRef.current;
      if (!canvas || duration <= 0) return;
      const rect = canvas.getBoundingClientRect();
      const dx = e.clientX - dragRef.current.startX;
      if (Math.abs(dx) > 3) dragMovedRef.current = true;
      const deltaSec = (dx / rect.width) * duration;
      const newOffset = +(dragRef.current.startOffset + deltaSec).toFixed(2);
      onOverlayOffsetChange(newOffset);
    }

    if (selectionDragRef.current && onSelectionChange) {
      const canvas = canvasRef.current;
      if (!canvas || duration <= 0) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const dx = x - selectionDragRef.current.startX;
      if (Math.abs(dx) > 5) dragMovedRef.current = true;
      const t = Math.max(0, Math.min((x / rect.width) * duration, duration));
      onSelectionChange(
        Math.min(selectionDragRef.current.startTime, t),
        Math.max(selectionDragRef.current.startTime, t)
      );
    }
  }, [onOverlayOffsetChange, onSelectionChange, duration]);

  const handleMouseUp = useCallback((e: MouseEvent) => {
    // このインスタンスがジェスチャーを開始していない場合は無視（P1修正）
    if (!gestureOwnerRef.current) return;
    gestureOwnerRef.current = false;

    // ドラッグ距離が小さければシークとして扱う
    if (!dragMovedRef.current && onSeek && peaks) {
      const canvas = canvasRef.current;
      if (canvas && duration > 0) {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        if (x >= 0 && x <= rect.width) {
          onSeek((x / rect.width) * duration);
        }
      }
    }
    dragRef.current = null;
    selectionDragRef.current = null;
    setIsDragging(false);
  }, [onSeek, peaks, duration]);

  useEffect(() => {
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  const cursor = onOverlayOffsetChange
    ? isDragging ? "grabbing" : "grab"
    : onSelectionChange
    ? "crosshair"
    : "pointer";

  return (
    <div ref={containerRef} className="w-full" style={{ height }}>
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        className="rounded"
        data-testid="waveform-canvas"
        style={{ width: "100%", height: "100%", cursor }}
      />
    </div>
  );
}
