import { useState, useMemo } from "react";
import Icon from "./Icon.jsx";
import TaskCard from "./TaskCard.jsx";
import { EARN_TASKS, TASK_CATEGORIES } from "./helpers.js";

export default function EarnTab({ completedTaskIds, onTaskClaimed, totalEarned }) {
  const [catFilter, setCatFilter] = useState("all");

  const visible = useMemo(
    () =>
      catFilter === "all"
        ? EARN_TASKS
        : EARN_TASKS.filter((t) => t.category === catFilter),
    [catFilter]
  );

  const doneCount   = EARN_TASKS.filter((t) =>
    completedTaskIds.includes(t.id)
  ).length;

  const totalSpins  = EARN_TASKS.reduce((a, t) => a + t.spins_reward, 0);

  const earnedSpins = EARN_TASKS
    .filter((t) => completedTaskIds.includes(t.id))
    .reduce((a, t) => a + t.spins_reward, 0);

  return (
    <>
      {/* ── Progress header ── */}
      <div className="sw-earn-header">
        <div className="sw-earn-progress-wrap">
          <div className="sw-earn-progress-top">
            <span className="sw-earn-progress-title">Tasks Completed</span>
            <span className="sw-earn-progress-count">
              {doneCount} / {EARN_TASKS.length}
            </span>
          </div>
          <div
            className="sw-earn-progress-bar-track"
            role="progressbar"
            aria-valuenow={doneCount}
            aria-valuemin={0}
            aria-valuemax={EARN_TASKS.length}
          >
            <div
              className="sw-earn-progress-bar-fill"
              style={{
                width: `${(doneCount / EARN_TASKS.length) * 100}%`,
              }}
            />
          </div>
        </div>

        {/* Stats */}
        <div className="sw-earn-stats-row">
          {[
            {
              val     : earnedSpins,
              label   : "Spins Earned",
              color   : "#e8630a",
              iconName: "spin",
            },
            {
              val     : totalSpins - earnedSpins,
              label   : "Spins Available",
              color   : "#6366f1",
              iconName: "bolt",
            },
            {
              val     : totalEarned || 0,
              label   : "Total Ever",
              color   : "#16a34a",
              iconName: "trophy",
            },
          ].map((s) => (
            <div key={s.label} className="sw-earn-stat">
              <Icon
                name={s.iconName}
                size={16}
                style={{ color: s.color, marginBottom: 4 }}
              />
              <span
                className="sw-earn-stat-val"
                style={{ color: s.color }}
              >
                {s.val}
              </span>
              <span className="sw-earn-stat-label">{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Category filter ── */}
      <div
        className="sw-earn-cat-filter"
        role="group"
        aria-label="Filter earn tasks by category"
      >
        {TASK_CATEGORIES.map((cat) => {
          const count =
            cat.key === "all"
              ? EARN_TASKS.length
              : EARN_TASKS.filter((t) => t.category === cat.key).length;

          return (
            <button
              key={cat.key}
              className={`sw-earn-cat-btn${catFilter === cat.key ? " active" : ""}`}
              onClick={() => setCatFilter(cat.key)}
              aria-pressed={catFilter === cat.key}
            >
              {cat.iconName && <Icon name={cat.iconName} size={14} />}
              {cat.label}
              <span className="sw-earn-cat-count">{count}</span>
            </button>
          );
        })}
      </div>

      {/* ── Task list ── */}
      <div className="sw-task-list" role="list" aria-label="Earn tasks">
        {visible.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            completed={completedTaskIds.includes(task.id)}
            onClaim={onTaskClaimed}
          />
        ))}
      </div>

      {/* ── Tip ── */}
      <div className="sw-earn-tip">
        <Icon
          name="lightbulb"
          size={18}
          style={{ color: "#f59e0b", flexShrink: 0 }}
        />
        <p>
          Follow or join each platform once to claim your bonus spins.
          Rewards are verified by our backend and can only be earned once
          per account.
        </p>
      </div>
    </>
  );
}