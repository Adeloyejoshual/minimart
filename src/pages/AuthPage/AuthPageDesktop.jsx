/* ════════════════════════════════════════════════════════════
   FILE: src/pages/AuthPage/AuthPageDesktop.jsx
   Full two-column desktop layout (left panel + right form).
   All state and API logic lives in useAuthLogic().

   UTM source tracking:
   • Reads utm_source from localStorage (set by App.jsx)
   • Passes it into useAuthLogic → backend on register
════════════════════════════════════════════════════════════ */
import { useMemo, useRef }              from "react";
import { useNavigate, Navigate, useParams } from "react-router-dom";

import { locationsByState }          from "../../config/locationsByState";
import { countries, getFlag }        from "../../config/countries";
import "../../styles/AuthPage.css";

import {
  Ic, MAX_INVITE_LEN,
  OTP_LENGTH,
  sanitizeInviteCode,
} from "./constants";

import {
  LeftPanel,
  OtpPanel,
  InviteCodePreview,
  InviteBanner,
  HelpLink,
  PasswordStrength,
  Badges,
  Spinner,
  Chevron,
} from "./components";

import { useAuthLogic } from "./useAuthLogic";

/* ════════════════════════════════════════════════════════════
   SOURCE HELPER
   Reads utm_source from localStorage.
   Always returns a non-empty string — "direct" as fallback.
   Never throws.
════════════════════════════════════════════════════════════ */
function readUtmSource() {
  try {
    return localStorage.getItem("utm_source")?.trim() || "direct";
  } catch {
    return "direct";
  }
}

/* ── Invite redirect helper ── */
export function InviteRedirect() {
  const { code } = useParams();
  const safeCode = sanitizeInviteCode(code);
  return <Navigate to={`/auth?ref=${safeCode}`} replace />;
}

