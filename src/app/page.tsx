"use client";

import { useState, useCallback } from "react";
import { ViewMode, WaveformPeaks } from "@/types/audio";
import { extractPeaks } from "@/lib/audio-utils";
import { PitchPoint } from "@/lib/pitch-detector";
import { COLORS } from "@/lib/constants";
import TrackSection from "@/components/TrackSection";
import ComparisonView from "@/components/ComparisonView";
import PitchCanvas from "@/components/PitchCanvas";
import MixPlayer from "@/components/MixPlayer";

type CompareTab = "mix" | "pitch" | "waveform";

interface TrackData {
  buffer: AudioBuffer;
  pitchData: PitchPoint[];
  peaks: WaveformPeaks;
}

export default function Home() {
  const [track1, setTrack1] = useState<TrackData | null>(null);
  const [track2, setTrack2] = useState<TrackData | null>(null);
  const [compareTab, setCompareTab] = useState<CompareTab>("mix");
  const [viewMode, setViewMode] = useState<ViewMode>("side-by-side");
  const [busy1, setBusy1] = useState(false);
  const [busy2, setBusy2] = useState(false);

  const handleTrack1Ready = useCallback(
    (buffer: AudioBuffer, pitchData: PitchPoint[]) => {
      setTrack1({ buffer, pitchData, peaks: extractPeaks(buffer, 800) });
    },
    []
  );

  const handleTrack2Ready = useCallback(
    (buffer: AudioBuffer, pitchData: PitchPoint[]) => {
      setTrack2({ buffer, pitchData, peaks: extractPeaks(buffer, 800) });
    },
    []
  );

  const hasBothTracks = track1 && track2;
  const anyBusy = busy1 || busy2;

  const tabs: { key: CompareTab; label: string }[] = [
    { key: "mix", label: "重ね再生" },
    { key: "pitch", label: "音程比較" },
    { key: "waveform", label: "波形比較" },
  ];

  return (
    <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-brand)]">
          Voice Training
        </h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">
          歌声を録音・アップロードして、音程と波形を分析・比較
        </p>
      </div>

      <TrackSection
        title="トラック 1"
        color={COLORS.brand}
        disabled={busy2}
        onBusy={setBusy1}
        onTrackReady={handleTrack1Ready}
        onTrackClear={() => setTrack1(null)}
      />

      <TrackSection
        title="トラック 2"
        color={COLORS.reference}
        disabled={busy1}
        onBusy={setBusy2}
        onTrackReady={handleTrack2Ready}
        onTrackClear={() => setTrack2(null)}
      />

      <section className="space-y-3 p-5 rounded-xl bg-[var(--color-surface)]">
        <h2 className="text-sm font-medium text-[var(--color-text)]">比較</h2>

        <div className="flex gap-2 border-b border-gray-700 pb-2">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setCompareTab(tab.key)}
              className={`px-3 py-1.5 text-sm rounded-t-md transition-colors ${
                compareTab === tab.key
                  ? "bg-[var(--color-surface-light)] text-[var(--color-brand)]"
                  : "text-[var(--color-text-muted)] hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {!hasBothTracks ? (
          <div className="flex items-center justify-center h-40 rounded-lg bg-[var(--color-surface-light)] text-[var(--color-text-muted)] text-sm">
            2つのトラックを用意すると比較できます
          </div>
        ) : compareTab === "mix" ? (
          <MixPlayer
            buffer1={track1.buffer}
            buffer2={track2.buffer}
            label1="トラック 1"
            label2="トラック 2"
          />
        ) : compareTab === "pitch" ? (
          <PitchCanvas
            mode="comparison"
            recordedPitch={track1.pitchData}
            referencePitch={track2.pitchData}
            recordedDuration={track1.buffer.duration}
            referenceDuration={track2.buffer.duration}
            color1={COLORS.brand}
            color2={COLORS.reference}
            height={250}
          />
        ) : (
          <ComparisonView
            recordedPeaks={track1.peaks}
            referencePeaks={track2.peaks}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
          />
        )}
      </section>
    </main>
  );
}
