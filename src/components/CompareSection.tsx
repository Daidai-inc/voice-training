"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AudioTrack, WaveformPeaks, ViewMode, PitchCurve, VoiceScore } from "@/types/audio";
import { formatTime, getAudioContext, createPlaybackNodes, extractPitchCurve, calcVoiceScore, extractVocals } from "@/lib/audio";
import WaveformCanvas from "./WaveformCanvas";
import PitchCurveCanvas from "./PitchCurveCanvas";
import ScorePanel from "./ScorePanel";
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
  const [startFrom, setStartFrom] = useState(0);

  // 範囲選択ループ（Step 2）
  const [selectionStart, setSelectionStart] = useState<number | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<number | null>(null);
  const [loopEnabled, setLoopEnabled] = useState(false);
  const loopRef = useRef(false);

  // ピッチ解析
  const [curve1, setCurve1] = useState<PitchCurve | null>(null);
  const [curve2, setCurve2] = useState<PitchCurve | null>(null);
  const [score, setScore] = useState<VoiceScore | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeProgress, setAnalyzeProgress] = useState(0);
  const [vocalMode, setVocalMode] = useState(false);

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

  const hasSelection = selectionStart != null && selectionEnd != null
    && Math.abs((selectionEnd ?? 0) - (selectionStart ?? 0)) > 0.1;

  // ループフラグをrefで同期（コールバック内から参照するため）
  useEffect(() => { loopRef.current = loopEnabled; }, [loopEnabled]);

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

  const startMixPlayback = useCallback(async (fromTime?: number, loopMode = false) => {
    if (!track1 || !track2) return;
    stopMixPlayback();

    const ctx = await getAudioContext();
    const now = ctx.currentTime;

    // ループ範囲 or 全体
    const playFrom = fromTime ?? startFrom;
    const loopEnd = loopMode && selectionEnd != null ? selectionEnd : maxDuration;

    // トラック1
    const t1Start = Math.max(0, Math.min(playFrom, dur1));
    const t1Duration = loopMode ? Math.max(0, loopEnd - playFrom) : undefined;
    const { source: s1, gain: g1 } = createPlaybackNodes(ctx, track1.buffer, volume1, 0);
    source1Ref.current = s1;
    gain1Ref.current = g1;
    if (t1Start < dur1) {
      s1.start(now, t1Start, t1Duration);
    }

    // トラック2（オフセット考慮）
    const t2ActualStart = playFrom - offset2;
    const { source: s2, gain: g2 } = createPlaybackNodes(ctx, track2.buffer, volume2, 0);
    source2Ref.current = s2;
    gain2Ref.current = g2;
    if (t2ActualStart >= 0 && t2ActualStart < dur2) {
      // track2上での再生時間 = loopEnd - (playFrom) → track2座標では loopEnd - offset2 - t2ActualStart
      const t2Duration = loopMode ? Math.max(0, loopEnd - offset2 - t2ActualStart) : undefined;
      s2.start(now, t2ActualStart, t2Duration);
    } else if (t2ActualStart < 0) {
      // 遅延開始の場合、遅延分だけ再生時間を短縮
      const delay = Math.abs(t2ActualStart);
      const t2Duration = loopMode ? Math.max(0, loopEnd - playFrom - delay) : undefined;
      s2.start(now + delay, 0, t2Duration);
    }

    startTimeRef.current = now - playFrom;
    setIsPlaying(true);

    const updateTime = () => {
      const elapsed = ctx.currentTime - startTimeRef.current;
      const end = loopMode && selectionEnd != null ? selectionEnd : maxDuration;
      if (elapsed <= end) {
        setCurrentTime(elapsed);
        rafRef.current = requestAnimationFrame(updateTime);
      } else if (loopRef.current && selectionStart != null && selectionEnd != null) {
        // ループ折り返し
        startMixPlayback(selectionStart, true);
      } else {
        stopMixPlayback();
        setCurrentTime(0);
      }
    };
    rafRef.current = requestAnimationFrame(updateTime);
  }, [track1, track2, volume1, volume2, offset2, dur1, dur2, maxDuration, startFrom, selectionStart, selectionEnd, stopMixPlayback]);

  const handleSeekTrack1 = useCallback((time: number) => {
    setStartFrom(time);
    if (isPlaying) startMixPlayback(time);
  }, [isPlaying, startMixPlayback]);

  const handleSeekTrack2 = useCallback((time: number) => {
    const timelinePos = Math.max(0, time + offset2);
    setStartFrom(timelinePos);
    if (isPlaying) startMixPlayback(timelinePos);
  }, [isPlaying, offset2, startMixPlayback]);

  // 音量リアルタイム反映
  useEffect(() => {
    if (gain1Ref.current) gain1Ref.current.gain.value = volume1;
  }, [volume1]);
  useEffect(() => {
    if (gain2Ref.current) gain2Ref.current.gain.value = volume2;
  }, [volume2]);

  // トラック差し替え時リセット
  useEffect(() => {
    stopMixPlayback();
    setCurve1(null); setCurve2(null); setScore(null);
    setSelectionStart(null); setSelectionEnd(null); setLoopEnabled(false);
  }, [track1, track2, stopMixPlayback]);

  // offset変更時スコアリセット
  useEffect(() => { setScore(null); }, [offset2]);

  // vocalMode切替時に古い解析結果をクリア（ラベルと内容の不一致防止）
  useEffect(() => { setCurve1(null); setCurve2(null); setScore(null); }, [vocalMode]);

  // ピッチ解析
  const handleAnalyze = useCallback(async () => {
    if (!track1 || !track2 || analyzing) return;
    setAnalyzing(true);
    setAnalyzeProgress(0);
    try {
      let buf1 = track1.buffer;
      let buf2 = track2.buffer;
      if (vocalMode) {
        [buf1, buf2] = await Promise.all([
          extractVocals(track1.buffer),
          extractVocals(track2.buffer),
        ]);
      }
      const c1 = await extractPitchCurve(buf1, p => setAnalyzeProgress(Math.round(p / 2)));
      const c2 = await extractPitchCurve(buf2, p => setAnalyzeProgress(50 + Math.round(p / 2)));
      setCurve1(c1);
      setCurve2(c2);
      setScore(calcVoiceScore(c1, c2, offset2));
    } finally {
      setAnalyzing(false);
      setAnalyzeProgress(0);
    }
  }, [track1, track2, offset2, analyzing, vocalMode]);

  useEffect(() => { return () => stopMixPlayback(); }, [stopMixPlayback]);

  const handleSelectionChange = useCallback((start: number, end: number) => {
    setSelectionStart(start);
    setSelectionEnd(end);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectionStart(null);
    setSelectionEnd(null);
    setLoopEnabled(false);
  }, []);

  if (!hasBothTracks) {
    return (
      <div className="rounded-lg p-6 text-center" style={{ backgroundColor: "var(--color-surface)" }}>
        <p style={{ color: "var(--color-text-muted)" }} className="text-sm">
          2つのトラックを読み込むと比較できます
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg p-4" style={{ backgroundColor: "var(--color-surface)" }}>
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium">比較</h3>
        <div className="flex gap-1">
          {(["side-by-side", "overlay", "pitch"] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-2 py-1 text-xs rounded transition ${
                viewMode === mode ? "bg-white/20" : "bg-white/5 hover:bg-white/10"
              }`}
            >
              {mode === "side-by-side" ? "並列" : mode === "overlay" ? "重ね合わせ" : "ピッチ"}
            </button>
          ))}
        </div>
      </div>

      {/* 波形表示エリア */}
      {viewMode === "side-by-side" ? (
        <div className="space-y-1">
          <div className="text-[10px] pl-1" style={{ color: COLORS.brand }}>トラック 1（お手本）</div>
          <WaveformCanvas
            peaks={peaks1}
            color={COLORS.brand}
            currentTime={currentTime}
            duration={dur1}
            height={80}
            onSeek={handleSeekTrack1}
            selectionStart={selectionStart != null ? selectionStart : undefined}
            selectionEnd={selectionEnd != null ? selectionEnd : undefined}
            onSelectionChange={handleSelectionChange}
          />
          <div className="text-[10px] pl-1 mt-2" style={{ color: COLORS.reference }}>トラック 2（自分の声）</div>
          <WaveformCanvas
            peaks={peaks2}
            color={COLORS.reference}
            currentTime={Math.max(0, currentTime - offset2)}
            duration={dur2}
            height={80}
            onSeek={handleSeekTrack2}
          />
        </div>
      ) : viewMode === "overlay" ? (
        <div className="space-y-1">
          <div className="text-[10px] flex items-center gap-2 px-1" style={{ color: "var(--color-text-muted)" }}>
            <span style={{ color: COLORS.brand }}>■</span> お手本（固定）
            <span style={{ color: COLORS.reference }} className="ml-2">■</span> 自分の声
            <span className="ml-auto font-mono text-[10px]">
              トラック2: {offset2 >= 0 ? "+" : ""}{offset2.toFixed(2)}秒
              {offset2 !== 0 && (
                <button
                  onClick={() => setOffset2(0)}
                  className="ml-2 px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20 transition text-[9px]"
                >リセット</button>
              )}
            </span>
          </div>
          <WaveformCanvas
            peaks={peaks1}
            color={COLORS.brand}
            currentTime={currentTime}
            duration={maxDuration}
            height={140}
            overlayPeaks={peaks2}
            overlayColor={COLORS.reference}
            overlayOffset={offset2}
            onOverlayOffsetChange={(newOffset) => {
              setOffset2(newOffset);
              if (isPlaying) startMixPlayback(currentTime);
            }}
            selectionStart={selectionStart != null ? selectionStart : undefined}
            selectionEnd={selectionEnd != null ? selectionEnd : undefined}
            onSelectionChange={handleSelectionChange}
          />
          <p className="text-[10px] text-center" style={{ color: "var(--color-text-muted)" }}>
            青い波形をドラッグ → タイミング調整　｜　空白をドラッグ → 範囲選択
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <PitchCurveCanvas
            curve1={curve1}
            curve2={curve2}
            offset2Sec={offset2}
            currentTime={currentTime}
            duration={maxDuration}
            height={160}
            onSeek={(time) => {
              setStartFrom(time);
              if (isPlaying) startMixPlayback(time);
            }}
          />
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={handleAnalyze}
              disabled={analyzing}
              className="px-3 py-1.5 text-xs rounded bg-white/10 hover:bg-white/20 transition disabled:opacity-50"
            >
              {analyzing ? `解析中... ${analyzeProgress}%` : curve1 ? "再解析" : "ピッチ解析を実行"}
            </button>
            <button
              onClick={() => setVocalMode(v => !v)}
              className={`px-3 py-1.5 text-xs rounded transition ${
                vocalMode ? "bg-white/25 ring-1 ring-white/40" : "bg-white/5 hover:bg-white/10"
              }`}
            >
              {vocalMode ? "🎤 ボーカルのみ ON" : "🎤 ボーカルのみ"}
            </button>
            <span className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>
              {!curve1
                ? "解析するとピッチカーブとスコアが表示されます"
                : vocalMode ? "ボーカル帯域(80Hz〜5kHz)で比較中" : ""}
            </span>
          </div>
          {score && (
            <div className="p-3 rounded" style={{ backgroundColor: "var(--color-surface-light)" }}>
              <ScorePanel score={score} />
            </div>
          )}
        </div>
      )}

      {/* 範囲選択コントロール（Step 2） */}
      {hasSelection && (
        <div className="mt-2 px-2 py-1.5 rounded flex items-center gap-3 text-[10px]"
          style={{ backgroundColor: "rgba(255,255,255,0.06)" }}>
          <span style={{ color: "var(--color-text-muted)" }}>
            選択: {formatTime(selectionStart!)} 〜 {formatTime(selectionEnd!)}
            （{((selectionEnd! - selectionStart!) ).toFixed(1)}秒）
          </span>
          <button
            onClick={() => {
              setStartFrom(selectionStart!);
              // ループOFF時も selectionEnd で止めるため loopMode=true で呼ぶ（ループ折り返しはloopRefで制御）
              startMixPlayback(selectionStart!, true);
            }}
            className="px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 transition"
          >
            ▶ この区間を再生
          </button>
          <button
            onClick={() => setLoopEnabled(v => !v)}
            className={`px-2 py-0.5 rounded transition ${
              loopEnabled ? "bg-white/25 ring-1 ring-white/40" : "bg-white/5 hover:bg-white/15"
            }`}
          >
            {loopEnabled ? "🔁 ループ ON" : "🔁 ループ"}
          </button>
          <button
            onClick={clearSelection}
            className="ml-auto px-2 py-0.5 rounded bg-white/5 hover:bg-white/15 transition"
            style={{ color: "var(--color-text-muted)" }}
          >
            選択解除
          </button>
        </div>
      )}

      {/* 再生コントロール */}
      <div className="flex items-center gap-3 mt-3">
        <button
          onClick={() => (isPlaying ? stopMixPlayback() : startMixPlayback(undefined, loopEnabled && hasSelection))}
          className="px-3 py-1.5 text-xs rounded bg-white/10 hover:bg-white/20 transition"
        >
          {isPlaying ? "⏸ 停止" : "▶ 重ね再生"}
        </button>
        <span className="text-xs font-mono" style={{ color: "var(--color-text-muted)" }}>
          {formatTime(currentTime)} / {formatTime(maxDuration)}
        </span>
        {startFrom > 0 && (
          <>
            <span className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>
              ({formatTime(startFrom)}から)
            </span>
            <button
              onClick={() => setStartFrom(0)}
              className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/10 transition"
              style={{ color: "var(--color-text-muted)" }}
            >
              先頭に戻す
            </button>
          </>
        )}
      </div>

      {/* タイミング調整パネル */}
      <div className="mt-3 p-3 rounded" style={{ backgroundColor: "var(--color-surface-light)" }}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            トラック2 タイミング調整
            {viewMode === "overlay" && (
              <span className="ml-2 text-[10px] opacity-60">（波形ドラッグでも調整可）</span>
            )}
          </span>
          <div className="flex items-center gap-2">
            <input
              type="number"
              step={0.01}
              value={offset2}
              onChange={(e) => setOffset2(parseFloat(e.target.value) || 0)}
              className="w-20 text-xs font-mono text-center rounded px-1 py-0.5 bg-white/10 outline-none"
              style={{ color: "var(--color-text-muted)" }}
            />
            <span className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>秒</span>
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

        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10px] w-16" style={{ color: "var(--color-text-muted)" }}>スライダー</span>
          <input
            type="range"
            min={-Math.max(dur1, dur2)}
            max={Math.max(dur1, dur2)}
            step={0.01}
            value={offset2}
            onChange={(e) => setOffset2(parseFloat(e.target.value))}
            className="flex-1 h-1 accent-white"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] w-16" style={{ color: "var(--color-text-muted)" }}>微調整</span>
          <div className="flex gap-1 flex-wrap">
            {([-1, -0.1, -0.01] as number[]).map((v) => (
              <button key={v}
                onClick={() => setOffset2(prev => +parseFloat((prev + v).toFixed(2)))}
                className="px-2 py-0.5 text-[10px] rounded bg-white/5 hover:bg-white/15 transition"
              >{v}s</button>
            ))}
            {([0.01, 0.1, 1] as number[]).map((v) => (
              <button key={v}
                onClick={() => setOffset2(prev => +parseFloat((prev + v).toFixed(2)))}
                className="px-2 py-0.5 text-[10px] rounded bg-white/5 hover:bg-white/15 transition"
              >+{v}s</button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
