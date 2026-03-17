"use client";

import { useEffect, useRef, useState } from "react";

export function useWaveformAnalyzer(analyserNode: AnalyserNode | null) {
  const [timeData, setTimeData] = useState<Float32Array | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastUpdateRef = useRef(0);

  useEffect(() => {
    if (!analyserNode) {
      setTimeData(null);
      return;
    }

    const bufferLength = analyserNode.frequencyBinCount;
    const dataArray = new Float32Array(bufferLength);

    const update = () => {
      const now = performance.now();
      // 50msごとに更新（20fps）— 60fpsは不要
      if (now - lastUpdateRef.current > 50) {
        analyserNode.getFloatTimeDomainData(dataArray);
        setTimeData(new Float32Array(dataArray));
        lastUpdateRef.current = now;
      }
      rafRef.current = requestAnimationFrame(update);
    };

    rafRef.current = requestAnimationFrame(update);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [analyserNode]);

  return { timeData };
}
