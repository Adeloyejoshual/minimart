/**
 * MediaViewer.jsx
 * Full-screen media viewer with:
 * - Prev/Next navigation (arrows + swipe + keyboard)
 * - Pinch-to-zoom on mobile / double-tap
 * - Mouse wheel zoom on desktop
 * - Drag to pan when zoomed
 * - Download button
 * - Share button (uses Web Share API when available)
 * - Sender name + timestamp header
 * - Thumbnail strip at bottom
 * - Loading spinner + error fallback
 */

import {
  useState, useEffect, useRef,
  useCallback, memo,
} from "react";

/* ═══════════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════════ */
function isVideoUrl(url) {
  return /\.(mp4|webm|mov|3gp|mkv)(\?|$)/i.test(url || "");
}

function formatTimestamp(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    const today = new Date();
    const same  = d.toDateString() === today.toDateString();
    const time  = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    return same
      ? `Today at ${time}`
      : `${d.toLocaleDateString([], { day: "numeric", month: "short" })} at ${time}`;
  } catch { return ""; }
}

async function downloadFile(url) {
  try {
    const res  = await fetch(url, { mode: "cors" });
    const blob = await res.blob();
    const link = document.createElement("a");
    link.href     = URL.createObjectURL(blob);
    link.download = url.split("/").pop().split("?")[0] || "media";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  } catch (err) {
    /* fallback — open in new tab */
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

async function shareMedia(url) {
  try {
    if (navigator.share) {
      await navigator.share({ url, title: "Media" });
    } else {
      await navigator.clipboard.writeText(url);
      alert("Link copied to clipboard");
    }
  } catch {
    /* user cancelled — ignore */
  }
}

/* ═══════════════════════════════════════════════════════════════
   MAIN VIEWER
═══════════════════════════════════════════════════════════════ */
function MediaViewer({
  urls        = [],
  startIndex  = 0,
  senderName  = "",
  createdAt   = null,
  onClose,
}) {
  const [index, setIndex]     = useState(startIndex);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(false);
  const [zoom,    setZoom]    = useState(1);
  const [pan,     setPan]     = useState({ x: 0, y: 0 });
  const [showChrome, setShowChrome] = useState(true);

  const currentUrl = urls[index];
  const isVideo    = isVideoUrl(currentUrl);

  const imgRef     = useRef(null);
  const stageRef   = useRef(null);
  const touchRef   = useRef({ startX: 0, startY: 0, startDist: 0, startZoom: 1 });
  const dragRef    = useRef({ dragging: false, startX: 0, startY: 0, baseX: 0, baseY: 0 });
  const chromeTimer = useRef(null);

  /* ── Reset on media change ── */
  useEffect(() => {
    setLoading(true);
    setError(false);
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [index]);

  /* ── Auto-hide chrome after 3s (like WhatsApp) ── */
  const bumpChrome = useCallback(() => {
    setShowChrome(true);
    clearTimeout(chromeTimer.current);
    chromeTimer.current = setTimeout(() => setShowChrome(false), 3000);
  }, []);

  useEffect(() => { bumpChrome(); }, [index, bumpChrome]);
  useEffect(() => () => clearTimeout(chromeTimer.current), []);

  /* ── Navigation ── */
  const goPrev = useCallback(() => {
    if (index > 0) setIndex((i) => i - 1);
  }, [index]);

  const goNext = useCallback(() => {
    if (index < urls.length - 1) setIndex((i) => i + 1);
  }, [index, urls.length]);

  /* ── Keyboard ── */
  useEffect(() => {
    const onKey = (e) => {
      bumpChrome();
      if (e.key === "Escape")       onClose?.();
      else if (e.key === "ArrowLeft")  goPrev();
      else if (e.key === "ArrowRight") goNext();
      else if (e.key === "+" || e.key === "=") setZoom((z) => Math.min(z + 0.5, 4));
      else if (e.key === "-")               setZoom((z) => Math.max(z - 0.5, 1));
      else if (e.key.toLowerCase() === "d") downloadFile(currentUrl);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goPrev, goNext, onClose, currentUrl, bumpChrome]);

  /* ── Body scroll lock ── */
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  /* ── Touch handlers (swipe + pinch) ── */
  const onTouchStart = useCallback((e) => {
    bumpChrome();
    if (e.touches.length === 1) {
      touchRef.current.startX = e.touches[0].clientX;
      touchRef.current.startY = e.touches[0].clientY;
    } else if (e.touches.length === 2) {
      const dx   = e.touches[0].clientX - e.touches[1].clientX;
      const dy   = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      touchRef.current.startDist = dist;
      touchRef.current.startZoom = zoom;
    }
  }, [zoom, bumpChrome]);

  const onTouchMove = useCallback((e) => {
    if (e.touches.length === 2) {
      /* pinch zoom */
      const dx   = e.touches[0].clientX - e.touches[1].clientX;
      const dy   = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      if (touchRef.current.startDist > 0) {
        const scale = dist / touchRef.current.startDist;
        const next  = Math.max(1, Math.min(4, touchRef.current.startZoom * scale));
        setZoom(next);
        if (next === 1) setPan({ x: 0, y: 0 });
      }
    }
  }, []);

  const onTouchEnd = useCallback((e) => {
    if (zoom > 1) return; // don't swipe when zoomed
    if (e.changedTouches.length !== 1) return;
    const dx = e.changedTouches[0].clientX - touchRef.current.startX;
    const dy = e.changedTouches[0].clientY - touchRef.current.startY;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
      if (dx > 0) goPrev();
      else        goNext();
    } else if (Math.abs(dy) > 100 && Math.abs(dy) > Math.abs(dx)) {
      /* swipe down to close */
      onClose?.();
    }
  }, [zoom, goPrev, goNext, onClose]);

  /* ── Double-tap / double-click to toggle zoom ── */
  const lastTap = useRef(0);
  const onDoubleTap = useCallback(() => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      setZoom((z) => (z > 1 ? 1 : 2));
      setPan({ x: 0, y: 0 });
    }
    lastTap.current = now;
  }, []);

  /* ── Mouse wheel zoom (desktop) ── */
  const onWheel = useCallback((e) => {
    if (!e.ctrlKey && !e.metaKey && e.deltaY) {
      /* only wheel-zoom on ctrl/cmd or default = ignore */
    }
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.2 : -0.2;
    setZoom((z) => {
      const next = Math.max(1, Math.min(4, z + delta));
      if (next === 1) setPan({ x: 0, y: 0 });
      return next;
    });
    bumpChrome();
  }, [bumpChrome]);

  /* ── Drag to pan when zoomed (desktop) ── */
  const onMouseDown = useCallback((e) => {
    if (zoom <= 1) return;
    dragRef.current = {
      dragging: true,
      startX  : e.clientX,
      startY  : e.clientY,
      baseX   : pan.x,
      baseY   : pan.y,
    };
  }, [zoom, pan]);

  const onMouseMove = useCallback((e) => {
    if (!dragRef.current.dragging) return;
    setPan({
      x: dragRef.current.baseX + (e.clientX - dragRef.current.startX),
      y: dragRef.current.baseY + (e.clientY - dragRef.current.startY),
    });
  }, []);

  const onMouseUp = useCallback(() => {
    dragRef.current.dragging = false;
  }, []);

  useEffect(() => {
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup",   onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup",   onMouseUp);
    };
  }, [onMouseMove, onMouseUp]);

  /* ── Actions ── */
  const handleDownload = useCallback(() => downloadFile(currentUrl), [currentUrl]);
  const handleShare    = useCallback(() => shareMedia(currentUrl),   [currentUrl]);
  const handleZoomIn   = useCallback(() => { setZoom((z) => Math.min(z + 0.5, 4)); bumpChrome(); }, [bumpChrome]);
  const handleZoomOut  = useCallback(() => {
    setZoom((z) => {
      const n = Math.max(z - 0.5, 1);
      if (n === 1) setPan({ x: 0, y: 0 });
      return n;
    });
    bumpChrome();
  }, [bumpChrome]);

  const onBackdropClick = useCallback((e) => {
    if (e.target === stageRef.current) onClose?.();
  }, [onClose]);

  return (
    <div
      className={`mv-root ${showChrome ? "mv-root--chrome" : ""}`}
      role="dialog"
      aria-modal="true"
    >
      {/* ── Header ── */}
      <div className="mv-header">
        <button className="mv-btn mv-btn--close" onClick={onClose} aria-label="Close">
          ✕
        </button>
        <div className="mv-header__info">
          {senderName && <div className="mv-header__sender">{senderName}</div>}
          {createdAt && <div className="mv-header__time">{formatTimestamp(createdAt)}</div>}
        </div>
        <div className="mv-header__actions">
          {!isVideo && (
            <>
              <button className="mv-btn" onClick={handleZoomOut} aria-label="Zoom out">−</button>
              <button className="mv-btn" onClick={handleZoomIn}  aria-label="Zoom in">+</button>
            </>
          )}
          <button className="mv-btn" onClick={handleShare}    aria-label="Share">↗</button>
          <button className="mv-btn" onClick={handleDownload} aria-label="Download">⬇</button>
        </div>
      </div>

      {/* ── Stage ── */}
      <div
        ref={stageRef}
        className="mv-stage"
        onClick={onBackdropClick}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onWheel={onWheel}
        onMouseDown={onMouseDown}
      >
        {/* Loading */}
        {loading && !error && (
          <div className="mv-loading">
            <div className="mv-spinner" />
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mv-error">
            <div>⚠️</div>
            <div>Failed to load media</div>
          </div>
        )}

        {/* Media */}
        {isVideo ? (
          <video
            src={currentUrl}
            className="mv-media"
            controls
            autoPlay
            playsInline
            onLoadedData={() => setLoading(false)}
            onError={() => { setLoading(false); setError(true); }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <img
            ref={imgRef}
            src={currentUrl}
            alt=""
            className="mv-media"
            style={{
              transform : `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transition: dragRef.current.dragging ? "none" : "transform 0.2s ease",
              cursor    : zoom > 1 ? "grab" : "zoom-in",
            }}
            onLoad={() => setLoading(false)}
            onError={() => { setLoading(false); setError(true); }}
            onDoubleClick={(e) => { e.stopPropagation(); onDoubleTap(); }}
            onClick={(e) => { e.stopPropagation(); onDoubleTap(); bumpChrome(); }}
            draggable={false}
          />
        )}

        {/* Prev arrow (desktop) */}
        {index > 0 && (
          <button
            className="mv-nav mv-nav--prev"
            onClick={(e) => { e.stopPropagation(); goPrev(); }}
            aria-label="Previous"
          >
            ‹
          </button>
        )}

        {/* Next arrow (desktop) */}
        {index < urls.length - 1 && (
          <button
            className="mv-nav mv-nav--next"
            onClick={(e) => { e.stopPropagation(); goNext(); }}
            aria-label="Next"
          >
            ›
          </button>
        )}
      </div>

      {/* ── Footer / thumbnail strip ── */}
      {urls.length > 1 && (
        <div className="mv-footer">
          <div className="mv-counter">
            {index + 1} / {urls.length}
          </div>
          <div className="mv-thumbs">
            {urls.map((u, i) => (
              <button
                key={i}
                className={`mv-thumb ${i === index ? "mv-thumb--active" : ""}`}
                onClick={() => setIndex(i)}
                aria-label={`Media ${i + 1}`}
              >
                {isVideoUrl(u) ? (
                  <div className="mv-thumb__video">▶</div>
                ) : (
                  <img src={u} alt="" loading="lazy" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(MediaViewer);