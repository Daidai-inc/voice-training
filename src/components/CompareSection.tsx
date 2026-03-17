"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AudioTrack, WaveformPeaks, ViewMode } from "@/types/audio";
import { formatTime, getAudioContext, createPlaybackNodes } from "@/lib/audio";
import WaveformCanvas from "./WaveformCanvas";
import { COLORS } from "@/lib/constants";

interface CompareSectionProps {
  track1: AudioTrack | null;
  track2: AudioTrack | null;
  peaks1: WaveformPeaks | null;
  peaks2: WaveformPeaks | null;
  volume1: number;
  volume2: number;
}

export default function CompareSection({
  track1,
  track2,
  peaks1,
  peaks2,
  volume1,
  volume2,
}: CompareSectionProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("side-by-side");
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [offset2, setOffset2] = useState(0); // トラック2のオフセット（秒）

  const source1Ref = useRef<AudioBufferSourceNode | null>(null);
  const source2Ref = useRef<AudioBufferSourceNode | null>(null);
  const gain1Ref = useRef<GainNode | null>(null);
  const gain2Ref = useRef<GainNode | null>(null);
  const startTimeRef = useRef(0);
  const rafRef = useRef<number>(0);

  const hasBothTracks = track1 && track2;
  const maxDuration = Math.max(track1?.duration ?? 0, (track2?.duration ?? 0) + offset2);

  const stopMixPlayback = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
    [source1Ref, source2Ref].forEach((ref) => {
      if (ref.current) {
        try { ref.current.stop(); } catch {}
        ref.current.disconnect();
        ref.current = null;
      }
    });
    [gain1Ref, gain2Ref].forEach((ref) => {
      if (ref.current) {
        ref.current.disconnect();
        ref.current = null;
      }
    });
    setIsPlaying(false);
  }, []);

  const startMixPlayback = useCallback(() => {
    if (!track1 || !track2) return;

    stopMixPlayback();

    const ctx = getAudioContext();
    const now = ctx.currentTime;
    startTimeRef.current = now;

    // トラック1
    const { source: s1, gain: g1 } = createPlaybackNodes(track1.buffer, volume1, 0);
    source1Ref.current = s1;
    gain1Ref.current = g1;
    s1.start(now);

    // トラック2（オフセット付き）
    const { source: s2, gain: g2 } = createPlaybackNodes(track2.buffer, volume2, 0);
    source2Ref.current = s2;
    gain2Ref.current = g2;
    // offset2秒後に再生開始
    s2.start(now + offset2);

    setIsPlaying(true);

    const updateTime = () => {
      const elapsed = getAudioContext().currentTime - startTimeRef.current;
      if (elapsed <= maxDuration) {
        setCurrentTime(elapsed);
        rafRef.current = requestAnimationFrame(updateTime);
      } else {
        stopMixPlayback();
        setCurrentTime(0);
      }
    };
    rafRef.current = requestAnimationFrame(updateTime);

    // 終了ハンドラ
    const checkEnd = () => {
      // 両方終了したら停止
    };
    s1.onended = checkEnd;
    s2.onended = checkEnd;
  }, [track1, track2, volume1, volume2, offset2, maxDuration, stopMixPlayback]);

  // 音量変更をリアルタイム反映
  useEffect(() => {
    if (gain1Ref.current) gain1Ref.current.gain.value = volume1;
  }, [volume1]);

  useEffect(() => {
    if (gain2Ref.current) gain2Ref.current.gain.value = volume2;
  }, [volume2]);

  // クリーンアップ
  useEffect(() => {
    return () => stopMixPlayback();
  }, [stopMixPlayback]);

  if (!hasBothTracks) {
    return (
      <div
        className="rounded-lg p-6 text-center"
        style={{ backgroundColor: "var(--color-surface)" }}
      >
        <p style={{ color: "var(--color-text-muted)" }} className="text-sm">
          2つのトラックを読み込むと比較できます
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg p-4" style={{ backgroundColor: "var(--color-surface)" }}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium">比較</h3>
        <div className="flex gap-1">
          <button
            onClick={() => setViewMode("side-by-side")}
            className={`px-2 py-1 text-xs rounded transition ${
              viewMode === "side-by-side" ? "bg-white/20" : "bg-white/5 hover:bg-white/10"
            }`}
          >
            並列
          </button>
          <button
            onClick={() => setViewMode("overlay")}
            className={`px-2 py-1 text-xs rounded transition ${
              viewMode === "overlay" ? "bg-white/20" : "bg-white/5 hover:bg-white/10"
            }`}
          >
            重ね合わせ
          </button>
        </div>
      </div>

      {viewMode === "side-by-side" ? (
        <div className="space-y-2">
          <WaveformCanvas
            peaks={peaks1}
            color={COLORS.brand}
            currentTime={currentTime}
            duration={track1!.duration}
            height={80}
          />
          <WaveformCanvas
            peaks={peaks2}
            color={COLORS.reference}
            currentTime={Math.max(0, currentTime - offset2)}
            duration={track2!.duration}
            height={80}
          />
        </div>
      ) : (
        <WaveformCanvas
          peaks={peaks1}
          color={COLORS.brand}
          currentTime={currentTime}
          duration={maxDuration}
          height={120}
          overlayPeaks={peaks2}
          overlayColor={COLORS.reference}
        />
      )}

      {/* 重ね再生コントロール */}
      <div className="flex items-center gap-3 mt-3">
        <button
          onClick={() => (isPlaying ? stopMixPlayback() : startMixPlayback())}
          className="px-3 py-1 text-xs rounded bg-white/10 hover:bg-white/20 transition"
        >
          {isPlaying ? "⏸ 停止" : "▶ 重ね再生"}
        </button>
        <span className="text-xs font-mono" style={{ color: "var(--color-text-muted)" }}>
          {formatTime(currentTime)} / {formatTime(maxDuration)}
        </span>
      </div>

      {/* タイミング調整 */}
      <div className="flex items-center gap-2 mt-2">
        <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
          トラック2オフセット:
        </span>
        <input
          type="range"
          min="-5"
          max="5"
          step="0.1"
          value={offset2}
          onChange={(e) => setOffset2(parseFloat(e.target.value))}
          className="w-32 h-1 accent-white"
        />
        <span className="text-xs font-mono" style={{ color: "var(--color-text-muted)" }}>
          {offset2 >= 0 ? "+" : ""}
          {offset2.toFixed(1)}s
        </span>
      </div>
    </div>
  );
}
