"use client";

import { formatTime } from "@/lib/audio-utils";

interface TransportControlsProps {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  disabled?: boolean;
}

export default function TransportControls({
  isPlaying,
  currentTime,
  duration,
  onPlay,
  onPause,
  onStop,
  disabled = false,
}: TransportControlsProps) {
  return (
    <div className="flex items-center gap-3">
      {/* Play / Pause */}
      <button
        onClick={isPlaying ? onPause : onPlay}
        disabled={disabled}
        className={`
          flex items-center justify-center w-10 h-10 rounded-full
          transition-colors
          ${
            disabled
              ? "bg-gray-700 cursor-not-allowed opacity-50"
              : "bg-[var(--color-surface-light)] hover:bg-[var(--color-reference)]"
          }
        `}
      >
        {isPlaying ? (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="white">
            <rect x="3" y="2" width="4" height="12" rx="1" />
            <rect x="9" y="2" width="4" height="12" rx="1" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="white">
            <polygon points="4,2 14,8 4,14" />
          </svg>
        )}
      </button>

      {/* Stop */}
      <button
        onClick={onStop}
        disabled={disabled}
        className={`
          flex items-center justify-center w-10 h-10 rounded-full
          transition-colors
          ${
            disabled
              ? "bg-gray-700 cursor-not-allowed opacity-50"
              : "bg-[var(--color-surface-light)] hover:bg-gray-600"
          }
        `}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="white">
          <rect x="2" y="2" width="10" height="10" rx="1" />
        </svg>
      </button>

      {/* Time display */}
      <span className="text-xs text-[var(--color-text-muted)] font-mono min-w-[80px]">
        {formatTime(currentTime)} / {formatTime(duration)}
      </span>
    </div>
  );
}
