import { useEffect, useRef } from "react";

/**
 * While `playing` is true, drives `onTick` from `startT` toward `duration` using rAF, then `onEnd`.
 */
export function useAnimationLoop(
  playing: boolean,
  startT: number,
  duration: number,
  onTick: (t: number) => void,
  onEnd: () => void,
): void {
  const onTickRef = useRef(onTick);
  const onEndRef = useRef(onEnd);
  onTickRef.current = onTick;
  onEndRef.current = onEnd;
  useEffect(() => {
    if (!playing) return;
    const startT0 = startT;
    let raf = 0;
    let t0: number | null = null;
    const loop = (now: number) => {
      if (t0 === null) t0 = now;
      const elapsed = (now - t0) / 1000;
      const time = Math.min(startT0 + elapsed, duration);
      onTickRef.current(time);
      if (time < duration) {
        raf = requestAnimationFrame(loop);
      } else {
        onEndRef.current();
      }
    };
    t0 = null;
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playing, startT, duration]);
}
