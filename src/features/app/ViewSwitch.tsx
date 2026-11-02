import { useLayoutEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react';

interface Option<V extends string> {
  value: V;
  label: string;
  icon: ReactNode;
}

/**
 * Converter | Taxes as a slider: the green thumb glides (and stretches, the buttons differ in width) to the
 * open section. Click a section, or drag the thumb and let go on the nearest one.
 */
export function ViewSwitch<V extends string>({ value, options, onChange, label }: {
  value: V;
  options: readonly Option<V>[];
  onChange: (v: V) => void;
  label: string;
}) {
  const navRef = useRef<HTMLElement>(null);
  const start = useRef<{ x: number; moved: boolean } | null>(null);
  /** Each button's left edge and width inside the switch, measured. */
  const [boxes, setBoxes] = useState<{ left: number; width: number }[]>([]);
  /** While dragging: where the thumb's centre follows the pointer. */
  const [drag, setDrag] = useState<number | null>(null);
  const index = options.findIndex((o) => o.value === value);
  // The options array is new on every render; only the labels change the buttons' widths.
  const labels = options.map((o) => o.label).join('|');

  // Measure again when the labels change width (language) or the window resizes.
  useLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const measure = () =>
      setBoxes([...nav.querySelectorAll('button')].map((b) => ({ left: b.offsetLeft, width: b.offsetWidth })));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(nav);
    return () => ro.disconnect();
  }, [labels]);

  const centres = boxes.map((b) => b.left + b.width / 2);
  const xIn = (clientX: number) => clientX - navRef.current!.getBoundingClientRect().left;
  const nearest = (x: number) =>
    centres.reduce((best, c, i) => (Math.abs(c - x) < Math.abs(centres[best]! - x) ? i : best), 0);

  const onPointerDown = (e: PointerEvent<HTMLElement>) => {
    if (e.button !== 0 || !boxes.length) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    start.current = { x: e.clientX, moved: false };
  };
  const onPointerMove = (e: PointerEvent<HTMLElement>) => {
    if (!start.current) return;
    if (Math.abs(e.clientX - start.current.x) > 4) start.current.moved = true;
    if (start.current.moved) setDrag(Math.min(Math.max(xIn(e.clientX), centres[0]!), centres[centres.length - 1]!));
  };
  const onPointerUp = (e: PointerEvent<HTMLElement>) => {
    if (!start.current) return;
    const next = options[nearest(xIn(e.clientX))]!.value;
    start.current = null;
    setDrag(null);
    if (next !== value) onChange(next);
  };

  // The thumb: on the open section, or (dragging) centred on the pointer with the width of the nearest one.
  const box = boxes[drag === null ? index : nearest(drag)];
  const thumb = box && (drag === null ? box : { left: drag - box.width / 2, width: box.width });

  return (
    <nav
      ref={navRef}
      className={`views${drag !== null ? ' dragging' : ''}`}
      aria-label={label}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => { start.current = null; setDrag(null); }}
    >
      {thumb && <span className="views-thumb" aria-hidden="true" style={{ transform: `translateX(${thumb.left}px)`, width: thumb.width }} />}
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-current={value === o.value ? 'page' : undefined}
          // Pointer clicks are handled on the switch (so a drag can end anywhere); this is for the keyboard.
          onClick={(e) => { if (e.detail === 0) onChange(o.value); }}
        >
          <span className="views-icon">{o.icon}</span>
          {o.label}
        </button>
      ))}
    </nav>
  );
}
