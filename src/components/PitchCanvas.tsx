"use client";

import { useRef, useEffect, useCallback } from "react";
import { PitchPoint, frequencyToMidi } from "@/lib/pitch-detector";
import { COLORS } from "@/lib/constants";

interface PitchCanvasProps {
  pitchData?: PitchPoint[];
  color?: string;
  label?: string;
  duration?: number;
  recordedPitch?: PitchPoint[];
  referencePitch?: PitchPoint[];
  recordedDuration?: number;
  referenceDuration?: number;
  color1?: string;
  color2?: string;
  playbackProgress?: number;
  height?: number;
  mode?: "single" | "comparison";
}

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export default function PitchCanvas({
  pitchData,
  color = "#FF6B35",
  label,
  duration = 1,
  recordedPitch,
  referencePitch,
  recordedDuration = 1,
  referenceDuration = 1,
  color1 = "#FF6B35",
  color2 = "#3B82F6",
  playbackProgress,
  height = 200,
  mode = "single",
}: PitchCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const width = container.offsetWidth;
    if (width <= 0) {
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

    ctx.fillStyle = COLORS.surface;
    ctx.fillRect(0, 0, width, height);

    if (mode === "comparison" && recordedPitch && referencePitch) {
      drawComparison(ctx, width, height, recordedPitch, referencePitch, recordedDuration, referenceDuration, color1, color2, playbackProgress);
    } else if (pitchData && pitchData.length > 0) {
      drawSingle(ctx, width, height, pitchData, color, duration, label, playbackProgress);
    } else {
      ctx.font = "13px system-ui, sans-serif";
      ctx.fillStyle = COLORS.textMuted;
      ctx.textAlign = "center";
      ctx.fillText("ピッチデータがありません", width / 2, height / 2);
    }
  }, [pitchData, color, label, duration, recordedPitch, referencePitch, recordedDuration, referenceDuration, color1, color2, playbackProgress, height, mode]);

  useEffect(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [draw]);

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
    <div ref={containerRef} className="w-full rounded-lg overflow-hidden" style={{ minHeight: height }}>
      <canvas ref={canvasRef} className="block" />
    </div>
  );
}

function getValidRange(points: PitchPoint[]): { minMidi: number; maxMidi: number } | null {
  const valid = points.filter(p => p.frequency > 0);
  if (valid.length === 0) return null;
  const midis = valid.map(p => frequencyToMidi(p.frequency));
  return {
    minMidi: Math.floor(Math.min(...midis)) - 2,
    maxMidi: Math.ceil(Math.max(...midis)) + 2,
  };
}

function drawGrid(ctx: CanvasRenderingContext2D, width: number, height: number, minMidi: number, maxMidi: number) {
  const range = maxMidi - minMidi;
  ctx.font = "10px system-ui, sans-serif";
  for (let midi = Math.ceil(minMidi); midi <= Math.floor(maxMidi); midi++) {
    const noteIndex = ((midi % 12) + 12) % 12;
    const octave = Math.floor(midi / 12) - 1;
    const y = height - ((midi - minMidi) / range) * (height - 40) - 20;
    ctx.strokeStyle = noteIndex === 0 ? "rgba(148,163,184,0.25)" : COLORS.gridLine;
    ctx.lineWidth = noteIndex === 0 ? 1.5 : 0.5;
    ctx.beginPath();
    ctx.moveTo(30, y);
    ctx.lineTo(width, y);
    ctx.stroke();
    if (noteIndex === 0 || noteIndex === 4 || noteIndex === 7) {
      ctx.fillStyle = COLORS.textMuted;
      ctx.fillText(`${NOTE_NAMES[noteIndex]}${octave}`, 2, y + 4);
    }
  }
}

function drawPitchLine(ctx: CanvasRenderingContext2D, data: PitchPoint[], width: number, height: number, dur: number, color: string, alpha: number, minMidi: number, range: number) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.globalAlpha = alpha;
  ctx.lineJoin = "round";
  ctx.beginPath();
  let started = false;
  for (const p of data) {
    if (p.frequency <= 0) { started = false; continue; }
    const x = (p.time / dur) * width;
    const midi = frequencyToMidi(p.frequency);
    const y = height - ((midi - minMidi) / range) * (height - 40) - 20;
    if (!started) { ctx.moveTo(x, y); started = true; }
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function drawSingle(ctx: CanvasRenderingContext2D, width: number, height: number, data: PitchPoint[], color: string, duration: number, label?: string, progress?: number) {
  const range = getValidRange(data);
  if (!range) return;
  drawGrid(ctx, width, height, range.minMidi, range.maxMidi);
  drawPitchLine(ctx, data, width, height, duration, color, 0.8, range.minMidi, range.maxMidi - range.minMidi);
  if (progress !== undefined && progress > 0) {
    ctx.strokeStyle = COLORS.playhead;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(progress * width, 0);
    ctx.lineTo(progress * width, height);
    ctx.stroke();
  }
  if (label) {
    ctx.font = "12px system-ui, sans-serif";
    ctx.fillStyle = color;
    ctx.fillText(label, 8, 18);
  }
}

function drawComparison(ctx: CanvasRenderingContext2D, width: number, height: number, rec: PitchPoint[], ref: PitchPoint[], recDur: number, refDur: number, c1: string, c2: string, progress?: number) {
  const allValid = [...rec.filter(p => p.frequency > 0), ...ref.filter(p => p.frequency > 0)];
  if (allValid.length === 0) return;
  const midis = allValid.map(p => frequencyToMidi(p.frequency));
  const minMidi = Math.floor(Math.min(...midis)) - 2;
  const maxMidi = Math.ceil(Math.max(...midis)) + 2;
  const midiRange = maxMidi - minMidi;
  drawGrid(ctx, width, height, minMidi, maxMidi);
  drawPitchLine(ctx, ref, width, height, refDur, c2, 0.5, minMidi, midiRange);
  drawPitchLine(ctx, rec, width, height, recDur, c1, 0.8, minMidi, midiRange);
  if (progress !== undefined && progress > 0) {
    ctx.strokeStyle = COLORS.playhead;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.moveTo(progress * width, 0);
    ctx.lineTo(progress * width, height);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.font = "11px system-ui, sans-serif";
  ctx.fillStyle = c1;
  ctx.fillRect(width - 160, 6, 10, 10);
  ctx.fillText("トラック 1", width - 146, 14);
  ctx.fillStyle = c2;
  ctx.fillRect(width - 70, 6, 10, 10);
  ctx.fillText("トラック 2", width - 56, 14);
}
