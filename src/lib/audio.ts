import { WaveformPeaks, PitchCurve, VoiceScore, VibratoInfo } from "@/types/audio";

// モジュールレベルのAudioContext（シングルトン）
let audioContext: AudioContext | null = null;

export async function getAudioContext(): Promise<AudioContext> {
  // closedになったContextは再生成（定期的なロード失敗の根本原因）
  if (audioContext && audioContext.state === "closed") {
    audioContext = null;
  }
  if (!audioContext) {
    audioContext = new AudioContext({ sampleRate: 44100 });
  }
  if (audioContext.state === "suspended") {
    await audioContext.resume();
  }
  return audioContext;
}

export async function decodeAudioFile(file: File): Promise<AudioBuffer> {
  // arrayBuffer取得を先に行う（AudioContext生成前に済ませることでジェスチャーコンテキストを温存）
  // Autoplay Policy: getAudioContext()のresume()はユーザージェスチャーの同期スタック内である必要がある
  // file.arrayBuffer()を後に回すとSafari等でContextが再suspendされる
  const arrayBuffer = await file.arrayBuffer();
  const ctx = await getAudioContext();
  return ctx.decodeAudioData(arrayBuffer);
}

export function extractPeaks(buffer: AudioBuffer, numBins: number): WaveformPeaks {
  const channelData = buffer.getChannelData(0);
  const samplesPerBin = Math.floor(channelData.length / numBins);
  const positive = new Float32Array(numBins);
  const negative = new Float32Array(numBins);

  for (let i = 0; i < numBins; i++) {
    let max = 0;
    let min = 0;
    const start = i * samplesPerBin;
    const end = Math.min(start + samplesPerBin, channelData.length);
    for (let j = start; j < end; j++) {
      const v = channelData[j];
      if (v > max) max = v;
      if (v < min) min = v;
    }
    positive[i] = max;
    negative[i] = min;
  }

  return { positive, negative };
}

// 再生用のSourceNodeとGainNodeを作成（呼び出し前にgetAudioContext()をawait済み前提）
export function createPlaybackNodes(
  ctx: AudioContext,
  buffer: AudioBuffer,
  volume: number,
  startTime: number
): { source: AudioBufferSourceNode; gain: GainNode } {
  const source = ctx.createBufferSource();
  const gain = ctx.createGain();

  source.buffer = buffer;
  gain.gain.value = volume;
  source.connect(gain);
  gain.connect(ctx.destination);

  return { source, gain };
}

// 録音用
export async function startRecording(): Promise<{
  mediaRecorder: MediaRecorder;
  chunks: Blob[];
}> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mediaRecorder = new MediaRecorder(stream);
  const chunks: Blob[] = [];

  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  mediaRecorder.start();
  return { mediaRecorder, chunks };
}

export async function stopRecording(
  mediaRecorder: MediaRecorder,
  chunks: Blob[]
): Promise<AudioBuffer> {
  return new Promise((resolve, reject) => {
    mediaRecorder.onstop = async () => {
      try {
        // ストリームを停止
        mediaRecorder.stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: "audio/webm" });
        const arrayBuffer = await blob.arrayBuffer();
        const ctx = await getAudioContext();
        const buffer = await ctx.decodeAudioData(arrayBuffer);
        resolve(buffer);
      } catch (e) {
        reject(e);
      }
    };
    mediaRecorder.stop();
  });
}

// ピッチ解析（手動トリガー、メインスレッド）
export function analyzePitch(
  buffer: AudioBuffer,
  onProgress?: (pct: number) => void
): Float32Array {
  const data = buffer.getChannelData(0);
  const sampleRate = buffer.sampleRate;
  const hopSize = 512;
  const windowSize = 2048;
  const numFrames = Math.floor((data.length - windowSize) / hopSize);
  const pitches = new Float32Array(numFrames);

  for (let i = 0; i < numFrames; i++) {
    const start = i * hopSize;
    pitches[i] = detectPitchACF(data, start, windowSize, sampleRate);
    if (onProgress && i % 100 === 0) {
      onProgress(i / numFrames);
    }
  }

  return pitches;
}

