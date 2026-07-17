/**
 * src/pages/product/components/PaymentCountdown.jsx
 */
import { useState, useEffect, useCallback } from "react";
import { WarningIcon, ClockIcon } from "./icons/index.jsx";
import "./styles/PaymentCountdown.css";

export default function PaymentCountdown({ createdAt, maxAgeMs }) {
  const compute = useCallback(
    () => Math.max(0, maxAgeMs - (Date.now() - createdAt)),
    [createdAt, maxAgeMs]
  );

  const [remaining, setRemaining] = useState(compute);

  /* Sync if createdAt changes (new payment session) */
  useEffect(() => {
    setRemaining(compute());
  }, [compute]);

  /* Tick every second */
  useEffect(() => {
    const id = setInterval(() => setRemaining(compute()), 1_000);
    return () => clearInterval(id);
  }, [compute]);

  const mins = Math.floor(remaining / 60_000);
  const secs = Math.floor((remaining % 60_000) / 1_000);

  if (remaining <= 0) {
    return (
      <p className="payment-expired">
        <WarningIcon /> Payment link expired — resubmit to get a new one.
      </p>
    );
  }

  return (
    <p>
      Complete it to make your listing live.{" "}
      <strong>
        <ClockIcon /> Expires in {mins}:{String(secs).padStart(2, "0")}
      </strong>
    </p>
  );
}