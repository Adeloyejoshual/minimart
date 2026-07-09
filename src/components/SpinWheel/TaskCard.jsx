import { useState, useEffect, useRef } from "react";
import Icon from "./Icon.jsx";
import { sound } from "./SoundManager.js";
import { fireConfetti } from "./confetti.js";
import { API, authH } from "./helpers.js";

export default function TaskCard({ task, completed, onClaim }) {
  const [state,     setState]     = useState(completed ? "done" : "idle");
  const [countdown, setCountdown] = useState(0);
  const timerRef                  = useRef(null);

  useEffect(() => {
    if (completed) setState("done");
  }, [completed]);

  const handleGo = () => {
    if (state !== "idle") return;

    if (task.internal) window.location.href = task.url;
    else window.open(task.url, "_blank", "noopener,noreferrer");

    const secs = Math.ceil(task.verifyDelay / 1_000);
    setCountdown(secs);
    setState("pending");

    timerRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(timerRef.current);
          setState("ready");
          return 0;
        }
        return c - 1;
      });
    }, 1_000);
  };

  const handleVerify = async () => {
    setState("verifying");
    try {
      const res  = await fetch(`${API}/spinwheel/earn-task`, {
        method  : "POST",
        headers : authH(),
        body    : JSON.stringify({ task_id: task.id }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setState("done");
        sound.taskDone();
        fireConfetti(false);
        onClaim?.(task, data);
      } else {
        setState("idle");
        alert(
          data.message ||
          "We couldn't verify yet. Please complete the task first."
        );
      }
    } catch {
      setState("idle");
      alert("Network error. Please try again.");
    }
  };

  useEffect(() => () => clearInterval(timerRef.current), []);

  const isDone      = state === "done";
  const isPending   = state === "pending";
  const isReady     = state === "ready";
  const isVerifying = state === "verifying";
  const totalSecs   = Math.ceil(task.verifyDelay / 1_000);

  return (
    <div
      className={`sw-task-card${isDone ? " sw-task-card--done" : ""}`}
      style={{ "--task-color": task.color, "--task-bg": task.bg }}
      aria-label={`${task.label} — ${task.spins_reward} bonus spin${task.spins_reward > 1 ? "s" : ""}`}
    >
      {/* Platform icon */}
      <div
        className="sw-task-icon"
        style={{ background: task.bg, color: task.color }}
      >
        <Icon name={task.iconName} size={22} />
      </div>

      {/* Body */}
      <div className="sw-task-body">
        <div className="sw-task-top">
          <p className="sw-task-label">{task.label}</p>
          <div
            className="sw-task-reward"
            aria-label={`+${task.spins_reward} spin reward`}
          >
            <Icon name="spin" size={12} />
            +{task.spins_reward}
          </div>
        </div>

        <p className="sw-task-desc">{task.description}</p>

        {/* Progress bar */}
        {isPending && (
          <div
            className="sw-task-progress"
            aria-label={`Verifying in ${countdown}s`}
          >
            <div
              className="sw-task-progress-bar"
              style={{
                width      : `${100 - (countdown / totalSecs) * 100}%`,
                transition : "width 1s linear",
                background : task.color,
              }}
            />
            <span className="sw-task-progress-label">
              Verify available in {countdown}s…
            </span>
          </div>
        )}
      </div>

      {/* Action */}
      <div className="sw-task-action">
        {isDone && (
          <div className="sw-task-done-badge" aria-label="Task completed">
            <Icon name="check" size={14} /> Done
          </div>
        )}

        {state === "idle" && (
          <button
            className="sw-task-go-btn"
            style={{ background: task.color }}
            onClick={handleGo}
            aria-label={`${task.type === "join" ? "Join" : "Follow"} ${task.platform}`}
          >
            {task.type === "join" ? "Join" : "Follow"}
            <Icon name="externalLink" size={13} />
          </button>
        )}

        {isPending && (
          <button
            className="sw-task-go-btn sw-task-go-btn--waiting"
            disabled
            aria-label={`Wait ${countdown} seconds before verifying`}
          >
            <Icon name="hourglass" size={14} /> {countdown}s
          </button>
        )}

        {isReady && (
          <button
            className="sw-task-verify-btn"
            onClick={handleVerify}
            aria-label={`Verify ${task.label} and claim spins`}
          >
            <Icon name="checkCircle" size={14} /> Verify &amp; Claim
          </button>
        )}

        {isVerifying && (
          <button
            className="sw-task-verify-btn sw-task-verify-btn--loading"
            disabled
            aria-label="Verifying task completion"
          >
            <Icon name="loader" size={14} /> Checking…
          </button>
        )}
      </div>
    </div>
  );
}