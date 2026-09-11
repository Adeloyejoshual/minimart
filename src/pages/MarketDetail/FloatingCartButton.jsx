/**
 * src/components/FloatingCartButton.jsx
 * Draggable floating cart — drag anywhere, snaps to nearest edge.
 * Tap = open cart. Position saved.
 */
import { useRef, useState, useEffect, useCallback } from "react";

const POS_KEY = "lm-cart-btn-pos";
const SIZE = 56;
const PAD = 12;

const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

function loadPos() {
  try {
    const p = JSON.parse(localStorage.getItem(POS_KEY) || "null");
    if (p && Number.isFinite(p.x) && Number.isFinite(p.y)) return p;
  } catch {}
  return null;
}

export default function FloatingCartButton({ count, onClick, icon }) {
  const [pos, setPos] = useState(loadPos);
  const [dragging, setDragging] = useState(false);
  const drag = useRef({ active: false, moved: false, sx: 0, sy: 0, ox: 0, oy: 0 });

  const defaultPos = useCallback(
    () => ({
      x: window.innerWidth - SIZE - PAD - 6,
      y: window.innerHeight - SIZE - 130,
    }),
    []
  );

  /* keep on screen after rotate/resize */
  useEffect(() => {
    const onResize = () => {
      setPos((p) => {
        if (!p) return p;
        const fixed = {
          x: clamp(p.x, PAD, window.innerWidth - SIZE - PAD),
          y: clamp(p.y, 70, window.innerHeight - SIZE - PAD),
        };
        localStorage.setItem(POS_KEY, JSON.stringify(fixed));
        return fixed;
      });
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const onPointerDown = (e) => {
    const cur = pos || defaultPos();
    drag.current = {
      active: true,
      moved: false,
      sx: e.clientX,
      sy: e.clientY,
      ox: cur.x,
      oy: cur.y,
    };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e) => {
    const d = drag.current;
    if (!d.active) return;
    const dx = e.clientX - d.sx;
    const dy = e.clientY - d.sy;
    if (!d.moved && Math.hypot(dx, dy) > 8) {
      d.moved = true;
      setDragging(true);
    }
    if (!d.moved) return;
    setPos({
      x: clamp(d.ox + dx, PAD, window.innerWidth - SIZE - PAD),
      y: clamp(d.oy + dy, 70, window.innerHeight - SIZE - PAD),
    });
  };

  const onPointerUp = () => {
    const d = drag.current;
    if (!d.active) return;
    d.active = false;
    setDragging(false);

    if (d.moved) {
      /* snap to nearest left/right edge */
      setPos((p) => {
        if (!p) return p;
        const snapped = {
          x:
            p.x + SIZE / 2 < window.innerWidth / 2
              ? PAD
              : window.innerWidth - SIZE - PAD,
          y: p.y,
        };
        localStorage.setItem(POS_KEY, JSON.stringify(snapped));
        return snapped;
      });
    } else {
      onClick?.(); /* it was a tap, not a drag */
    }
  };

  const style = pos
    ? { left: pos.x, top: pos.y, right: "auto", bottom: "auto" }
    : undefined;

  return (
    <button
      type="button"
      className={`mdp-float-cart${dragging ? " mdp-float-cart--dragging" : ""}`}
      style={style}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      aria-label={`View cart, ${count} items`}
    >
      {icon}
      <span className="mdp-float-cart__badge">{count > 99 ? "99+" : count}</span>
    </button>
  );
}