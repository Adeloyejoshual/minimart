import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "../styles/SpinWinModal.css";

const STORAGE_KEY = "loemart_spin_modal_dismissed_at";
const DISMISS_COOLOFF_MS = 12 * 60 * 60 * 1000; // 12 hours cooldown
const POPUP_DELAY_MS = 5000;                     // 5 seconds homepage delay

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

const HOME_PATHS = new Set(["/", "/home", "/homepage", "/loemart"]);

function wasRecentlyDismissed() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const elapsed = Date.now() - Number(raw);
    return Number.isFinite(elapsed) && elapsed < DISMISS_COOLOFF_MS;
  } catch {
    return false;
  }
}

function markDismissed() {
  try {
    localStorage.setItem(STORAGE_KEY, String(Date.now()));
  } catch {
    /* private browsing / quota fallback */
  }
}

/**
 * Homepage-only Spin & Win promotional popup.
 *
 * Smart Auth Handling:
 * - Registered Users → Taken directly to `/spin`
 * - Guest Visitors  → Taken to `/auth?redirect=%2Fspin` to register/login
 */
export default function SpinWinModal({ user }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const titleId = useId();
  const descId = useId();

  const normalizedPath = pathname.replace(/\/+$/, "") || "/";
  const isHomepage = HOME_PATHS.has(normalizedPath);

  const [isOpen, setIsOpen] = useState(false);

  const cardRef = useRef(null);
  const closeBtnRef = useRef(null);
  const previouslyFocusedRef = useRef(null);
  const scrollYRef = useRef(0);
  const timerRef = useRef(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const lockBodyScroll = useCallback(() => {
    scrollYRef.current = window.scrollY || window.pageYOffset || 0;
    const { body } = document;
    body.style.position = "fixed";
    body.style.top = `-${scrollYRef.current}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
    body.style.overflow = "hidden";
    body.style.touchAction = "none";
  }, []);

  const unlockBodyScroll = useCallback(() => {
    const { body } = document;
    body.style.position = "";
    body.style.top = "";
    body.style.left = "";
    body.style.right = "";
    body.style.width = "";
    body.style.overflow = "";
    body.style.touchAction = "";
    window.scrollTo(0, scrollYRef.current || 0);
  }, []);

  const closeModal = useCallback(() => {
    markDismissed();
    setIsOpen(false);
  }, []);

  const handleActionClick = useCallback(() => {
    markDismissed();
    setIsOpen(false);

    if (user) {
      // Logged in -> Go directly to spin wheel
      navigate("/spin");
    } else {
      // Visitor -> Go to Auth to register first, then redirect to spin wheel
      navigate("/auth?redirect=%2Fspin");
    }
  }, [navigate, user]);

  /* ── 1. Handle delay timer & route switching ── */
  useEffect(() => {
    clearTimer();

    if (!isHomepage) {
      setIsOpen(false);
      return undefined;
    }

    if (wasRecentlyDismissed()) {
      setIsOpen(false);
      return undefined;
    }

    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      const currentPath = window.location.pathname.replace(/\/+$/, "") || "/";
      if (!HOME_PATHS.has(currentPath) || wasRecentlyDismissed()) return;

      previouslyFocusedRef.current = document.activeElement;
      setIsOpen(true);
    }, POPUP_DELAY_MS);

    return () => clearTimer();
  }, [isHomepage, pathname, clearTimer]);

  /* ── 2. Handle scroll lock while open ── */
  useEffect(() => {
    if (!isOpen) return undefined;
    lockBodyScroll();
    return () => unlockBodyScroll();
  }, [isOpen, lockBodyScroll, unlockBodyScroll]);

  /* ── 3. Manage focus on open/close ── */
  useEffect(() => {
    if (isOpen) {
      const t = window.setTimeout(() => {
        if (closeBtnRef.current) closeBtnRef.current.focus();
        else if (cardRef.current) cardRef.current.focus();
      }, 0);
      return () => window.clearTimeout(t);
    }

    const prev = previouslyFocusedRef.current;
    if (prev && typeof prev.focus === "function") {
      try {
        prev.focus();
      } catch {
        /* Element might be unmounted */
      }
    }
    return undefined;
  }, [isOpen]);

  /* ── 4. Keyboard trap (Tab) & Escape key listener ── */
  useEffect(() => {
    if (!isOpen) return undefined;

    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeModal();
        return;
      }

      if (e.key !== "Tab") return;

      const root = cardRef.current;
      if (!root) return;

      const focusable = Array.from(
        root.querySelectorAll(FOCUSABLE_SELECTOR)
      ).filter(
        (el) =>
          !el.hasAttribute("disabled") &&
          el.getAttribute("aria-hidden") !== "true"
      );

      if (focusable.length === 0) {
        e.preventDefault();
        root.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (e.shiftKey) {
        if (active === first || !root.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else if (active === last || !root.contains(active)) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, closeModal]);

  if (!isOpen || !isHomepage) return null;

  return (
    <div
      className="sp-overlay"
      onClick={closeModal}
      role="presentation"
    >
      <div
        ref={cardRef}
        className="sp-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          ref={closeBtnRef}
          type="button"
          className="sp-close-btn"
          onClick={closeModal}
          aria-label="Close rewards popup"
        >
          ✕
        </button>

        <div className="sp-icon-wrapper" aria-hidden="true">
          <span className="sp-wheel-icon">🎡</span>
        </div>

        <span className="sp-badge">Loemart Rewards</span>

        <h2 id={titleId} className="sp-title">
          {user ? (
            <>
              Your next reward <span className="sp-title-accent">awaits</span>
            </>
          ) : (
            <>
              Get <span className="sp-title-accent">1 Free Daily Spin</span>
            </>
          )}
        </h2>

        <p id={descId} className="sp-subtitle">
          {user ? (
            <>
              Spin the wheel for a chance at discount coupons and airtime rewards.
              Use your free daily spin today — then explore products or list yours free on Loemart.
            </>
          ) : (
            <>
              Create your free Loemart account to spin the wheel for discount coupons and airtime rewards.
              Plus, buy or list products for free across Nigeria!
            </>
          )}
        </p>

        <button
          type="button"
          className="sp-cta-btn"
          onClick={handleActionClick}
        >
          <span>{user ? "SPIN & WIN NOW" : "CLAIM FREE SPIN NOW"}</span>
          <span aria-hidden="true">→</span>
        </button>

        <p className="sp-fineprint">
          Rewards depend on wheel results and account eligibility. Terms apply.
        </p>
      </div>
    </div>
  );
}