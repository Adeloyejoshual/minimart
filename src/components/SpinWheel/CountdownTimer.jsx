import { useState, useEffect } from "react";
import Icon from "./Icon.jsx";
import { fmtCountdown } from "./helpers.js";

export default function CountdownTimer({ secondsLeft }) {
  const [secs, setSecs] = useState(secondsLeft || 0);

  useEffect(() => {
    setSecs(secondsLeft || 0);
    if (!secondsLeft || secondsLeft <= 0) return;
    const t = setInterval(
      () => setSecs((s) => Math.max(0, s - 1)),
      1_000
    );
    return () => clearInterval(t);
  }, [secondsLeft]);

  if (secs <= 0) return null;

  return (
    <div
      className="sw-countdown"
      aria-live="polite"
      aria-label="Time until next free spin"
    >
      <Icon name="timer" size={18} />
      <span>Next free spin in</span>
      <span className="sw-countdown-time">{fmtCountdown(secs)}</span>
    </div>
  );
}