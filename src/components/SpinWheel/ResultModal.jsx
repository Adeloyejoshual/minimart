import { useState, useEffect } from "react";
import { useNavigate }         from "react-router-dom";
import Icon                    from "./Icon.jsx";
import { isBigWin, naira }     from "./helpers.js";

export default function ResultModal({ result, onClose }) {
  const [copied, setCopied] = useState(false);
  const navigate            = useNavigate();
  const big                 = isBigWin(result);
  const isAirtime           = result?.type === "airtime";

  const handleCopy = () => {
    if (!result?.coupon_code) return;
    navigator.clipboard?.writeText(result.coupon_code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2_000);
  };

  const handleShare = async () => {
    const text = result.is_win
      ? `I just won ${result.label} on Loemart's Spin & Win! Join here: ${
          import.meta.env.VITE_APP_URL || "https://loemart.com"
        }`
      : "I just spun the Loemart wheel! Join and try your luck!";
    try {
      if (navigator.share)
        await navigator.share({ title: "Loemart Spin & Win", text });
      else await navigator.clipboard.writeText(text);
    } catch (_) {}
  };

  /*
   * Navigate to the airtime coupons tab and close the modal.
   * The Profile page reads the `tab` query-param to pre-select
   * the correct panel on mount.
   */
  const handleClaimAirtime = () => {
    onClose();
    navigate("/coupons");
  };

  useEffect(() => {
    if (big && "vibrate" in navigator)
      navigator.vibrate([200, 100, 200, 100, 400]);
  }, [big]);

  if (!result) return null;

  return (
    <div
      className="sw-modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={result.is_win ? "You won!" : "Better luck next time"}
    >
      <div
        className={`sw-modal${big ? " sw-modal--big-win" : ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Animation ring ── */}
        <div className="sw-modal-anim">
          {result.is_win ? (
            <div className="sw-modal-win-ring">
              <Icon name="party" size={48} style={{ color: "#e8630a" }} />
            </div>
          ) : (
            <Icon name="frown" size={60} style={{ color: "#9ca3af" }} />
          )}
        </div>

        {/* ── Title ── */}
        <h2 className="sw-modal-title">
          {result.is_win ? (
            <>
              <Icon name="party" size={22} style={{ color: "#e8630a" }} />
              You Won!
            </>
          ) : (
            "Better Luck Tomorrow!"
          )}
        </h2>

        {/* ── Prize details ── */}
        {result.is_win && (
          <div className="sw-modal-prize">
            <p className="sw-modal-prize-label">{result.label}</p>

            {result.type === "fixed" && (
              <p className="sw-modal-prize-val">{naira(result.value)} OFF</p>
            )}
            {result.type === "percentage" && (
              <p className="sw-modal-prize-val">{result.value}% OFF</p>
            )}
            {result.type === "free_shipping" && (
              <p className="sw-modal-prize-val">
                <Icon name="truck" size={18} style={{ marginRight: 4 }} />
                Free Delivery
              </p>
            )}
            {isAirtime && (
              <p className="sw-modal-prize-val">
                <Icon name="phone" size={18} style={{ marginRight: 4 }} />
                {naira(result.value)} Airtime
              </p>
            )}
          </div>
        )}

        {/* ── Spin type badge ── */}
        {result.spin_type && (
          <div
            className={`sw-modal-spin-type ${
              result.spin_type === "bonus" ? "bonus" : "free"
            }`}
          >
            {result.spin_type === "bonus" ? (
              <><Icon name="gift" size={14} /> Bonus Spin Used</>
            ) : (
              <><Icon name="star" size={14} /> Free Daily Spin</>
            )}
          </div>
        )}

        <p className="sw-modal-msg">{result.message}</p>

        {/* ── Airtime claim banner ──────────────────────────────────
             Shown instead of the generic coupon block when the prize
             is airtime. The coupon code is stored server-side on the
             airtime_coupons table — the user redeems it from the
             Airtime Coupons page in their profile.
        ─────────────────────────────────────────────────────────── */}
        {isAirtime && result.is_win && (
          <div className="sw-modal-airtime-banner">
            <div className="sw-modal-airtime-icon">📱</div>

            <p className="sw-modal-airtime-title">
              Your {naira(result.value)} airtime is ready!
            </p>

            <p className="sw-modal-airtime-sub">
              Your airtime coupon has been added to your account.
              Go to your Airtime Coupons to redeem it.
            </p>

            <button
              className="sw-modal-airtime-btn"
              onClick={handleClaimAirtime}
              aria-label="Go to Airtime Coupons to claim your airtime"
            >
              <Icon name="phone" size={16} />
              Claim Airtime Now
            </button>
          </div>
        )}

        {/* ── Discount coupon block ─────────────────────────────────
             Only shown for non-airtime wins that have a coupon code.
        ─────────────────────────────────────────────────────────── */}
        {!isAirtime && result.coupon_code && (
          <div className="sw-modal-coupon">
            <p className="sw-modal-coupon-label">Your coupon code</p>
            <div className="sw-modal-coupon-row">
              <span className="sw-modal-coupon-code">
                {result.coupon_code}
              </span>
              <button
                className={`sw-modal-copy${copied ? " copied" : ""}`}
                onClick={handleCopy}
                aria-label={copied ? "Copied!" : "Copy coupon code"}
              >
                {copied ? (
                  <><Icon name="check" size={14} /> Copied!</>
                ) : (
                  <><Icon name="copy" size={14} /> Copy</>
                )}
              </button>
            </div>
            {result.expires_in && (
              <p className="sw-modal-expires">
                Expires in {result.expires_in}
              </p>
            )}
          </div>
        )}

        {/* ── Spins remaining ── */}
        {typeof result.spins_remaining === "number" &&
          result.spins_remaining > 0 && (
            <div className="sw-modal-remaining" aria-live="polite">
              <Icon name="spin" size={16} /> You have{" "}
              <strong>{result.spins_remaining}</strong> bonus spin
              {result.spins_remaining !== 1 ? "s" : ""} remaining!
            </div>
          )}

        {/* ── Share ── */}
        {result.is_win && (
          <button
            className="sw-modal-share"
            onClick={handleShare}
            aria-label="Share your win"
          >
            <Icon name="share" size={16} /> Share Your Win
          </button>
        )}

        {/* ── Close ── */}
        <button
          className="sw-modal-close"
          onClick={onClose}
          aria-label={result.is_win ? "Close" : "Close dialog"}
        >
          {result.is_win ? (
            <><Icon name="party" size={16} /> Awesome!</>
          ) : (
            <>Try Tomorrow <Icon name="arrowRight" size={14} /></>
          )}
        </button>
      </div>
    </div>
  );
}