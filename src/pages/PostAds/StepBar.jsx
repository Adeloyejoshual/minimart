import { memo, useCallback, useMemo } from "react";

/* ══════════════════════════════════════════════════════════════
   SVG ICONS
══════════════════════════════════════════════════════════════ */
const IconCamera = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
    <circle cx="12" cy="13" r="4" />
  </svg>
);

const IconTag = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true">
    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
    <line x1="7" y1="7" x2="7.01" y2="7" />
  </svg>
);

const IconPackage = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true">
    <line x1="16.5" y1="9.4" x2="7.5" y2="4.21" />
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
    <line x1="12" y1="22.08" x2="12" y2="12" />
  </svg>
);

const IconDollar = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true">
    <line x1="12" y1="1" x2="12" y2="23" />
    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
  </svg>
);

const IconFileText = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
);

const IconCheckCircle = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

const IconLock = ({ size = 12 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

/* ══════════════════════════════════════════════════════════════
   DEFAULT STEPS
   stepMeta can override label / desc / Icon
══════════════════════════════════════════════════════════════ */
const DEFAULT_STEPS = [
  { id: 1, label: "Photos",   Icon: IconCamera,   desc: "Add your product photos" },
  { id: 2, label: "Details",  Icon: IconTag,      desc: "Title, description and category" },
  { id: 3, label: "Variants", Icon: IconPackage,  desc: "SKU, price, stock and attributes" },
  { id: 4, label: "Pricing",  Icon: IconDollar,   desc: "Base price and discount" },
  { id: 5, label: "Review",   Icon: IconFileText, desc: "Review and submit your listing" },
];

/* ══════════════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════════════ */
function getAriaLabel(step, isDone, isActive, isLocked) {
  const suffix =
    isDone   ? " (completed)" :
    isActive ? " (current)"   :
    isLocked ? " (locked)"    : "";

  return `Step ${step.id}: ${step.label}${suffix}`;
}

function mergeSteps(stepMeta) {
  return DEFAULT_STEPS.map((base, i) => {
    const meta = stepMeta?.[i] ?? {};
    return {
      id   : base.id,
      label: meta.label ?? base.label,
      desc : meta.desc  ?? base.desc,
      Icon : meta.Icon  ?? base.Icon,
    };
  });
}

/* ══════════════════════════════════════════════════════════════
   STEP DOT
══════════════════════════════════════════════════════════════ */
const StepDot = memo(function StepDot({
  step,
  isDone,
  isActive,
  isLocked,
  onClick,
}) {
  const { Icon } = step;

  const handleClick = useCallback(() => {
    if (!isLocked) onClick?.(step.id);
  }, [isLocked, onClick, step.id]);

  const className = [
    "pa-step",
    isActive ? "pa-step--active" : "",
    isDone   ? "pa-step--done"   : "",
    isLocked ? "pa-step--locked" : "",
  ].filter(Boolean).join(" ");

  return (
    <button
      type="button"
      className={className}
      aria-current={isActive ? "step" : undefined}
      aria-label={getAriaLabel(step, isDone, isActive, isLocked)}
      aria-disabled={isLocked ? "true" : undefined}
      disabled={isLocked}
      title={step.desc}
      onClick={handleClick}
    >
      <span className="pa-step-dot" aria-hidden="true">
        {isDone ? (
          <IconCheckCircle size={14} />
        ) : isLocked ? (
          <IconLock size={12} />
        ) : (
          <Icon size={15} />
        )}

        {isActive && <span className="pa-step-pulse" aria-hidden="true" />}
      </span>

      <span className="pa-step-label">{step.label}</span>
      <span className="pa-step-num" aria-hidden="true">{step.id}</span>
    </button>
  );
});

const StepLine = memo(function StepLine({ done }) {
  return (
    <div className="pa-step-line" aria-hidden="true">
      <div
        className="pa-step-line-fill"
        style={{ width: done ? "100%" : "0%" }}
      />
    </div>
  );
});

/* ══════════════════════════════════════════════════════════════
   MAIN
══════════════════════════════════════════════════════════════ */
function StepBar({
  current,
  onStepClick,
  completedSteps = [],
  stepMeta,
}) {
  const steps = useMemo(() => mergeSteps(stepMeta), [stepMeta]);
  const total = steps.length;

  const completedSet = useMemo(
    () => new Set(completedSteps),
    [completedSteps]
  );

  const pct =
    Number.isFinite(current) && total > 1
      ? Math.min(100, Math.max(0, ((current - 1) / (total - 1)) * 100))
      : 0;

  const currentDesc =
    steps.find((s) => s.id === current)?.desc ?? "";

  return (
    <nav
      className="pa-stepbar-wrap"
      aria-label={`Form progress — step ${current} of ${total}`}
    >
      <div className="pa-stepbar-progress" aria-hidden="true">
        <div
          className="pa-stepbar-progress-fill"
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="pa-stepbar" role="list">
        {steps.map((step, i) => {
          const isDone   = completedSet.has(step.id);
          const isActive = current === step.id;
          const isLocked = step.id > current && !isDone;

          return (
            <div
              key={step.id}
              className="pa-stepbar-item"
              role="listitem"
            >
              <StepDot
                step={step}
                isDone={isDone}
                isActive={isActive}
                isLocked={isLocked}
                onClick={onStepClick}
              />

              {i < steps.length - 1 && (
                <StepLine done={completedSet.has(step.id)} />
              )}
            </div>
          );
        })}
      </div>

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

StepBar.displayName = "StepBar";

export default memo(StepBar);