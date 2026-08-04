// src/pages/components/HowToUseRewards.jsx
import { useState, useEffect } from "react";
import { useNavigate }         from "react-router-dom";
import "../styles/HowToUseRewards.css";

/*
 * Seller identifier used for the in-app profile route.
 * We navigate to /seller/:username so the user stays inside the app
 * instead of leaving via an external link.
 */
const SELLER_USERNAME = "loemart";

/*
 * localStorage key used to remember the user's open/closed choice.
 * Bumping the suffix (v1 → v2) is a clean way to force the panel
 * open again after a major content update.
 */
const STORAGE_KEY = "htu_panel_open_v1";

/*
 * Read the persisted open/closed state from localStorage.
 * Runs synchronously during initial render via useState's lazy initializer
 * so there's no flash of the wrong state.
 */
function readPersistedState(fallback) {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === "1") return true;
    if (raw === "0") return false;
  } catch { /* ignore quota / privacy-mode errors */ }
  return fallback;
}

export default function HowToUseRewards({
  defaultOpen    = true,
  sellerUsername = SELLER_USERNAME,
  /*
   * persist=true  → remember the user's choice across page loads (default)
   * persist=false → always start from defaultOpen, ignore localStorage
   */
  persist        = true,
}) {
  /*
   * Lazy initializer reads from storage exactly once on mount.
   * If persistence is disabled we just use defaultOpen.
   */
  const [open, setOpen] = useState(() =>
    persist ? readPersistedState(defaultOpen) : defaultOpen
  );

  const navigate = useNavigate();

  /*
   * Write the current state back to storage whenever it changes.
   * Wrapped in try/catch because localStorage can throw in:
   *   – Safari private mode
   *   – iframes with cookies disabled
   *   – enterprise browsers with storage locked down
   */
  useEffect(() => {
    if (!persist) return;
    try {
      localStorage.setItem(STORAGE_KEY, open ? "1" : "0");
    } catch { /* non-fatal */ }
  }, [open, persist]);

  /*
   * Navigate to the seller profile inside the app.
   * Using useNavigate keeps the user in the SPA — no page reload,
   * no external tab, back button works as expected.
   */
  const goToSeller = (e) => {
    e.preventDefault();
    navigate(`/seller/${sellerUsername}`);
  };

  return (
    <section className="htu-panel" aria-labelledby="htu-title">
      {/* ═══ Toggle header ═══ */}
      <button
        type          ="button"
        className     ="htu-header"
        onClick       ={() => setOpen((v) => !v)}
        aria-expanded ={open}
        aria-controls ="htu-body"
      >
        <span className="htu-header-left">
          <span className="htu-header-emoji" aria-hidden="true">🎟️</span>
          <span id="htu-title" className="htu-header-title">
            How to Use Your Rewards
          </span>
        </span>

        <span
          className ={`htu-chevron ${open ? "htu-chevron--open" : ""}`}
          aria-hidden="true"
        >
          ⌄
        </span>
      </button>

      {/* ═══ Body ═══ */}
      {open && (
        <div id="htu-body" className="htu-body">

          {/* ─── Discount Coupons ─── */}
          <div className="htu-section">
            <div className="htu-section-header">
              <span
                className  ="htu-section-icon htu-section-icon--discount"
                aria-hidden="true"
              >
                🏷️
              </span>
              <h3 className="htu-section-title">Discount Coupons</h3>
            </div>

            <ol className="htu-steps">
              <li>
                Copy your coupon code by tapping the{" "}
                <span className="htu-inline-btn">Copy</span> button.
              </li>
              <li>
                Browse products and choose the item you want from the{" "}
                <strong>official Loemart seller store</strong>.
              </li>
              <li>
                Open the seller profile:{" "}
                {/*
                  href is kept as the real path so users can:
                  – right-click "Open in new tab"
                  – copy the link
                  – have proper accessibility semantics
                  onClick intercepts the normal click and navigates
                  inside the SPA via react-router.
                */}
                <a
                  href      ={`/seller/${sellerUsername}`}
                  onClick   ={goToSeller}
                  className ="htu-link"
                >
                  @{sellerUsername}
                </a>
              </li>
              <li>
                Tap <strong>"Chat with Seller"</strong> and send:
                <ul className="htu-sublist">
                  <li>Your coupon code</li>
                  <li>The product you want to buy</li>
                </ul>
              </li>
              <li>
                Our team will verify your coupon and apply the discount
                if it is valid.
              </li>
            </ol>
          </div>

          {/* ─── Airtime Rewards ─── */}
          <div className="htu-section">
            <div className="htu-section-header">
              <span
                className  ="htu-section-icon htu-section-icon--airtime"
                aria-hidden="true"
              >
                📱
              </span>
              <h3 className="htu-section-title">Airtime Rewards</h3>
            </div>

            <ol className="htu-steps">
              <li>Tap <strong>Claim Airtime</strong>.</li>
              <li>Enter the phone number you want to receive the airtime on.</li>
              <li>Tap <strong>Claim</strong>.</li>
              <li>
                Once your request is verified, the airtime will be credited
                to your phone number.
              </li>
            </ol>
          </div>

          {/* ─── Important notes ─── */}
          <div className="htu-important">
            <div className="htu-important-header">
              <span className="htu-important-icon" aria-hidden="true">⚠️</span>
              <span className="htu-important-title">Important</span>
            </div>

            <ul className="htu-important-list">
              <li>Coupons can only be used <strong>before they expire</strong>.</li>
              <li>Each coupon can only be used <strong>once</strong>.</li>
              <li>Airtime rewards can only be claimed <strong>once</strong>.</li>
              <li>
                <strong>Do not share</strong> your coupon code with anyone else.
              </li>
            </ul>
          </div>

        </div>
      )}
    </section>
  );
}