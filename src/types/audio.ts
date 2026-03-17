export type RecordingState = "idle" | "recording" | "processing" | "done" | "error";
export type ViewMode = "side-by-side" | "overlay";

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
