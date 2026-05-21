import React, { useEffect, useRef, useCallback, memo } from "react";
import { Icon } from "./icons";

function ContextMenu({ msg, mine, pos, onClose, onReply, onCopy, onDelete }) {
  const menuRef = useRef(null);

  /* close on Escape */
  useEffect(() => {
    const handler = e => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  /* adjust position so menu doesn't overflow viewport */
  useEffect(() => {
    if (!menuRef.current || !pos) return;
    const rect   = menuRef.current.getBoundingClientRect();
    const maxX   = window.innerWidth  - rect.width  - 12;
    const maxY   = window.innerHeight - rect.height - 12;
    const el     = menuRef.current;

    if (rect.right > window.innerWidth) {
      el.style.left = `${Math.max(8, maxX)}px`;
    }
    if (rect.bottom > window.innerHeight) {
      el.style.top = `${Math.max(8, maxY)}px`;
    }
  }, [pos]);

  const items = [
    { icon: Icon.reply, label: "Reply",  fn: onReply },
    {
      icon: Icon.copy, label: "Copy", fn: onCopy,
      hide: !!msg._offerMeta || !!msg._deleted || !msg.message,
    },
    {
      icon: Icon.trash, label: "Delete", fn: onDelete,
      danger: true,
      hide: !mine || !!msg._deleted,
    },
  ].filter(i => !i.hide);

  const handleItemClick = useCallback(
    (fn) => () => { fn(); onClose(); },
    [onClose]
  );

  if (!pos) return null;

  return (
    <>
      <div className="ctx-backdrop" onClick={onClose}/>
      <div
        ref={menuRef}
        className="ctx-wrap"
        style={{
          position: "fixed",
          top:      pos.y,
          left:     pos.x,
          zIndex:   49,
        }}
      >
        <div className="ctx-menu">
          {items.map(item => (
            <button
              key={item.label}
              className={`ctx-item ${item.danger ? "danger" : ""}`}
              onClick={handleItemClick(item.fn)}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

export default memo(ContextMenu);