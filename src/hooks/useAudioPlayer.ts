"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { FFT_SIZE } from "@/lib/constants";

interface UseAudioPlayerReturn {
  play: (buffer: AudioBuffer, offset?: number) => void;
  pause: () => void;
  stop: () => void;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  analyserNode: AnalyserNode | null;
}

export function useAudioPlayer(
  audioContext: AudioContext | null
): UseAudioPlayerReturn {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const startTimeRef = useRef(0);
  const pausedAtRef = useRef(0);
  const bufferRef = useRef<AudioBuffer | null>(null);
  const rafRef = useRef<number | null>(null);

  const updateTime = useCallback(() => {
    if (!audioContext || !isPlaying) return;
    const elapsed = audioContext.currentTime - startTimeRef.current;
    setCurrentTime(elapsed);
    rafRef.current = requestAnimationFrame(updateTime);
  }, [audioContext, isPlaying]);

  useEffect(() => {
    if (isPlaying) {
      rafRef.current = requestAnimationFrame(updateTime);
    }
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isPlaying, updateTime]);

  const play = useCallback(
    (buffer: AudioBuffer, offset?: number) => {
      if (!audioContext) return;

      // 既存のソースを停止
      if (sourceRef.current) {
        try {
          sourceRef.current.stop();
        } catch {
          // already stopped
        }
      }

      const source = audioContext.createBufferSource();
      source.buffer = buffer;
      bufferRef.current = buffer;
      setDuration(buffer.duration);

      // AnalyserNode
      if (!analyserRef.current) {
        analyserRef.current = audioContext.createAnalyser();
        analyserRef.current.fftSize = FFT_SIZE;
      }

      source.connect(analyserRef.current);
      analyserRef.current.connect(audioContext.destination);

      const startOffset = offset ?? pausedAtRef.current;
      source.start(0, startOffset);
      startTimeRef.current = audioContext.currentTime - startOffset;
      sourceRef.current = source;

      source.onended = () => {
        setIsPlaying(false);
        if (!pausedAtRef.current) {
          setCurrentTime(0);
          pausedAtRef.current = 0;
        }
      };

      setIsPlaying(true);
    },
    [audioContext]
  );

  const pause = useCallback(() => {
    if (!audioContext || !sourceRef.current) return;

    pausedAtRef.current = audioContext.currentTime - startTimeRef.current;
    try {
      sourceRef.current.stop();
    } catch {
      // already stopped
    }
    sourceRef.current = null;
    setIsPlaying(false);
  }, [audioContext]);

  const stop = useCallback(() => {
    if (sourceRef.current) {
      try {
        sourceRef.current.stop();
      } catch {
        // already stopped
      }
      sourceRef.current = null;
    }
    pausedAtRef.current = 0;
    setCurrentTime(0);
    setIsPlaying(false);
  }, []);

  return {
    play,
    pause,
    stop,
    isPlaying,
    currentTime,
    duration,
    analyserNode: analyserRef.current,
  };
}
