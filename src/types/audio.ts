export type RecordingState = "idle" | "recording" | "processing" | "done" | "error";
export type ViewMode = "side-by-side" | "overlay" | "pitch";

export interface PitchCurve {
  pitches: Float32Array; // Hz（0=無声）
  times: Float32Array;   // 秒
  hopSize: number;
  sampleRate: number;
}

export interface VibratoInfo {
  detected: boolean;
  rate: number;   // Hz
  depth: number;  // セント
}

export interface VoiceScore {
  pitchAccuracy: number;  // 0〜100
  stability: number;      // 0〜100
  timing: number;         // 0〜100
  range: number;          // 0〜100
  vibrato: VibratoInfo;
}

export interface AudioTrack {
  buffer: AudioBuffer;
  name: string;
  duration: number;
  sampleRate: number;
}

export interface WaveformPeaks {
  positive: Float32Array;
  negative: Float32Array;
}

export interface TrackState {
  track: AudioTrack | null;
  peaks: WaveformPeaks | null;
  volume: number;
  isPlaying: boolean;
  currentTime: number;
  recordingState: RecordingState;
}
