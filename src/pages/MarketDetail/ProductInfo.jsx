import React, {
  useState,
  memo,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from "react";
import "./styles/ProductInfo.css";

// ═══════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════

const CONFIG = {
  COLLAPSE_THRESHOLD: 300, // character count
  LINE_LIMIT: 8,           // structured line count
  COLLAPSED_HEIGHT: 160,   // px — matches CSS max-height
};

// ═══════════════════════════════════════════════════════════════
// TYPE DEFINITIONS (JSDoc for IDE support without TypeScript)
// ═══════════════════════════════════════════════════════════════

/**
 * @typedef {"heading" | "bullet" | "divider" | "text"} LineType
 *
 * @typedef {{ id: string, type: LineType, content: string }} ParsedLine
 */

// ═══════════════════════════════════════════════════════════════
// PURE HELPERS
// ═══════════════════════════════════════════════════════════════

/**
 * Classify a single trimmed line into its content type.
 * Order of checks matters — most specific first.
 *
 * @param {string} line
 * @returns {LineType}
 */
function getLineType(line) {
  if (line.startsWith("### "))              return "heading";
  if (line.startsWith("- ") ||
      line.startsWith("* "))               return "bullet";
  if (/^[-─═]{3,}$/.test(line))            return "divider";
  return "text";
}

/**
 * Strip syntax markers and normalize content per line type.
 *
 * @param {string}   line
 * @param {LineType} type
 * @returns {string}
 */
function normalizeContent(line, type) {
  switch (type) {
    case "heading":  return line.replace(/^###\s*/, "").trim();
    case "bullet":   return line.replace(/^[-*]\s*/, "• ").trim();
    case "divider":  return "";
    default:         return line.trim();
  }
}

/**
 * Convert raw description string into structured ParsedLine array.
 * Pure function — safe to run inside useMemo.
 *
 * @param {string} raw
 * @returns {ParsedLine[]}
 */
function parseDescription(raw = "") {
  if (!raw.trim()) return [];

  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const type    = getLineType(line);
      const content = normalizeContent(line, type);

      return {
        id:      `line-${index}-${type}`, // stable + descriptive key
        type,
        content,
      };
    });
}

/**
 * Detect and convert URLs in a string into clickable anchor elements.
 * Returns a mixed array of strings and React elements.
 *
 * @param {string} text
 * @returns {(string | React.ReactElement)[]}
 */
function linkify(text) {
  // Matches http/https URLs — stops at whitespace
  const URL_PATTERN = /(https?:\/\/[^\s]+)/g;

  const parts = text.split(URL_PATTERN);

  return parts.map((part, i) => {
    if (URL_PATTERN.test(part)) {
      // Reset lastIndex after .test() to avoid regex state bugs
      URL_PATTERN.lastIndex = 0;

      return (
        <a
          key={`link-${i}`}
          href={part}
          target="_blank"
          rel="noopener noreferrer"  // security: prevents tab-napping
          className="pi-link"
          aria-label={`External link: ${part}`}
        >
          {part}
        </a>
      );
    }

    // Reset after negative test too
    URL_PATTERN.lastIndex = 0;
    return part;
  });
}

/**
 * Determine whether the description is long enough to need collapsing.
 * Uses two signals: raw character count + structured line count.
 *
 * @param {string}       raw
 * @param {ParsedLine[]} lines
 * @returns {boolean}
 */
function computeIsLong(raw, lines) {
  return (
    raw.length    > CONFIG.COLLAPSE_THRESHOLD ||
    lines.length  > CONFIG.LINE_LIMIT
  );
}

// ═══════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════

/**
 * Renders a single structured content line.
 * Each type maps to its own semantic element.
 *
 * @param {{ type: LineType, content: string }} props
 */
function DescriptionLine({ type, content }) {
  switch (type) {
    case "heading":
      return (
        <h4 className="pi-heading" aria-label={`Section: ${content}`}>
          {content}
        </h4>
      );

    case "bullet":
      return (
        <p className="pi-bullet" role="listitem">
          {linkify(content)}
        </p>
      );

    case "divider":
      return <hr className="pi-divider" aria-hidden="true" />;

    default:
      return (
        <p className="pi-text">
          {linkify(content)}
        </p>
      );
  }
}

