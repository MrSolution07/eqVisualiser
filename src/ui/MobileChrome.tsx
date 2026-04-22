import { memo, type ReactElement } from "react";

export type MobileChromeProps = {
  visible: boolean;
  title: string;
  t: number;
  duration: number;
  fps: number;
  playing: boolean;
  exporting: boolean;
  menuOpen: boolean;
  setMenuOpen: (v: boolean) => void;
  onScrub: (t: number) => void;
  onPlayPause: () => void;
  onRestart: () => void;
  onOpenEquation: () => void;
  onExport: () => void;
  onResetStory: () => void;
};

function MobileChromeInner({
  visible,
  title,
  t,
  duration,
  fps,
  playing,
  exporting,
  menuOpen,
  setMenuOpen,
  onScrub,
  onPlayPause,
  onRestart,
  onOpenEquation,
  onExport,
  onResetStory,
}: MobileChromeProps): ReactElement {
  const chromeClass = `mobileChrome ${visible ? "mobileChrome--visible" : "mobileChrome--hidden"}`;

  return (
    <>
      <header className={`${chromeClass} mobileChrome__top`}>
        <span className="mobileChrome__title">{title}</span>
        <div className="mobileChrome__topActions">
          <button type="button" className="btn btn--icon" aria-expanded={menuOpen} aria-haspopup="true" onClick={() => setMenuOpen(!menuOpen)}>
            ⋯
          </button>
          {menuOpen ? (
            <div className="mobileMenu" role="menu">
              <button type="button" className="mobileMenu__item" role="menuitem" onClick={() => { onExport(); setMenuOpen(false); }} disabled={exporting || playing}>
                {exporting ? "Exporting…" : "Export video"}
              </button>
              <button type="button" className="mobileMenu__item" role="menuitem" onClick={() => { onResetStory(); setMenuOpen(false); }}>
                Reset story
              </button>
              <div className="mobileMenu__meta" role="note">
                {fps} fps
              </div>
            </div>
          ) : null}
        </div>
      </header>

      <div className={`${chromeClass} mobileChrome__scrubWrap`}>
        <input
          className="mobileChrome__scribe"
          type="range"
          min={0}
          max={duration}
          step={0.01}
          value={t}
          aria-label="Timeline"
          onChange={(e) => onScrub(Number(e.target.value))}
        />
        <span className="mobileChrome__time">
          {t.toFixed(1)}s / {duration.toFixed(0)}s
        </span>
      </div>

      <nav className={`${chromeClass} mobileChrome__bottom`} aria-label="Playback">
        <button type="button" className="btn btn--lg" onClick={onPlayPause} disabled={exporting}>
          {playing ? "Pause" : "Play"}
        </button>
        <button type="button" className="btn btn--lg" onClick={onRestart} disabled={exporting}>
          Restart
        </button>
        <button type="button" className="btn btn--lg btn--primary" onClick={onOpenEquation} disabled={exporting}>
          Equation
        </button>
      </nav>
    </>
  );
}

export const MobileChrome = memo(MobileChromeInner);
