import React from "react";
import {
  FiCamera, FiTag, FiPackage,
  FiDollarSign, FiFileText, FiCheckCircle,
} from "react-icons/fi";

const STEPS = [
  { id: 1, label: "Photos",   icon: <FiCamera    size={16} /> },
  { id: 2, label: "Details",  icon: <FiTag       size={16} /> },
  { id: 3, label: "Variants", icon: <FiPackage   size={16} /> },
  { id: 4, label: "Pricing",  icon: <FiDollarSign size={16} /> },
  { id: 5, label: "Review",   icon: <FiFileText  size={16} /> },
];

export default function StepBar({ current }) {
  return (
    <div className="pa-stepbar">
      {STEPS.map((s, i) => (
        <React.Fragment key={s.id}>
          <div
            className={[
              "pa-step",
              current === s.id ? "pa-step--active" : "",
              current  >  s.id ? "pa-step--done"   : "",
            ].join(" ")}
          >
            <div className="pa-step-dot">
              {current > s.id ? <FiCheckCircle size={14} /> : s.icon}
            </div>
            <span className="pa-step-label">{s.label}</span>
          </div>

          {i < STEPS.length - 1 && (
            <div className={`pa-step-line ${current > s.id ? "pa-step-line--done" : ""}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}
