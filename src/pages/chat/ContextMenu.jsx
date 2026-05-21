import React from "react";
import { Icon } from "./icons";

function ContextMenu({ msg, mine, pos, onClose, onReply, onCopy, onDelete }) {
  const items = [
    { icon: Icon.reply, label: "Reply",  fn: onReply },
    {
      icon: Icon.copy, label: "Copy", fn: onCopy,
      hide: !!msg._offerMeta || !!msg._deleted,
    },
    {
      icon: Icon.trash, label: "Delete", fn: onDelete,
      danger: true,
      hide: !mine || !!msg._deleted,
    },
  ].filter(i => !i.hide);

  return (
    <>
      <div className="ctx-backdrop" onClick={onClose}/>
      <div className="ctx-wrap" style={{ top: pos.y, left: pos.x }}>
        <div className="ctx-menu">
          {items.map(i => (
            <button
              key={i.label}
              className={`ctx-item ${i.danger ? "danger" : ""}`}
              onClick={() => { i.fn(); onClose(); }}
            >
              {i.icon}
              {i.label}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

export default React.memo(ContextMenu);