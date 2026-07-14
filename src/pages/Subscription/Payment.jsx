import { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import "../../styles/subscription/index.css";

const Payment = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [status,   setStatus]   = useState("verifying");
  const [message,  setMessage]  = useState("");
  const [planName, setPlanName] = useState("");

  const verifiedRef = useRef(false);

  useEffect(() => {
    if (verifiedRef.current) return;
    verifiedRef.current = true;

    const run = async () => {
      try {
        const reference = params.get("reference") ?? params.get("trxref");
        if (!reference) throw new Error("No payment reference found in the URL.");

        const res = await fetch("/api/subscription/payments/verify/paystack", {
          method:  "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization:  `Bearer ${localStorage.getItem("token")}`,
          },
          body: JSON.stringify({ reference }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message);

        setStatus("success");
        setMessage(data.message);
        setPlanName(data.planName ?? "");

        sessionStorage.removeItem("pending_subscription");
        setTimeout(() => navigate("/seller/subscription"), 4000);
      } catch (err) {
        setStatus("failed");
        setMessage(
          err.message ?? "Verification failed. Contact support if you were charged."
        );
      }
    };

    run();
  }, [navigate, params]);

  return (
    <div className="sub-payment-page">
      <div className="sub-payment-card">

        {status === "verifying" && (
          <>
            <div className="sub-payment-spinner" />
            <h2 className="sub-payment-card__title">Verifying Payment</h2>
            <p className="sub-payment-card__text">
              Confirming your payment with Paystack — please wait...
            </p>
          </>
        )}

        {status === "success" && (
          <>
            <div className="sub-payment-card__status-icon sub-payment-card__status-icon--success">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="10"/></svg>
            </div>
            <h2 className="sub-payment-card__title">Payment Successful!</h2>
            {planName && (
              <p className="sub-payment-card__plan">Welcome to {planName}!</p>
            )}
            <p className="sub-payment-card__text">{message}</p>
            <p className="sub-payment-card__redirect">
              Redirecting to your dashboard in a moment...
            </p>
            <button
              onClick={() => navigate("/seller/subscription")}
              className="sub-btn sub-btn--primary sub-btn--full"
            >
              Go to Dashboard
            </button>
          </>
        )}

        {status === "failed" && (
          <>
            <div className="sub-payment-card__status-icon sub-payment-card__status-icon--failed">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
            </div>
            <h2 className="sub-payment-card__title">Verification Failed</h2>
            <p className="sub-payment-card__text">{message}</p>
            <div className="sub-payment-card__actions">
              <button
                onClick={() => navigate("/seller/subscription/plans")}
                className="sub-btn sub-btn--primary sub-btn--full"
              >
                Try Again
              </button>
              <button
                onClick={() => navigate("/seller/subscription")}
                className="sub-btn sub-btn--ghost sub-btn--full"
              >
                Back to Dashboard
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Payment;