/**
 * Gradient fade overlay — visually signals collapsed content.
 * pointer-events: none ensures it never blocks tap / text selection.
 */
function FadeOverlay() {
  return (
    <div
      className="pi-fade-overlay"
      aria-hidden="true"
      data-testid="fade-overlay"
    />
  );
}

/**
 * Accessible expand / collapse toggle button.
 *
 * @param {{ expanded: boolean, onClick: () => void }} props
 */
function ToggleButton({ expanded, onClick }) {
  return (
    <button
      className="pi-toggle-btn"
      onClick={onClick}
      aria-expanded={expanded}
      aria-controls="pi-description-body"
      aria-label={
        expanded
          ? "Collapse product description"
          : "Expand full product description"
      }
    >
      <span className="pi-toggle-label">
        {expanded ? "Show less" : "Read more"}
      </span>
      <span className="pi-toggle-icon" aria-hidden="true">
        {expanded ? "▲" : "▼"}
      </span>
    </button>
  );
}

/**
 * Empty state shown when no description is available.
 */
function EmptyDescription() {
  return (
    <p className="pi-empty" role="status" aria-live="polite">
      No description available for this product.
    </p>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

/**
 * ProductInfo — Marketplace Content Renderer Engine
 *
 * Renders structured product descriptions with:
 *   • headings, bullets, dividers, plain text
 *   • auto-linkified URLs
 *   • smart collapse / expand with fade overlay
 *   • state reset on product change
 *   • full accessibility support
 *
 * @param {{ description?: string }} props
 */
const ProductInfo = memo(function ProductInfo({ description = "" }) {
  const [expanded, setExpanded] = useState(false);

  // ── Refs ──────────────────────────────────────────────────
  const bodyRef = useRef(null);

  // ── Reset on product change ───────────────────────────────
  useEffect(() => {
    setExpanded(false);
  }, [description]);

  // ── Focus management on expand ────────────────────────────
  // When user expands, scroll body into view smoothly
  useEffect(() => {
    if (expanded && bodyRef.current) {
      bodyRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, [expanded]);

  // ── Parse once per description change ─────────────────────
  const lines = useMemo(
    () => parseDescription(description),
    [description]
  );

  // ── Collapse detection ────────────────────────────────────
  const isLong = useMemo(
    () => computeIsLong(description, lines),
    [description, lines]
  );

  // ── Stable toggle handler ─────────────────────────────────
  const handleToggle = useCallback(() => {
    setExpanded((prev) => !prev);
  }, []);

  // ── Derived class list ────────────────────────────────────
  const bodyClassName = [
    "pi-description",
    !expanded && isLong ? "pi-description--collapsed" : "",
  ]
    .filter(Boolean)
    .join(" ");

  // ─────────────────────────────────────────────────────────
  return (
    <section
      className="pi-section"
      aria-label="Product Description"
      data-testid="product-info"
    >
      {/* ── Section Header ── */}
      <h3 className="pi-section-title">Description</h3>

      {/* ── Description Body ── */}
      <div
        id="pi-description-body"
        ref={bodyRef}
        className={bodyClassName}
        aria-live="polite"
      >
        {/* Bullet groups get list role for screen readers */}
        {lines.length > 0 ? (
          <div
            role={
              lines.some((l) => l.type === "bullet")
                ? "list"
                : undefined
            }
          >
            {lines.map((line) => (
              <DescriptionLine
                key={line.id}
                type={line.type}
                content={line.content}
              />
            ))}
          </div>
        ) : (
          <EmptyDescription />
        )}

        {/* Fade overlay — only when collapsed */}
        {!expanded && isLong && <FadeOverlay />}
      </div>

      {/* ── Toggle Button ── */}
      {isLong && (
        <ToggleButton
          expanded={expanded}
          onClick={handleToggle}
        />
      )}
    </section>
  );
});

export default ProductInfo;