"use client";

import { useState, useRef, useCallback } from "react";
import { RecordingState } from "@/types/audio";
import { FFT_SIZE } from "@/lib/constants";

interface UseAudioRecorderReturn {
  startRecording: (audioContext: AudioContext) => Promise<void>;
  stopRecording: () => Promise<AudioBuffer | null>;
  recordingState: RecordingState;
  analyserNode: AnalyserNode | null;
  recordedBuffer: AudioBuffer | null;
  error: string | null;
  recordingTime: number;
}

export function useAudioRecorder(): UseAudioRecorderReturn {
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [recordedBuffer, setRecordedBuffer] = useState<AudioBuffer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startRecording = useCallback(async (audioContext: AudioContext) => {
    try {
      setError(null);
      setRecordedBuffer(null);
      setRecordingTime(0);
      audioContextRef.current = audioContext;

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
      streamRef.current = stream;

      // AnalyserNode（リアルタイム波形用）
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = FFT_SIZE;
      source.connect(analyser);
      analyserRef.current = analyser;

      // MediaRecorder
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/mp4";

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.start(100); // 100msごとにデータ取得
      mediaRecorderRef.current = mediaRecorder;

      // タイマー
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);

      setRecordingState("recording");
    } catch (err) {
      const message =
        err instanceof DOMException && err.name === "NotAllowedError"
          ? "マイクへのアクセスが拒否されました。ブラウザの設定でマイクを許可してください。"
          : "録音の開始に失敗しました。";
      setError(message);
      setRecordingState("error");
    }
  }, []);

  const stopRecording = useCallback(async (): Promise<AudioBuffer | null> => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    const mediaRecorder = mediaRecorderRef.current;
    const audioContext = audioContextRef.current;

    if (!mediaRecorder || !audioContext) return null;

    setRecordingState("processing");

    return new Promise((resolve) => {
      mediaRecorder.onstop = async () => {
        // ストリーム停止
        streamRef.current?.getTracks().forEach((track) => track.stop());

        try {
          const blob = new Blob(chunksRef.current, {
            type: mediaRecorder.mimeType,
          });
          const arrayBuffer = await blob.arrayBuffer();
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

          setRecordedBuffer(audioBuffer);
          setRecordingState("done");
          resolve(audioBuffer);
        } catch {
          setError("録音データの処理に失敗しました。");
          setRecordingState("error");
          resolve(null);
        }
      };

      mediaRecorder.stop();
    });
  }, []);

  return {
    startRecording,
    stopRecording,
    recordingState,
    analyserNode: analyserRef.current,
    recordedBuffer,
    error,
    recordingTime,
  };
}
