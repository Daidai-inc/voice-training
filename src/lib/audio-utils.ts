import { WaveformPeaks } from "@/types/audio";

/**
 * AudioBufferから表示用のピークデータを生成する
 * 各ピクセルに対応するサンプル範囲のmin/maxを計算
 */
export function extractPeaks(
  buffer: AudioBuffer,
  targetWidth: number
): WaveformPeaks {
  const channelData = buffer.getChannelData(0);
  const samplesPerPixel = Math.floor(channelData.length / targetWidth);
  const positive = new Float32Array(targetWidth);
  const negative = new Float32Array(targetWidth);

  for (let i = 0; i < targetWidth; i++) {
    const start = i * samplesPerPixel;
    const end = Math.min(start + samplesPerPixel, channelData.length);
    let max = -1;
    let min = 1;

    for (let j = start; j < end; j++) {
      const val = channelData[j];
      if (val > max) max = val;
      if (val < min) min = val;
    }

    positive[i] = max;
    negative[i] = min;
  }

  return { positive, negative };
}

/**
 * 秒数をmm:ss形式にフォーマット
 */
export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

/**
 * ファイルからAudioBufferをデコード
 */
export async function decodeAudioFile(
  file: File,
  audioContext: AudioContext
): Promise<AudioBuffer> {
  const arrayBuffer = await file.arrayBuffer();
  return audioContext.decodeAudioData(arrayBuffer);
}
