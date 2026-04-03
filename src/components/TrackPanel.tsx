"use client";

import { useRef, useCallback, useEffect, useState } from "react";
import { AudioTrack, WaveformPeaks, RecordingState } from "@/types/audio";
import {
  decodeAudioFile,
  extractPeaks,
  getAudioContext,
  startRecording,
  stopRecording,
  formatTime,
  createPlaybackNodes,
} from "@/lib/audio";
import WaveformCanvas from "./WaveformCanvas";
import { MAX_FILE_SIZE_MB } from "@/lib/constants";

interface TrackPanelProps {
  label: string;
  color: string;
  track: AudioTrack | null;
  peaks: WaveformPeaks | null;
  volume: number;
  isPlaying: boolean;
  currentTime: number;
  onTrackLoaded: (track: AudioTrack, peaks: WaveformPeaks) => void;
  onVolumeChange: (v: number) => void;
  onPlayStateChange: (playing: boolean) => void;
  onTimeUpdate: (time: number) => void;
}

export default function TrackPanel({
  label,
  color,
  track,
  peaks,
  volume,
  isPlaying,
  currentTime,
  onTrackLoaded,
  onVolumeChange,
  onPlayStateChange,
  onTimeUpdate,
}: TrackPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const startTimeRef = useRef(0);
  const offsetRef = useRef(0);
  const rafRef = useRef<number>(0);
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const recorderRef = useRef<{ mediaRecorder: MediaRecorder; chunks: Blob[] } | null>(null);
  const [loading, setLoading] = useState(false);

  // 再生停止
  const stopPlayback = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
    if (sourceRef.current) {
      try {
        sourceRef.current.stop();
      } catch {}
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if (gainRef.current) {
      gainRef.current.disconnect();
      gainRef.current = null;
    }
    onPlayStateChange(false);
  }, [onPlayStateChange]);

  // 再生開始
  const startPlayback = useCallback(
    async (fromTime: number) => {
      if (!track) return;

      stopPlayback();

      const ctx = await getAudioContext();
      const { source, gain } = createPlaybackNodes(ctx, track.buffer, volume, fromTime);
      sourceRef.current = source;
      gainRef.current = gain;

      startTimeRef.current = ctx.currentTime;
      offsetRef.current = fromTime;

      source.onended = () => {
        // 自然終了時のみ先頭にリセット（一時停止時はstopPlayback()が先にsourceRefをクリアする）
        if (sourceRef.current === source) {
          stopPlayback();
          onTimeUpdate(0);
        }
      };

      source.start(0, fromTime);
      onPlayStateChange(true);

      // 時間更新ループ
      const updateTime = () => {
        if (!sourceRef.current) return;
        const elapsed = ctx.currentTime - startTimeRef.current;
        const newTime = offsetRef.current + elapsed;
        if (newTime <= track.duration) {
          onTimeUpdate(newTime);
          rafRef.current = requestAnimationFrame(updateTime);
        }
      };
      rafRef.current = requestAnimationFrame(updateTime);
    },
    [track, volume, stopPlayback, onPlayStateChange, onTimeUpdate]
  );

  // 再生/停止トグル
  const togglePlay = useCallback(() => {
    if (isPlaying) {
      // 現在位置を保存して停止
      offsetRef.current = currentTime;
      stopPlayback();
    } else if (track) {
      startPlayback(currentTime);
    }
  }, [isPlaying, track, currentTime, startPlayback, stopPlayback]);

  // 音量変更
  useEffect(() => {
    if (gainRef.current) {
      gainRef.current.gain.value = volume;
    }
  }, [volume]);

  // シーク
  const handleSeek = useCallback(
    (time: number) => {
      onTimeUpdate(time);
      if (isPlaying) {
        startPlayback(time);
      }
    },
    [isPlaying, startPlayback, onTimeUpdate]
  );

  // ファイルアップロード
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      alert(`ファイルサイズは${MAX_FILE_SIZE_MB}MB以下にしてください`);
      return;
    }

    setLoading(true);
    try {
      stopPlayback();
      const buffer = await decodeAudioFile(file);
      const p = extractPeaks(buffer, 1000);
      onTrackLoaded(
        {
          buffer,
          name: file.name,
          duration: buffer.duration,
          sampleRate: buffer.sampleRate,
        },
        p
      );
      onTimeUpdate(0);
    } catch (err) {
      console.error("ファイル読み込みエラー:", err);
      alert("音声ファイルの読み込みに失敗しました");
    } finally {
      setLoading(false);
      // input をリセットして同じファイルを再選択可能に
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // 録音開始
  const handleStartRecording = async () => {
    try {
      stopPlayback();
      setRecordingState("recording");
      const recorder = await startRecording();
      recorderRef.current = recorder;
    } catch (err) {
      console.error("録音エラー:", err);
      setRecordingState("error");
    }
  };

  // 録音停止
  const handleStopRecording = async () => {
    if (!recorderRef.current) return;
    setRecordingState("processing");
    try {
      const buffer = await stopRecording(
        recorderRef.current.mediaRecorder,
        recorderRef.current.chunks
      );
      const p = extractPeaks(buffer, 1000);
      onTrackLoaded(
        {
          buffer,
          name: "録音",
          duration: buffer.duration,
          sampleRate: buffer.sampleRate,
        },
        p
      );
      onTimeUpdate(0);
      setRecordingState("done");
    } catch (err) {
      console.error("録音処理エラー:", err);
      setRecordingState("error");
    }
    recorderRef.current = null;
  };

  // クリーンアップ
  useEffect(() => {
    return () => {
      stopPlayback();
    };
  }, [stopPlayback]);

  return (
    <div className="rounded-lg p-4" style={{ backgroundColor: "var(--color-surface)" }}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium" style={{ color }}>
          {label}
        </h3>
        {track && (
          <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            {track.name}
          </span>
        )}
      </div>

      {/* ボタン群 */}
      <div className="flex gap-2 mb-3">
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          onChange={handleFileChange}
          className="hidden"
          data-testid="file-input"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={loading}
          className="px-3 py-1.5 text-xs rounded bg-white/10 hover:bg-white/20 transition disabled:opacity-50"
        >
          {loading ? "読込中..." : "ファイル選択"}
        </button>
        {recordingState !== "recording" ? (
          <button
            onClick={handleStartRecording}
            disabled={recordingState === "processing"}
            className="px-3 py-1.5 text-xs rounded bg-red-600/80 hover:bg-red-600 transition disabled:opacity-50"
          >
            {recordingState === "processing" ? "処理中..." : "録音"}
          </button>
        ) : (
          <button
            onClick={handleStopRecording}
            className="px-3 py-1.5 text-xs rounded bg-red-500 hover:bg-red-400 transition animate-pulse"
          >
            停止
          </button>
        )}
      </div>

      {/* 波形 */}
      <WaveformCanvas
        peaks={peaks}
        color={color}
        currentTime={currentTime}
        duration={track?.duration ?? 0}
        onSeek={handleSeek}
      />

      {/* トランスポート */}
      {track && (
        <div className="flex items-center gap-3 mt-3">
          <button
            onClick={togglePlay}
            className="px-3 py-1 text-xs rounded bg-white/10 hover:bg-white/20 transition"
            data-testid="play-button"
          >
            {isPlaying ? "⏸" : "▶"}
          </button>
          <span className="text-xs font-mono" style={{ color: "var(--color-text-muted)" }} data-testid="time-display">
            {formatTime(currentTime)} / {formatTime(track.duration)}
          </span>
          <div className="flex items-center gap-1 ml-auto">
            <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
              Vol
            </span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
              className="w-20 h-1 accent-white"
            />
          </div>
        </div>
      )}
    </div>
  );
}