function detectPitchACF(
  data: Float32Array,
  offset: number,
  windowSize: number,
  sampleRate: number
): number {
  const minPeriod = Math.floor(sampleRate / 1000); // 1000Hz
  const maxPeriod = Math.floor(sampleRate / 50); // 50Hz

  let bestCorrelation = 0;
  let bestPeriod = 0;

  for (let period = minPeriod; period < maxPeriod && period < windowSize; period++) {
    let correlation = 0;
    let norm1 = 0;
    let norm2 = 0;
    for (let j = 0; j < windowSize - period; j++) {
      const idx1 = offset + j;
      const idx2 = offset + j + period;
      if (idx2 >= data.length) break;
      correlation += data[idx1] * data[idx2];
      norm1 += data[idx1] * data[idx1];
      norm2 += data[idx2] * data[idx2];
    }
    const denom = Math.sqrt(norm1 * norm2);
    if (denom > 0) {
      correlation /= denom;
    }
    if (correlation > bestCorrelation) {
      bestCorrelation = correlation;
      bestPeriod = period;
    }
  }

  if (bestCorrelation > 0.8 && bestPeriod > 0) {
    return sampleRate / bestPeriod;
  }
  return 0;
}

// ピッチをHzからセントに変換（A4=440Hz基準）
export function hzToCents(hz: number): number {
  if (hz <= 0) return 0;
  return 1200 * Math.log2(hz / 440);
}

// ピッチカーブを抽出（ACFベース）
// hopSize=2048, windowSize=1024 で軽量化（5分音源で約3秒）
export async function extractPitchCurve(
  buffer: AudioBuffer,
  onProgress?: (pct: number) => void
): Promise<PitchCurve> {
  const data = buffer.getChannelData(0);
  const sampleRate = buffer.sampleRate;
  const hopSize = 2048;  // 512→2048: フレーム数1/4
  const windowSize = 1024; // 2048→1024: 各フレーム計算量1/2
  const numFrames = Math.max(0, Math.floor((data.length - windowSize) / hopSize));

  const pitches = new Float32Array(numFrames);
  const times = new Float32Array(numFrames);

  // チャンク処理でUIをブロックしない（100フレームごとにyield）
  const CHUNK = 100;
  for (let i = 0; i < numFrames; i++) {
    times[i] = (i * hopSize) / sampleRate;
    pitches[i] = detectPitchACF(data, i * hopSize, windowSize, sampleRate);
    if (i % CHUNK === 0) {
      onProgress?.(Math.round((i / numFrames) * 100));
      await new Promise<void>(r => setTimeout(r, 0)); // UIスレッドを解放
    }
  }
  onProgress?.(100);

  return { pitches, times, hopSize, sampleRate };
}

// ビブラート検出（ピッチカーブの周期振動を4〜7Hzで探す）
export function detectVibrato(curve: PitchCurve): VibratoInfo {
  const voiced = curve.pitches.filter(p => p > 0);
  if (voiced.length < 20) return { detected: false, rate: 0, depth: 0 };

  const hopSec = curve.hopSize / curve.sampleRate;
  const cents = Array.from(curve.pitches).map(p => p > 0 ? hzToCents(p) : null);

  // 有声区間の移動平均との差分でビブラート成分を抽出
  const window = 10;
  const deviations: number[] = [];
  for (let i = window; i < cents.length - window; i++) {
    const c = cents[i];
    if (c === null) continue;
    let sum = 0, count = 0;
    for (let j = i - window; j <= i + window; j++) {
      if (cents[j] !== null) { sum += cents[j]!; count++; }
    }
    deviations.push(c - sum / count);
  }

  if (deviations.length < 10) return { detected: false, rate: 0, depth: 0 };

  // ゼロクロス数からビブラートレートを推定
  let crossings = 0;
  for (let i = 1; i < deviations.length; i++) {
    if (deviations[i - 1] * deviations[i] < 0) crossings++;
  }
  const rate = (crossings / 2) / (deviations.length * hopSec);
  const depth = Math.max(...deviations.map(Math.abs));

  const detected = rate >= 4 && rate <= 7 && depth >= 0.5;
  return { detected, rate: +rate.toFixed(1), depth: +depth.toFixed(1) };
}

