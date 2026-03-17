"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { FFT_SIZE } from "@/lib/constants";

interface UseAudioPlayerReturn {
  play: (buffer: AudioBuffer, offset?: number) => void;
  pause: () => void;
  stop: () => void;
  setVolume: (value: number) => void;
  volume: number;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  analyserNode: AnalyserNode | null;
}

export function useAudioPlayer(
  getContext: () => AudioContext
): UseAudioPlayerReturn {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(1);

  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const startTimeRef = useRef(0);
  const pausedAtRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const isPlayingRef = useRef(false);

  // 時間更新ループ
  useEffect(() => {
    if (!isPlaying) {
      isPlayingRef.current = false;
      return;
    }
    isPlayingRef.current = true;

    const tick = () => {
      if (!isPlayingRef.current || !ctxRef.current) return;
      const elapsed = ctxRef.current.currentTime - startTimeRef.current;
      setCurrentTime(elapsed);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isPlaying]);

  const play = useCallback(
    (buffer: AudioBuffer, offset?: number) => {
      // ここで初めてAudioContextを取得
      const ctx = getContext();
      ctxRef.current = ctx;

      // 既存ソース停止
      if (sourceRef.current) {
        try { sourceRef.current.stop(); } catch { /* */ }
      }

      // ノード生成（未作成時のみ）
      if (!gainRef.current) {
        gainRef.current = ctx.createGain();
        gainRef.current.gain.value = volume;
      }
      if (!analyserRef.current) {
        analyserRef.current = ctx.createAnalyser();
        analyserRef.current.fftSize = FFT_SIZE;
      }

      // 接続
      try { gainRef.current.disconnect(); } catch { /* */ }
      try { analyserRef.current.disconnect(); } catch { /* */ }
      gainRef.current.connect(analyserRef.current);
      analyserRef.current.connect(ctx.destination);

      // ソース生成+再生
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      setDuration(buffer.duration);
      source.connect(gainRef.current);

      const startOffset = offset ?? pausedAtRef.current;
      source.start(0, startOffset);
      startTimeRef.current = ctx.currentTime - startOffset;
      sourceRef.current = source;

      source.onended = () => {
        setIsPlaying(false);
        if (pausedAtRef.current === 0) {
          setCurrentTime(0);
        }
      };

      setIsPlaying(true);
    },
    [getContext, volume]
  );

  const pause = useCallback(() => {
    if (!ctxRef.current || !sourceRef.current) return;
    pausedAtRef.current = ctxRef.current.currentTime - startTimeRef.current;
    try { sourceRef.current.stop(); } catch { /* */ }
    sourceRef.current = null;
    setIsPlaying(false);
  }, []);

  const stop = useCallback(() => {
    if (sourceRef.current) {
      try { sourceRef.current.stop(); } catch { /* */ }
      sourceRef.current = null;
    }
    pausedAtRef.current = 0;
    setCurrentTime(0);
    setIsPlaying(false);
  }, []);

  const setVolume = useCallback((value: number) => {
    setVolumeState(value);
    if (gainRef.current) {
      gainRef.current.gain.value = value;
    }
  }, []);

  return {
    play, pause, stop, setVolume, volume,
    isPlaying, currentTime, duration,
    analyserNode: analyserRef.current,
  };
}
