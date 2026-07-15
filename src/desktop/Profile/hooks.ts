/* ═══════════════════════════════════════════════════════════════
   DESKTOP PROFILE — CUSTOM HOOKS
═══════════════════════════════════════════════════════════════ */
import { useState, useEffect, useRef, useCallback } from "react";
import { animate } from "framer-motion";

/* ── Desktop media query ── */
export function useIsDesktop(query = "(min-width: 1024px)"): boolean {
  const getMatch = (): boolean =>
    typeof window !== "undefined" && window.matchMedia(query).matches;

  const [matches, setMatches] = useState<boolean>(getMatch);

  useEffect(() => {
    const media = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    setMatches(media.matches);
    if (media.addEventListener) {
      media.addEventListener("change", handler);
    } else {
      media.addListener(handler);
    }
    return () => {
      if (media.removeEventListener) {
        media.removeEventListener("change", handler);
      } else {
        media.removeListener(handler);
      }
    };
  }, [query]);

  return matches;
}

/* ── Animated number counter ── */
export function useAnimatedCounter(
  to: number,
  duration = 1.1
): number {
  const [display, setDisplay] = useState<number>(0);
  const prev = useRef<number>(0);

  useEffect(() => {
    const from = prev.current;
    prev.current = to;
    if (from === to) return;

    const ctrl = animate(from, to, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setDisplay(Math.round(v * 10) / 10),
    });

    return () => ctrl.stop();
  }, [to, duration]);

  return display;
}

/* ── Drag scroll (desktop, fine pointer only) ── */
export function useDragScroll(enabled = true): React.RefObject<HTMLDivElement> {
  const ref = useRef<HTMLDivElement>(null);
  const state = useRef({
    isDown: false,
    startX: 0,
    scrollLeft: 0,
    hasDragged: false,
  });

  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;

    const isFine =
      typeof window !== "undefined" &&
      window.matchMedia("(pointer: fine)").matches;
    if (!isFine) return;

    const THRESH = 5;

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      state.current = {
        isDown: true,
        hasDragged: false,
        startX: e.pageX - el.offsetLeft,
        scrollLeft: el.scrollLeft,
      };
      el.classList.add("dp-drag");
    };

    const onMouseUp = () => {
      state.current.isDown = false;
      el.classList.remove("dp-drag");
    };

    const onMouseLeave = () => {
      if (!state.current.isDown) return;
      state.current.isDown = false;
      el.classList.remove("dp-drag");
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!state.current.isDown) return;
      e.preventDefault();
      const x = e.pageX - el.offsetLeft;
      const walk = x - state.current.startX;
      if (Math.abs(walk) > THRESH) state.current.hasDragged = true;
      el.scrollLeft = state.current.scrollLeft - walk * 1.4;
    };

    const onClickCapture = (e: MouseEvent) => {
      if (state.current.hasDragged) {
        e.stopPropagation();
        e.preventDefault();
        state.current.hasDragged = false;
      }
    };

    el.addEventListener("mousedown", onMouseDown);
    el.addEventListener("mouseup", onMouseUp);
    el.addEventListener("mouseleave", onMouseLeave);
    el.addEventListener("mousemove", onMouseMove, { passive: false });
    el.addEventListener("click", onClickCapture, true);

    return () => {
      el.removeEventListener("mousedown", onMouseDown);
      el.removeEventListener("mouseup", onMouseUp);
      el.removeEventListener("mouseleave", onMouseLeave);
      el.removeEventListener("mousemove", onMouseMove);
      el.removeEventListener("click", onClickCapture, true);
    };
  }, [enabled]);

  return ref;
}

/* ── Copy to clipboard ── */
export function useCopyToClipboard(resetMs = 2200) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), resetMs);
    } catch {
      /* silent */
    }
  }, [resetMs]);

  return { copied, copy };
}

/* ── Outside click ── */
export function useOutsideClick(
  ref: React.RefObject<HTMLElement>,
  handler: () => void
) {
  useEffect(() => {
    const fn = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        handler();
      }
    };
    document.addEventListener("mousedown", fn);
    document.addEventListener("touchstart", fn as EventListener);
    return () => {
      document.removeEventListener("mousedown", fn);
      document.removeEventListener("touchstart", fn as EventListener);
    };
  }, [ref, handler]);
}

/* ── Scroll spy (highlight sidebar) ── */
export function useScrollSpy(ids: string[], offset = 100): string {
  const [active, setActive] = useState<string>("");

  useEffect(() => {
    const fn = () => {
      const scrollPos = window.scrollY + offset;
      const found = ids
        .map((id) => {
          const el = document.getElementById(id);
          return el ? { id, top: el.offsetTop } : null;
        })
        .filter(Boolean)
        .reverse()
        .find((item) => item!.top <= scrollPos);
      if (found) setActive(found.id);
    };

    window.addEventListener("scroll", fn, { passive: true });
    fn();
    return () => window.removeEventListener("scroll", fn);
  }, [ids, offset]);

  return active;
}