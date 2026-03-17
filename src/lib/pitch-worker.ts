import { PitchPoint } from "./pitch-detector";

/**
 * メインスレッドで非同期にピッチ解析を実行
 * setTimeoutでUIスレッドに制御を返しながら分割処理
 */
export function extractPitchDataAsync(
  buffer: AudioBuffer,
  onProgress?: (progress: number) => void
): Promise<PitchPoint[]> {
  return new Promise((resolve) => {
    const channelData = buffer.getChannelData(0);
    const sampleRate = buffer.sampleRate;
    const hopSize = 2048; // 大きめにして処理量削減
    const windowSize = 2048;
    const totalFrames = Math.floor(
      (channelData.length - windowSize) / hopSize
    );
    const points: PitchPoint[] = [];

    const MIN_FREQ = 80;
    const MAX_FREQ = 1000;
    const minLag = Math.floor(sampleRate / MAX_FREQ);
    const maxLag = Math.floor(sampleRate / MIN_FREQ);

    let frameIndex = 0;
    const BATCH_SIZE = 200; // バッチを大きくして setTimeout 回数削減

    function processBatch() {
      const batchEnd = Math.min(frameIndex + BATCH_SIZE, totalFrames);

      for (; frameIndex < batchEnd; frameIndex++) {
        const offset = frameIndex * hopSize;
        const time = offset / sampleRate;

        // RMS チェック（高速化: 4サンプルおきに計算）
        let sumSq = 0;
        for (let j = 0; j < windowSize; j += 4) {
          const v = channelData[offset + j];
          sumSq += v * v;
        }
        const rms = Math.sqrt(sumSq / (windowSize / 4));

        if (rms < 0.01) {
          points.push({ time, frequency: 0, clarity: 0, note: "-", cents: 0 });
          continue;
        }

        // 自己相関法（sliceを避けて直接アクセス）
        let energy0 = 0;
        for (let j = 0; j < windowSize; j++) {
          const v = channelData[offset + j];
          energy0 += v * v;
        }

        let bestCorrelation = 0;
        let bestLag = 0;

        for (let lag = minLag; lag <= maxLag && lag < windowSize; lag++) {
          let correlation = 0;
          let energy1 = 0;

          for (let j = 0; j + lag < windowSize; j++) {
            correlation += channelData[offset + j] * channelData[offset + j + lag];
            energy1 += channelData[offset + j + lag] * channelData[offset + j + lag];
          }

          const norm = Math.sqrt(energy0 * energy1);
          if (norm > 0) correlation /= norm;

          if (correlation > bestCorrelation) {
            bestCorrelation = correlation;
            bestLag = lag;
          }
        }

        if (bestLag > 0 && bestCorrelation > 0.8) {
          const frequency = sampleRate / bestLag;
          const { note, cents } = freqToNote(frequency);
          points.push({ time, frequency, clarity: bestCorrelation, note, cents });
        } else {
          points.push({ time, frequency: 0, clarity: 0, note: "-", cents: 0 });
        }
      }

      const progress = Math.round((frameIndex / totalFrames) * 100);
      onProgress?.(progress);

      if (frameIndex < totalFrames) {
        setTimeout(processBatch, 0);
      } else {
        resolve(points);
      }
    }

    if (totalFrames <= 0) {
      resolve([]);
      return;
    }

    processBatch();
  });
}

const NOTE_NAMES = [
  "C", "C#", "D", "D#", "E", "F",
  "F#", "G", "G#", "A", "A#", "B",
];

function freqToNote(frequency: number): { note: string; cents: number } {
  if (frequency <= 0) return { note: "-", cents: 0 };
  const semitones = 12 * Math.log2(frequency / 440);
  const rounded = Math.round(semitones);
  const cents = Math.round((semitones - rounded) * 100);
  const noteIndex = ((rounded % 12) + 12 + 9) % 12;
  const octave = Math.floor((rounded + 9) / 12) + 4;
  return { note: `${NOTE_NAMES[noteIndex]}${octave}`, cents };
}
