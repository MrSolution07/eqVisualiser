import type { ReactElement } from "react";

type DesktopToolbarProps = {
  title: string;
  t: number;
  duration: number;
  fps: number;
  playing: boolean;
  exporting: boolean;
  onPlayPause: () => void;
  onScrub: (next: number) => void;
  onExport: () => void;
};

/**
 * Top bar for non-mobile: playback, timeline scrub, export, and meta labels.
 */
export function DesktopToolbar({
  title,
  t,
  duration,
  fps,
  playing,
  exporting,
  onPlayPause,
  onScrub,
  onExport,
}: DesktopToolbarProps): ReactElement {
  return (
    <div className="toolbar toolbar--desktop">
      <span className="title">{title}</span>
      <button type="button" className="btn" onClick={onPlayPause} disabled={exporting}>
        {playing ? "Pause" : "Play"}
      </button>
      <input
        className="scribe"
        type="range"
        min={0}
        max={duration}
        step={0.01}
        value={t}
        onChange={(e) => onScrub(Number(e.target.value))}
      />
      <span className="timeLabel">
        {t.toFixed(2)}s / {duration.toFixed(1)}s
      </span>
      <button type="button" className="btn" onClick={onExport} disabled={exporting || playing}>
        {exporting ? "Exporting…" : "Export video"}
      </button>
      <span className="timeLabel">{fps} fps</span>
    </div>
  );
}
