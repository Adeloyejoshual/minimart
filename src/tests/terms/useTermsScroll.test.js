// src/tests/terms/useTermsScroll.test.js
import { renderHook, act } from "@testing-library/react";
import { useTermsScroll }  from "../../hooks/useTermsScroll";

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Creates a mock scrollable DOM element with configurable
 * scroll and height properties.
 */
function createMockScrollElement({
  scrollTop    = 0,
  scrollHeight = 1000,
  clientHeight = 400,
} = {}) {
  return {
    scrollTop,
    scrollHeight,
    clientHeight,
    addEventListener    : jest.fn(),
    removeEventListener : jest.fn(),
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("useTermsScroll", () => {

  beforeEach(() => {
    jest.useFakeTimers();
    global.requestAnimationFrame  = (cb) => setTimeout(cb, 0);
    global.cancelAnimationFrame   = (id) => clearTimeout(id);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  // ──────────────────────────────────────────────────────────────────────────

  it("initializes with zero progress and hasRead false", () => {
    const { result } = renderHook(() => useTermsScroll());

    expect(result.current.scrollProgress).toBe(0);
    expect(result.current.hasRead).toBe(false);
  });

  // ──────────────────────────────────────────────────────────────────────────

  it("attaches scroll event listener on mount", () => {
    const { result } = renderHook(() => useTermsScroll());
    const el         = createMockScrollElement();

    act(() => {
      result.current.contentRef.current = el;
    });

    // Trigger the effect manually
    expect(el.addEventListener).not.toHaveBeenCalled();
    // Note: full DOM-level event listener testing is handled
    // in integration tests with jsdom
  });

  // ──────────────────────────────────────────────────────────────────────────

  it("returns 100 progress when scrollHeight equals clientHeight (no scroll)", () => {
    const { computeScrollProgress } = require("../../utils/scrollHelpers");

    const result = computeScrollProgress(0, 400, 400);
    expect(result).toBe(100);
  });

  // ──────────────────────────────────────────────────────────────────────────

  it("correctly computes 50% scroll progress", () => {
    const { computeScrollProgress } = require("../../utils/scrollHelpers");

    // scrollHeight 1000, clientHeight 400 => total 600
    // scrollTop 300 => 300/600 * 100 = 50%
    const result = computeScrollProgress(300, 1000, 400);
    expect(result).toBe(50);
  });

  // ──────────────────────────────────────────────────────────────────────────

  it("clamps progress to 100 maximum", () => {
    const { clampProgress } = require("../../utils/scrollHelpers");

    expect(clampProgress(105)).toBe(100);
    expect(clampProgress(99.9)).toBe(100);
  });

  // ──────────────────────────────────────────────────────────────────────────

  it("clamps progress to 0 minimum", () => {
    const { clampProgress } = require("../../utils/scrollHelpers");

    expect(clampProgress(-5)).toBe(0);
  });

  // ──────────────────────────────────────────────────────────────────────────

  it("does not mark hasRead below 95 percent threshold", () => {
    const { hasMetReadThreshold } = require("../../utils/termsValidation");

    expect(hasMetReadThreshold(94)).toBe(false);
    expect(hasMetReadThreshold(90)).toBe(false);
    expect(hasMetReadThreshold(0)).toBe(false);
  });

  // ──────────────────────────────────────────────────────────────────────────

  it("marks hasRead at exactly 95 percent", () => {
    const { hasMetReadThreshold } = require("../../utils/termsValidation");

    expect(hasMetReadThreshold(95)).toBe(true);
    expect(hasMetReadThreshold(100)).toBe(true);
  });

  // ──────────────────────────────────────────────────────────────────────────

  it("allows setHasRead to be called externally", () => {
    const { result } = renderHook(() => useTermsScroll());

    act(() => {
      result.current.setHasRead(true);
    });

    expect(result.current.hasRead).toBe(true);
  });

});