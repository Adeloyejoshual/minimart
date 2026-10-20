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
const DISMISS_COOLOFF_MS = 12 * 60 * 60 * 1000; // 12 hours
const POPUP_DELAY_MS = 5000; // browse first, then promote

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

const HOME_PATHS = new Set(["/", "/home", "/homepage"]);

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
    /* private mode / quota — ignore */
  }
}

/**
 * Homepage-only Spin & Win promo.
 *
 * Flow:
 * 1) User opens homepage
 * 2) Browses ~5s
 * 3) Modal appears (unless 12h cooldown active)
 * 4) Spin CTA → /spinwheel  OR  close
 * 5) Either action starts 12h cooldown
 *
 * Popup never grants spins/rewards — eligibility lives in backend /spinwheel.
 */
export default function SpinWinModal() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const titleId = useId();
  const descId = useId();

  const isHomepage = HOME_PATHS.has(pathname);

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
    markDismissed(); // 12h cooldown — intentional
    setIsOpen(false);
  }, []);

  const openSpinPage = useCallback(() => {
    markDismissed(); // visiting spin counts as handled promo
    setIsOpen(false);
    navigate("/spinwheel");
  }, [navigate]);

  /**
   * Schedule / reset popup timer whenever route changes.
   * - Leaving homepage: cancel timer + close modal
   * - Entering homepage: start a fresh 5s timer (if cooldown allows)
   * Prevents stale timeouts from a previous homepage visit.
   */
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

    // Fresh timer for this homepage visit only
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      // Re-check route + cooldown at fire time (user may have navigated away)
      const stillHome = HOME_PATHS.has(
        window.location.pathname.replace(/\/+$/, "") || "/"
      );
      // pathname from hook is source of truth inside React tree;
      // also guard against cooldown set in another tab
      if (!stillHome || wasRecentlyDismissed()) return;

      previouslyFocusedRef.current = document.activeElement;
      setIsOpen(true);
    }, POPUP_DELAY_MS);

    return () => {
      clearTimer();
    };
  }, [isHomepage, pathname, clearTimer]);

  // Body scroll lock while open
  useEffect(() => {
    if (!isOpen) return undefined;
    lockBodyScroll();
    return () => unlockBodyScroll();
  }, [isOpen, lockBodyScroll, unlockBodyScroll]);

  // Focus move-in on open, restore on close
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
        /* node may be unmounted */
      }
    }
    return undefined;
  }, [isOpen]);

  // Focus trap + Escape
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

  // Hard gate — never render off-homepage
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
          Your next reward{" "}
          <span className="sp-title-accent">awaits</span>
        </h2>

        <p id={descId} className="sp-subtitle">
          Spin the wheel for a chance at discount coupons and airtime rewards.
          Signed-in shoppers can use one free spin per day when available —
          then keep browsing or list your own items free on Loemart.
        </p>

        <button
          type="button"
          className="sp-cta-btn"
          onClick={openSpinPage}
        >
          <span>SPIN &amp; WIN NOW</span>
          <span aria-hidden="true">→</span>
        </button>

        <p className="sp-fineprint">
          Rewards depend on wheel results and account eligibility. Daily free
          spin limits are enforced on the spin page. Terms apply.
        </p>
      </div>
    </div>
  );
}