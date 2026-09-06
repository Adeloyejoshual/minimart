/**
 * src/pages/MarketDetail/ProductInfo.jsx
 */

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
  COLLAPSE_THRESHOLD: 250,
  LINE_LIMIT: 6,
};

function safeString(input) {
  if (!input) return "";
  if (typeof input === "string") return input;
  if (typeof input === "object") {
    return input.text || input.content || input.html || input.description || JSON.stringify(input);
  }
  return String(input);
}

function getLineType(line) {
  if (line.startsWith("### ")) return "heading";
  if (line.startsWith("- ") || line.startsWith("* ")) return "bullet";
  if (/^[-─═]{3,}$/.test(line)) return "divider";
  return "text";
}

function normalizeContent(line, type) {
  switch (type) {
    case "heading": return line.replace(/^###\s*/, "").trim();
    case "bullet": return line.replace(/^[-*]\s*/, "• ").trim();
    case "divider": return "";
    default: return line.trim();
  }
}

function parseDescription(rawInput) {
  const raw = safeString(rawInput);
  if (!raw.trim()) return [];

  // Handle HTML string from backend
  if (/<[a-z][\s\S]*>/i.test(raw)) {
    return [{ id: "line-html-0", type: "html", content: raw }];
  }

  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const type = getLineType(line);
      const content = normalizeContent(line, type);
      return { id: `line-${index}-${type}`, type, content };
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
        >
          {part}
        </a>
      );
    }
    URL_PATTERN.lastIndex = 0;
    return part;
  });
}

function DescriptionLine({ type, content }) {
  switch (type) {
    case "heading":
      return <h4 className="pi-heading">{content}</h4>;
    case "bullet":
      return <p className="pi-bullet" role="listitem">{linkify(content)}</p>;
    case "divider":
      return <hr className="pi-divider" aria-hidden="true" />;
    case "html":
      return <div className="pi-html-body" dangerouslySetInnerHTML={{ __html: content }} />;
    default:
      return <p className="pi-text">{linkify(content)}</p>;
  }
}

function FadeOverlay() {
  return <div className="pi-fade-overlay" aria-hidden="true" />;
}

function ToggleButton({ expanded, onClick }) {
  return (
    <button
      type="button"
      className="pi-toggle-btn"
      onClick={onClick}
      aria-expanded={expanded}
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

const ProductInfo = memo(function ProductInfo({ description = "" }) {
  const [expanded, setExpanded] = useState(false);
  const bodyRef = useRef(null);

  const rawStr = useMemo(() => safeString(description), [description]);
  const lines = useMemo(() => parseDescription(rawStr), [rawStr]);

  const isLong = useMemo(() => {
    return rawStr.length > CONFIG.COLLAPSE_THRESHOLD || lines.length > CONFIG.LINE_LIMIT;
  }, [rawStr, lines]);

  useEffect(() => {
    setExpanded(false);
  }, [description]);

  const handleToggle = useCallback(() => {
    setExpanded((prev) => !prev);
  }, []);

  const bodyClassName = [
    "pi-description",
    !expanded && isLong ? "pi-description--collapsed" : "",
  ].filter(Boolean).join(" ");

  if (lines.length === 0) {
    return (
      <p className="pi-empty">
        No description available for this product.
      </p>
    );
  }

  return (
    <section className="pi-section" data-testid="product-info">
      <div
        id="pi-description-body"
        ref={bodyRef}
        className={bodyClassName}
      >
        <div role={lines.some((l) => l.type === "bullet") ? "list" : undefined}>
          {lines.map((line) => (
            <DescriptionLine
              key={line.id}
              type={line.type}
              content={line.content}
            />
          ))}
        </div>

        {!expanded && isLong && <FadeOverlay />}
      </div>

      {isLong && (
        <ToggleButton expanded={expanded} onClick={handleToggle} />
      )}
    </section>
  );
});

export default ProductInfo;