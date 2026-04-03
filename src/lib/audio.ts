import { WaveformPeaks } from "@/types/audio";

// モジュールレベルのAudioContext（シングルトン）
let audioContext: AudioContext | null = null;

export async function getAudioContext(): Promise<AudioContext> {
  if (!audioContext) {
    audioContext = new AudioContext({ sampleRate: 44100 });
  }
  if (audioContext.state === "suspended") {
    await audioContext.resume();
  }
  return audioContext;
}

export async function decodeAudioFile(file: File): Promise<AudioBuffer> {
  const ctx = await getAudioContext();
  const arrayBuffer = await file.arrayBuffer();
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

export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
