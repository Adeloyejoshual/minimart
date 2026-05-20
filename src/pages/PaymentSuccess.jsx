import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";

const API_BASE = "https://minimart-ivrm.onrender.com/api";

export default function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const navigate       = useNavigate();
  const [status, setStatus]   = useState("verifying"); // verifying | success | cancelled | failed
  const [message, setMessage] = useState("");

  useEffect(() => {
    // Paystack sends ?trxref=xxx&reference=xxx in the URL
    const reference = searchParams.get("reference") || searchParams.get("trxref");

    if (!reference) {
      setStatus("failed");
      setMessage("No payment reference found");
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }

    // Verify the payment with our backend
    fetch(`${API_BASE}/payment/verify`, {
      method:  "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization:  `Bearer ${token}`,
      },
      body: JSON.stringify({ reference }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.success || data.status === "success") {
          setStatus("success");
          // Clear the stored payment session
          localStorage.removeItem("payment_retry");
          // Redirect to home after 3 seconds
          setTimeout(() => navigate("/"), 3000);
        } else {
          setStatus(data.status === "abandoned" ? "cancelled" : "failed");
          setMessage(data.message ?? "Payment was not completed");
        }
      })
      .catch(() => {
        setStatus("failed");
        setMessage("Could not verify payment — please contact support");
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Render ──────────────────────────────────────────────────────────────
  if (status === "verifying") {
    return (
      <div className="payment-result-page">
        <div className="payment-result-icon">⏳</div>
        <h2>Verifying your payment…</h2>
        <p>Please wait, do not close this page.</p>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="payment-result-page">
        <div className="payment-result-icon">✅</div>
        <h2>Payment Successful!</h2>
        <p>Your product is now live. Redirecting you home…</p>
      </div>
    );
  }

  if (status === "cancelled") {
    return (
      <div className="payment-result-page">
        <div className="payment-result-icon">❌</div>
        <h2>Payment Cancelled</h2>
        <p>{message}</p>
        <p>Your listing has been saved as a draft. You can complete payment anytime.</p>
        <div className="payment-result-actions">
          <button onClick={() => navigate("/add-product")}>
            Go Back to My Listing
          </button>
          <button onClick={() => navigate("/")}>
            Go Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="payment-result-page">
      <div className="payment-result-icon">⚠️</div>
      <h2>Payment Failed</h2>
      <p>{message}</p>
      <p>Your listing has been saved as a draft. Please try again.</p>
      <div className="payment-result-actions">
        <button onClick={() => navigate("/add-product")}>
          Try Again
        </button>
        <button onClick={() => navigate("/")}>
          Go Home
        </button>
      </div>
    </div>
  );
}