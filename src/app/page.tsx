"use client";

import { useState, useCallback, useMemo } from "react";
import { ViewMode, WaveformPeaks } from "@/types/audio";
import { useAudioContext } from "@/hooks/useAudioContext";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";
import { useWaveformAnalyzer } from "@/hooks/useWaveformAnalyzer";
import { extractPeaks, decodeAudioFile } from "@/lib/audio-utils";
import { COLORS } from "@/lib/constants";
import Recorder from "@/components/Recorder";
import ReferenceUploader from "@/components/ReferenceUploader";
import WaveformCanvas from "@/components/WaveformCanvas";
import TransportControls from "@/components/TransportControls";
import ComparisonView from "@/components/ComparisonView";

const WAVEFORM_WIDTH = 800;

export default function Home() {
  const { audioContext, resume } = useAudioContext();

  // 録音
  const recorder = useAudioRecorder();
  const { timeData: recordingRealtimeData } = useWaveformAnalyzer(
    recorder.analyserNode
  );

  // 録音済みの再生
  const recordedPlayer = useAudioPlayer(audioContext);
  const { timeData: recordedPlaybackData } = useWaveformAnalyzer(
    recordedPlayer.analyserNode
  );

  // 参考音源
  const [referenceBuffer, setReferenceBuffer] = useState<AudioBuffer | null>(
    null
  );
  const [referenceFileName, setReferenceFileName] = useState<string>("");
  const referencePlayer = useAudioPlayer(audioContext);
  const { timeData: referencePlaybackData } = useWaveformAnalyzer(
    referencePlayer.analyserNode
  );

  // 比較表示
  const [viewMode, setViewMode] = useState<ViewMode>("side-by-side");

  // ピークデータ
  const recordedPeaks: WaveformPeaks | undefined = useMemo(() => {
    if (!recorder.recordedBuffer) return undefined;
    return extractPeaks(recorder.recordedBuffer, WAVEFORM_WIDTH);
  }, [recorder.recordedBuffer]);

  const referencePeaks: WaveformPeaks | undefined = useMemo(() => {
    if (!referenceBuffer) return undefined;
    return extractPeaks(referenceBuffer, WAVEFORM_WIDTH);
  }, [referenceBuffer]);

  // 録音開始
  const handleStartRecording = useCallback(async () => {
    const ctx = await resume();
    await recorder.startRecording(ctx);
  }, [resume, recorder]);

  // 録音停止
  const handleStopRecording = useCallback(async () => {
    await recorder.stopRecording();
  }, [recorder]);

  // 参考音源ロード
  const handleReferenceLoaded = useCallback(
    async (file: File) => {
      const ctx = await resume();
      try {
        const buffer = await decodeAudioFile(file, ctx);
        setReferenceBuffer(buffer);
        setReferenceFileName(file.name);
      } catch {
        alert("音声ファイルの読み込みに失敗しました。");
      }
    },
    [resume]
  );

  // 再生位置の進行度
  const recordedProgress =
    recordedPlayer.duration > 0
      ? recordedPlayer.currentTime / recordedPlayer.duration
      : 0;

  const referenceProgress =
    referencePlayer.duration > 0
      ? referencePlayer.currentTime / referencePlayer.duration
      : 0;

  // 同期再生用の進行度（長い方に合わせる）
  const syncProgress = Math.max(recordedProgress, referenceProgress);

  return (
    <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      {/* ヘッダー */}
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-brand)]">
          Voice Training
        </h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">
          歌声を録音して、お手本と波形を比較しよう
        </p>
      </div>

      {/* 録音セクション */}
      <section className="space-y-3 p-5 rounded-xl bg-[var(--color-surface)]">
        <h2 className="text-sm font-medium text-[var(--color-brand)]">
          あなたの歌声
        </h2>

        <Recorder
          recordingState={recorder.recordingState}
          recordingTime={recorder.recordingTime}
          onStart={handleStartRecording}
          onStop={handleStopRecording}
          error={recorder.error}
        />

        {/* リアルタイム波形（録音中） */}
        {recorder.recordingState === "recording" && (
          <WaveformCanvas
            realtimeData={recordingRealtimeData}
            color={COLORS.brand}
            label="録音中"
          />
        )}

        {/* 録音済み波形 + 再生コントロール */}
        {recorder.recordedBuffer && recorder.recordingState !== "recording" && (
          <div className="space-y-2">
            <WaveformCanvas
              peaks={recordedPeaks}
              color={COLORS.brand}
              label="あなたの歌声"
              playbackProgress={recordedProgress}
            />
            <TransportControls
              isPlaying={recordedPlayer.isPlaying}
              currentTime={recordedPlayer.currentTime}
              duration={recordedPlayer.duration}
              onPlay={() =>
                recordedPlayer.play(recorder.recordedBuffer!)
              }
              onPause={recordedPlayer.pause}
              onStop={recordedPlayer.stop}
            />
          </div>
        )}
      </section>

      {/* 参考音源セクション */}
      <section className="space-y-3 p-5 rounded-xl bg-[var(--color-surface)]">
        <h2 className="text-sm font-medium text-[var(--color-reference)]">
          お手本
        </h2>

        <ReferenceUploader
          onFileLoaded={handleReferenceLoaded}
          isLoaded={!!referenceBuffer}
          fileName={referenceFileName}
        />

        {referenceBuffer && (
          <div className="space-y-2">
            <WaveformCanvas
              peaks={referencePeaks}
              color={COLORS.reference}
              label="お手本"
              playbackProgress={referenceProgress}
            />
            <TransportControls
              isPlaying={referencePlayer.isPlaying}
              currentTime={referencePlayer.currentTime}
              duration={referencePlayer.duration}
              onPlay={() => referencePlayer.play(referenceBuffer)}
              onPause={referencePlayer.pause}
              onStop={referencePlayer.stop}
            />
          </div>
        )}
      </section>

      {/* 比較セクション */}
      <section className="space-y-3 p-5 rounded-xl bg-[var(--color-surface)]">
        <h2 className="text-sm font-medium text-[var(--color-text)]">
          波形比較
        </h2>

        <ComparisonView
          recordedPeaks={recordedPeaks}
          referencePeaks={referencePeaks}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          playbackProgress={syncProgress}
        />

        {/* 同期再生ボタン */}
        {recorder.recordedBuffer && referenceBuffer && (
          <div className="flex gap-3">
            <button
              onClick={() => {
                recordedPlayer.play(recorder.recordedBuffer!, 0);
                referencePlayer.play(referenceBuffer, 0);
              }}
              className="px-4 py-2 text-sm rounded-lg bg-[var(--color-surface-light)] hover:bg-[var(--color-brand)] transition-colors"
            >
              同期再生
            </button>
            <button
              onClick={() => {
                recordedPlayer.stop();
                referencePlayer.stop();
              }}
              className="px-4 py-2 text-sm rounded-lg bg-[var(--color-surface-light)] hover:bg-gray-600 transition-colors"
            >
              停止
            </button>
          </div>
        )}
      </section>
    </main>
  );
}
