import { useEffect } from "react";

/**
 * Hides mobile chrome after idle playback time unless reduced motion; closes menu when chrome hides.
 */
export function useMobileChromeAutohide(
  isMobile: boolean,
  playing: boolean,
  reducedMotion: boolean,
  /** scrub time — bumping re-triggers the hide timer */
  t: number,
  chromeVisible: boolean,
  setChromeVisible: (value: boolean | ((prev: boolean) => boolean)) => void,
  setMenuOpen: (open: boolean) => void,
): void {
  useEffect(() => {
    if (!isMobile || !playing || reducedMotion) {
      setChromeVisible(true);
      return;
    }
    setChromeVisible(true);
    const id = window.setTimeout(() => setChromeVisible(false), 2600);
    return () => clearTimeout(id);
  }, [isMobile, playing, reducedMotion, t, setChromeVisible]);

  useEffect(() => {
    if (!chromeVisible) setMenuOpen(false);
  }, [chromeVisible, setMenuOpen]);
}
