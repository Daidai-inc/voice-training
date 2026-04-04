"use client";

import { useState, useCallback } from "react";
import { AudioTrack, WaveformPeaks } from "@/types/audio";
import TrackPanel from "@/components/TrackPanel";
import CompareSection from "@/components/CompareSection";
import { COLORS } from "@/lib/constants";

export default function Home() {
  // トラック1 state
  const [track1, setTrack1] = useState<AudioTrack | null>(null);
  const [peaks1, setPeaks1] = useState<WaveformPeaks | null>(null);
  const [volume1, setVolume1] = useState(1);
  const [isPlaying1, setIsPlaying1] = useState(false);
  const [currentTime1, setCurrentTime1] = useState(0);

  // トラック2 state
  const [track2, setTrack2] = useState<AudioTrack | null>(null);
  const [peaks2, setPeaks2] = useState<WaveformPeaks | null>(null);
  const [volume2, setVolume2] = useState(1);
  const [isPlaying2, setIsPlaying2] = useState(false);
  const [currentTime2, setCurrentTime2] = useState(0);

  const handleTrack1Loaded = useCallback((t: AudioTrack, p: WaveformPeaks) => {
    setTrack1(t);
    setPeaks1(p);
    setCurrentTime1(0);
    setIsPlaying1(false);
  }, []);

  const handleTrack2Loaded = useCallback((t: AudioTrack, p: WaveformPeaks) => {
    setTrack2(t);
    setPeaks2(p);
    setCurrentTime2(0);
    setIsPlaying2(false);
  }, []);

  return (
    <main className="max-w-4xl mx-auto p-4 space-y-6">
      <header className="text-center py-4">
        <h1 className="text-2xl font-bold" style={{ color: COLORS.brand }}>
          Voice Training
        </h1>
        <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
          お手本と自分の歌声を比較してトレーニング
        </p>
      </header>

      {/* トラック1 */}
      <TrackPanel
        label="トラック 1（お手本）"
        color={COLORS.brand}
        track={track1}
        peaks={peaks1}
        volume={volume1}
        isPlaying={isPlaying1}
        currentTime={currentTime1}
        onTrackLoaded={handleTrack1Loaded}
        onVolumeChange={setVolume1}
        onPlayStateChange={setIsPlaying1}
        onTimeUpdate={setCurrentTime1}
      />

      {/* トラック2 */}
      <TrackPanel
        label="トラック 2（自分の声）"
        color={COLORS.reference}
        track={track2}
        peaks={peaks2}
        volume={volume2}
        isPlaying={isPlaying2}
        currentTime={currentTime2}
        onTrackLoaded={handleTrack2Loaded}
        onVolumeChange={setVolume2}
        onPlayStateChange={setIsPlaying2}
        onTimeUpdate={setCurrentTime2}
      />

      {/* 比較セクション */}
      <CompareSection
        track1={track1}
        track2={track2}
        peaks1={peaks1}
        peaks2={peaks2}
        volume1={volume1}
        volume2={volume2}
      />

    </main>
  );
}
