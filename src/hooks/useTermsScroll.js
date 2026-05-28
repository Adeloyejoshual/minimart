// src/hooks/useTermsScroll.js
import { useState, useEffect, useRef, useCallback } from "react";
import {
  computeScrollProgress,
  hasMetReadThreshold,
} from "../utils/termsValidation";

/**
 * Tracks scroll progress within a scrollable container.
 * Uses requestAnimationFrame for debouncing.
 * Exposes progress (0-100) and hasRead boolean.
 */
export function useTermsScroll() {
  const contentRef                          = useRef(null);
  const rafRef                              = useRef(null);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [hasRead, setHasRead]               = useState(false);

  const handleScroll = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    rafRef.current = requestAnimationFrame(() => {
      const el = contentRef.current;
      if (!el) return;

      const progress = computeScrollProgress(
        el.scrollTop,
        el.scrollHeight,
        el.clientHeight
      );

      setScrollProgress(progress);
      if (hasMetReadThreshold(progress)) setHasRead(true);
    });
  }, []);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;

    el.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      el.removeEventListener("scroll", handleScroll);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [handleScroll]);

  return { contentRef, scrollProgress, hasRead, setHasRead };
}