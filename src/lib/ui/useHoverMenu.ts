import { useEffect, useRef, useState, type PointerEvent } from 'react';

/**
 * A menu that opens on hover with a mouse and on click everywhere (touch has no hover). Closing waits a moment,
 * so moving the mouse from the button to the menu doesn't shut it. Esc and a click outside close it.
 */
export function useHoverMenu(closeDelay = 250) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const timer = useRef<number | undefined>(undefined);
  /** When hover opened it: a click right after (the mouse got there and clicked) must not close it again. */
  const hoverOpenedAt = useRef(0);

  const cancelClose = () => window.clearTimeout(timer.current);
  const closeSoon = () => {
    cancelClose();
    timer.current = window.setTimeout(() => setOpen(false), closeDelay);
  };

  useEffect(() => {
    if (!open) return;
    const onDown = (e: globalThis.PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => () => cancelClose(), []);

  return {
    open,
    setOpen,
    rootRef,
    /** Spread on the wrapper around the button and the menu. */
    hoverProps: {
      onPointerEnter: (e: PointerEvent) => {
        if (e.pointerType !== 'mouse') return;
        cancelClose();
        if (!open) hoverOpenedAt.current = Date.now();
        setOpen(true);
      },
      onPointerLeave: (e: PointerEvent) => {
        if (e.pointerType === 'mouse') closeSoon();
      },
    },
    toggle: () => {
      cancelClose();
      if (open && Date.now() - hoverOpenedAt.current < 800) return;
      setOpen(!open);
    },
  };
}
