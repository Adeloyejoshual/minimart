// ════════════════════════════════════════════════════════════
// FILE: src/components/LivenessChallenge.jsx
//
// Real-time liveness detection using device camera.
// Challenges (2 of 3 picked randomly):
//   1. Blink detection (eye aspect ratio)
//   2. Head turn (nose tip horizontal shift)
//   3. Smile detection (mouth corner ratio)
//
// Uses MediaPipe FaceMesh (CDN loaded once, cached on window).
// Falls back gracefully if camera / MediaPipe unavailable.
// No lucide-react icons that might not exist in older versions.
// ════════════════════════════════════════════════════════════

import { useState, useEffect, useRef, useCallback } from "react";

/* ══════════════════════════════════════════════════════════════
   INLINE SVG ICONS — no external dependency risk
══════════════════════════════════════════════════════════════ */
const Icon = ({ children, size = 20, className = "" }) => (
  <svg
    width={size} height={size} viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round"
    className={className} aria-hidden="true"
  >
    {children}
  </svg>
);

const CameraIcon = ({ size = 20, className = "" }) => (
  <Icon size={size} className={className}>
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
    <circle cx="12" cy="13" r="4" />
  </Icon>
);

const CheckIcon = ({ size = 20, className = "" }) => (
  <Icon size={size} className={className}>
    <polyline points="20 6 9 17 4 12" />
  </Icon>
);

const AlertIcon = ({ size = 20, className = "" }) => (
  <Icon size={size} className={className}>
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </Icon>
);

const RetryIcon = ({ size = 20, className = "" }) => (
  <Icon size={size} className={className}>
    <polyline points="23 4 23 10 17 10" />
    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
  </Icon>
);

const EyeIcon = ({ size = 20, className = "" }) => (
  <Icon size={size} className={className}>
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </Icon>
);

const SmileIcon = ({ size = 20, className = "" }) => (
  <Icon size={size} className={className}>
    <circle cx="12" cy="12" r="10" />
    <path d="M8 14s1.5 2 4 2 4-2 4-2" />
    <line x1="9" y1="9" x2="9.01" y2="9" />
    <line x1="15" y1="9" x2="15.01" y2="9" />
  </Icon>
);

const ArrowsIcon = ({ size = 20, className = "" }) => (
  <Icon size={size} className={className}>
    <path d="M21 12H3M3 12l4-4M3 12l4 4M21 12l-4-4M21 12l-4 4" />
  </Icon>
);

const SpinnerIcon = ({ size = 20, className = "" }) => (
  <svg
    width={size} height={size} viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="2.5"
    strokeLinecap="round"
    className={`v-spin ${className}`}
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
    <path d="M12 2a10 10 0 0 1 10 10" />
  </svg>
);

const XIcon = ({ size = 20, className = "" }) => (
  <Icon size={size} className={className}>
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </Icon>
);

/* ══════════════════════════════════════════════════════════════
   MEDIAPIPE LOADER — CDN, cached on window
══════════════════════════════════════════════════════════════ */
const MP_VER  = "0.4.1633559619";
const MP_BASE = `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@${MP_VER}`;

const loadMediaPipe = (() => {
  let p = null;
  return () => {
    if (p) return p;
    p = new Promise((ok, no) => {
      if (window.__mpFM) { ok(window.__mpFM); return; }
      const s   = document.createElement("script");
      s.src     = `${MP_BASE}/face_mesh.js`;
      s.async   = true;
      s.onload  = () => {
        try {
          const fm = new window.FaceMesh({
            locateFile: (f) => `${MP_BASE}/${f}`,
          });
          fm.setOptions({
            maxNumFaces           : 1,
            refineLandmarks       : true,
            minDetectionConfidence: 0.7,
            minTrackingConfidence : 0.7,
          });
          window.__mpFM = fm;
          ok(fm);
        } catch (e) { no(e); }
      };
      s.onerror = () => no(new Error("MediaPipe load failed"));
      document.head.appendChild(s);
    });
    return p;
  };
})();

