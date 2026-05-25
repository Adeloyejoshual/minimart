import React, { useMemo } from "react";
import {
  FiCamera,
  FiTag,
  FiLayers,
  FiDollarSign,
  FiFileText,
  FiCheck,
  FiLock,
  FiAlertCircle,
} from "react-icons/fi";

/* ─────────────────────────────────────────────
   FUTURE-GENERATION COMMERCE STEP ENGINE
───────────────────────────────────────────── */

const STEPS = [
  {
    id: 1,
    key: "media",
    title: "Media",
    subtitle: "Photos, videos & gallery",
    icon: FiCamera,
  },
  {
    id: 2,
    key: "details",
    title: "Details",
    subtitle: "Product information",
    icon: FiTag,
  },
  {
    id: 3,
    key: "variants",
    title: "Variants",
    subtitle: "Dynamic attributes & SKUs",
    icon: FiLayers,
  },
  {
    id: 4,
    key: "pricing",
    title: "Pricing",
    subtitle: "Price, stock & inventory",
    icon: FiDollarSign,
  },
  {
    id: 5,
    key: "review",
    title: "Review",
    subtitle: "Final verification",
    icon: FiFileText,
  },
];

export default function StepBar({
  current = 1,
  completed = [],
  errors = {},
  lockedSteps = [],
  onStepChange,
}) {

  /* ─────────────────────────────────────────
     GLOBAL PROGRESS
  ───────────────────────────────────────── */

  const progress = useMemo(() => {
    return Math.round(
      (completed.length / STEPS.length) * 100
    );
  }, [completed]);

  return (
    <div className="pa-step-system">

      {/* ─────────────────────────────────────
         TOP PROGRESS SECTION
      ───────────────────────────────────── */}

      <div className="pa-step-top">

        <div>
          <h2 className="pa-step-heading">
            Product Creation Flow
          </h2>

          <p className="pa-step-subheading">
            Advanced commerce publishing pipeline
          </p>
        </div>

        <div className="pa-step-progress-wrap">

          <div className="pa-step-progress-info">
            <span>Completion</span>
            <strong>{progress}%</strong>
          </div>

          <div className="pa-step-progress-bar">
            <div
              className="pa-step-progress-fill"
              style={{
                width: `${progress}%`,
              }}
            />
          </div>

        </div>

      </div>

      {/* ─────────────────────────────────────
         STEP FLOW
      ───────────────────────────────────── */}

      <div className="pa-stepbar">

        {STEPS.map((step, index) => {

          const Icon = step.icon;

          const isActive =
            current === step.id;

          const isCompleted =
            completed.includes(step.id);

          const isLocked =
            lockedSteps.includes(step.id);

          const hasError =
            !!errors[step.key];

          const isClickable =
            !isLocked;

          return (
            <React.Fragment key={step.id}>

              {/* STEP CARD */}
              <button
                type="button"
                className={[
                  "pa-step-card",

                  isActive
                    ? "pa-step-card--active"
                    : "",

                  isCompleted
                    ? "pa-step-card--done"
                    : "",

                  hasError
                    ? "pa-step-card--error"
                    : "",

                  isLocked
                    ? "pa-step-card--locked"
                    : "",
                ].join(" ")}

                disabled={!isClickable}

                onClick={() =>
                  isClickable &&
                  onStepChange?.(step.id)
                }
              >

                {/* GLOW */}
                <div className="pa-step-glow" />

                {/* TOP */}
                <div className="pa-step-card-top">

                  {/* ICON */}
                  <div className="pa-step-icon-wrap">

                    {isCompleted ? (
                      <FiCheck size={18} />
                    ) : isLocked ? (
                      <FiLock size={16} />
                    ) : hasError ? (
                      <FiAlertCircle size={18} />
                    ) : (
                      <Icon size={18} />
                    )}

                  </div>

                  {/* NUMBER */}
                  <span className="pa-step-number">
                    0{step.id}
                  </span>

                </div>

                {/* CONTENT */}
                <div className="pa-step-content">

                  <span className="pa-step-title">
                    {step.title}
                  </span>

                  <span className="pa-step-subtitle">
                    {step.subtitle}
                  </span>

                </div>

                {/* STATUS */}
                <div className="pa-step-status">

                  {isCompleted && (
                    <span className="pa-status pa-status--success">
                      Completed
                    </span>
                  )}

                  {isActive && !isCompleted && (
                    <span className="pa-status pa-status--active">
                      In Progress
                    </span>
                  )}

                  {hasError && (
                    <span className="pa-status pa-status--error">
                      Requires Attention
                    </span>
                  )}

                  {isLocked && (
                    <span className="pa-status pa-status--locked">
                      Locked
                    </span>
                  )}

                </div>

              </button>

              {/* CONNECTOR */}
              {index < STEPS.length - 1 && (
                <div
                  className={[
                    "pa-step-connector",

                    completed.includes(step.id)
                      ? "pa-step-connector--done"
                      : "",
                  ].join(" ")}
                >
                  <div className="pa-step-connector-fill" />
                </div>
              )}

            </React.Fragment>
          );
        })}

      </div>

    </div>
  );
}