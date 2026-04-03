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
  const [offset2, setOffset2] = useState(0);
  const [startFrom, setStartFrom] = useState(0); // 再生開始位置（秒）

  const source1Ref = useRef<AudioBufferSourceNode | null>(null);
  const source2Ref = useRef<AudioBufferSourceNode | null>(null);
  const gain1Ref = useRef<GainNode | null>(null);
  const gain2Ref = useRef<GainNode | null>(null);
  const startTimeRef = useRef(0);
  const rafRef = useRef<number>(0);

  const hasBothTracks = track1 && track2;
  const dur1 = track1?.duration ?? 0;
  const dur2 = track2?.duration ?? 0;
  const maxDuration = Math.max(dur1, dur2 + offset2);

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

  const startMixPlayback = useCallback(async (fromTime?: number) => {
    if (!track1 || !track2) return;

    stopMixPlayback();

    const ctx = await getAudioContext();
    const now = ctx.currentTime;
    const playFrom = fromTime ?? startFrom;

    // トラック1の再生開始位置
    const t1Start = Math.max(0, Math.min(playFrom, dur1));
    const { source: s1, gain: g1 } = createPlaybackNodes(ctx, track1.buffer, volume1, 0);
    source1Ref.current = s1;
    gain1Ref.current = g1;
    if (t1Start < dur1) {
      s1.start(now, t1Start);
    }

    // トラック2の再生開始位置（オフセット考慮）
    const t2ActualStart = playFrom - offset2;
    const { source: s2, gain: g2 } = createPlaybackNodes(ctx, track2.buffer, volume2, 0);
    source2Ref.current = s2;
    gain2Ref.current = g2;

    if (t2ActualStart >= 0 && t2ActualStart < dur2) {
      // 既にトラック2の再生範囲内
      s2.start(now, t2ActualStart);
    } else if (t2ActualStart < 0) {
      // まだトラック2の開始前 → 遅延して開始
      s2.start(now + Math.abs(t2ActualStart), 0);
    }

    startTimeRef.current = now - playFrom;
    setIsPlaying(true);

    const updateTime = () => {
      const elapsed = ctx.currentTime - startTimeRef.current;
      if (elapsed <= maxDuration) {
        setCurrentTime(elapsed);
        rafRef.current = requestAnimationFrame(updateTime);
      } else {
        stopMixPlayback();
        setCurrentTime(0);
      }
    };
    rafRef.current = requestAnimationFrame(updateTime);
  }, [track1, track2, volume1, volume2, offset2, dur1, dur2, maxDuration, startFrom, stopMixPlayback]);

  // 波形クリックで再生位置指定
  const handleSeekTrack1 = useCallback((time: number) => {
    setStartFrom(time);
    if (isPlaying) {
      startMixPlayback(time);
    }
  }, [isPlaying, startMixPlayback]);

  const handleSeekTrack2 = useCallback((time: number) => {
    // トラック2のクリック位置 → タイムライン上の位置に変換
    const timelinePos = time + offset2;
    setStartFrom(timelinePos);
    if (isPlaying) {
      startMixPlayback(timelinePos);
    }
  }, [isPlaying, offset2, startMixPlayback]);

  // 音量変更をリアルタイム反映
  useEffect(() => {
    if (gain1Ref.current) gain1Ref.current.gain.value = volume1;
  }, [volume1]);

  useEffect(() => {
    if (gain2Ref.current) gain2Ref.current.gain.value = volume2;
  }, [volume2]);

  // トラック差し替え時も再生停止
  useEffect(() => {
    stopMixPlayback();
  }, [track1, track2, stopMixPlayback]);

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

      {/* 波形表示 */}
      {viewMode === "side-by-side" ? (
        <div className="space-y-1">
          <div className="text-[10px] pl-1" style={{ color: COLORS.brand }}>トラック 1</div>
          <WaveformCanvas
            peaks={peaks1}
            color={COLORS.brand}
            currentTime={currentTime}
            duration={dur1}
            height={80}
            onSeek={handleSeekTrack1}
          />
          <div className="text-[10px] pl-1 mt-2" style={{ color: COLORS.reference }}>トラック 2</div>
          <WaveformCanvas
            peaks={peaks2}
            color={COLORS.reference}
            currentTime={Math.max(0, currentTime - offset2)}
            duration={dur2}
            height={80}
            onSeek={handleSeekTrack2}
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
          overlayOffset={offset2}
          onSeek={(time) => {
            setStartFrom(time);
            if (isPlaying) startMixPlayback(time);
          }}
        />
      )}

      {/* 再生コントロール */}
      <div className="flex items-center gap-3 mt-3">
        <button
          onClick={() => (isPlaying ? stopMixPlayback() : startMixPlayback())}
          className="px-3 py-1.5 text-xs rounded bg-white/10 hover:bg-white/20 transition"
        >
          {isPlaying ? "⏸ 停止" : "▶ 重ね再生"}
        </button>
        <span className="text-xs font-mono" style={{ color: "var(--color-text-muted)" }}>
          {formatTime(currentTime)} / {formatTime(maxDuration)}
        </span>
        {startFrom > 0 && (
          <span className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>
            ({formatTime(startFrom)}から)
          </span>
        )}
        {startFrom > 0 && (
          <button
            onClick={() => setStartFrom(0)}
            className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/10 transition"
            style={{ color: "var(--color-text-muted)" }}
          >
            先頭に戻す
          </button>
        )}
      </div>

      {/* タイミング調整 */}
      <div className="mt-3 p-3 rounded" style={{ backgroundColor: "var(--color-surface-light)" }}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            トラック2 タイミング調整
          </span>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono" style={{ color: "var(--color-text-muted)" }}>
              {offset2 >= 0 ? "+" : ""}{offset2.toFixed(1)}秒
            </span>
            {offset2 !== 0 && (
              <button
                onClick={() => setOffset2(0)}
                className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/10 transition"
                style={{ color: "var(--color-text-muted)" }}
              >
                リセット
              </button>
            )}
          </div>
        </div>

        {/* 粗調整 */}
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10px] w-12" style={{ color: "var(--color-text-muted)" }}>粗調整</span>
          <input
            type="range"
            min={-Math.max(dur1, dur2)}
            max={Math.max(dur1, dur2)}
            step={1}
            value={offset2}
            onChange={(e) => setOffset2(parseFloat(e.target.value))}
            className="flex-1 h-1 accent-white"
          />
        </div>

        {/* 細調整 */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] w-12" style={{ color: "var(--color-text-muted)" }}>細調整</span>
          <div className="flex gap-1">
            {[-1, -0.5, -0.1].map((v) => (
              <button
                key={v}
                onClick={() => setOffset2((prev) => +(prev + v).toFixed(1))}
                className="px-2 py-0.5 text-[10px] rounded bg-white/5 hover:bg-white/15 transition"
              >
                {v}s
              </button>
            ))}
            {[+0.1, +0.5, +1].map((v) => (
              <button
                key={v}
                onClick={() => setOffset2((prev) => +(prev + v).toFixed(1))}
                className="px-2 py-0.5 text-[10px] rounded bg-white/5 hover:bg-white/15 transition"
              >
                +{v}s
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