/* ══════════════════════════════════════════════════════════════
   LANDMARKS (468-point model)
══════════════════════════════════════════════════════════════ */
const LM = {
  L_TOP: 159, L_BOT: 145, L_L: 33,  L_R: 133,
  R_TOP: 386, R_BOT: 374, R_L: 362, R_R: 263,
  NOSE: 4,
  M_L: 61, M_R: 291, M_TOP: 13, M_BOT: 14,
};

/* ══════════════════════════════════════════════════════════════
   GEOMETRY
══════════════════════════════════════════════════════════════ */
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

const getEAR = (lm, t, b, l, r) => {
  const h = dist(lm[l], lm[r]);
  return h > 0 ? dist(lm[t], lm[b]) / h : 1;
};

const getHeadTurn = (lm) => {
  const mid = (lm[LM.L_L].x + lm[LM.R_R].x) / 2;
  return lm[LM.NOSE].x - mid;
};

const getSmile = (lm) => {
  const w = dist(lm[LM.M_L], lm[LM.M_R]);
  return w > 0 ? dist(lm[LM.M_TOP], lm[LM.M_BOT]) / w : 0;
};

/* ══════════════════════════════════════════════════════════════
   BRIGHTNESS PRE-CHECK
══════════════════════════════════════════════════════════════ */
const CAM_BRIGHT_THRESH = 50;

const measureBrightness = (video) => {
  try {
    const c   = document.createElement("canvas");
    const s   = Math.min(1, 100 / video.videoWidth);
    c.width   = Math.round(video.videoWidth * s);
    c.height  = Math.round(video.videoHeight * s);
    const ctx = c.getContext("2d");
    ctx.drawImage(video, 0, 0, c.width, c.height);
    const { data } = ctx.getImageData(0, 0, c.width, c.height);
    let sum = 0;
    for (let i = 0; i < data.length; i += 4)
      sum += data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    return sum / (c.width * c.height);
  } catch { return 255; }
};

/* ══════════════════════════════════════════════════════════════
   CHALLENGES (2 of 3 picked randomly)
══════════════════════════════════════════════════════════════ */
const ALL_CHALLENGES = [
  {
    id: "blink",
    icon: <EyeIcon size={22} />,
    title: "Blink twice",
    hint: "Slowly close and open your eyes twice",
    detect: (rd) => {
      const v = rd.filter((r) => !r.multi);
      let blinks = 0, open = true;
      for (const r of v) {
        const ear = (r.lEAR + r.rEAR) / 2;
        if (open && ear < 0.20) open = false;
        else if (!open && ear > 0.25) { blinks++; open = true; if (blinks >= 2) return true; }
      }
      return false;
    },
  },
  {
    id: "turn",
    icon: <ArrowsIcon size={22} />,
    title: "Turn head left then right",
    hint: "Slowly turn left, then right, then forward",
    detect: (rd, bl) => {
      const v = rd.filter((r) => !r.multi);
      let l = false, r = false;
      for (const x of v) {
        const t = x.turn - bl.turn;
        if (t < -0.06) l = true;
        if (t > 0.06) r = true;
        if (l && r) return true;
      }
      return false;
    },
  },
  {
    id: "smile",
    icon: <SmileIcon size={22} />,
    title: "Smile!",
    hint: "Give us a big smile",
    detect: (rd, bl) => {
      const v = rd.filter((r) => !r.multi);
      return v.some((r) => r.smile - bl.smile > 0.08);
    },
  },
];

const pick2 = () => [...ALL_CHALLENGES].sort(() => Math.random() - 0.5).slice(0, 2);

/* ══════════════════════════════════════════════════════════════
   CAPTURE FRAME
══════════════════════════════════════════════════════════════ */
const captureFrame = (v, q = 0.88) =>
  new Promise((ok) => {
    const c   = document.createElement("canvas");
    c.width   = v.videoWidth  || 640;
    c.height  = v.videoHeight || 480;
    c.getContext("2d").drawImage(v, 0, 0);
    c.toBlob((b) => ok(b), "image/jpeg", q);
  });

