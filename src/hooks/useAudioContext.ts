"use client";

import { useRef, useCallback, useState } from "react";
import { SAMPLE_RATE } from "@/lib/constants";

export function useAudioContext() {
  const ctxRef = useRef<AudioContext | null>(null);
  const [state, setState] = useState<AudioContextState>("suspended");

  const getContext = useCallback(() => {
    if (!ctxRef.current) {
      ctxRef.current = new AudioContext({ sampleRate: SAMPLE_RATE });
      setState(ctxRef.current.state);
    }
    return ctxRef.current;
  }, []);

  const resume = useCallback(async () => {
    const ctx = getContext();
    if (ctx.state === "suspended") {
      await ctx.resume();
      setState(ctx.state);
    }
    return ctx;
  }, [getContext]);

  return { audioContext: ctxRef.current, getContext, resume, state };
}
