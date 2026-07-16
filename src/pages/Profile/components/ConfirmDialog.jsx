// src/pages/Profile/components/ConfirmDialog.jsx
import { Ic } from "./icons";
import "./ConfirmDialog.css";

export default function ConfirmDialog({ message, onConfirm, onCancel }) {
  return (
    <div className="overlay" onClick={onCancel}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog__icon dialog__icon--danger">
          <Ic.Trash />
        </div>
        <h3 className="dialog__title">Confirm Delete</h3>
        <p className="dialog__msg">{message}</p>
        <div className="dialog__actions">
          <button className="btn btn--ghost" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn btn--danger" onClick={onConfirm}>
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}