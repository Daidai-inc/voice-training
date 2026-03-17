import { WaveformPeaks } from "@/types/audio";
import { COLORS } from "./constants";

interface RenderOptions {
  width: number;
  height: number;
  color: string;
  peaks?: WaveformPeaks;
  realtimeData?: Float32Array;
  playbackProgress?: number; // 0-1
  label?: string;
}

/**
 * 静的波形（録音済み/アップロード済み音源の全体表示）を描画
 */
export function renderStaticWaveform(
  ctx: CanvasRenderingContext2D,
  options: RenderOptions
) {
  const { width, height, color, peaks, playbackProgress, label } = options;
  if (!peaks) return;

  clearCanvas(ctx, width, height);
  drawCenterLine(ctx, width, height);

  const centerY = height / 2;

  // 波形描画
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.8;

  for (let i = 0; i < peaks.positive.length && i < width; i++) {
    const top = centerY - peaks.positive[i] * centerY;
    const bottom = centerY - peaks.negative[i] * centerY;
    const barHeight = bottom - top;
    ctx.fillRect(i, top, 1, Math.max(barHeight, 1));
  }

  ctx.globalAlpha = 1;

  // 再生位置インジケータ
  if (playbackProgress !== undefined && playbackProgress > 0) {
    const x = playbackProgress * width;
    ctx.strokeStyle = COLORS.playhead;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }

  // ラベル
  if (label) {
    drawLabel(ctx, label, color);
  }
}

/**
 * リアルタイム波形（録音中のマイク入力）を描画
 */
export function renderRealtimeWaveform(
  ctx: CanvasRenderingContext2D,
  options: RenderOptions
) {
  const { width, height, color, realtimeData, label } = options;
  if (!realtimeData) return;

  clearCanvas(ctx, width, height);
  drawCenterLine(ctx, width, height);

  const centerY = height / 2;
  const sliceWidth = width / realtimeData.length;

  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();

  let x = 0;
  for (let i = 0; i < realtimeData.length; i++) {
    const v = realtimeData[i];
    const y = centerY - v * centerY;

    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
    x += sliceWidth;
  }

  ctx.stroke();

  if (label) {
    drawLabel(ctx, label, color);
  }
}

/**
 * 2つの波形をオーバーレイ描画
 */
export function renderOverlay(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  peaks1: WaveformPeaks | undefined,
  peaks2: WaveformPeaks | undefined,
  color1: string,
  color2: string,
  playbackProgress?: number
) {
  clearCanvas(ctx, width, height);
  drawCenterLine(ctx, width, height);

  const centerY = height / 2;

  // 1つ目の波形
  if (peaks1) {
    ctx.fillStyle = color1;
    ctx.globalAlpha = 0.5;
    for (let i = 0; i < peaks1.positive.length && i < width; i++) {
      const top = centerY - peaks1.positive[i] * centerY;
      const bottom = centerY - peaks1.negative[i] * centerY;
      ctx.fillRect(i, top, 1, Math.max(bottom - top, 1));
    }
  }

  // 2つ目の波形
  if (peaks2) {
    ctx.fillStyle = color2;
    ctx.globalAlpha = 0.5;
    for (let i = 0; i < peaks2.positive.length && i < width; i++) {
      const top = centerY - peaks2.positive[i] * centerY;
      const bottom = centerY - peaks2.negative[i] * centerY;
      ctx.fillRect(i, top, 1, Math.max(bottom - top, 1));
    }
  }

  ctx.globalAlpha = 1;

  // 再生位置
  if (playbackProgress !== undefined && playbackProgress > 0) {
    const x = playbackProgress * width;
    ctx.strokeStyle = COLORS.playhead;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }

  // 凡例
  drawLegend(ctx, width, color1, color2);
}

function clearCanvas(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
) {
  ctx.fillStyle = COLORS.surface;
  ctx.fillRect(0, 0, width, height);
}

function drawCenterLine(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
) {
  ctx.strokeStyle = COLORS.centerLine;
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(0, height / 2);
  ctx.lineTo(width, height / 2);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawLabel(
  ctx: CanvasRenderingContext2D,
  label: string,
  color: string
) {
  ctx.font = "12px system-ui, sans-serif";
  ctx.fillStyle = color;
  ctx.fillText(label, 8, 18);
}

function drawLegend(
  ctx: CanvasRenderingContext2D,
  width: number,
  color1: string,
  color2: string
) {
  const y = 14;
  ctx.font = "11px system-ui, sans-serif";

  ctx.fillStyle = color1;
  ctx.fillRect(width - 160, y - 8, 10, 10);
  ctx.fillText("あなたの歌声", width - 146, y);

  ctx.fillStyle = color2;
  ctx.fillRect(width - 70, y - 8, 10, 10);
  ctx.fillText("お手本", width - 56, y);
}
