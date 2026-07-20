/* ════════════════════════════════════════════════════════════
   FILE: src/pages/AuthPage/components.jsx
   All sub-components — no business logic
════════════════════════════════════════════════════════════ */
import { useEffect, useRef, useState } from "react";
import { useNavigate }                 from "react-router-dom";
import {
  Ic, IcMap,
  FEATURES, TRUST_ITEMS,
  OTP_LENGTH, RESEND_SECS,
} from "./constants";

/* ════════════════════════════════════════════════════════════
   PARTICLE CANVAS
════════════════════════════════════════════════════════════ */
export function ParticleCanvas() {
  const ref = useRef(null);
  const pts = useRef([]);
  const mx  = useRef({ x: -9999, y: -9999 });
  const raf = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    let w, h;

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      w = r.width;
      h = r.height;
      canvas.width  = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      pts.current = Array.from(
        { length: Math.min(30, Math.floor((w * h) / 18_000)) },
        () => ({
          x  : Math.random() * w,
          y  : Math.random() * h,
          vx : (Math.random() - 0.5) * 0.18,
          vy : (Math.random() - 0.5) * 0.18,
          r  : Math.random() * 1.1 + 0.4,
          o  : Math.random() * 0.07 + 0.02,
        })
      );
    };

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      const p          = pts.current;
      const { x: ox, y: oy } = mx.current;

      for (const q of p) {
        q.x += q.vx;
        q.y += q.vy;
        if (q.x < -4)    q.x = w + 4;
        if (q.x > w + 4) q.x = -4;
        if (q.y < -4)    q.y = h + 4;
        if (q.y > h + 4) q.y = -4;

        const dx = q.x - ox;
        const dy = q.y - oy;
        const d  = Math.hypot(dx, dy);
        if (d < 80 && d > 0) { q.x += dx * 0.005; q.y += dy * 0.005; }

        ctx.beginPath();
        ctx.arc(q.x, q.y, q.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(180,80,0,${q.o})`;
        ctx.fill();
      }

      for (let i = 0; i < p.length; i++) {
        for (let j = i + 1; j < p.length; j++) {
          const d = Math.hypot(p[i].x - p[j].x, p[i].y - p[j].y);
          if (d < 70) {
            ctx.beginPath();
            ctx.moveTo(p[i].x, p[i].y);
            ctx.lineTo(p[j].x, p[j].y);
            ctx.strokeStyle = `rgba(180,80,0,${0.025 * (1 - d / 70)})`;
            ctx.lineWidth   = 0.5;
            ctx.stroke();
          }
        }
      }
      raf.current = requestAnimationFrame(draw);
    };

    const onMove  = (e) => {
      const r    = canvas.getBoundingClientRect();
      mx.current = { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const onLeave = () => { mx.current = { x: -9999, y: -9999 }; };

    resize();
    draw();
    window.addEventListener("resize",     resize);
    canvas.addEventListener("mousemove",  onMove);
    canvas.addEventListener("mouseleave", onLeave);

    return () => {
      cancelAnimationFrame(raf.current);
      window.removeEventListener("resize",     resize);
      canvas.removeEventListener("mousemove",  onMove);
      canvas.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      style={{
        position      : "absolute",
        inset         : 0,
        width         : "100%",
        height        : "100%",
        pointerEvents : "all",
        zIndex        : 0,
        opacity       : 0.45,
      }}
    />
  );
}

/* ════════════════════════════════════════════════════════════
   LEFT PANEL
════════════════════════════════════════════════════════════ */
export function LeftPanel() {
  return (
    <div className="ap-left" aria-hidden="true">
      <div className="ap-blob ap-blob1" />
      <div className="ap-blob ap-blob2" />
      <ParticleCanvas />
      <div className="ap-left-inner">
        <div className="ap-logo">
          <div className="ap-logo-icon">
            <div className="ap-logo-ring" />
            <div className="ap-logo-bag">
              <div className="ap-logo-pin" />
            </div>
          </div>
          <span className="ap-logo-name">Loe<b>mart</b></span>
        </div>
        <div className="ap-hero">
          <div className="ap-hero-tag">Your everyday marketplace</div>
          <h2>Shop Smarter,<br /><em>Live Better.</em></h2>
          <p className="ap-hero-desc">
            Discover quality products from verified sellers. Fast delivery,
            secure checkout, and real support — every order.
          </p>
          <div className="ap-feats">
            {FEATURES.map((f) => (
              <div className="ap-feat" key={f.title}>
                <div className="ap-feat-icon">{IcMap[f.icon]?.("#FF5C00")}</div>
                <div className="ap-feat-text">
                  <strong>{f.title}</strong>
                  {f.desc}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="ap-trust-grid">
          {TRUST_ITEMS.map((t) => (
            <div className="ap-trust-item" key={t.label}>
              <div className="ap-trust-ic">{IcMap[t.icon]?.("#FF5C00")}</div>
              <div>
                <div className="ap-trust-label">{t.label}</div>
                <div className="ap-trust-sub">{t.sub}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   OTP CELLS
════════════════════════════════════════════════════════════ */
export function OtpCells({ value, onChange, disabled, hasError }) {
  const refs = useRef([]);

  useEffect(() => {
    const t = setTimeout(() => refs.current[0]?.focus(), 300);
    return () => clearTimeout(t);
  }, []);

  const char   = (i) => value[i] ?? "";
  const update = (i, ch) => {
    const arr = Array.from({ length: OTP_LENGTH }, (_, k) => value[k] ?? "");
    arr[i] = ch;
    onChange(arr.join(""));
  };

  return (
    <div
      className={`ap-otp-group${hasError ? " ap-otp-group--error" : ""}`}
      role="group"
      aria-label="One-time code input"
    >
      {Array.from({ length: OTP_LENGTH }).map((_, i) => (
        <input
          key={i}
          ref={(el) => (refs.current[i] = el)}
          type="text"
          inputMode="numeric"
          pattern="\d*"
          maxLength={1}
          value={char(i)}
          disabled={disabled}
          aria-label={`Digit ${i + 1} of ${OTP_LENGTH}`}
          className={[
            "ap-otp-cell",
            char(i)  ? "ap-otp-cell--filled" : "",
            hasError ? "ap-otp-cell--error"  : "",
          ].filter(Boolean).join(" ")}
          onChange={(e) => {
            const d = e.target.value.replace(/\D/g, "").slice(-1);
            update(i, d);
            if (d && i < OTP_LENGTH - 1) refs.current[i + 1]?.focus();
          }}
          onKeyDown={(e) => {
            if (e.key === "Backspace") {
              e.preventDefault();
              if (char(i))  { update(i, ""); }
              else if (i > 0) { update(i - 1, ""); refs.current[i - 1]?.focus(); }
            } else if (e.key === "ArrowLeft"  && i > 0)              refs.current[i - 1]?.focus();
            else if   (e.key === "ArrowRight" && i < OTP_LENGTH - 1) refs.current[i + 1]?.focus();
          }}
          onFocus={(e) => e.target.select()}
          onPaste={(e) => {
            e.preventDefault();
            const digits = e.clipboardData
              .getData("text")
              .replace(/\D/g, "")
              .slice(0, OTP_LENGTH);
            const result = Array.from(
              { length: OTP_LENGTH },
              (_, k) => digits[k] ?? ""
            ).join("");
            onChange(result);
            refs.current[Math.min(digits.length, OTP_LENGTH - 1)]?.focus();
          }}
        />
      ))}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   COUNTDOWN
════════════════════════════════════════════════════════════ */
export function Countdown({ seconds, resendKey, onDone }) {
  const [left,    setLeft]  = useState(seconds);
  const onDoneRef           = useRef(onDone);

  useEffect(() => { onDoneRef.current = onDone; }, [onDone]);

  useEffect(() => {
    setLeft(seconds);
    if (seconds <= 0) return;
    const id = setInterval(() => {
      setLeft((p) => {
        if (p <= 1) { clearInterval(id); onDoneRef.current?.(); return 0; }
        return p - 1;
      });
    }, 1_000);
    return () => clearInterval(id);
  }, [seconds, resendKey]);

  return (
    <span
      className={`ap-countdown${left <= 10 ? " ap-countdown--warn" : ""}`}
      aria-live="polite"
      aria-atomic="true"
    >
      {left}s
    </span>
  );
}

/* ════════════════════════════════════════════════════════════
   SMALL ATOMS
════════════════════════════════════════════════════════════ */
export function Chevron() {
  return (
    <span className="ap-chev" aria-hidden="true">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
           stroke="currentColor" strokeWidth="2.5"
           strokeLinecap="round" strokeLinejoin="round">
        <polyline points="6 9 12 15 18 9"/>
      </svg>
    </span>
  );
}

export function Spinner({ c = "#fff" }) {
  return (
    <svg className="ap-spinner" width="18" height="18"
         viewBox="0 0 24 24" fill="none"
         stroke={c} strokeWidth="2.5" strokeLinecap="round"
         aria-hidden="true">
      <path d="M21 12a9 9 0 11-6.219-8.56"/>
    </svg>
  );
}

export function Badges() {
  return (
    <div className="ap-badges" aria-label="Security badges">
      <span className="ap-badge"><Ic.Shield s={11} c="#6B6560" /> SSL Secured</span>
      <span className="ap-badge"><Ic.Lock   s={11} c="#6B6560" /> Encrypted</span>
      <span className="ap-badge"><Ic.Check  s={11} c="#6B6560" /> GDPR</span>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   PASSWORD STRENGTH METER
════════════════════════════════════════════════════════════ */
export function PasswordStrength({ pw }) {
  if (!pw.checks?.length) return null;
  return (
    <div className="ap-pw" role="status" aria-live="polite">
      <div className="ap-pw-bars" aria-hidden="true">
        {[1, 2, 3, 4].map((v) => (
          <div
            key={v}
            className={`ap-pw-bar${pw.score >= v ? " ap-pw-bar--on" : ""}`}
            style={pw.score >= v ? { background: pw.color } : {}}
          />
        ))}
      </div>
      <div className="ap-pw-label" style={{ color: pw.color }}
           aria-label={`Password strength: ${pw.label}`}>
        {pw.label}
      </div>
      <div className="ap-pw-checks">
        {pw.checks.map((c, i) => (
          <span
            key={i}
            className={`ap-pw-check ${c.met ? "ap-pw-check--met" : "ap-pw-check--no"}`}
            aria-label={`${c.label}: ${c.met ? "met" : "not met"}`}
          >
            {c.met ? (
              <Ic.Check s={9} c="#15803D" />
            ) : (
              <span aria-hidden="true" style={{
                width: 9, height: 9, display: "inline-block",
                borderRadius: "50%", border: "1.5px solid #B0AAA3",
              }} />
            )}
            {c.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   INVITE CODE PREVIEW
   ── Privacy model ──────────────────────────────────────────
   The backend returns only:
     { valid: true, code_preview: "JOS***47" }
   No name, no avatar, no identity — just enough for the
   invitee to recognise their own code. If the inviter shared
   "JOSHUA247" verbally, the preview confirms it without
   revealing who owns the account.
════════════════════════════════════════════════════════════ */
export function InviteCodePreview({ status, preview, onClear }) {
  if (!status) return null;

  if (status === "checking") {
    return (
      <div className="ap-invite-status ap-invite-status--checking" aria-live="polite">
        <Spinner c="#6B7280" />
        <span>Checking invite code…</span>
      </div>
    );
  }

  if (status === "valid" && preview) {
    return (
      <div
        className="ap-invite-status ap-invite-status--valid"
        role="status"
        aria-live="polite"
      >
        {/* ── Privacy-safe: icon only, no name/avatar ── */}
        <div className="ap-invite-valid-icon" aria-hidden="true">
          <Ic.CheckCircle s={16} c="#15803D" />
        </div>

        <div className="ap-invite-info">
          <span className="ap-invite-valid-label">
            Valid invite code
          </span>

          {/*
            Show only the masked code so the invitee can
            confirm it matches what they received — no name
            or identity detail is disclosed.
          */}
          {preview.code_preview && (
            <span className="ap-invite-code-preview">
              Code: <code>{preview.code_preview}</code>
            </span>
          )}

          <span className="ap-invite-sub">
            You've been invited to join Loemart!
          </span>
        </div>

        {onClear && (
          <button
            type="button"
            className="ap-invite-clear"
            onClick={onClear}
            aria-label="Clear invite code"
          >
            <Ic.X s={12} c="#9CA3AF" />
          </button>
        )}
      </div>
    );
  }

  if (status === "invalid") {
    return (
      <div
        className="ap-invite-status ap-invite-status--invalid"
        role="alert"
        aria-live="assertive"
      >
        <Ic.X s={12} c="#DC2626" />
        <span>Invalid invite code — it won't be applied</span>
      </div>
    );
  }

  return null;
}

/* ════════════════════════════════════════════════════════════
   INVITE BANNER
   Shown at the top of the register form when a valid code
   is pre-filled from a URL. Privacy-safe — no name shown.
════════════════════════════════════════════════════════════ */
export function InviteBanner({ visible }) {
  if (!visible) return null;
  return (
    <div className="ap-invite-banner" role="note">
      <Ic.Gift s={18} c="#15803D" />
      <div>
        <strong>You've been invited to join Loemart!</strong>
        <br />
        <span style={{ fontSize: 12, opacity: 0.7 }}>
          You and the person who invited you will both earn rewards
          when you sign up and verify your email.
        </span>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   HELP LINK
   Shown on both login and register screens below the form.
   Also surfaced as a dedicated entry in the mode switcher
   area so users locked out can find it easily.
════════════════════════════════════════════════════════════ */
export function HelpLink({ className = "" }) {
  return (
    <a
      href="/help"
      className={`ap-help-link ${className}`.trim()}
      aria-label="Go to the Help Center"
    >
      <Ic.Help s={14} c="currentColor" />
      <span>Help Center</span>
      <span className="ap-help-link__desc">Browse FAQs &amp; articles</span>
    </a>
  );
}

/* ════════════════════════════════════════════════════════════
   OTP PANEL
════════════════════════════════════════════════════════════ */
export function OtpPanel({
  otp,
  setOtp,
  otpError,
  otpErrMsg,
  attemptsLeft,
  canResend,
  resendKey,
  resendLeft,
  devOtp,
  maskedEmail,
  isVerifying,
  onResend,
  onDoneCountdown,
  onSkip,
}) {
  return (
    <>
      <div className="ap-otp-header">
        <div className="ap-otp-icon-wrap" aria-hidden="true">
          <Ic.Mail s={28} c="#fff" />
        </div>
        <h3 className="ap-otp-title">Check your email</h3>
        <p className="ap-otp-sub">
          We sent a 6-digit code to{" "}
          {maskedEmail
            ? <strong>{maskedEmail}</strong>
            : "your email address"
          }.{" "}
          Enter it below to verify your account.
        </p>
      </div>

      {devOtp && (
        <div className="ap-dev-otp" role="note">
          Dev mode — code: <strong>{devOtp}</strong>
        </div>
      )}

      <OtpCells
        value={otp}
        onChange={setOtp}
        disabled={isVerifying}
        hasError={otpError}
      />

      <p className="ap-otp-hint" aria-live="polite">
        Auto-submits when all {OTP_LENGTH} digits are entered
      </p>

      {otpErrMsg && (
        <div className="ap-otp-error" role="alert" aria-live="assertive">
          {otpErrMsg}
          {typeof attemptsLeft === "number" &&
           attemptsLeft > 0 &&
           attemptsLeft <= 4 && (
            <span className="ap-otp-error__sub">
              {attemptsLeft} attempt{attemptsLeft !== 1 ? "s" : ""} remaining
            </span>
          )}
        </div>
      )}

      <div className="ap-otp-resend">
        <div>
          {resendLeft === 0 ? (
            <span className="ap-otp-resend__limit">
              Daily limit reached — try tomorrow
            </span>
          ) : canResend ? (
            <button
              type="button"
              className="ap-otp-resend__btn"
              onClick={onResend}
              aria-label="Resend verification code"
            >
              <Ic.Refresh s={13} /> Resend code
              {resendLeft !== null && (
                <span className="ap-otp-resend__count">
                  ({resendLeft} left)
                </span>
              )}
            </button>
          ) : (
            <span className="ap-otp-resend__timer">
              Resend in{" "}
              {/* ✅ onDone now wires through to enable the resend button */}
              <Countdown
                key={resendKey}
                seconds={RESEND_SECS}
                resendKey={resendKey}
                onDone={onDoneCountdown}
              />
            </span>
          )}
        </div>
        <span className="ap-otp-resend__note">
          <Ic.Lock s={11} /> Never share this
        </span>
      </div>

      {/* ── Skip + Help ── */}
      <div className="ap-otp-footer">
        <button
          type="button"
          className="ap-forgot"
          onClick={onSkip}
          aria-label="Skip email verification for now"
        >
          Skip for now — verify later
        </button>

        {/*
          Users who are locked out (lost access to email, never
          received the code) need a clear path to support.
        */}
        <HelpLink className="ap-otp-help" />
      </div>

      <Badges />
    </>
  );
}