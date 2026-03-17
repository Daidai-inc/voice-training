import { PitchPoint, frequencyToMidi } from "./pitch-detector";
import { COLORS } from "./constants";

/**
 * ピッチの時系列をCanvasに描画
 */
export function renderPitchContour(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  pitchData: PitchPoint[],
  color: string,
  duration: number,
  label?: string,
  playbackProgress?: number
) {
  clearCanvas(ctx, width, height);

  if (pitchData.length === 0) return;

  // MIDI範囲を自動検出（表示範囲を決める）
  const validPoints = pitchData.filter((p) => p.frequency > 0);
  if (validPoints.length === 0) {
    drawEmptyMessage(ctx, width, height);
    return;
  }

  const midiValues = validPoints.map((p) => frequencyToMidi(p.frequency));
  const minMidi = Math.floor(Math.min(...midiValues)) - 2;
  const maxMidi = Math.ceil(Math.max(...midiValues)) + 2;
  const midiRange = maxMidi - minMidi;

  // グリッド線（音名）
  drawPitchGrid(ctx, width, height, minMidi, maxMidi);

  // ピッチライン描画
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.lineJoin = "round";
  ctx.beginPath();

  let started = false;

  for (const point of pitchData) {
    if (point.frequency <= 0) {
      started = false;
      continue;
    }

    const x = (point.time / duration) * width;
    const midi = frequencyToMidi(point.frequency);
    const y = height - ((midi - minMidi) / midiRange) * (height - 40) - 20;

    if (!started) {
      ctx.moveTo(x, y);
      started = true;
    } else {
      ctx.lineTo(x, y);
    }
  }

  ctx.stroke();

  // ピッチポイントのドット
  ctx.fillStyle = color;
  for (const point of pitchData) {
    if (point.frequency <= 0) continue;
    const x = (point.time / duration) * width;
    const midi = frequencyToMidi(point.frequency);
    const y = height - ((midi - minMidi) / midiRange) * (height - 40) - 20;
    ctx.beginPath();
    ctx.arc(x, y, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }

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

  // ラベル
  if (label) {
    ctx.font = "12px system-ui, sans-serif";
    ctx.fillStyle = color;
    ctx.fillText(label, 8, 18);
  }
}

/**
 * 2つのピッチ曲線を重ねて描画
 */
export function renderPitchComparison(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  recordedPitch: PitchPoint[],
  referencePitch: PitchPoint[],
  recordedDuration: number,
  referenceDuration: number,
  color1: string,
  color2: string,
  playbackProgress?: number
) {
  clearCanvas(ctx, width, height);

  const allValid = [
    ...recordedPitch.filter((p) => p.frequency > 0),
    ...referencePitch.filter((p) => p.frequency > 0),
  ];

  if (allValid.length === 0) {
    drawEmptyMessage(ctx, width, height);
    return;
  }

  const midiValues = allValid.map((p) => frequencyToMidi(p.frequency));
  const minMidi = Math.floor(Math.min(...midiValues)) - 2;
  const maxMidi = Math.ceil(Math.max(...midiValues)) + 2;
  const midiRange = maxMidi - minMidi;

  drawPitchGrid(ctx, width, height, minMidi, maxMidi);

  // お手本を先に描画（下のレイヤー）
  drawPitchLine(
    ctx,
    referencePitch,
    width,
    height,
    referenceDuration,
    color2,
    0.5,
    minMidi,
    midiRange
  );

  // 録音を上に描画
  drawPitchLine(
    ctx,
    recordedPitch,
    width,
    height,
    recordedDuration,
    color1,
    0.8,
    minMidi,
    midiRange
  );

  // 再生位置
  if (playbackProgress !== undefined && playbackProgress > 0) {
    const x = playbackProgress * width;
    ctx.strokeStyle = COLORS.playhead;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }

  // 凡例
  ctx.globalAlpha = 1;
  ctx.font = "11px system-ui, sans-serif";

  ctx.fillStyle = color1;
  ctx.fillRect(width - 160, 6, 10, 10);
  ctx.fillText("あなたの歌声", width - 146, 14);

  ctx.fillStyle = color2;
  ctx.fillRect(width - 70, 6, 10, 10);
  ctx.fillText("お手本", width - 56, 14);
}

function drawPitchLine(
  ctx: CanvasRenderingContext2D,
  pitchData: PitchPoint[],
  width: number,
  height: number,
  duration: number,
  color: string,
  alpha: number,
  minMidi: number,
  midiRange: number
) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.globalAlpha = alpha;
  ctx.lineJoin = "round";
  ctx.beginPath();

  let started = false;
  for (const point of pitchData) {
    if (point.frequency <= 0) {
      started = false;
      continue;
    }

    const x = (point.time / duration) * width;
    const midi = frequencyToMidi(point.frequency);
    const y = height - ((midi - minMidi) / midiRange) * (height - 40) - 20;

    if (!started) {
      ctx.moveTo(x, y);
      started = true;
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.stroke();
}

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

function drawPitchGrid(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  minMidi: number,
  maxMidi: number
) {
  const midiRange = maxMidi - minMidi;

  ctx.strokeStyle = COLORS.gridLine;
  ctx.lineWidth = 1;
  ctx.font = "10px system-ui, sans-serif";
  ctx.fillStyle = COLORS.textMuted;

  // 各音名でグリッド線
  for (let midi = Math.ceil(minMidi); midi <= Math.floor(maxMidi); midi++) {
    const noteIndex = ((midi % 12) + 12) % 12;
    const octave = Math.floor(midi / 12) - 1;
    const noteName = NOTE_NAMES[noteIndex];

    const y = height - ((midi - minMidi) / midiRange) * (height - 40) - 20;

    // Cの音は太い線
    if (noteIndex === 0) {
      ctx.strokeStyle = "rgba(148, 163, 184, 0.25)";
      ctx.lineWidth = 1.5;
    } else {
      ctx.strokeStyle = COLORS.gridLine;
      ctx.lineWidth = 0.5;
    }

    ctx.beginPath();
    ctx.moveTo(30, y);
    ctx.lineTo(width, y);
    ctx.stroke();

    // 音名ラベル（CとEとGだけ表示して見やすくする）
    if (noteIndex === 0 || noteIndex === 4 || noteIndex === 7) {
      ctx.fillText(`${noteName}${octave}`, 2, y + 4);
    }
  }
}

function clearCanvas(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
) {
  ctx.fillStyle = COLORS.surface;
  ctx.fillRect(0, 0, width, height);
}

function drawEmptyMessage(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
) {
  ctx.font = "13px system-ui, sans-serif";
  ctx.fillStyle = COLORS.textMuted;
  ctx.textAlign = "center";
  ctx.fillText("ピッチデータがありません", width / 2, height / 2);
  ctx.textAlign = "start";
}
