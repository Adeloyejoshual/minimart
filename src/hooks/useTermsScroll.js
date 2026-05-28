// src/hooks/useTermsScroll.js
import { useState, useEffect, useRef, useCallback } from "react";
import { createRAFDebounce }    from "../utils/scrollHelpers";
import { computeScrollProgress } from "../utils/scrollHelpers";
import { hasMetReadThreshold }  from "../utils/termsValidation";

/**
 * Tracks scroll progress on the page (window scroll),
 * not an inner scrollable div.
 *
 * The .terms-content element is used only as a ref to
 * measure position — the page itself scrolls naturally.
 * This matches the existing CSS which has no overflow-y
 * on .terms-content.
 */
export function useTermsScroll() {
  const contentRef                          = useRef(null);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [hasRead, setHasRead]               = useState(false);

  const handleScroll = useCallback(() => {
    // ── Measure the document scroll, not an inner element ──
    const scrollTop    = window.scrollY || document.documentElement.scrollTop;
    const scrollHeight = document.documentElement.scrollHeight;
    const clientHeight = document.documentElement.clientHeight;

    const progress = computeScrollProgress(scrollTop, scrollHeight, clientHeight);

    setScrollProgress(progress);
    if (hasMetReadThreshold(progress)) setHasRead(true);
  }, []);

  useEffect(() => {
    const { schedule, cancel } = createRAFDebounce(handleScroll);

    window.addEventListener("scroll", schedule, { passive: true });

    // ── Run once on mount in case content is short ──
    handleScroll();

    return () => {
      window.removeEventListener("scroll", schedule);
      cancel();
    };
  }, [handleScroll]);

  return { contentRef, scrollProgress, hasRead, setHasRead };
}