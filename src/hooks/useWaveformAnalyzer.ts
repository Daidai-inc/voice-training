"use client";

import { useEffect, useRef, useState } from "react";

export function useWaveformAnalyzer(analyserNode: AnalyserNode | null) {
  const [timeData, setTimeData] = useState<Float32Array | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!analyserNode) {
      setTimeData(null);
      return;
    }

    const bufferLength = analyserNode.frequencyBinCount;
    const dataArray = new Float32Array(bufferLength);

    const update = () => {
      analyserNode.getFloatTimeDomainData(dataArray);
      // 新しいFloat32Arrayとして渡す（参照変更でReact再描画を発火）
      setTimeData(new Float32Array(dataArray));
      rafRef.current = requestAnimationFrame(update);
    };

    rafRef.current = requestAnimationFrame(update);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [analyserNode]);

  return { timeData };
}
