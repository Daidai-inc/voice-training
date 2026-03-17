"use client";

import { useState, useCallback, useMemo } from "react";
import { WaveformPeaks } from "@/types/audio";
import { extractPeaks, decodeAudioFile } from "@/lib/audio-utils";
import { extractPitchDataAsync } from "@/lib/pitch-worker";
import { PitchPoint } from "@/lib/pitch-detector";
import { useAudioContext } from "@/hooks/useAudioContext";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";
import Recorder from "./Recorder";
import AudioUploader from "./AudioUploader";
import WaveformCanvas from "./WaveformCanvas";
import PitchCanvas from "./PitchCanvas";
import TransportControls from "./TransportControls";
import ProgressBar from "./ProgressBar";

interface TrackSectionProps {
  title: string;
  color: string;
  disabled?: boolean;
  onBusy: (busy: boolean) => void;
  onTrackReady: (buffer: AudioBuffer, pitchData: PitchPoint[]) => void;
  onTrackClear: () => void;
}

type InputMode = "record" | "upload";

export default function TrackSection({
  title,
  color,
  disabled = false,
  onBusy,
  onTrackReady,
  onTrackClear,
}: TrackSectionProps) {
  const [inputMode, setInputMode] = useState<InputMode>("upload");
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [fileName, setFileName] = useState("");
  const [pitchData, setPitchData] = useState<PitchPoint[]>([]);
  const [pitchProgress, setPitchProgress] = useState<number | null>(null);
  const [showPitch, setShowPitch] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState<string | null>(null);

  const { getContext, resume } = useAudioContext();
  const recorder = useAudioRecorder();
  const player = useAudioPlayer(getContext);

  const peaks: WaveformPeaks | undefined = useMemo(() => {
    if (!audioBuffer) return undefined;
    return extractPeaks(audioBuffer, 800);
  }, [audioBuffer]);

  const progress =
    player.duration > 0 ? player.currentTime / player.duration : 0;

  // ピッチ解析（手動トリガー）
  const analyzePitch = useCallback(async () => {
    if (!audioBuffer || pitchProgress !== null) return;
    onBusy(true);
    setPitchProgress(0);
    setPitchData([]);
    const data = await extractPitchDataAsync(audioBuffer, (p) => {
      setPitchProgress(p);
    });
    setPitchData(data);
    setPitchProgress(null);
    setShowPitch(true);
    onTrackReady(audioBuffer, data);
    onBusy(false);
  }, [audioBuffer, pitchProgress, onTrackReady, onBusy]);

  // ファイルアップロード
  const handleFileLoaded = useCallback(
    async (file: File) => {
      onBusy(true);
      setLoadingStatus("音声ファイルを読み込み中...");
      try {
        const ctx = await resume();
        setLoadingStatus("音声データを処理中...");
        const buffer = await decodeAudioFile(file, ctx);
        setLoadingStatus("波形を生成中...");
        await new Promise(r => requestAnimationFrame(r));
        setAudioBuffer(buffer);
        setFileName(file.name);
        onTrackReady(buffer, []);
      } catch {
        alert("音声ファイルの読み込みに失敗しました。");
      } finally {
        setLoadingStatus(null);
        onBusy(false);
      }
    },
    [resume, onTrackReady, onBusy]
  );

  // 録音開始
  const handleStartRecording = useCallback(async () => {
    onBusy(true);
    const ctx = await resume();
    setAudioBuffer(null);
    setPitchData([]);
    setShowPitch(false);
    onTrackClear();
    await recorder.startRecording(ctx);
  }, [resume, recorder, onTrackClear, onBusy]);

  // 録音停止
  const handleStopRecording = useCallback(async () => {
    setLoadingStatus("録音データを処理中...");
    const buffer = await recorder.stopRecording();
    if (buffer) {
      setLoadingStatus("波形を生成中...");
      await new Promise(r => requestAnimationFrame(r));
      setAudioBuffer(buffer);
      setFileName("録音データ");
      onTrackReady(buffer, []);
    }
    setLoadingStatus(null);
    onBusy(false);
  }, [recorder, onTrackReady, onBusy]);

  // トラッククリア
  const handleClear = useCallback(() => {
    setAudioBuffer(null);
    setFileName("");
    setPitchData([]);
    setShowPitch(false);
    setPitchProgress(null);
    setLoadingStatus(null);
    player.stop();
    onTrackClear();
  }, [player, onTrackClear]);

  const isRecording = recorder.recordingState === "recording";

  return (
    <section className={`space-y-3 p-5 rounded-xl bg-[var(--color-surface)] ${disabled ? "opacity-50 pointer-events-none" : ""}`}>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium" style={{ color }}>
          {title}
        </h2>
        {audioBuffer && (
          <button
            onClick={handleClear}
            className="text-xs text-[var(--color-text-muted)] hover:text-red-400 transition-colors"
          >
            クリア
          </button>
        )}
      </div>

      {disabled && !audioBuffer && (
        <div className="flex items-center justify-center gap-2 py-6 text-sm text-[var(--color-text-muted)]">
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" strokeOpacity="0.3" />
            <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
          </svg>
          もう一方のトラックを処理中です
        </div>
      )}

      {!audioBuffer && !disabled && !loadingStatus && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <button
              onClick={() => setInputMode("upload")}
              className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                inputMode === "upload"
                  ? "bg-[var(--color-surface-light)] text-white"
                  : "text-[var(--color-text-muted)] hover:text-white"
              }`}
            >
              ファイルを選択
            </button>
            <button
              onClick={() => setInputMode("record")}
              className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                inputMode === "record"
                  ? "bg-[var(--color-surface-light)] text-white"
                  : "text-[var(--color-text-muted)] hover:text-white"
              }`}
            >
              マイクで録音
            </button>
          </div>

          {inputMode === "upload" ? (
            <AudioUploader
              onFileLoaded={handleFileLoaded}
              isLoaded={false}
              label={`${title}の音声ファイルをドロップ`}
              accentColor={color}
            />
          ) : (
            <div className="space-y-2">
              <Recorder
                recordingState={recorder.recordingState}
                recordingTime={recorder.recordingTime}
                onStart={handleStartRecording}
                onStop={handleStopRecording}
                error={recorder.error}
              />
              {isRecording && (
                <div className="text-xs text-[var(--color-text-muted)]">
                  録音中...停止ボタンで終了
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {loadingStatus && (
        <div className="space-y-2 py-2">
          <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" strokeOpacity="0.3" />
              <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
            </svg>
            {loadingStatus}
          </div>
          <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
            <div className="h-full bg-[var(--color-brand)] rounded-full animate-pulse" style={{ width: "60%" }} />
          </div>
        </div>
      )}

      {audioBuffer && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
            <span>{fileName}</span>
            <button
              onClick={handleClear}
              className="hover:text-white transition-colors"
            >
              変更
            </button>
          </div>

          <WaveformCanvas
            peaks={peaks}
            color={color}
            label="波形"
            playbackProgress={progress}
            height={100}
          />

          {pitchProgress !== null && (
            <ProgressBar progress={pitchProgress} label="音程を解析中..." />
          )}

          <div className="flex items-center gap-2">
            {pitchData.length === 0 && pitchProgress === null ? (
              <button
                onClick={analyzePitch}
                className="text-xs px-2 py-1 rounded transition-colors text-[var(--color-text-muted)] hover:text-white"
              >
                音程を解析
              </button>
            ) : pitchData.length > 0 ? (
              <button
                onClick={() => setShowPitch(!showPitch)}
                className={`text-xs px-2 py-1 rounded transition-colors ${
                  showPitch
                    ? "bg-[var(--color-surface-light)] text-white"
                    : "text-[var(--color-text-muted)] hover:text-white"
                }`}
              >
                {showPitch ? "音程を隠す" : "音程を表示"}
              </button>
            ) : null}
          </div>

          {showPitch && pitchData.length > 0 && (
            <PitchCanvas
              pitchData={pitchData}
              color={color}
              label="音程"
              duration={audioBuffer.duration}
              playbackProgress={progress}
              height={150}
            />
          )}

          <div className="flex items-center gap-4">
            <TransportControls
              isPlaying={player.isPlaying}
              currentTime={player.currentTime}
              duration={player.duration}
              onPlay={() => player.play(audioBuffer)}
              onPause={player.pause}
              onStop={player.stop}
            />
            <div className="flex items-center gap-2 flex-1">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[var(--color-text-muted)] shrink-0">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19" />
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
              </svg>
              <input
                type="range"
                min={0}
                max={1.5}
                step={0.01}
                value={player.volume}
                onChange={(e) => player.setVolume(parseFloat(e.target.value))}
                className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, ${color} 0%, ${color} ${(player.volume / 1.5) * 100}%, #374151 ${(player.volume / 1.5) * 100}%, #374151 100%)`,
                }}
              />
              <span className="text-[10px] text-[var(--color-text-muted)] font-mono w-8 text-right">
                {Math.round(player.volume * 100)}%
              </span>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
