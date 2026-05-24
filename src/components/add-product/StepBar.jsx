import React from "react";
import {
  FiCamera, FiTag, FiPackage, FiZap,
  FiDollarSign, FiFileText, FiCheckCircle,
} from "react-icons/fi";
import { STEPS } from "./constants";

const ICON_MAP = {
  camera: <FiCamera size={14} />,
  tag:    <FiTag    size={14} />,
  package:<FiPackage size={14} />,
  zap:    <FiZap    size={14} />,
  dollar: <FiDollarSign size={14} />,
  file:   <FiFileText   size={14} />,
};

export default function StepBar({ current }) {
  return (
    <div className="ap-stepbar">
      {STEPS.map((s, i) => (
        <React.Fragment key={s.id}>
          <div
            className={[
              "ap-step",
              current === s.id ? "ap-step--active" : "",
              current > s.id   ? "ap-step--done"   : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <div className="ap-step-dot">
              {current > s.id
                ? <FiCheckCircle size={13} />
                : ICON_MAP[s.icon]}
            </div>
            <span className="ap-step-label">{s.label}</span>
          </div>

          {i < STEPS.length - 1 && (
            <div
              className={[
                "ap-step-line",
                current > s.id ? "ap-step-line--done" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}