import React, { memo } from "react";

function DeleteChatConfirm({ onConfirm, onCancel }) {
  return (
    <div className="delete-chat-confirm" onClick={onCancel}>
      <div className="delete-chat-sheet" onClick={e => e.stopPropagation()}>
        <div className="delete-chat-icon">🗑️</div>
        <div className="delete-chat-title">Delete this chat?</div>
        <div className="delete-chat-body">
          This chat will be hidden from your inbox.
          Messages are kept securely for 90 days in case of a dispute,
          then permanently deleted.
        </div>
        <div className="delete-chat-actions">
          <button className="delete-chat-cancel" onClick={onCancel}>
            Cancel
          </button>
          <button className="delete-chat-confirm-btn" onClick={onConfirm}>
            Delete Chat
          </button>
        </div>
      </div>
    </div>
  );
}

export default memo(DeleteChatConfirm);