// 2トラックのピッチカーブからスコアを算出
export function calcVoiceScore(
  curve1: PitchCurve,
  curve2: PitchCurve,
  offset2Sec: number = 0
): VoiceScore {
  // ピッチ精度: 両トラックの有声フレームのセント差が±5以内の割合
  let matchCount = 0, compareCount = 0;
  const centDiffs: number[] = [];

  for (let i = 0; i < curve2.pitches.length; i++) {
    const t2 = curve2.times[i] + offset2Sec;
    const p2 = curve2.pitches[i];
    if (p2 <= 0) continue;

    // curve1の対応フレームを探す
    const idx1 = Math.round((t2 * curve1.sampleRate) / curve1.hopSize);
    if (idx1 < 0 || idx1 >= curve1.pitches.length) continue;
    const p1 = curve1.pitches[idx1];
    if (p1 <= 0) continue;

    const diff = Math.abs(hzToCents(p2) - hzToCents(p1));
    centDiffs.push(diff);
    if (diff <= 50) matchCount++; // ±50セント（半音以内）
    compareCount++;
  }

  const pitchAccuracy = compareCount > 0 ? Math.round((matchCount / compareCount) * 100) : 0;

  // 安定性: ピッチカーブの分散が小さいほど高スコア
  const voiced2 = Array.from(curve2.pitches).filter(p => p > 0).map(hzToCents);
  let stability = 0;
  if (voiced2.length > 1) {
    const mean = voiced2.reduce((a, b) => a + b, 0) / voiced2.length;
    const variance = voiced2.reduce((a, b) => a + (b - mean) ** 2, 0) / voiced2.length;
    stability = Math.max(0, Math.round(100 - Math.sqrt(variance) / 2));
  }

  // タイミング: 有声/無声の遷移タイミングが揃っているか（長さ0の場合はNaN防止）
  const voiced1Ratio = curve1.pitches.length > 0 ? curve1.pitches.filter(p => p > 0).length / curve1.pitches.length : 0;
  const voiced2Ratio = curve2.pitches.length > 0 ? curve2.pitches.filter(p => p > 0).length / curve2.pitches.length : 0;
  const timing = Math.round(100 - Math.abs(voiced1Ratio - voiced2Ratio) * 200);

  // 音域: curve2の音域幅をcurve1と比較
  const validP1 = Array.from(curve1.pitches).filter(p => p > 0);
  const validP2 = Array.from(curve2.pitches).filter(p => p > 0);
  const range1 = validP1.length > 0 ? hzToCents(Math.max(...validP1)) - hzToCents(Math.min(...validP1)) : 0;
  const range2 = validP2.length > 0 ? hzToCents(Math.max(...validP2)) - hzToCents(Math.min(...validP2)) : 0;
  const range = range1 > 0 ? Math.min(100, Math.round((range2 / range1) * 100)) : 0;

  const vibrato = detectVibrato(curve2);

  return {
    pitchAccuracy: Math.max(0, Math.min(100, pitchAccuracy)),
    stability: Math.max(0, Math.min(100, stability)),
    timing: Math.max(0, Math.min(100, timing)),
    range: Math.max(0, Math.min(100, range)),
    vibrato,
  };
}

// ボーカル抽出: センターチャンネル(L+R)/2 + バンドパスフィルタ(80Hz〜5kHz)
export async function extractVocals(buffer: AudioBuffer): Promise<AudioBuffer> {
  const { sampleRate, length } = buffer;

  // ステレオ→センターチャンネル(L+R)/2でボーカル帯域を強調
  const centerData = new Float32Array(length);
  const left = buffer.getChannelData(0);
  if (buffer.numberOfChannels > 1) {
    const right = buffer.getChannelData(1);
    for (let i = 0; i < length; i++) {
      centerData[i] = (left[i] + right[i]) / 2;
    }
  } else {
    centerData.set(left);
  }

  const mono = new AudioBuffer({ length, sampleRate, numberOfChannels: 1 });
  mono.copyToChannel(centerData, 0);

  // OfflineAudioContext でバンドパスフィルタ適用
  const offCtx = new OfflineAudioContext(1, length, sampleRate);
  const src = offCtx.createBufferSource();
  src.buffer = mono;

  const hp = offCtx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 80; // 低音域カット（ベース・キック）

  const lp = offCtx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 5000; // 高音域カット（シンバル等）

  src.connect(hp);
  hp.connect(lp);
  lp.connect(offCtx.destination);
  src.start(0);

  return offCtx.startRendering();
}

export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
