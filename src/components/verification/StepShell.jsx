import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle }             from "lucide-react";

const STATUS_MAP = {
  complete  : { label: "Completed",  cls: "chip--complete"  },
  in_review : { label: "In Review",  cls: "chip--review"    },
  rejected  : { label: "Rejected",   cls: "chip--rejected"  },
  active    : { label: "Active",     cls: "chip--active"    },
  pending   : { label: "Pending",    cls: "chip--pending"   },
};

export function Chip({ status = "pending" }) {
  const cfg = STATUS_MAP[status] ?? STATUS_MAP.pending;
  return (
    <span className={`v-chip ${cfg.cls}`} role="status">
      {cfg.label}
    </span>
  );
}

export function StepShell({
  icon,
  title,
  subtitle,
  chipStatus,
  headerAction,
  children,
  open        = false,
  complete    = false,
  stepNumber,
}) {
  return (
    <motion.div
      layout
      className={[
        "step-shell",
        complete ? "step-shell--complete" : "",
        open     ? "step-shell--open"     : "",
      ].join(" ")}
    >
      {/* step number badge */}
      {stepNumber && (
        <div
          className={`step-number ${complete ? "step-number--done" : ""}`}
          aria-hidden="true"
        >
          {complete ? <CheckCircle size={12} /> : stepNumber}
        </div>
      )}

      {/* header */}
      <div className="step-header">
        <div className={`step-icon ${complete ? "step-icon--done" : ""}`}>
          {icon}
        </div>
        <div className="step-info">
          <p className="step-title">{title}</p>
          {subtitle && (
            <p className="step-subtitle">{subtitle}</p>
          )}
        </div>
        <div className="step-aside">
          {headerAction ?? <Chip status={chipStatus ?? (complete ? "complete" : "pending")} />}
        </div>
      </div>

      {/* expandable body */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="body"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            className="step-body"
            style={{ overflow: "hidden" }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}