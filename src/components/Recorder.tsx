"use client";

import { RecordingState } from "@/types/audio";
import { formatTime } from "@/lib/audio-utils";

interface RecorderProps {
  recordingState: RecordingState;
  recordingTime: number;
  onStart: () => void;
  onStop: () => void;
  error: string | null;
}

export default function Recorder({
  recordingState,
  recordingTime,
  onStart,
  onStop,
  error,
}: RecorderProps) {
  const isRecording = recordingState === "recording";
  const isProcessing = recordingState === "processing";

  return (
    <div className="flex items-center gap-4">
      <button
        onClick={isRecording ? onStop : onStart}
        disabled={isProcessing}
        className={`
          flex items-center justify-center w-14 h-14 rounded-full
          transition-all duration-200
          ${
            isRecording
              ? "bg-red-500 hover:bg-red-600 animate-pulse"
              : isProcessing
              ? "bg-gray-500 cursor-not-allowed"
              : "bg-[var(--color-brand)] hover:bg-[var(--color-brand-light)]"
          }
        `}
      >
        {isRecording ? (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="white">
            <rect x="3" y="3" width="14" height="14" rx="2" />
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="white">
            <circle cx="10" cy="10" r="7" />
          </svg>
        )}
      </button>

      <div className="flex flex-col">
        <span className="text-sm text-[var(--color-text-muted)]">
          {isRecording
            ? "録音中..."
            : isProcessing
            ? "処理中..."
            : recordingState === "done"
            ? "録音完了"
            : "録音ボタンを押して開始"}
        </span>
        {(isRecording || recordingState === "done") && (
          <span className="text-xs text-[var(--color-text-muted)]">
            {formatTime(recordingTime)}
          </span>
        )}
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}
    </div>
  );
}
