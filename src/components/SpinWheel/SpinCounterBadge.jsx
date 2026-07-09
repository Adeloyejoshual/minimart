export default function SpinCounterBadge({ spinStatus }) {
  if (!spinStatus) return null;

  const freeLeft  = spinStatus.can_free_spin ? 1 : 0;
  const bonusLeft = spinStatus.bonus_spins_remaining || 0;
  const total     = freeLeft + bonusLeft;

  return (
    <div className="sw-counter-wrap">
      <div
        className={`sw-counter-pill ${total > 0 ? "has-spins" : "no-spins"}`}
        aria-label={`${total} spin${total !== 1 ? "s" : ""} remaining`}
      >
        <span className="sw-counter-num">{total}</span>
        <span className="sw-counter-label">
          spin{total !== 1 ? "s" : ""} left
        </span>
      </div>

      <div
        className="sw-counter-breakdown"
        role="list"
        aria-label="Spin breakdown"
      >
        <div className="sw-counter-dot-wrap" role="listitem">
          <div
            className={`sw-counter-dot ${freeLeft > 0 ? "dot-free" : "dot-used"}`}
            aria-hidden="true"
          />
          <span>Free</span>
        </div>

        {Array.from({ length: Math.min(bonusLeft, 10) }).map((_, i) => (
          <div key={i} className="sw-counter-dot-wrap" role="listitem">
            <div className="sw-counter-dot dot-bonus" aria-hidden="true" />
            {i === 0 && <span>Bonus</span>}
          </div>
        ))}

        {bonusLeft > 10 && (
          <span className="sw-counter-overflow">+{bonusLeft - 10} more</span>
        )}
      </div>
    </div>
  );
}