import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";

import SettingsSection from "./SettingsSection.jsx";
import "../styles/DangerZone.css";

/* ────────────────────────────────────────────────────────────
   SVG ICONS
──────────────────────────────────────────────────────────── */
const ActionsIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="10" />
    <path d="M12 8v4" />
    <path d="M12 16h.01" />
  </svg>
);

const LogoutIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

const TrashIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <line x1="10" y1="11" x2="10" y2="17" />
    <line x1="14" y1="11" x2="14" y2="17" />
  </svg>
);

const AlertIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

const CloseIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const ChevronIcon = ({ open }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={`dz-chevron ${open ? "dz-chevron--open" : ""}`}
    aria-hidden="true"
  >
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

/* ────────────────────────────────────────────────────────────
   HELPERS
──────────────────────────────────────────────────────────── */
const API_BASE = `${import.meta.env.VITE_API_BASE_URL}/api`;

const getToken = () =>
  localStorage.getItem("marketplace_token") ||
  localStorage.getItem("token");

const DELETION_ITEMS = [
  "Your account will be scheduled for permanent deletion after 60 days.",
  "All your listings, chats, saved items, and personal data will be removed.",
  "You can restore your account by logging in before the deletion date.",
];

/* ────────────────────────────────────────────────────────────
   DELETE MODAL
──────────────────────────────────────────────────────────── */
function DeleteAccountModal({
  open,
  onClose,
  onSuccessRedirect,
}) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm]   = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const [done, setDone]         = useState(false);

  const passwordRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => passwordRef.current?.focus(), 180);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (e.key === "Escape" && !loading) onClose();
    };
    document.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [open, loading, onClose]);

  useEffect(() => {
    if (!open) {
      setPassword("");
      setConfirm("");
      setLoading(false);
      setError("");
      setDone(false);
    }
  }, [open]);

  if (!open) return null;

  const submitDelete = async () => {
    if (!password.trim()) {
      setError("Password is required.");
      return;
    }
    if (confirm.trim().toLowerCase() !== "delete") {
      setError('Type "DELETE" to confirm.');
      return;
    }

    setLoading(true);
    setError("");

    try {
      const token = getToken();

      const res = await fetch(`${API_BASE}/settings/delete-account`, {
        method  : "DELETE",
        headers : {
          "Content-Type" : "application/json",
          Authorization  : `Bearer ${token}`,
        },
        body: JSON.stringify({
          password,
          confirm: "delete",
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.message ?? "Failed to delete account.");
      }

      setDone(true);

      setTimeout(() => {
        localStorage.clear();
        sessionStorage.clear();
        onSuccessRedirect?.();
      }, 2600);

    } catch (err) {
      setError(err.message ?? "Something went wrong.");
      setLoading(false);
    }
  };

  return (
    <div
      className="dz-modal__overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Delete account confirmation"
    >
      <div className="dz-modal">
        <div className="dz-modal__header">
          <div className="dz-modal__title-wrap">
            <span className="dz-modal__alert">
              <AlertIcon />
            </span>
            <h3 className="dz-modal__title">Delete Account</h3>
          </div>

          {!loading && !done && (
            <button
              type="button"
              className="dz-modal__close"
              onClick={onClose}
              aria-label="Close"
            >
              <CloseIcon />
            </button>
          )}
        </div>

        {!done ? (
          <>
            <div className="dz-modal__warning">
              <p className="dz-modal__warning-title">
                Please read this carefully
              </p>
              <ul className="dz-modal__warning-list">
                {DELETION_ITEMS.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>

            <div className="dz-modal__field">
              <label className="dz-modal__label" htmlFor="dz-password">
                Current Password
              </label>
              <input
                id="dz-password"
                ref={passwordRef}
                type="password"
                className="dz-modal__input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                autoComplete="current-password"
                disabled={loading}
              />
            </div>

            <div className="dz-modal__field">
              <label className="dz-modal__label" htmlFor="dz-confirm">
                Type <strong>DELETE</strong> to confirm
              </label>
              <input
                id="dz-confirm"
                type="text"
                className={`dz-modal__input ${
                  confirm.trim().toLowerCase() === "delete"
                    ? "dz-modal__input--valid"
                    : ""
                }`}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="DELETE"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                disabled={loading}
              />
            </div>

            {error && (
              <p className="dz-modal__error" role="alert">
                {error}
              </p>
            )}

            <div className="dz-modal__actions">
              <button
                type="button"
                className="dz-btn dz-btn--cancel"
                onClick={onClose}
                disabled={loading}
              >
                Cancel
              </button>

              <button
                type="button"
                className="dz-btn dz-btn--danger"
                onClick={submitDelete}
                disabled={
                  loading ||
                  !password.trim() ||
                  confirm.trim().toLowerCase() !== "delete"
                }
              >
                {loading ? (
                  <>
                    <span className="dz-spinner" aria-hidden="true" />
                    Deleting…
                  </>
                ) : (
                  "Delete My Account"
                )}
              </button>
            </div>
          </>
        ) : (
          <div className="dz-modal__success">
            <p className="dz-modal__success-title">
              Account scheduled for deletion
            </p>
            <p className="dz-modal__success-text">
              Your account has been scheduled for deletion. It will be
              permanently removed after <strong>60 days</strong>. You can
              restore it by logging in before the deletion date.
            </p>
            <p className="dz-modal__success-redirect">
              Redirecting to login…
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   COMPONENT
──────────────────────────────────────────────────────────── */
export default function DangerZone({ settings }) {
  const { handleLogout } = settings;
  const navigate = useNavigate();

  const [open, setOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const onLogout = useCallback(() => {
    handleLogout?.();
    navigate("/auth", { replace: true });
  }, [handleLogout, navigate]);

  const handleDeleteSuccessRedirect = useCallback(() => {
    navigate("/auth", { replace: true });
  }, [navigate]);

  return (
    <>
      <SettingsSection
        title="Danger Zone"
        className="settings-section--danger"
      >
        <div className="dz-card">

          {/* Trigger row */}
          <button
            type="button"
            className="dz-trigger"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="danger-zone-panel"
          >
            <div className="dz-trigger__left">
              <span className="dz-trigger__icon">
                <ActionsIcon />
              </span>

              <div className="dz-trigger__text">
                <span className="dz-trigger__label">Account Actions</span>
                <span className="dz-trigger__desc">
                  Log out or delete your account
                </span>
              </div>
            </div>

            <span className="dz-trigger__right">
              <ChevronIcon open={open} />
            </span>
          </button>

          {/* Dropdown panel */}
          <div
            id="danger-zone-panel"
            className={`dz-panel ${open ? "dz-panel--open" : ""}`}
          >
            <div className="dz-panel__inner">

              <button
                type="button"
                className="dz-action dz-action--logout"
                onClick={onLogout}
              >
                <span className="dz-action__icon">
                  <LogoutIcon />
                </span>
                <span className="dz-action__text">
                  <span className="dz-action__label">Log Out</span>
                  <span className="dz-action__desc">
                    Sign out and go to login page
                  </span>
                </span>
              </button>

              <button
                type="button"
                className="dz-action dz-action--delete"
                onClick={() => setDeleteOpen(true)}
              >
                <span className="dz-action__icon">
                  <TrashIcon />
                </span>
                <span className="dz-action__text">
                  <span className="dz-action__label">Delete Account</span>
                  <span className="dz-action__desc">
                    Schedule your account for permanent deletion
                  </span>
                </span>
              </button>

            </div>
          </div>
        </div>
      </SettingsSection>

      <DeleteAccountModal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onSuccessRedirect={handleDeleteSuccessRedirect}
      />
    </>
  );
}