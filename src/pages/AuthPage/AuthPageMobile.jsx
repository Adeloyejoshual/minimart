/* ════════════════════════════════════════════════════════════
   FILE: src/pages/AuthPage/AuthPageMobile.jsx
   Single-column mobile layout.
   Shares all logic via useAuthLogic() and all fields via
   FormFields — only the chrome (header, layout) differs.
════════════════════════════════════════════════════════════ */
import { useMemo }               from "react";
import { useNavigate, Navigate } from "react-router-dom";

import { locationsByState }  from "../../config/locationsByState";
import "../../styles/AuthPage.css";

import {
  Ic,
} from "./constants.jsx";

import {
  OtpPanel,
  InviteCodePreview,
  InviteBanner,
  HelpLink,
  Badges,
  Spinner,
} from "./components";

import { useAuthLogic } from "./useAuthLogic";
import { FormFields }   from "./AuthPageDesktop";

/* ════════════════════════════════════════════════════════════
   MOBILE LAYOUT
════════════════════════════════════════════════════════════ */
export default function AuthPageMobile({ setUser }) {
  const navigate = useNavigate();

  const {
    mode, switchMode,
    form, handleChange, handleInviteChange, clearInviteCode,
    inviteStatus, invitePreview,
    pw, showPw, setShowPw,
    remember, setRemember,
    loading,
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
    onSubmit, handleResend,
  } = useAuthLogic({ setUser, navigate });

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
      <div className="ap ap--mobile">
        {/* Mobile: compact header instead of full left panel */}
        <MobileHeader />

        <div className="ap-mobile-body">
          <div className="ap-box ap-box--mobile">
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
    );
  }

  /* ════════════════════════════════════════════════════════
     LOGIN / REGISTER SCREEN
  ════════════════════════════════════════════════════════ */
  return (
    <div className="ap ap--mobile">
      <MobileHeader />

      <div className="ap-mobile-body">
        <div className="ap-box ap-box--mobile">

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
  );
}

/* ════════════════════════════════════════════════════════════
   MOBILE HEADER
   Replaces the full LeftPanel with a compact branded bar.
   Keeps the logo visible without the canvas / feature list.
════════════════════════════════════════════════════════════ */
function MobileHeader() {
  return (
    <header className="ap-mobile-header" aria-label="Loemart">
      <div className="ap-logo ap-logo--mobile">
        <div className="ap-logo-icon ap-logo-icon--sm">
          <div className="ap-logo-ring" />
          <div className="ap-logo-bag">
            <div className="ap-logo-pin" />
          </div>
        </div>
        <span className="ap-logo-name">Loe<b>mart</b></span>
      </div>
      <p className="ap-mobile-tagline">Your everyday marketplace</p>
    </header>
  );
}