import React, {
  useState,
  memo,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from "react";
import "./styles/ProductInfo.css";

const CONFIG = {
  COLLAPSE_THRESHOLD: 300,
  LINE_LIMIT: 8,
  COLLAPSED_HEIGHT: 160,
};

function getLineType(line) {
  if (line.startsWith("### "))              return "heading";
  if (line.startsWith("- ") || line.startsWith("* ")) return "bullet";
  if (/^[-─═]{3,}$/.test(line))            return "divider";
  return "text";
}

function normalizeContent(line, type) {
  switch (type) {
    case "heading":  return line.replace(/^###\s*/, "").trim();
    case "bullet":   return line.replace(/^[-*]\s*/, "• ").trim();
    case "divider":  return "";
    default:         return line.trim();
  }
}

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
        id:      `line-${index}-${type}`,
        type,
        content,
      };
    });
}

function linkify(text) {
  const URL_PATTERN = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(URL_PATTERN);

  return parts.map((part, i) => {
    if (URL_PATTERN.test(part)) {
      URL_PATTERN.lastIndex = 0;
      return (
        <a
          key={`link-${i}`}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="pi-link"
          aria-label={`External link: ${part}`}
        >
          {part}
        </a>
      );
    }
    URL_PATTERN.lastIndex = 0;
    return part;
  });
}

function computeIsLong(raw, lines) {
  return (
    raw.length    > CONFIG.COLLAPSE_THRESHOLD ||
    lines.length  > CONFIG.LINE_LIMIT
  );
}

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

function FadeOverlay() {
  return (
    <div
      className="pi-fade-overlay"
      aria-hidden="true"
      data-testid="fade-overlay"
    />
  );
}

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

function EmptyDescription() {
  return (
    <p className="pi-empty" role="status" aria-live="polite">
      No description available for this product.
    </p>
  );
}

const ProductInfo = memo(function ProductInfo({ description = "" }) {
  const [expanded, setExpanded] = useState(false);
  const bodyRef = useRef(null);

  useEffect(() => {
    setExpanded(false);
  }, [description]);

  useEffect(() => {
    if (expanded && bodyRef.current) {
      bodyRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, [expanded]);

  const lines = useMemo(() => parseDescription(description), [description]);
  const isLong = useMemo(() => computeIsLong(description, lines), [description, lines]);

  const handleToggle = useCallback(() => {
    setExpanded((prev) => !prev);
  }, []);

  const bodyClassName = [
    "pi-description",
    !expanded && isLong ? "pi-description--collapsed" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <section
      className="pi-section"
      aria-label="Product Description"
      data-testid="product-info"
    >
      <h3 className="pi-section-title">Description</h3>

      <div
        id="pi-description-body"
        ref={bodyRef}
        className={bodyClassName}
        aria-live="polite"
      >
        {lines.length > 0 ? (
          <div role={lines.some((l) => l.type === "bullet") ? "list" : undefined}>
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

        {!expanded && isLong && <FadeOverlay />}
      </div>

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