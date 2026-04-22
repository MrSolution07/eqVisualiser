import { useEffect, useState } from "react";

/**
 * Subscribes to `window.matchMedia(query)` and returns whether it currently matches.
 * SSR-safe: false until mounted in the browser.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(query).matches : false,
  );

  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMatches(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [query]);

  return matches;
}
