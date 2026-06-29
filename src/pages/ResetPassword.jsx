import { useState, useEffect } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";
import "../styles/ResetPassword.css";

/* ── API ─────────────────────────────────────────────────────── */
const BASE_URL  = import.meta.env.VITE_API_BASE_URL;
const USERS_API = `${BASE_URL}/api/users`;

/* ── Password Strength ───────────────────────────────────────── */
const getPasswordStrength = (password) => {
  if (!password) return { score: 0, label: "", color: "" };

  let score = 0;
  if (password.length >= 8)              score++; // min length
  if (/[A-Z]/.test(password))            score++; // uppercase
  if (/[0-9]/.test(password))            score++; // number
  if (/[^A-Za-z0-9]/.test(password))     score++; // special char

  const levels = [
    { score: 1, label: "Weak",      color: "#ef4444" },
    { score: 2, label: "Fair",      color: "#f97316" },
    { score: 3, label: "Good",      color: "#eab308" },
    { score: 4, label: "Strong",    color: "#22c55e" },
  ];

  return levels[score - 1] || { score: 0, label: "", color: "" };
};

/* ══════════════════════════════════════════════════════════════
   RESET PASSWORD PAGE
══════════════════════════════════════════════════════════════ */
export default function ResetPassword() {
  const [searchParams]            = useSearchParams();
  const navigate                  = useNavigate();
  const token                     = searchParams.get("token");

  const [password,        setPassword]        = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword,    setShowPassword]    = useState(false);
  const [showConfirm,     setShowConfirm]     = useState(false);
  const [loading,         setLoading]         = useState(false);
  const [success,         setSuccess]         = useState(false);
  const [errors,          setErrors]          = useState({});
  const [tokenValid,      setTokenValid]      = useState(true);
  const [verifying,       setVerifying]       = useState(true);

  const strength = getPasswordStrength(password);

  /* ── Verify Token on Mount ──────────────────────────────── */
  useEffect(() => {
    // No token in URL → invalid
    if (!token) {
      setTokenValid(false);
      setVerifying(false);
      return;
    }

    // Verify token with backend
    axios
      .get(`${USERS_API}/verify-reset-token`, {
        params  : { token },
        timeout : 8_000,
      })
      .then(() => setTokenValid(true))
      .catch(() => setTokenValid(false))
      .finally(() => setVerifying(false));
  }, [token]);

  /* ── Validation ─────────────────────────────────────────── */
  const validate = () => {
    const newErrors = {};

    if (!password) {
      newErrors.password = "Please enter a new password.";
    } else if (password.length < 8) {
      newErrors.password = "Password must be at least 8 characters.";
    } else if (strength.score < 2) {
      newErrors.password = "Password is too weak. Add numbers or symbols.";
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = "Please confirm your new password.";
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match.";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  /* ── Submit ─────────────────────────────────────────────── */
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validate()) return;

    setLoading(true);

    try {
      await axios.post(`${USERS_API}/reset-password`, {
        token,
        password,
      });

      setSuccess(true);
      toast.success("Password reset successfully!");

      // Auto-redirect to login after 3s
      setTimeout(() => navigate("/auth", { replace: true }), 3_000);

    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        "Something went wrong. Please try again.";

      // Token expired or already used
      if (err?.response?.status === 400 || err?.response?.status === 401) {
        setTokenValid(false);
      } else {
        toast.error(msg);
        setErrors({ general: msg });
      }
    } finally {
      setLoading(false);
    }
  };

  /* ══════════════════════════════════════════════════════════
     VERIFYING STATE
  ══════════════════════════════════════════════════════════ */
  if (verifying) {
    return (
      <div className="rp-container">
        <div className="rp-card">
          <div className="rp-logo">🛒</div>
          <div className="rp-verifying">
            <div className="rp-spinner-lg" />
            <p>Verifying your reset link…</p>
          </div>
        </div>
      </div>
    );
  }

  /* ══════════════════════════════════════════════════════════
     INVALID / EXPIRED TOKEN STATE
  ══════════════════════════════════════════════════════════ */
  if (!tokenValid) {
    return (
      <div className="rp-container">
        <div className="rp-card">
          <div className="rp-logo">🛒</div>
          <div className="rp-invalid">
            <div className="rp-invalid-icon">⚠️</div>
            <h2>Link Expired or Invalid</h2>
            <p>
              This password reset link has expired or has already been used.
              Reset links are only valid for <strong>30 minutes</strong>.
            </p>
            <Link to="/forgot-password" className="rp-btn">
              Request a New Link
            </Link>
            <Link to="/auth" className="rp-back-link">
              ← Back to Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  /* ══════════════════════════════════════════════════════════
     SUCCESS STATE
  ══════════════════════════════════════════════════════════ */
  if (success) {
    return (
      <div className="rp-container">
        <div className="rp-card">
          <div className="rp-logo">🛒</div>
          <div className="rp-success">
            <div className="rp-success-icon">✅</div>
            <h2>Password Reset!</h2>
            <p>
              Your password has been reset successfully.
              You'll be redirected to login in a moment.
            </p>
            <div className="rp-redirect-note">
              Redirecting to login<span className="rp-dots" />
            </div>
            <Link to="/auth" className="rp-btn">
              Go to Login Now
            </Link>
          </div>
        </div>
      </div>
    );
  }

  /* ══════════════════════════════════════════════════════════
     FORM STATE
  ══════════════════════════════════════════════════════════ */
  return (
    <div className="rp-container">
      <div className="rp-card">

        {/* ── Logo ── */}
        <div className="rp-logo">🛒</div>

        <h2 className="rp-title">Set New Password</h2>
        <p className="rp-subtitle">
          Your new password must be different from your previous password.
        </p>

        <form onSubmit={handleSubmit} className="rp-form" noValidate>

          {/* ── General Error ── */}
          {errors.general && (
            <div className="rp-alert-error">
              ⚠️ {errors.general}
            </div>
          )}

          {/* ════════════════════════════════
              NEW PASSWORD
          ════════════════════════════════ */}
          <div className="rp-input-group">
            <label htmlFor="rp-password">New Password</label>

            <div className={`rp-input-wrapper ${errors.password ? "rp-input-error" : ""}`}>
              <span className="rp-input-icon">🔒</span>
              <input
                id="rp-password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter new password"
                value={password}
                disabled={loading}
                autoComplete="new-password"
                onChange={(e) => {
                  setPassword(e.target.value);
                  setErrors((prev) => ({ ...prev, password: "" }));
                }}
              />
              <button
                type="button"
                className="rp-eye-btn"
                onClick={() => setShowPassword((v) => !v)}
                tabIndex={-1}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? "🙈" : "👁️"}
              </button>
            </div>

            {/* ── Password Strength Bar ── */}
            {password && (
              <div className="rp-strength">
                <div className="rp-strength-bars">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="rp-strength-bar"
                      style={{
                        background:
                          i <= strength.score
                            ? strength.color
                            : "#e5e7eb",
                      }}
                    />
                  ))}
                </div>
                <span
                  className="rp-strength-label"
                  style={{ color: strength.color }}
                >
                  {strength.label}
                </span>
              </div>
            )}

            {/* ── Password Hints ── */}
            <ul className="rp-hints">
              <li className={password.length >= 8       ? "rp-hint-pass" : ""}>At least 8 characters</li>
              <li className={/[A-Z]/.test(password)     ? "rp-hint-pass" : ""}>One uppercase letter</li>
              <li className={/[0-9]/.test(password)     ? "rp-hint-pass" : ""}>One number</li>
              <li className={/[^A-Za-z0-9]/.test(password) ? "rp-hint-pass" : ""}>One special character</li>
            </ul>

            {errors.password && (
              <p className="rp-error-msg">⚠️ {errors.password}</p>
            )}
          </div>

          {/* ════════════════════════════════
              CONFIRM PASSWORD
          ════════════════════════════════ */}
          <div className="rp-input-group">
            <label htmlFor="rp-confirm">Confirm New Password</label>

            <div className={`rp-input-wrapper ${errors.confirmPassword ? "rp-input-error" : ""}`}>
              <span className="rp-input-icon">🔒</span>
              <input
                id="rp-confirm"
                type={showConfirm ? "text" : "password"}
                placeholder="Confirm new password"
                value={confirmPassword}
                disabled={loading}
                autoComplete="new-password"
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setErrors((prev) => ({ ...prev, confirmPassword: "" }));
                }}
              />
              <button
                type="button"
                className="rp-eye-btn"
                onClick={() => setShowConfirm((v) => !v)}
                tabIndex={-1}
                aria-label={showConfirm ? "Hide password" : "Show password"}
              >
                {showConfirm ? "🙈" : "👁️"}
              </button>
            </div>

            {/* ── Match Indicator ── */}
            {confirmPassword && (
              <p
                className="rp-match-msg"
                style={{
                  color: password === confirmPassword ? "#22c55e" : "#ef4444",
                }}
              >
                {password === confirmPassword ? "✅ Passwords match" : "❌ Passwords do not match"}
              </p>
            )}

            {errors.confirmPassword && (
              <p className="rp-error-msg">⚠️ {errors.confirmPassword}</p>
            )}
          </div>

          {/* ── Submit Button ── */}
          <button
            type="submit"
            className={`rp-btn ${loading ? "rp-btn-loading" : ""}`}
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="rp-spinner" /> Resetting…
              </>
            ) : (
              "Reset Password"
            )}
          </button>

        </form>

        {/* ── Back to Login ── */}
        <Link to="/auth" className="rp-back-link">
          ← Back to Login
        </Link>

      </div>
    </div>
  );
}