import React, { memo, useCallback, useMemo, useState } from "react";
import {
  FiCamera, FiTag, FiPackage,
  FiDollarSign, FiFileText,
  FiCheckCircle, FiLock,
} from "react-icons/fi";

/* ═══════════════════════════════════════════════
   STEPS CONFIG
   — Icon stored as component ref (not JSX)
     avoids element recreation on every render
═══════════════════════════════════════════════ */
const STEPS = [
  { id: 1, label: "Photos",   Icon: FiCamera,     desc: "Add your product photos"        },
  { id: 2, label: "Details",  Icon: FiTag,        desc: "Title, description, category"   },
  { id: 3, label: "Variants", Icon: FiPackage,    desc: "SKU, price, stock, attributes"  },
  { id: 4, label: "Pricing",  Icon: FiDollarSign, desc: "Base price and discounts"       },
  { id: 5, label: "Review",   Icon: FiFileText,   desc: "Review and publish"             },
];

const TOTAL_STEPS = STEPS.length;

/* ═══════════════════════════════════════════════
   PURE HELPER — fix #6: extracted aria label
   keeps render clean and easy to test
═══════════════════════════════════════════════ */
function getAriaLabel(step, isDone, isActive, isLocked) {
  const suffix =
    isDone   ? " (completed)" :
    isActive ? " (current)"   :
    isLocked ? " (locked)"    : "";
  return `Step ${step.id}: ${step.label}${suffix}`;
}

/* ═══════════════════════════════════════════════
   STEP DOT
═══════════════════════════════════════════════ */
const StepDot = memo(({
  step,
  isDone,
  isActive,
  isLocked,
  onClick,
}) => {
  const { Icon } = step;

  /* fix #5: React state instead of DOM class mutation */
  const [focused, setFocused] = useState(false);

  const handleClick = useCallback(() => {
    if (!isLocked) onClick?.(step.id);
  }, [isLocked, onClick, step.id]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleClick();
    }
  }, [handleClick]);

  const className = [
    "pa-step",
    isActive  ? "pa-step--active"  : "",
    isDone    ? "pa-step--done"    : "",
    isLocked  ? "pa-step--locked"  : "",
    focused   ? "pa-step--focused" : "",
  ].filter(Boolean).join(" ");

  return (
    <div
      className={className}
      role="button"
      aria-current={isActive ? "step" : undefined}
      aria-label={getAriaLabel(step, isDone, isActive, isLocked)}
      aria-disabled={isLocked}
      title={step.desc}
      tabIndex={isLocked ? -1 : 0}
      onClick={handleClick}
      onKeyDown={!isLocked ? handleKeyDown : undefined}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{ cursor: isLocked ? "default" : "pointer" }}
    >
      {/* ── Dot ── */}
      <div className="pa-step-dot" aria-hidden="true">
        {isDone   ? <FiCheckCircle size={14} /> :
         isLocked ? <FiLock size={12} />         :
                    <Icon size={15} />}

        {/* Active pulse ring */}
        {isActive && <span className="pa-step-pulse" aria-hidden="true" />}
      </div>

      {/* ── Label ── */}
      <span className="pa-step-label">{step.label}</span>

      {/* ── Number badge (very small screens) ── */}
      <span className="pa-step-num" aria-hidden="true">{step.id}</span>
    </div>
  );
});

/* ═══════════════════════════════════════════════
   STEP LINE
═══════════════════════════════════════════════ */
const StepLine = memo(({ done }) => (
  <div
    className="pa-step-line"
    role="presentation"
    aria-hidden="true"
  >
    <div
      className="pa-step-line-fill"
      style={{
        width:      done ? "100%" : "0%",
        transition: "width 0.45s cubic-bezier(0.4,0,0.2,1)",
      }}
    />
  </div>
));

/* ═══════════════════════════════════════════════
   STEP BAR — MAIN
═══════════════════════════════════════════════ */
function StepBar({
  current,
  onStepClick,
  completedSteps = [],
}) {
  /* fix #2: O(1) Set lookup instead of O(n) includes per step */
  const completedSet = useMemo(
    () => new Set(completedSteps),
    [completedSteps]
  );

  /* fix #1: remove useMemo — pure calc, not expensive */
  const pct =
    Number.isFinite(current) && TOTAL_STEPS > 1
      ? Math.min(100, Math.max(0, ((current - 1) / (TOTAL_STEPS - 1)) * 100))
      : 0;

  /* Current step description */
  const currentDesc =
    STEPS.find((s) => s.id === current)?.desc ?? "";

  return (
    <nav
      className="pa-stepbar-wrap"
      aria-label={`Form progress — step ${current} of ${TOTAL_STEPS}`}
    >
      {/* ── Top progress bar ── */}
      <div className="pa-stepbar-progress" aria-hidden="true">
        <div
          className="pa-stepbar-progress-fill"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* ── Dots row ── */}
      <div className="pa-stepbar" role="list">
        {STEPS.map((s, i) => {
          /* fix #3: inline step state — no useCallback needed */
          const isDone   = completedSet.has(s.id);
          const isActive = current === s.id;
          /* fix #1 carried: uses completedSet for correctness */
          const isLocked = s.id > current && !isDone;

          return (
            <React.Fragment key={s.id}>
              <StepDot
                step={s}
                isDone={isDone}
                isActive={isActive}
                isLocked={isLocked}
                onClick={onStepClick}
              />

              {i < STEPS.length - 1 && (
                /* fix #2: O(1) Set lookup here too */
                <StepLine done={completedSet.has(s.id)} />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* ── Step description ── */}
      <p
        className="pa-stepbar-desc"
        aria-live="polite"
        aria-atomic="true"
      >
        {currentDesc}
      </p>
    </nav>
  );
}

export default memo(StepBar);