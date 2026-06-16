// src/pages/PaymentSuccess.jsx
import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";

const API_BASE = `${import.meta.env.VITE_API_BASE_URL}/api`;

// ---------------- CONSTANTS ----------------
const REDIRECT_DELAY = 3000; // ms before redirecting to home on success

// ---------------- STATUS VIEWS ----------------
const VIEWS = {
  verifying: {
    icon:    "⏳",
    title:   "Verifying your payment…",
    message: "Please wait, do not close this page.",
  },
  success: {
    icon:    "✅",
    title:   "Payment Successful!",
    message: "Your product is now live. Redirecting you home…",
  },
  cancelled: {
    icon:    "❌",
    title:   "Payment Cancelled",
    message: "Your listing has been saved as a draft. You can complete payment anytime.",
  },
  failed: {
    icon:    "⚠️",
    title:   "Payment Failed",
    message: "Your listing has been saved as a draft. Please try again.",
  },
};

// ---------------- COMPONENT ----------------
export default function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const navigate       = useNavigate();

  const [status, setStatus]   = useState("verifying"); // verifying | success | cancelled | failed
  const [message, setMessage] = useState("");

  // ---------------- VERIFY PAYMENT ----------------
  useEffect(() => {
    // Paystack sends ?trxref=xxx&reference=xxx in the URL
    const reference =
      searchParams.get("reference") ||
      searchParams.get("trxref");

    if (!reference) {
      setStatus("failed");
      setMessage("No payment reference found.");
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }

    // Verify payment with backend
    fetch(`${API_BASE}/payment/verify`, {
      method:  "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization:  `Bearer ${token}`,
      },
      body: JSON.stringify({ reference }),
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (data.success || data.status === "success") {
          setStatus("success");
          localStorage.removeItem("payment_retry");
          setTimeout(() => navigate("/"), REDIRECT_DELAY);
        } else {
          setStatus(data.status === "abandoned" ? "cancelled" : "failed");
          setMessage(data.message ?? "Payment was not completed.");
        }
      })
      .catch(() => {
        setStatus("failed");
        setMessage("Could not verify payment — please contact support.");
      });

  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------- RENDER ----------------
  const view = VIEWS[status];

  return (
    <div className="payment-result-page">

      {/* Icon */}
      <div className="payment-result-icon">
        {view.icon}
      </div>

      {/* Title */}
      <h2>{view.title}</h2>

      {/* Dynamic message (from server) or default */}
      <p>{message || view.message}</p>

      {/* Extra message for cancelled/failed */}
      {status === "cancelled" && (
        <p>Your listing has been saved as a draft. You can complete payment anytime.</p>
      )}
      {status === "failed" && (
        <p>Your listing has been saved as a draft. Please try again.</p>
      )}

      {/* Actions for cancelled & failed */}
      {(status === "cancelled" || status === "failed") && (
        <div className="payment-result-actions">
          <button onClick={() => navigate("/add-product")}>
            {status === "cancelled" ? "Go Back to My Listing" : "Try Again"}
          </button>
          <button onClick={() => navigate("/")}>
            Go Home
          </button>
        </div>
      )}

    </div>
  );
}