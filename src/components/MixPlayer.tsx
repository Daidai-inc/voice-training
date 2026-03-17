"use client";

import { useState, useCallback } from "react";
import { useAudioContext } from "@/hooks/useAudioContext";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";
import { formatTime } from "@/lib/audio-utils";
import { COLORS } from "@/lib/constants";
import AlignmentView from "./AlignmentView";

interface MixPlayerProps {
  buffer1: AudioBuffer;
  buffer2: AudioBuffer;
  label1: string;
  label2: string;
}

export default function MixPlayer({
  buffer1,
  buffer2,
  label1,
  label2,
}: MixPlayerProps) {
  const { getContext, resume } = useAudioContext();
  const player1 = useAudioPlayer(getContext);
  const player2 = useAudioPlayer(getContext);

  const [offset, setOffset] = useState(0);

  const maxDuration = Math.max(buffer1.duration, buffer2.duration);

  const handlePlay = useCallback(async () => {
    await resume();

    if (offset >= 0) {
      player1.play(buffer1, 0);
      if (offset === 0) {
        player2.play(buffer2, 0);
      } else {
        setTimeout(() => player2.play(buffer2, 0), offset * 1000);
      }
    } else {
      player2.play(buffer2, 0);
      setTimeout(() => player1.play(buffer1, 0), Math.abs(offset) * 1000);
    }
  }, [resume, buffer1, buffer2, player1, player2, offset]);

  const handleStop = useCallback(() => {
    player1.stop();
    player2.stop();
  }, [player1, player2]);

  const handlePause = useCallback(() => {
    player1.pause();
    player2.pause();
  }, [player1, player2]);

  const isMixPlaying = player1.isPlaying || player2.isPlaying;

  return (
    <div className="space-y-4">
      <AlignmentView
        buffer1={buffer1}
        buffer2={buffer2}
        offset={offset}
        onOffsetChange={setOffset}
      />

      <div className="p-4 rounded-lg bg-[var(--color-surface-light)] space-y-4">
        <div className="flex items-center gap-3">
          {isMixPlaying ? (
            <>
              <button
                onClick={handlePause}
                className="flex items-center justify-center w-10 h-10 rounded-full bg-[var(--color-brand)] hover:bg-[var(--color-brand-light)] transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="white">
                  <rect x="3" y="2" width="4" height="12" rx="1" />
                  <rect x="9" y="2" width="4" height="12" rx="1" />
                </svg>
              </button>
              <button
                onClick={handleStop}
                className="flex items-center justify-center w-10 h-10 rounded-full bg-gray-600 hover:bg-gray-500 transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="white">
                  <rect x="2" y="2" width="10" height="10" rx="1" />
                </svg>
              </button>
            </>
          ) : (
            <button
              onClick={handlePlay}
              className="flex items-center justify-center w-10 h-10 rounded-full bg-[var(--color-brand)] hover:bg-[var(--color-brand-light)] transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="white">
                <polygon points="4,2 14,8 4,14" />
              </svg>
            </button>
          )}

          <span className="text-xs text-[var(--color-text-muted)] font-mono">
            {formatTime(Math.max(player1.currentTime, player2.currentTime))} /{" "}
            {formatTime(maxDuration)}
          </span>
        </div>

        <div className="space-y-2">
          <VolumeSlider
            label={label1}
            color={COLORS.brand}
            volume={player1.volume}
            onChange={player1.setVolume}
          />
          <VolumeSlider
            label={label2}
            color={COLORS.reference}
            volume={player2.volume}
            onChange={player2.setVolume}
          />
        </div>
      </div>
    </div>
  );
}

function VolumeSlider({
  label,
  color,
  volume,
  onChange,
}: {
  label: string;
  color: string;
  volume: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs min-w-[72px]" style={{ color }}>
        {label}
      </span>

      <button
        onClick={() => onChange(volume === 0 ? 1 : 0)}
        className="text-[var(--color-text-muted)] hover:text-white transition-colors shrink-0"
      >
        {volume === 0 ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19" />
            <line x1="23" y1="9" x2="17" y2="15" />
            <line x1="17" y1="9" x2="23" y2="15" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19" />
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
          </svg>
        )}
      </button>

      <input
        type="range"
        min={0}
        max={1.5}
        step={0.01}
        value={volume}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer"
        style={{
          background: `linear-gradient(to right, ${color} 0%, ${color} ${(volume / 1.5) * 100}%, #374151 ${(volume / 1.5) * 100}%, #374151 100%)`,
        }}
      />

      <span className="text-[10px] text-[var(--color-text-muted)] font-mono w-8 text-right">
        {Math.round(volume * 100)}%
      </span>
    </div>
  );
}