/* ════════════════════════════════════════════════════════════
   DESKTOP LAYOUT
════════════════════════════════════════════════════════════ */
export default function AuthPageDesktop({ setUser }) {
  const navigate = useNavigate();

  /* ── Capture utm_source once on mount ── */
  const sourceRef = useRef(readUtmSource());

  const {
    /* mode */
    mode, switchMode,
    /* form */
    form, handleChange, handleInviteChange, clearInviteCode,
    /* invite */
    inviteStatus, invitePreview,
    /* password */
    pw, showPw, setShowPw,
    /* remember */
    remember, setRemember,
    /* loading */
    loading,
    /* OTP */
    otp, setOtp,
    otpError, otpErrMsg,
    attemptsLeft,
    canResend, setCanResend,
    resendKey,
    resendLeft,
    maskedEmail,
    authToken,
    devOtp,
    isVerifying,
    /* handlers */
    onSubmit, handleResend, sendOtp,
  } = useAuthLogic({
    setUser,
    navigate,
    source: sourceRef.current,    /* ← passed into logic hook */
  });

  /* ── Derived location data ── */
  const isNigeria     = form.country === "Nigeria";
  const nigeriaStates = useMemo(() => Object.keys(locationsByState).sort(), []);
  const cities        = useMemo(() => {
    if (isNigeria && form.state && locationsByState[form.state])
      return locationsByState[form.state];
    return [];
  }, [isNigeria, form.state]);

  /* ════════════════════════════════════════════════════════
     OTP SCREEN
  ════════════════════════════════════════════════════════ */
  if (mode === "otp") {
    if (!authToken) return <Navigate to="/auth" replace />;

    return (
      <div className="ap ap--desktop">
        <LeftPanel />
        <div className="ap-right">
          <div className="ap-right-scroll">
            <div className="ap-box">
              <OtpPanel
                otp={otp}
                setOtp={setOtp}
                otpError={otpError}
                otpErrMsg={otpErrMsg}
                attemptsLeft={attemptsLeft}
                canResend={canResend}
                resendKey={resendKey}
                resendLeft={resendLeft}
                devOtp={devOtp}
                maskedEmail={maskedEmail}
                isVerifying={isVerifying}
                onResend={handleResend}
                onDoneCountdown={() => setCanResend(true)}
                onSkip={() => navigate("/")}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ════════════════════════════════════════════════════════
     LOGIN / REGISTER SCREEN
  ════════════════════════════════════════════════════════ */
  return (
    <div className="ap ap--desktop">
      <LeftPanel />

      <div className="ap-right">
        <div className="ap-right-scroll">
          <div className="ap-box">

            {/* ── Tabs ── */}
            <div className="ap-tabs" role="tablist" aria-label="Authentication mode">
              {[
                { key: "login",    label: "Login"    },
                { key: "register", label: "Register" },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={mode === key}
                  className={`ap-tab${mode === key ? " active" : ""}`}
                  onClick={() => switchMode(key)}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* ── Heading ── */}
            <div className="ap-heading">
              <h3>
                {mode === "login" ? "Welcome back" : "Create your account"}
              </h3>
              <p>
                {mode === "login"
                  ? "Enter your credentials to continue"
                  : "Fill in your details — we'll verify your email next"
                }
              </p>
            </div>

            {/* ── Invite banner ── */}
            <InviteBanner visible={mode === "register" && inviteStatus === "valid"} />

            {/* ── Form ── */}
            <form onSubmit={onSubmit} noValidate>
              <div className="ap-form">
                <FormFields
                  mode={mode}
                  form={form}
                  pw={pw}
                  showPw={showPw}
                  setShowPw={setShowPw}
                  remember={remember}
                  setRemember={setRemember}
                  loading={loading}
                  inviteStatus={inviteStatus}
                  invitePreview={invitePreview}
                  isNigeria={isNigeria}
                  nigeriaStates={nigeriaStates}
                  cities={cities}
                  handleChange={handleChange}
                  handleInviteChange={handleInviteChange}
                  clearInviteCode={clearInviteCode}
                  navigate={navigate}
                />

                {/* Submit */}
                <button
                  type="submit"
                  className="ap-submit"
                  disabled={loading || inviteStatus === "checking"}
                  aria-busy={loading}
                >
                  {loading ? (
                    <><Spinner /> Please wait…</>
                  ) : mode === "login" ? (
                    <>Login <Ic.Arrow s={17} /></>
                  ) : (
                    <>Create Account &amp; Verify Email <Ic.Arrow s={17} /></>
                  )}
                </button>
              </div>
            </form>

            {/* ── Mode switcher ── */}
            <p className="ap-switch">
              {mode === "login"
                ? "Don't have an account? "
                : "Already have an account? "
              }
              <button
                type="button"
                className="ap-link-btn"
                onClick={() => switchMode(mode === "login" ? "register" : "login")}
              >
                {mode === "login" ? "Register" : "Login"}
              </button>
            </p>

            <HelpLink />

            <p className="ap-terms">
              By continuing you agree to our{" "}
              <a href="/terms"   target="_blank" rel="noreferrer">Terms of Service</a>
              {" "}and{" "}
              <a href="/privacy" target="_blank" rel="noreferrer">Privacy Policy</a>
            </p>

            <Badges />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   FORM FIELDS
   Extracted so both desktop and mobile can share the same
   field logic without duplicating JSX.
   source is NOT a prop here — it is handled entirely inside
   useAuthLogic and is invisible to the form rendering layer.
════════════════════════════════════════════════════════════ */
export function FormFields({
  mode,
  form,
  pw,
  showPw,
  setShowPw,
  remember,
  setRemember,
  loading,
  inviteStatus,
  invitePreview,
  isNigeria,
  nigeriaStates,
  cities,
  handleChange,
  handleInviteChange,
  clearInviteCode,
  navigate,
}) {
  return (
    <>
      {/* Full Name */}
      {mode === "register" && (
        <div className="ap-field">
          <label className="ap-label" htmlFor="ap-name">Full Name</label>
          <div className="ap-iw">
            <span className="ap-icon" aria-hidden="true"><Ic.User /></span>
            <input
              id="ap-name"
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="Your full name"
              autoComplete="name"
              required
            />
          </div>
        </div>
      )}

      {/* Email */}
      <div className="ap-field">
        <label className="ap-label" htmlFor="ap-email">Email</label>
        <div className="ap-iw">
          <span className="ap-icon" aria-hidden="true"><Ic.Mail /></span>
          <input
            id="ap-email"
            name="email"
            type="email"
            value={form.email}
            onChange={handleChange}
            placeholder="Email address"
            autoComplete="email"
            required
          />
        </div>
      </div>

      {/* Password */}
      <div className="ap-field">
        <label className="ap-label" htmlFor="ap-password">
          Password
          {mode === "login" && (
            <button
              type="button"
              className="ap-forgot"
              onClick={() => navigate("/forgot-password")}
              aria-label="Forgot password"
            >
              Forgot?
            </button>
          )}
        </label>
        <div className="ap-iw">
          <span className="ap-icon" aria-hidden="true"><Ic.Lock /></span>
          <input
            id="ap-password"
            name="password"
            type={showPw ? "text" : "password"}
            value={form.password}
            onChange={handleChange}
            placeholder="Password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            required
          />
          <button
            type="button"
            className="ap-eye"
            onClick={() => setShowPw((v) => !v)}
            tabIndex={-1}
            aria-label={showPw ? "Hide password" : "Show password"}
            aria-pressed={showPw}
          >
            {showPw ? <Ic.EyeOff /> : <Ic.Eye />}
          </button>
        </div>
        {mode === "register" && form.password && (
          <PasswordStrength pw={pw} />
        )}
      </div>

      {/* ── Register-only fields ── */}
      {mode === "register" && (
        <>
          {/* Invite Code */}
          <div className="ap-field">
            <label className="ap-label" htmlFor="ap-invite-code">
              Invite Code
              <span className="ap-label-opt">Optional</span>
            </label>
            <div
              className="ap-iw"
              style={{
                borderColor:
                  inviteStatus === "valid"   ? "#22C55E" :
                  inviteStatus === "invalid" ? "#EF4444" : undefined,
              }}
            >
              <span className="ap-icon" aria-hidden="true">
                <Ic.Gift
                  s={17}
                  c={
                    inviteStatus === "valid"   ? "#15803D" :
                    inviteStatus === "invalid" ? "#DC2626" : "currentColor"
                  }
                />
              </span>
              <input
                id="ap-invite-code"
                name="invite_code"
                value={form.invite_code}
                onChange={handleInviteChange}
                placeholder="e.g. MEMBER247"
                maxLength={MAX_INVITE_LEN}
                autoComplete="off"
                spellCheck={false}
                aria-describedby="ap-invite-status"
                disabled={inviteStatus === "checking" || loading}
                style={{
                  textTransform : "uppercase",
                  letterSpacing : form.invite_code ? "1.5px" : undefined,
                  fontWeight    : form.invite_code ? 700     : undefined,
                }}
              />
              {form.invite_code && inviteStatus !== "checking" && (
                <button
                  type="button"
                  className="ap-eye"
                  onClick={clearInviteCode}
                  aria-label="Clear invite code"
                  style={{ padding: 4 }}
                >
                  <Ic.X s={14} c="#9CA3AF" />
                </button>
              )}
            </div>
            <div id="ap-invite-status">
              <InviteCodePreview
                status={inviteStatus}
                preview={invitePreview}
                onClear={clearInviteCode}
              />
            </div>
          </div>

          {/* Phone */}
          <div className="ap-field">
            <label className="ap-label" htmlFor="ap-phone">
              Phone Number
              <span className="ap-label-opt">Optional</span>
            </label>
            <div className="ap-iw">
              <span className="ap-icon" aria-hidden="true"><Ic.Phone /></span>
              <input
                id="ap-phone"
                name="phone_number"
                type="tel"
                value={form.phone_number}
                onChange={handleChange}
                placeholder="Phone number"
                autoComplete="tel"
              />
            </div>
          </div>

          {/* Country */}
          <div className="ap-field">
            <label className="ap-label" htmlFor="ap-country">Country</label>
            <div className="ap-iw">
              <span className="ap-icon" aria-hidden="true"><Ic.Globe /></span>
              <select
                id="ap-country"
                name="country"
                value={form.country}
                onChange={handleChange}
                className={form.country === "" ? "ap-empty" : ""}
              >
                <option value="" disabled>Select Country</option>
                {countries.map((c) => (
                  <option key={c.code} value={c.name}>
                    {getFlag(c.code)} {c.name}
                  </option>
                ))}
              </select>
              <Chevron />
            </div>
          </div>

          {/* State + City */}
          <div className="ap-row">
            <div className="ap-field">
              <label className="ap-label" htmlFor="ap-state">State</label>
              <div className="ap-iw">
                <span className="ap-icon" aria-hidden="true"><Ic.Pin /></span>
                {isNigeria ? (
                  <>
                    <select
                      id="ap-state"
                      name="state"
                      value={form.state}
                      onChange={handleChange}
                      className={form.state === "" ? "ap-empty" : ""}
                    >
                      <option value="" disabled>Select State</option>
                      {nigeriaStates.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                    <Chevron />
                  </>
                ) : (
                  <input
                    id="ap-state"
                    name="state"
                    value={form.state}
                    onChange={handleChange}
                    placeholder="State / Region"
                  />
                )}
              </div>
            </div>

            <div className="ap-field">
              <label className="ap-label" htmlFor="ap-city">
                City
                <span className="ap-label-opt">Optional</span>
              </label>
              <div className="ap-iw">
                <span className="ap-icon" aria-hidden="true"><Ic.Pin /></span>
                {isNigeria && cities.length > 0 ? (
                  <>
                    <select
                      id="ap-city"
                      name="city"
                      value={form.city}
                      onChange={handleChange}
                      className={form.city === "" ? "ap-empty" : ""}
                    >
                      <option value="" disabled>Select City</option>
                      {cities.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                    <Chevron />
                  </>
                ) : (
                  <input
                    id="ap-city"
                    name="city"
                    value={form.city}
                    onChange={handleChange}
                    placeholder={
                      isNigeria && !form.state ? "Select state first" : "City"
                    }
                    disabled={isNigeria && !form.state}
                  />
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Remember me */}
      {mode === "login" && (
        <div className="ap-opts">
          <label className="ap-remember" htmlFor="ap-remember">
            <input
              id="ap-remember"
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              style={{ display: "none" }}
            />
            <span
              className={`ap-checkbox${remember ? " ap-checkbox--on" : ""}`}
              aria-hidden="true"
            >
              {remember && <Ic.Check s={10} c="#fff" />}
            </span>
            Remember me
          </label>
        </div>
      )}
    </>
  );
}