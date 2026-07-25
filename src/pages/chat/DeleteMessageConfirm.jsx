import { memo } from "react";

const DeleteMessageConfirm = memo(function DeleteMessageConfirm({
  onConfirm,
  onCancel,
}) {
  return (
    <div className="delete-chat-confirm" onClick={onCancel}>
      <div
        className="delete-chat-sheet"
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-labelledby="delmsg-title"
      >
        <div className="delete-chat-icon" aria-hidden="true">
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none">
            <path
              d="M4 7h16M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2m-8 0v13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V7"
              stroke="#ef4444"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <div id="delmsg-title" className="delete-chat-title">
          Delete this message?
        </div>

        <div className="delete-chat-body">
          This message will be removed for everyone in this chat. This action
          cannot be undone.
        </div>

        <div className="delete-chat-actions">
          <button className="delete-chat-cancel" onClick={onCancel}>
            Cancel
          </button>
          <button className="delete-chat-confirm-btn" onClick={onConfirm}>
            Delete
          </button>
        </div>
      </div>
    </div>
  );
});

export default DeleteMessageConfirm;