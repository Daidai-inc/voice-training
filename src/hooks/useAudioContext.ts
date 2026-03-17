"use client";

import { useCallback } from "react";
import { SAMPLE_RATE } from "@/lib/constants";

let sharedContext: AudioContext | null = null;

function getOrCreateContext(): AudioContext {
  if (!sharedContext || sharedContext.state === "closed") {
    sharedContext = new AudioContext({ sampleRate: SAMPLE_RATE });
  }
  return sharedContext;
}

export function useAudioContext() {
  const getContext = useCallback(() => getOrCreateContext(), []);

  const resume = useCallback(async () => {
    const ctx = getOrCreateContext();
    if (ctx.state === "suspended") {
      await ctx.resume();
    }
    return ctx;
  }, []);

  return { getContext, resume };
}
