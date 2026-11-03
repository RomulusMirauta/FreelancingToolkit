import { useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { LANGS, useT, type Lang } from '../../lib/i18n';
import { THEMES, type Theme } from '../../lib/ui/theme';

/**
 * A switch drawn as a slider: a thumb that glides between the stops. Click a stop, or drag the thumb and let go
 * (it settles on the nearest stop). Arrow keys move it too. `stop` is the width of one stop in px.
 */
function Slider<T extends string>({ value, options, onChange, label, stop, className }: {
  value: T;
  options: readonly { value: T; content: ReactNode; title: string; lang?: string }[];
  onChange: (v: T) => void;
  label: string;
  stop: number;
  className: string;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const start = useRef<{ x: number; moved: boolean } | null>(null);
  /** While dragging: the thumb's offset in px, following the pointer. */
  const [drag, setDrag] = useState<number | null>(null);
  const index = options.findIndex((o) => o.value === value);

  const offsetAt = (clientX: number) => {
    const box = trackRef.current!.getBoundingClientRect();
    return Math.min(Math.max(clientX - box.left - 3 - stop / 2, 0), stop * (options.length - 1));
  };
  const valueAt = (offset: number) => options[Math.round(offset / stop)]!.value;

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    start.current = { x: e.clientX, moved: false };
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!start.current) return;
    if (Math.abs(e.clientX - start.current.x) > 3) start.current.moved = true;
    if (start.current.moved) setDrag(offsetAt(e.clientX));
  };
  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    if (!start.current) return;
    onChange(valueAt(offsetAt(e.clientX))); // a click lands on the stop under the pointer, a drag on the nearest
    start.current = null;
    setDrag(null);
  };
  const onKeyDown = (e: KeyboardEvent) => {
    const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (index + step + options.length) % options.length;
    onChange(options[next]!.value);
    trackRef.current?.querySelectorAll('button')[next]?.focus();
  };

  return (
    <div
      ref={trackRef}
      className={`slider ${className}${drag !== null ? ' dragging' : ''}`}
      role="radiogroup"
      aria-label={label}
      style={{ ['--stop' as string]: `${stop}px` }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => { start.current = null; setDrag(null); }}
      onKeyDown={onKeyDown}
    >
      <span className="slider-thumb" aria-hidden="true" style={{ transform: `translateX(${drag ?? index * stop}px)` }} />
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          lang={o.lang}
          aria-checked={value === o.value}
          aria-label={o.title}
          title={o.title}
          tabIndex={value === o.value ? 0 : -1}
          // Pointer clicks are handled on the track (so a drag can end anywhere); this is for the keyboard.
          onClick={(e) => { if (e.detail === 0) onChange(o.value); }}
        >
          <span aria-hidden="true">{o.content}</span>
        </button>
      ))}
    </div>
  );
}

const THEME_ICONS: Record<Theme, string> = { system: '◐', light: '☀', dark: '☾' };

/** The theme switch, in the "Settings & options" menu: ◐ Automatic, ☀ Light, ☾ Dark, each icon with its name. */
export function ThemeSlider({ theme, setTheme }: { theme: Theme; setTheme: (t: Theme) => void }) {
  const t = useT().app;
  return (
    <Slider
      value={theme}
      options={THEMES.map((th) => ({
        value: th,
        content: <><i className="slider-icon">{THEME_ICONS[th]}</i>{t.themeShort[th]}</>,
        title: t.themes[th],
      }))}
      onChange={setTheme}
      label={t.theme}
      stop={88}
      className="theme-slider"
    />
  );
}

const LANG_NAMES: Record<Lang, string> = { ro: 'Română', en: 'English' };

/** The language switch, in the menu under the theme: Română | English, each named in its own language. */
export function LangSlider({ lang, setLang }: { lang: Lang; setLang: (l: Lang) => void }) {
  const t = useT().app;
  return (
    <Slider
      value={lang}
      options={LANGS.map((l) => ({ value: l, content: LANG_NAMES[l], title: LANG_NAMES[l], lang: l }))}
      onChange={setLang}
      label={t.language}
      stop={132}
      className="lang-slider"
    />
  );
}
