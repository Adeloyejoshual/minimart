// src/utils/scrollHelpers.js

/**
 * Scroll utility functions.
 * Extracted from useTermsScroll to keep the hook clean.
 * All functions are pure — no side effects, fully testable.
 */

/**
 * Safely computes scroll progress as a percentage (0–100).
 * Returns 100 when content fits without scrolling to prevent NaN.
 *
 * @param {number} scrollTop    - Current scroll position
 * @param {number} scrollHeight - Total scrollable height
 * @param {number} clientHeight - Visible container height
 * @returns {number} Integer between 0 and 100
 */
export function computeScrollProgress(scrollTop, scrollHeight, clientHeight) {
  const total = scrollHeight - clientHeight;
  if (total <= 0) return 100;
  const raw = (scrollTop / total) * 100;
  return clampProgress(raw);
}

/**
 * Clamps a raw progress value to a valid integer between 0 and 100.
 * Guards against floating point drift and rAF race conditions.
 *
 * @param {number} value
 * @returns {number}
 */
export function clampProgress(value) {
  return Math.min(Math.max(Math.round(value), 0), 100);
}

/**
 * Wraps a callback in requestAnimationFrame with automatic
 * cancellation of the previous pending frame.
 * Returns a cancel function for cleanup.
 *
 * @param {Function} callback
 * @returns {{ schedule: Function, cancel: Function }}
 *
 * @example
 * const rAF = createRAFDebounce(handleScroll);
 * element.addEventListener("scroll", rAF.schedule);
 * // On cleanup:
 * rAF.cancel();
 */
export function createRAFDebounce(callback) {
  let rafId = null;

  function schedule() {
    if (rafId !== null) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(() => {
      rafId = null;
      callback();
    });
  }

  function cancel() {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  return { schedule, cancel };
}

/**
 * Returns passive event listener options with a fallback
 * for browsers that do not support the options object.
 *
 * @returns {boolean | { passive: true }}
 */
export function getPassiveEventOptions() {
  let supportsPassive = false;

  try {
    const opts = Object.defineProperty({}, "passive", {
      get() {
        supportsPassive = true;
        return true;
      },
    });
    window.addEventListener("__test__", null, opts);
    window.removeEventListener("__test__", null, opts);
  } catch {
    // Browser does not support options object — use boolean
  }

  return supportsPassive ? { passive: true } : false;
}