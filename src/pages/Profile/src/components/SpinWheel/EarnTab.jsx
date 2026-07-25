// src/components/SpinWheel/EarnTab.jsx
import { useState } from "react";
import Icon from "./Icon.jsx";
import { API, authH, EARN_TASKS } from "./helpers.js";

/* ── Map task id → destination URL ── */
const TASK_URLS = {
  follow_instagram   : "https://instagram.com/loemart",
  follow_facebook    : "https://facebook.com/loemart",
  join_whatsapp      : "https://chat.whatsapp.com/YOUR_GROUP_LINK",
  join_telegram      : "https://t.me/loemart",
  follow_tiktok      : "https://tiktok.com/@loemart",
  subscribe_youtube  : "https://youtube.com/@loemart",
  follow_twitter     : "https://twitter.com/loemart",
  // add more as needed
};

export default function EarnTab({
  completedTaskIds = [],
  onTaskClaimed,
  totalEarned,
}) {
  const [claiming, setClaiming] = useState(null);
  const [errors,   setErrors]   = useState({});

  /* ── Step 1: open the social page, then show "I did it" button ── */
  const [opened, setOpened] = useState({});

  const handleOpen = (task) => {
    const url = TASK_URLS[task.id];
    if (url) {
      window.open(url, "_blank", "noopener,noreferrer");
      setOpened((prev) => ({ ...prev, [task.id]: true }));
    }
  };

  /* ── Step 2: after user returns, they click "I followed" → claim ── */
  const handleClaim = async (task) => {
    if (claiming) return;
    setClaiming(task.id);
    setErrors((prev) => ({ ...prev, [task.id]: null }));

    try {
      const res  = await fetch(`${API}/spinwheel/tasks/claim`, {
        method  : "POST",
        headers : { ...authH(), "Content-Type": "application/json" },
        body    : JSON.stringify({ task_id: task.id }),
      });
      const data = await res.json();

      if (res.ok) {
        onTaskClaimed?.(task);
      } else {
        setErrors((prev) => ({
          ...prev,
          [task.id]: data.message || "Could not claim. Try again.",
        }));
      }
    } catch {
      setErrors((prev) => ({
        ...prev,
        [task.id]: "Network error. Please try again.",
      }));
    } finally {
      setClaiming(null);
    }
  };

  const pending   = EARN_TASKS.filter((t) => !completedTaskIds.includes(t.id));
  const completed = EARN_TASKS.filter((t) =>  completedTaskIds.includes(t.id));

  return (
    <div className="sw-earn-tab">

      {/* ── Header ── */}
      <div className="sw-earn-header">
        <h2 className="sw-earn-title">
          <Icon name="bolt" size={18} style={{ color: "#e8630a" }} />
          Earn Bonus Spins
        </h2>
        {totalEarned > 0 && (
          <span className="sw-earn-total-badge">
            +{totalEarned} earned
          </span>
        )}
      </div>

      <p className="sw-earn-desc">
        Complete tasks below to earn instant bonus spins. Each task
        can only be completed once.
      </p>

      {/* ── Pending tasks ── */}
      {pending.length === 0 ? (
        <div className="sw-earn-all-done">
          <Icon name="checkCircle" size={32} style={{ color: "#22c55e" }} />
          <p>All tasks completed!</p>
          <small>You've earned all available bonus spins.</small>
        </div>
      ) : (
        <div className="sw-earn-list">
          {pending.map((task) => {
            const hasUrl    = Boolean(TASK_URLS[task.id]);
            const isOpened  = opened[task.id];
            const isClaiming = claiming === task.id;
            const err       = errors[task.id];

            return (
              <div key={task.id} className="sw-earn-card">

                {/* Left: icon + info */}
                <div className="sw-earn-card-left">
                  <div
                    className="sw-earn-card-icon"
                    aria-hidden="true"
                  >
                    {task.emoji || "⚡"}
                  </div>
                  <div className="sw-earn-card-info">
                    <p className="sw-earn-card-label">{task.label}</p>
                    <p className="sw-earn-card-desc">{task.description}</p>
                    {err && (
                      <p className="sw-earn-card-err">{err}</p>
                    )}
                  </div>
                </div>

                {/* Right: reward + actions */}
                <div className="sw-earn-card-right">
                  <span className="sw-earn-reward">
                    +{task.spins_reward} spin{task.spins_reward > 1 ? "s" : ""}
                  </span>

                  {/* ── Action buttons ── */}
                  {hasUrl ? (
                    <div className="sw-earn-btn-group">

                      {/* Step 1 — Go to platform */}
                      <button
                        className="sw-earn-goto-btn"
                        onClick={() => handleOpen(task)}
                        aria-label={`Open ${task.label}`}
                      >
                        {isOpened ? "Open again" : "Go →"}
                      </button>

                      {/* Step 2 — Claim (only shown after opening) */}
                      {isOpened && (
                        <button
                          className="sw-earn-claim-btn"
                          onClick={() => handleClaim(task)}
                          disabled={isClaiming}
                          aria-label={`Claim reward for ${task.label}`}
                        >
                          {isClaiming ? (
                            <>
                              <Icon name="loader" size={13} />
                              Verifying…
                            </>
                          ) : (
                            "I did it! Claim"
                          )}
                        </button>
                      )}
                    </div>
                  ) : (
                    /* Tasks with no external URL (e.g. profile complete) */
                    <button
                      className="sw-earn-claim-btn"
                      onClick={() => handleClaim(task)}
                      disabled={isClaiming}
                      aria-label={`Claim reward for ${task.label}`}
                    >
                      {isClaiming ? (
                        <>
                          <Icon name="loader" size={13} />
                          Verifying…
                        </>
                      ) : (
                        "Claim"
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Completed tasks ── */}
      {completed.length > 0 && (
        <div className="sw-earn-completed-section">
          <h3 className="sw-earn-completed-title">
            <Icon name="checkCircle" size={15} style={{ color: "#22c55e" }} />
            Completed
          </h3>
          <div className="sw-earn-list">
            {completed.map((task) => (
              <div
                key={task.id}
                className="sw-earn-card sw-earn-card--done"
              >
                <div className="sw-earn-card-left">
                  <div className="sw-earn-card-icon" aria-hidden="true">
                    {task.emoji || "⚡"}
                  </div>
                  <div className="sw-earn-card-info">
                    <p className="sw-earn-card-label">{task.label}</p>
                    <p className="sw-earn-card-desc">{task.description}</p>
                  </div>
                </div>
                <div className="sw-earn-card-right">
                  <span className="sw-earn-reward sw-earn-reward--done">
                    +{task.spins_reward} spin{task.spins_reward > 1 ? "s" : ""}
                  </span>
                  <span className="sw-earn-done-badge">
                    <Icon name="checkCircle" size={14} /> Done
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}