"use client";

import { useEffect, useRef, useImperativeHandle, forwardRef } from "react";
import WaveSurfer from "wavesurfer.js";
import RegionsPlugin, { Region } from "wavesurfer.js/dist/plugins/regions.js";
import { COLORS } from "@/lib/constants";

export interface WaveSurferTrackHandle {
  seek: (time: number) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  setVolume: (v: number) => void;
}

interface WaveSurferTrackProps {
  audioBuffer: AudioBuffer;
  color: string;
  height?: number;
  volume?: number;
  currentTime?: number; // 外部からのプレイヘッド同期（再生はしない）
  onSeek?: (time: number) => void;
  // 範囲選択
  selectionStart?: number | null;
  selectionEnd?: number | null;
  onSelectionChange?: (start: number, end: number) => void;
  // オーバーレイ（重ね合わせビュー）
  overlayBuffer?: AudioBuffer | null;
  overlayColor?: string;
  overlayOffset?: number;
}

const WaveSurferTrack = forwardRef<WaveSurferTrackHandle, WaveSurferTrackProps>(
  function WaveSurferTrack(
    {
      audioBuffer,
      color,
      height = 80,
      volume = 1,
      currentTime = 0,
      onSeek,
      selectionStart,
      selectionEnd,
      onSelectionChange,
      overlayBuffer,
      overlayColor,
      overlayOffset = 0,
    },
    ref
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const wsRef = useRef<WaveSurfer | null>(null);
    const regionRef = useRef<Region | null>(null);
    const regionsPluginRef = useRef<RegionsPlugin | null>(null);
    const seekingRef = useRef(false);

    // AudioBuffer → Blob URL 変換
    const bufferToBlobUrl = (buf: AudioBuffer): string => {
      const numCh = buf.numberOfChannels;
      const len = buf.length;
      const sr = buf.sampleRate;
      const bytesPerSample = 2;
      const dataSize = len * numCh * bytesPerSample;
      const ab = new ArrayBuffer(44 + dataSize);
      const view = new DataView(ab);
      const write = (pos: number, str: string) => {
        for (let i = 0; i < str.length; i++) view.setUint8(pos + i, str.charCodeAt(i));
      };
      write(0, "RIFF");
      view.setUint32(4, 36 + dataSize, true);
      write(8, "WAVE");
      write(12, "fmt ");
      view.setUint32(16, 16, true);
      view.setUint16(20, 1, true);
      view.setUint16(22, numCh, true);
      view.setUint32(24, sr, true);
      view.setUint32(28, sr * numCh * bytesPerSample, true);
      view.setUint16(32, numCh * bytesPerSample, true);
      view.setUint16(34, 16, true);
      write(36, "data");
      view.setUint32(40, dataSize, true);
      let offset = 44;
      for (let i = 0; i < len; i++) {
        for (let ch = 0; ch < numCh; ch++) {
          const s = Math.max(-1, Math.min(1, buf.getChannelData(ch)[i]));
          view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
          offset += 2;
        }
      }
      return URL.createObjectURL(new Blob([ab], { type: "audio/wav" }));
    };

    useImperativeHandle(ref, () => ({
      seek: (time: number) => {
        if (wsRef.current) {
          seekingRef.current = true;
          wsRef.current.seekTo(Math.max(0, Math.min(time / (wsRef.current.getDuration() || 1), 1)));
          seekingRef.current = false;
        }
      },
      getCurrentTime: () => wsRef.current?.getCurrentTime() ?? 0,
      getDuration: () => wsRef.current?.getDuration() ?? 0,
      setVolume: (v: number) => wsRef.current?.setVolume(v),
    }));

    // WaveSurfer 初期化
    useEffect(() => {
      if (!containerRef.current) return;

      const regionsPlugin = RegionsPlugin.create();
      regionsPluginRef.current = regionsPlugin;

      const ws = WaveSurfer.create({
        container: containerRef.current,
        waveColor: color,
        progressColor: `${color}88`,
        cursorColor: COLORS.playhead,
        cursorWidth: 2,
        height,
        normalize: true,
        interact: !!onSeek,
        plugins: [regionsPlugin],
        backend: "WebAudio",
      });

      wsRef.current = ws;

      const url = bufferToBlobUrl(audioBuffer);
      ws.load(url);

      ws.on("ready", () => {
        ws.setVolume(volume);
        URL.revokeObjectURL(url);
      });

      ws.on("interaction", (newTime: number) => {
        if (!seekingRef.current && onSeek) {
          onSeek(newTime);
        }
      });

      // 範囲選択: ドラッグで region を作成
      if (onSelectionChange) {
        regionsPlugin.enableDragSelection({ color: "rgba(255,255,255,0.15)" });
        regionsPlugin.on("region-created", (region: Region) => {
          // 新しいregionが作られたら古いのを削除
          if (regionRef.current && regionRef.current !== region) {
            regionRef.current.remove();
          }
          regionRef.current = region;
          onSelectionChange(region.start, region.end);
        });
        regionsPlugin.on("region-updated", (region: Region) => {
          onSelectionChange(region.start, region.end);
        });
      }

      return () => {
        ws.destroy();
        wsRef.current = null;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [audioBuffer]);

    // 音量同期
    useEffect(() => {
      wsRef.current?.setVolume(volume);
    }, [volume]);

    // 外部プレイヘッド同期（再生中は親が管理）
    useEffect(() => {
      const ws = wsRef.current;
      if (!ws) return;
      const dur = ws.getDuration();
      if (dur <= 0) return;
      seekingRef.current = true;
      ws.seekTo(Math.max(0, Math.min(currentTime / dur, 1)));
      seekingRef.current = false;
    }, [currentTime]);

    // 選択範囲を外部から更新
    useEffect(() => {
      if (selectionStart == null || selectionEnd == null) {
        regionRef.current?.remove();
        regionRef.current = null;
      }
    }, [selectionStart, selectionEnd]);

    return (
      <div className="relative w-full rounded overflow-hidden" style={{ backgroundColor: COLORS.surface }}>
        <div ref={containerRef} />
        {/* オーバーレイ波形はCanvasで重ね描画（WaveSurfer上に重ねるのは困難なのでラベルのみ） */}
        {overlayBuffer && overlayOffset !== 0 && (
          <div
            className="absolute top-1 right-2 text-[9px] font-mono px-1 rounded"
            style={{ color: overlayColor, backgroundColor: "rgba(0,0,0,0.5)" }}
          >
            offset: {overlayOffset >= 0 ? "+" : ""}{overlayOffset.toFixed(2)}s
          </div>
        )}
      </div>
    );
  }
);

export default WaveSurferTrack;