/* ══════════════════════════════════════════════════════════════
   COMPONENT
══════════════════════════════════════════════════════════════ */
export default function LivenessChallenge({ onComplete, onSkip }) {
  const [phase,   setPhase]   = useState("idle");
  const [challs,  setChalls]  = useState([]);
  const [idx,     setIdx]     = useState(0);
  const [done,    setDone]    = useState(0);
  const [secs,    setSecs]    = useState(5);
  const [face,    setFace]    = useState(false);
  const [errMsg,  setErrMsg]  = useState("");
  const [loadMsg, setLoadMsg] = useState("");

  const vidRef  = useRef(null);
  const strRef  = useRef(null);
  const fmRef   = useRef(null);
  const blRef   = useRef(null);
  const rdRef   = useRef([]);
  const tmrRef  = useRef(null);
  const rafRef  = useRef(null);
  const mtRef   = useRef(true);
  const phRef   = useRef("idle");

  useEffect(() => {
    mtRef.current = true;
    return () => {
      mtRef.current = false;
      stopCam();
      clearInterval(tmrRef.current);
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const safe = (fn) => { if (mtRef.current) fn(); };

  const startCam = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
        audio: false,
      });
      strRef.current = s;
      if (vidRef.current) { vidRef.current.srcObject = s; await vidRef.current.play(); }
      return true;
    } catch { return false; }
  };

  const stopCam = () => {
    strRef.current?.getTracks().forEach((t) => t.stop());
    strRef.current = null;
  };

  /* ── Detection loop ── */
  const startDetect = useCallback(async () => {
    const fm = fmRef.current;
    if (!fm || !vidRef.current) return;

    fm.onResults((res) => {
      if (!mtRef.current) return;
      const faces = res.multiFaceLandmarks ?? [];

      /* Reject 0 or multiple faces */
      if (faces.length !== 1) {
        safe(() => setFace(false));
        if (faces.length > 1 && phRef.current === "challenge")
          rdRef.current.push({ multi: true });
        return;
      }

      safe(() => setFace(true));
      const lm = faces[0];
      const r = {
        lEAR  : getEAR(lm, LM.L_TOP, LM.L_BOT, LM.L_L, LM.L_R),
        rEAR  : getEAR(lm, LM.R_TOP, LM.R_BOT, LM.R_L, LM.R_R),
        turn  : getHeadTurn(lm),
        smile : getSmile(lm),
        multi : false,
      };

      if (phRef.current === "baseline") {
        rdRef.current.push(r);
        if (rdRef.current.length >= 30) {
          const n = rdRef.current.length;
          blRef.current = {
            lEAR  : rdRef.current.reduce((s, x) => s + x.lEAR,  0) / n,
            rEAR  : rdRef.current.reduce((s, x) => s + x.rEAR,  0) / n,
            turn  : rdRef.current.reduce((s, x) => s + x.turn,  0) / n,
            smile : rdRef.current.reduce((s, x) => s + x.smile, 0) / n,
          };
          rdRef.current = [];
          safe(() => { phRef.current = "challenge"; setPhase("challenge"); });
        }
        return;
      }

      if (phRef.current === "challenge") rdRef.current.push(r);
    });

    const loop = async () => {
      if (!mtRef.current || !vidRef.current) return;
      await fm.send({ image: vidRef.current });
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
  }, []);

  /* ── Start flow ── */
  const startFlow = useCallback(async () => {
    safe(() => { setPhase("loading"); setLoadMsg("Starting camera…"); setErrMsg(""); });

    const ok = await startCam();
    if (!ok) {
      safe(() => { setPhase("error"); setErrMsg("Camera access denied. Allow camera and try again."); });
      return;
    }

    /* Brightness pre-check */
    await new Promise((r) => setTimeout(r, 500));
    if (vidRef.current) {
      const br = measureBrightness(vidRef.current);
      if (br < CAM_BRIGHT_THRESH) {
        stopCam();
        safe(() => {
          setPhase("error");
          setErrMsg(`Too dark (${Math.round(br)}/255). Move to a well-lit area.`);
        });
        return;
      }
    }

    safe(() => setLoadMsg("Loading face detection…"));

    let fm;
    try { fm = await loadMediaPipe(); fmRef.current = fm; }
    catch {
      stopCam();
      safe(() => { setPhase("error"); setErrMsg("Face detection failed to load."); });
      return;
    }

    const c = pick2();
    rdRef.current = [];
    blRef.current = null;
    phRef.current = "baseline";

    safe(() => { setChalls(c); setIdx(0); setDone(0); setSecs(5); setPhase("baseline"); });
    await startDetect();
  }, [startDetect]);

  /* ── Per-challenge countdown ── */
  useEffect(() => {
    if (phase !== "challenge") return;
    const ch = challs[idx];
    if (!ch) return;

    rdRef.current = [];
    let t = 5;
    safe(() => setSecs(t));

    tmrRef.current = setInterval(() => {
      t -= 1;
      safe(() => setSecs(t));

      if (blRef.current && ch.detect(rdRef.current, blRef.current)) {
        clearInterval(tmrRef.current);
        const next = idx + 1;
        if (next >= challs.length) {
          phRef.current = "capturing";
          safe(() => setPhase("capturing"));
          captureFrame(vidRef.current).then((blob) => {
            stopCam();
            cancelAnimationFrame(rafRef.current);
            safe(() => { setDone(challs.length); setPhase("passed"); });
            onComplete(blob);
          });
        } else {
          safe(() => { setDone((p) => p + 1); setIdx(next); setSecs(5); });
          rdRef.current = [];
        }
        return;
      }

      if (t <= 0) {
        clearInterval(tmrRef.current);
        phRef.current = "failed";
        safe(() => setPhase("failed"));
      }
    }, 1_000);

    return () => clearInterval(tmrRef.current);
  }, [phase, idx, challs]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Retry — auto-restarts ── */
  const retry = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    stopCam();
    clearInterval(tmrRef.current);
    rdRef.current = [];
    blRef.current = null;
    phRef.current = "idle";
    startFlow();
  }, [startFlow]);

  /* ════════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════════ */

  /* ── Idle ── */
  if (phase === "idle") {
    return (
      <div className="lv-shell">
        <div className="lv-intro">
          <div className="lv-intro__icon"><CameraIcon size={32} /></div>
          <h3 className="lv-intro__title">Liveness Check</h3>
          <p className="lv-intro__body">
            Complete 2 short face challenges with your front camera.
            Takes about 15 seconds.
          </p>
          <ul className="lv-intro__list">
            <li><EyeIcon size={13} /> Blink detection</li>
            <li><ArrowsIcon size={13} /> Head movement</li>
            <li><SmileIcon size={13} /> Smile challenge</li>
          </ul>
          <div className="lv-intro__actions">
            <button className="v-btn v-btn--primary v-btn--lg" onClick={startFlow}>
              <CameraIcon size={15} /> Start Liveness Check
            </button>
            {onSkip && (
              <button className="v-btn v-btn--ghost v-btn--sm" onClick={onSkip}>
                Skip (manual review may take longer)
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ── Loading ── */
  if (phase === "loading") {
    return (
      <div className="lv-shell">
        <div className="lv-center">
          <SpinnerIcon size={32} />
          <p className="lv-status">{loadMsg}</p>
        </div>
      </div>
    );
  }

  /* ── Error ── */
  if (phase === "error") {
    return (
      <div className="lv-shell">
        <div className="lv-center">
          <AlertIcon size={32} className="lv-icon--warn" />
          <p className="lv-status lv-status--error">{errMsg}</p>
          <div className="lv-actions">
            <button className="v-btn v-btn--primary" onClick={startFlow}>
              <RetryIcon size={13} /> Try Again
            </button>
            {onSkip && (
              <button className="v-btn v-btn--ghost v-btn--sm" onClick={onSkip}>
                Skip
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ── Passed ── */
  if (phase === "passed") {
    return (
      <div className="lv-shell">
        <div className="lv-center">
          <div className="lv-success-ring"><CheckIcon size={36} /></div>
          <p className="lv-status lv-status--pass">Liveness confirmed!</p>
          <p className="lv-hint">All challenges completed successfully.</p>
        </div>
      </div>
    );
  }

  /* ── Failed ── */
  if (phase === "failed") {
    return (
      <div className="lv-shell">
        <div className="lv-center">
          <AlertIcon size={32} className="lv-icon--warn" />
          <p className="lv-status lv-status--error">Challenge failed</p>
          <p className="lv-hint">
            Could not detect the required movement in time.
            Ensure good lighting and your face is centred.
          </p>
          <div className="lv-actions">
            <button className="v-btn v-btn--primary" onClick={retry}>
              <RetryIcon size={13} /> Try Again
            </button>
            {onSkip && (
              <button className="v-btn v-btn--ghost v-btn--sm" onClick={onSkip}>
                Skip
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ── Camera active: baseline / challenge / capturing ── */
  const ch         = challs[idx] ?? null;
  const isBaseline = phase === "baseline";
  const isCapture  = phase === "capturing";

  return (
    <div className="lv-shell">

      <div className={`lv-camera-wrap${!face && !isBaseline ? " lv-camera-wrap--noface" : ""}`}>
        <video
          ref={vidRef} className="lv-video"
          autoPlay playsInline muted
          aria-label="Camera feed for liveness detection"
        />
        <div className="lv-guide-oval" aria-hidden="true" />

        {!face && !isBaseline && (
          <div className="lv-noface-banner" role="alert">
            <AlertIcon size={12} /> Position your face in the oval
          </div>
        )}

        {isBaseline && (
          <div className="lv-baseline-banner">
            <SpinnerIcon size={12} /> Calibrating…
          </div>
        )}

        {isCapture && (
          <div className="lv-capture-flash" aria-live="polite">
            Capturing…
          </div>
        )}
      </div>

      {!isBaseline && !isCapture && ch && (
        <div className="lv-challenge">

          <div className="lv-progress-dots"
               aria-label={`Challenge ${idx + 1} of ${challs.length}`}>
            {challs.map((c, i) => (
              <span key={c.id} className={[
                "lv-dot",
                i < idx   ? "lv-dot--done"   : "",
                i === idx ? "lv-dot--active"  : "",
              ].join(" ")} />
            ))}
          </div>

          <div className="lv-challenge-card">
            <div className="lv-challenge-icon">{ch.icon}</div>
            <p className="lv-challenge-title">{ch.title}</p>
            <p className="lv-challenge-hint">{ch.hint}</p>

            <div className={`lv-countdown${secs <= 2 ? " lv-countdown--urgent" : ""}`}
                 aria-live="polite" aria-label={`${secs} seconds remaining`}>
              <svg width="48" height="48" viewBox="0 0 48 48">
                <circle cx="24" cy="24" r="20" fill="none"
                        stroke="currentColor" strokeOpacity=".15" strokeWidth="4" />
                <circle cx="24" cy="24" r="20" fill="none"
                        stroke="currentColor" strokeWidth="4" strokeLinecap="round"
                        strokeDasharray={`${2 * Math.PI * 20}`}
                        strokeDashoffset={`${2 * Math.PI * 20 * (1 - secs / 5)}`}
                        style={{
                          transformOrigin: "center",
                          transform: "rotate(-90deg)",
                          transition: "stroke-dashoffset 1s linear",
                        }}
                />
              </svg>
              <span className="lv-countdown__num">{secs}</span>
            </div>
          </div>
        </div>
      )}

      <button className="lv-cancel" onClick={retry} aria-label="Cancel">
        <XIcon size={14} /> Cancel
      </button>

    </div>
  );
}