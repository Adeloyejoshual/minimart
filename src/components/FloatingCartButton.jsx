/**
 * src/components/FloatingCartButton.jsx
 * Draggable floating cart — move up / down / sideways
 * Snaps to left or right edge on release · remembers position
 */

import { useRef, useState, useEffect, memo } from "react";

const POS_KEY = "lm-cart-btn-pos";
const SIZE = 56;
const PAD = 12;
const TOP_MIN = 70; // below header
const DRAG_THRESHOLD = 8;

const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

function loadPos() {
  try {
    const p = JSON.parse(localStorage.getItem(POS_KEY) || "null");
    if (p && Number.isFinite(p.x) && Number.isFinite(p.y)) return p;
  } catch {
    /* ignore */
  }
  return null;
}

function savePos(p) {
  try {
    localStorage.setItem(POS_KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}

function bounds() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  return {
    minX: PAD,
    maxX: Math.max(PAD, w - SIZE - PAD),
    minY: TOP_MIN,
    maxY: Math.max(TOP_MIN, h - SIZE - PAD),
  };
}

function defaultPos() {
  const b = bounds();
  return {
    x: b.maxX,
    y: Math.max(b.minY, window.innerHeight - SIZE - 110),
  };
}

function clampPos(p) {
  const b = bounds();
  return {
    x: clamp(p.x, b.minX, b.maxX),
    y: clamp(p.y, b.minY, b.maxY),
  };
}

function FloatingCartButton({ count = 0, onClick, icon }) {
  const [pos, setPos] = useState(() => {
    if (typeof window === "undefined") return null;
    const loaded = loadPos();
    return loaded ? clampPos(loaded) : null;
  });
  const [dragging, setDragging] = useState(false);

  const drag = useRef({
    active: false,
    moved: false,
    sx: 0,
    sy: 0,
    ox: 0,
    oy: 0,
  });

  // Keep on screen on rotate / resize
  useEffect(() => {
    const onResize = () => {
      setPos((p) => {
        const next = clampPos(p || defaultPos());
        savePos(next);
        return next;
      });
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const onPointerDown = (e) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;

    const cur = pos || defaultPos();
    drag.current = {
      active: true,
      moved: false,
      sx: e.clientX,
      sy: e.clientY,
      ox: cur.x,
      oy: cur.y,
    };

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const onPointerMove = (e) => {
    const d = drag.current;
    if (!d.active) return;

    const dx = e.clientX - d.sx;
    const dy = e.clientY - d.sy;

    if (!d.moved && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
      d.moved = true;
      setDragging(true);
    }
    if (!d.moved) return;

    setPos(
      clampPos({
        x: d.ox + dx,
        y: d.oy + dy,
      })
    );
  };

  const endDrag = (e) => {
    const d = drag.current;
    if (!d.active) return;
    d.active = false;
    setDragging(false);

    try {
      e?.currentTarget?.releasePointerCapture?.(e.pointerId);
    } catch {
      /* ignore */
    }

    if (d.moved) {
      // Snap to left or right edge; keep Y where user dropped
      setPos((p) => {
        if (!p) return p;
        const mid = window.innerWidth / 2;
        const snapped = clampPos({
          x: p.x + SIZE / 2 < mid ? PAD : window.innerWidth - SIZE - PAD,
          y: p.y,
        });
        savePos(snapped);
        return snapped;
      });
    } else {
      // Pure tap → open cart
      onClick?.();
    }
  };

  if (!count || count < 1) return null;

  const style = pos
    ? {
        left: pos.x,
        top: pos.y,
        right: "auto",
        bottom: "auto",
      }
    : {
        // First paint before measure: bottom-right default
        right: PAD,
        bottom: 110,
        left: "auto",
        top: "auto",
      };

  return (
    <button
      type="button"
      className={`mdp-float-cart${dragging ? " mdp-float-cart--dragging" : ""}`}
      style={style}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      aria-label={`View cart, ${count} items. Drag to move.`}
    >
      <span className="mdp-float-cart__icon" aria-hidden="true">
        {icon}
      </span>
      <span className="mdp-float-cart__badge">
        {count > 99 ? "99+" : count}
      </span>
      <span className="mdp-float-cart__grip" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
    </button>
  );
}

export default memo(FloatingCartButton);