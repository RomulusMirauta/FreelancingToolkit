import { useEffect, useRef, useState, type PointerEvent } from 'react';

/**
 * A menu that opens on hover with a mouse and on click everywhere (touch has no hover). Closing waits a moment,
 * so moving the mouse from the button to the menu doesn't shut it. Esc, a click outside and the focus leaving it
 * close it. To screen readers it is a button that shows a group (aria-expanded, aria-controls), not an ARIA menu,
 * which would promise arrow keys between its items.
 */
export function useHoverMenu(closeDelay = 250) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const timer = useRef<number | undefined>(undefined);
  /** When hover opened it: a click right after (the mouse got there and clicked) must not close it again. */
  const hoverOpenedAt = useRef(0);

  const cancelClose = () => window.clearTimeout(timer.current);
  const closeSoon = () => {
    cancelClose();
    timer.current = window.setTimeout(() => setOpen(false), closeDelay);
  };
  /** The item with the focus is about to be hidden: the focus goes back to the button, or it would fall to the page. */
  const close = () => {
    if (rootRef.current?.contains(document.activeElement)) triggerRef.current?.focus();
    setOpen(false);
  };

  useEffect(() => {
    if (!open) return;
    const root = rootRef.current;
    const onDown = (e: globalThis.PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    // Tabbing out closes it, so it doesn't stay open over what has the focus now. A click on the menu's own text
    // moves the focus to nothing (no relatedTarget), and the menu stays.
    const onFocusOut = (e: FocusEvent) => {
      if (e.relatedTarget instanceof Node && !root?.contains(e.relatedTarget)) setOpen(false);
    };
    // Tabbing past its last item, or before its button, leaves the document (no relatedTarget either): it closes
    // when the focus comes back to the page anywhere else, rather than staying open for the rest of the round.
    const onFocusIn = (e: FocusEvent) => {
      if (!root?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    root?.addEventListener('focusout', onFocusOut);
    document.addEventListener('focusin', onFocusIn);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
      root?.removeEventListener('focusout', onFocusOut);
      document.removeEventListener('focusin', onFocusIn);
    };
  }, [open]);

  useEffect(() => () => cancelClose(), []);

  return {
    open,
    setOpen,
    close,
    rootRef,
    /** On the menu's button, which gets the focus back. */
    triggerRef,
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
