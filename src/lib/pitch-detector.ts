/**
 * 自己相関法（autocorrelation）によるピッチ検出
 * 人の声の帯域（80Hz〜1000Hz）に絞って検出
 */

const MIN_FREQ = 80; // Hz（低い声）
const MAX_FREQ = 1000; // Hz（高い声）

export interface PitchPoint {
  time: number; // 秒
  frequency: number; // Hz（0 = 無音/検出不能）
  clarity: number; // 0-1（検出の確信度）
  note: string; // "C4", "A3" など
  cents: number; // 音程のズレ（-50〜+50）
}

/**
 * AudioBufferからピッチの時系列データを抽出
 */
export function extractPitchData(
  buffer: AudioBuffer,
  hopSize: number = 512
): PitchPoint[] {
  const sampleRate = buffer.sampleRate;
  const channelData = buffer.getChannelData(0);
  const windowSize = 2048;
  const points: PitchPoint[] = [];

  for (let i = 0; i + windowSize < channelData.length; i += hopSize) {
    const frame = channelData.slice(i, i + windowSize);
    const time = i / sampleRate;

    // RMS（音量）チェック — 無音はスキップ
    const rms = Math.sqrt(
      frame.reduce((sum, v) => sum + v * v, 0) / frame.length
    );
    if (rms < 0.01) {
      points.push({ time, frequency: 0, clarity: 0, note: "-", cents: 0 });
      continue;
    }

    const { frequency, clarity } = detectPitch(frame, sampleRate);

    if (frequency > 0 && clarity > 0.8) {
      const { note, cents } = frequencyToNote(frequency);
      points.push({ time, frequency, clarity, note, cents });
    } else {
      points.push({ time, frequency: 0, clarity: 0, note: "-", cents: 0 });
    }
  }

  return points;
}

/**
 * 自己相関法でピッチを検出
 */
function detectPitch(
  frame: Float32Array,
  sampleRate: number
): { frequency: number; clarity: number } {
  const minLag = Math.floor(sampleRate / MAX_FREQ);
  const maxLag = Math.floor(sampleRate / MIN_FREQ);
  const n = frame.length;

  // 正規化自己相関
  let bestCorrelation = 0;
  let bestLag = 0;

  // 自己相関の基準値（lag=0）
  let energy0 = 0;
  for (let j = 0; j < n; j++) {
    energy0 += frame[j] * frame[j];
  }

  for (let lag = minLag; lag <= maxLag && lag < n; lag++) {
    let correlation = 0;
    let energy1 = 0;

    for (let j = 0; j + lag < n; j++) {
      correlation += frame[j] * frame[j + lag];
      energy1 += frame[j + lag] * frame[j + lag];
    }

    // 正規化
    const norm = Math.sqrt(energy0 * energy1);
    if (norm > 0) {
      correlation /= norm;
    }

    if (correlation > bestCorrelation) {
      bestCorrelation = correlation;
      bestLag = lag;
    }
  }

  if (bestLag === 0 || bestCorrelation < 0.8) {
    return { frequency: 0, clarity: bestCorrelation };
  }

  // 放物線補間で精度向上
  const refinedLag = parabolicInterpolation(frame, bestLag, sampleRate);
  const frequency = sampleRate / refinedLag;

  return { frequency, clarity: bestCorrelation };
}

/**
 * 放物線補間でラグの精度を向上
 */
function parabolicInterpolation(
  frame: Float32Array,
  lag: number,
  sampleRate: number
): number {
  if (lag <= 0 || lag >= frame.length - 1) return lag;

  const n = frame.length;

  const calcCorr = (l: number) => {
    let c = 0;
    for (let j = 0; j + l < n; j++) {
      c += frame[j] * frame[j + l];
    }
    return c;
  };

  const s0 = calcCorr(lag - 1);
  const s1 = calcCorr(lag);
  const s2 = calcCorr(lag + 1);

  const denom = 2 * (2 * s1 - s0 - s2);
  if (Math.abs(denom) < 1e-10) return lag;

  const shift = (s0 - s2) / denom;
  return lag + Math.max(-1, Math.min(1, shift));
}

/**
 * 周波数を音名に変換
 */
const NOTE_NAMES = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
];

export function frequencyToNote(
  frequency: number
): { note: string; cents: number } {
  if (frequency <= 0) return { note: "-", cents: 0 };

  // A4 = 440Hz基準
  const semitones = 12 * Math.log2(frequency / 440);
  const roundedSemitones = Math.round(semitones);
  const cents = Math.round((semitones - roundedSemitones) * 100);

  const noteIndex = ((roundedSemitones % 12) + 12 + 9) % 12; // A=0 → C=0に変換
  const octave = Math.floor((roundedSemitones + 9) / 12) + 4;
  const note = `${NOTE_NAMES[noteIndex]}${octave}`;

  return { note, cents };
}

/**
 * 周波数をMIDIノート番号に変換（描画用）
 */
export function frequencyToMidi(frequency: number): number {
  if (frequency <= 0) return 0;
  return 69 + 12 * Math.log2(frequency / 440);
}

/**
 * リアルタイムピッチ検出（AnalyserNodeのデータから）
 */
export function detectPitchRealtime(
  analyserNode: AnalyserNode
): PitchPoint | null {
  const bufferLength = analyserNode.fftSize;
  const buffer = new Float32Array(bufferLength);
  analyserNode.getFloatTimeDomainData(buffer);

  const rms = Math.sqrt(
    buffer.reduce((sum, v) => sum + v * v, 0) / buffer.length
  );
  if (rms < 0.01) return null;

  const sampleRate = analyserNode.context.sampleRate;
  const { frequency, clarity } = detectPitch(buffer, sampleRate);

  if (frequency > 0 && clarity > 0.8) {
    const { note, cents } = frequencyToNote(frequency);
    return { time: 0, frequency, clarity, note, cents };
  }

  return null;
}
