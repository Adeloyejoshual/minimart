import React, { useState } from "react";
import "../styles/ForgotPassword.css";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState("");

  // ✅ Email Validation
  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // ✅ Handle Submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // Empty check
    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }

    // Format check
    if (!validateEmail(email)) {
      setError("Please enter a valid email address.");
      return;
    }

    setIsLoading(true);

    try {
      // 🔁 Replace this with your actual API call
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Example API call:
      // await axios.post("/api/auth/forgot-password", { email });

      setIsSuccess(true);
    } catch (err) {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // ✅ Handle Try Another Email
  const handleReset = () => {
    setEmail("");
    setIsSuccess(false);
    setError("");
  };

  return (
    <div className="fp-container">
      <div className="fp-card">

        {/* ---- LOGO ---- */}
        <div className="fp-logo">🛒</div>

        {/* ---- SUCCESS STATE ---- */}
        {isSuccess ? (
          <div className="fp-success">
            <div className="fp-success-icon">📧</div>
            <h2>Check Your Email!</h2>
            <p>
              We've sent a password reset link to <br />
              <strong>{email}</strong>
            </p>
            <p className="fp-note">
              Didn't receive the email? Check your spam folder or try again.
            </p>
            <button className="fp-btn" onClick={handleReset}>
              Try Another Email
            </button>
            <a href="/login" className="fp-back-link">
              ← Back to Login
            </a>
          </div>

        ) : (

          /* ---- FORM STATE ---- */
          <>
            <h2 className="fp-title">Forgot Password?</h2>
            <p className="fp-subtitle">
              No worries! Enter your email and we'll send you a reset link.
            </p>

            <form onSubmit={handleSubmit} className="fp-form" noValidate>

              {/* Email Input */}
              <div className="fp-input-group">
                <label htmlFor="email">Email Address</label>
                <div className={`fp-input-wrapper ${error ? "fp-input-error" : ""}`}>
                  <span className="fp-input-icon">✉️</span>
                  <input
                    id="email"
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setError("");
                    }}
                    disabled={isLoading}
                    autoComplete="email"
                  />
                </div>

                {/* Error Message */}
                {error && <p className="fp-error-msg">⚠️ {error}</p>}
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                className={`fp-btn ${isLoading ? "fp-btn-loading" : ""}`}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <span className="fp-spinner"></span> Sending...
                  </>
                ) : (
                  "Send Reset Link"
                )}
              </button>
            </form>

            {/* Back to Login */}
            <a href="/login" className="fp-back-link">
              ← Back to Login
            </a>
          </>
        )}

      </div>
    </div>
  );
};

export default ForgotPassword;