import React, { useState, memo, useEffect, useMemo, useCallback } from "react";
import "./styles/ProductInfo.css";

const CONFIG = {
  COLLAPSE_THRESHOLD: 180,
  LINE_LIMIT: 5,
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
        <a key={`link-${i}`} href={part} target="_blank" rel="noopener noreferrer" className="pi-link">
          {part}
        </a>
      );
    }
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

// SVG Icons
const ListIcon = () => (
  <svg className="pi-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="8" y1="6" x2="21" y2="6"></line>
    <line x1="8" y1="12" x2="21" y2="12"></line>
    <line x1="8" y1="18" x2="21" y2="18"></line>
    <line x1="3" y1="6" x2="3.01" y2="6"></line>
    <line x1="3" y1="12" x2="3.01" y2="12"></line>
    <line x1="3" y1="18" x2="3.01" y2="18"></line>
  </svg>
);

const BackIcon = () => (
  <svg className="pi-icon-back" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12"></line>
    <polyline points="12 19 5 12 12 5"></polyline>
  </svg>
);

const EditIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
  </svg>
);

const ProductInfo = memo(function ProductInfo({ description = "", onEdit }) {
  const [expanded, setExpanded] = useState(false);
  const rawStr = useMemo(() => safeString(description), [description]);
  const lines = useMemo(() => parseDescription(rawStr), [rawStr]);

  const isLong = useMemo(() => {
    return rawStr.length > CONFIG.COLLAPSE_THRESHOLD || lines.length > CONFIG.LINE_LIMIT;
  }, [rawStr, lines]);

  // Handle Phone Hardware Back Button
  useEffect(() => {
    const handlePopState = (e) => {
      if (expanded) setExpanded(false);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [expanded]);

  const handleExpand = useCallback(() => {
    window.history.pushState({ modal: "product-description" }, "");
    setExpanded(true);
  }, []);

  const handleClose = useCallback(() => {
    if (expanded) {
      window.history.back(); // Triggers popstate to close the modal
    }
  }, [expanded]);

  if (lines.length === 0) return null;

  return (
    <>
      {/* 1. Main Card View */}
      <section className="pi-card" data-testid="product-info-card">
        <div className="pi-card-header">
          <div className="pi-card-title-group">
            <ListIcon />
            <h3 className="pi-card-title">Description</h3>
          </div>
          {onEdit && (
            <button className="pi-edit-btn" onClick={onEdit} type="button">
              <EditIcon /> Edit
            </button>
          )}
        </div>

        <div className={`pi-card-body ${isLong ? "pi-clamped" : ""}`}>
          <div role={lines.some((l) => l.type === "bullet") ? "list" : undefined}>
            {lines.map((line) => (
              <DescriptionLine key={line.id} type={line.type} content={line.content} />
            ))}
          </div>
        </div>

        {isLong && (
          <button type="button" className="pi-read-more-btn" onClick={handleExpand}>
            Read full description
          </button>
        )}
      </section>

      {/* 2. Full Screen Modal (Opens on Read More, Closes on Phone Back) */}
      {expanded && (
        <div className="pi-fullpage-modal">
          <div className="pi-fullpage-header">
            <button className="pi-back-btn" onClick={handleClose} type="button">
              <BackIcon />
            </button>
            <h3 className="pi-fullpage-title">Description</h3>
            <div className="pi-spacer"></div>
          </div>
          
          <div className="pi-fullpage-content">
            <div role={lines.some((l) => l.type === "bullet") ? "list" : undefined}>
              {lines.map((line) => (
                <DescriptionLine key={line.id} type={line.type} content={line.content} />
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
});

export default ProductInfo;