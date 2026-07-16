// src/pages/Profile/SpinWheel.jsx
import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate, Link }                         from "react-router-dom";

/* ── Components ── */
import Icon               from "../../components/SpinWheel/Icon.jsx";
import SpinCounterBadge   from "../../components/SpinWheel/SpinCounterBadge.jsx";
import CountdownTimer     from "../../components/SpinWheel/CountdownTimer.jsx";
import BonusSpinToast     from "../../components/SpinWheel/BonusSpinToast.jsx";
import ReferralSpinsPanel from "../../components/SpinWheel/ReferralSpinsPanel.jsx";
import EarnTab            from "../../components/SpinWheel/EarnTab.jsx";
import WheelCanvas        from "../../components/SpinWheel/WheelCanvas.jsx";
import ResultModal        from "../../components/SpinWheel/ResultModal.jsx";
import HistoryTab         from "../../components/SpinWheel/HistoryTab.jsx";

/* ── Utilities ── */
import { sound }        from "../../components/SpinWheel/SoundManager.js";
import { fireConfetti } from "../../components/SpinWheel/confetti.js";
import {
  API, authH, getToken, isBigWin, EARN_TASKS,
} from "../../components/SpinWheel/helpers.js";

import "../../styles/SpinWheel.css";

/* ══════════════════════════════════════════════════════════════
   NAV TABS CONFIG
══════════════════════════════════════════════════════════════ */
const NAV_TABS = [
  { key: "wheel",     label: "Spin",      iconName: "spin"    },
  { key: "earn",      label: "Earn",      iconName: "bolt"    },
  { key: "history",   label: "History",   iconName: "history" },
  { key: "referrals", label: "Referrals", iconName: "gift"    },
];

const RULES = [
  "1 free spin per day — resets at midnight",
  "Earn bonus spins by following us on social media or joining our community groups",
  "Earn +1 bonus spin for every friend who signs up with your invite code",
  "Bonus spins never expire and stack up to 10",
  "Coupons expire 30 days after winning",
  "Airtime credited within 24 hours",
  "Each coupon can only be used once",
  "Each earn task can only be completed once",
  "Prizes are non-transferable",
  "Loemart reserves the right to cancel rewards from fraudulent activity",
];

/* ══════════════════════════════════════════════════════════════
   MAIN
══════════════════════════════════════════════════════════════ */
export default function SpinWheel() {
  const navigate = useNavigate();

  /* ── Server data ── */
  const [segments,       setSegments]       = useState([]);
  const [spinStatus,     setSpinStatus]     = useState(null);
  const [history,        setHistory]        = useState([]);
  const [stats,          setStats]          = useState(null);
  const [referralSpins,  setReferralSpins]  = useState([]);
  const [completedTasks, setCompletedTasks] = useState([]);
  const [taskStats,      setTaskStats]      = useState(null);

  /* ── UI state ── */
  const [loading,    setLoading]    = useState(true);
  const [spinning,   setSpinning]   = useState(false);
  const [spinResult, setSpinResult] = useState(null);
  const [showResult, setShowResult] = useState(false);
  const [targetId,   setTargetId]   = useState(null);
  const [tab,        setTab]        = useState("wheel");
  const [bonusToast, setBonusToast] = useState(null);
  const [spinType,   setSpinType]   = useState("free");
  const [soundOn,    setSoundOn]    = useState(true);
  const [bigWin,     setBigWin]     = useState(false);
  const [shake,      setShake]      = useState(false);
  const [error,      setError]      = useState(null);

  /* ── Auth guard ── */
  useEffect(() => {
    if (!getToken()) navigate("/auth?redirect=/spin");
  }, [navigate]);

  /* ── Sound sync ── */
  useEffect(() => { sound.muted = !soundOn; }, [soundOn]);

  /* ══════════════════════════════════════════
     LOAD ALL DATA
  ══════════════════════════════════════════ */
  const loadConfig = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const [configRes, historyRes, referralRes, tasksRes] =
        await Promise.all([
          fetch(`${API}/spinwheel/config`,        { headers: authH() }),
          fetch(`${API}/spinwheel/history`,        { headers: authH() }),
          fetch(`${API}/spinwheel/referral-spins`, { headers: authH() }),
          fetch(`${API}/spinwheel/tasks`,          { headers: authH() }),
        ]);

      if (configRes.status === 401) {
        navigate("/auth?redirect=/spin");
        return;
      }

      if (configRes.ok) {
        const d = await configRes.json();
        setSegments(d.segments    || []);
        setSpinStatus(d.spin_status || null);
      } else {
        const d = await configRes.json().catch(() => ({}));
        setError(d.message || "Failed to load wheel config.");
      }

      if (historyRes.ok) {
        const d = await historyRes.json();
        setHistory(d.history || []);
        setStats(d.stats    || null);
      }

      if (referralRes.ok) {
        const d = await referralRes.json();
        setReferralSpins(d.referral_spins || []);
      }

      if (tasksRes.ok) {
        const d = await tasksRes.json();
        setCompletedTasks(d.completed_task_ids || []);
        setTaskStats(d.stats || null);
      }
    } catch (err) {
      console.error("[SpinWheel] loadConfig:", err);
      setError("Could not connect. Check your internet.");
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  /* ── Poll every 90s ── */
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API}/spinwheel/config`, {
          headers: authH(),
        });
        if (!res.ok) return;
        const d   = await res.json();
        const nxt = d.spin_status;
        if (!nxt) return;

        setSpinStatus((prev) => {
          const prevBonus = prev?.bonus_spins_remaining || 0;
          const nxtBonus  = nxt.bonus_spins_remaining   || 0;
          if (prev && nxtBonus > prevBonus) {
            setBonusToast({
              spins_awarded: nxtBonus - prevBonus,
              referred_user: nxt.latest_referral_name || "Someone",
            });
          }
          return nxt;
        });
      } catch (_) {}
    }, 90_000);
    return () => clearInterval(interval);
  }, []);

  /* ══════════════════════════════════════════
     COMPUTED
  ══════════════════════════════════════════ */
  const canFreeSpin = spinStatus?.can_free_spin ?? spinStatus?.can_spin ?? false;
  const bonusLeft   = spinStatus?.bonus_spins_remaining || 0;
  const canSpin     = canFreeSpin || bonusLeft > 0;

  const currentSpinType = useCallback(() => {
    if (canFreeSpin)   return "free";
    if (bonusLeft > 0) return "bonus";
    return null;
  }, [canFreeSpin, bonusLeft]);

  const totalSpinsAvailable = (canFreeSpin ? 1 : 0) + bonusLeft;
  const pendingTasksCount   = EARN_TASKS.filter(
    (t) => !completedTasks.includes(t.id)
  ).length;
  const totalPossibleSpins  = useMemo(
    () => EARN_TASKS.reduce((a, t) => a + t.spins_reward, 0),
    []
  );

  /* ══════════════════════════════════════════
     TASK CLAIMED
  ══════════════════════════════════════════ */
  const handleTaskClaimed = useCallback((task) => {
    setCompletedTasks((prev) =>
      prev.includes(task.id) ? prev : [...prev, task.id]
    );
    setSpinStatus((prev) =>
      prev
        ? {
            ...prev,
            bonus_spins_remaining:
              (prev.bonus_spins_remaining || 0) + (task.spins_reward || 1),
          }
        : prev
    );
    setBonusToast({
      spins_awarded: task.spins_reward,
      referred_user: `You completed: ${task.label}`,
    });
    setTaskStats((prev) => ({
      ...prev,
      total_earned:
        ((prev?.total_earned) || 0) + (task.spins_reward || 1),
    }));
  }, []);

  /* ══════════════════════════════════════════
     SPIN
  ══════════════════════════════════════════ */
  const handleSpin = useCallback(async () => {
    if (spinning || !canSpin) return;

    sound.resume();
    sound.spinStart();

    const type = currentSpinType();
    if (!type) return;

    setSpinType(type);
    setSpinning(true);
    setSpinResult(null);
    setBigWin(false);

    try {
      const res  = await fetch(`${API}/spinwheel/spin`, {
        method  : "POST",
        headers : authH(),
        body    : JSON.stringify({ spin_type: type }),
      });
      const data = await res.json();

      if (!res.ok) {
        alert(data.message || "Could not spin. Please try again.");
        setSpinning(false);
        return;
      }

      setTargetId(data.segment_id);
      setSpinResult({ ...data.result, spin_type: type });

      setSpinStatus((prev) => {
        if (!prev) return prev;
        const u = { ...prev };
        if (type === "free") {
          u.can_free_spin = false;
          u.can_spin      = false;
        } else {
          u.bonus_spins_remaining = Math.max(
            0,
            (u.bonus_spins_remaining || 0) - 1
          );
        }
        return u;
      });
    } catch {
      alert("Network error. Please try again.");
      setSpinning(false);
    }
  }, [spinning, canSpin, currentSpinType]);

  /* ══════════════════════════════════════════
     SPIN END
  ══════════════════════════════════════════ */
  const handleSpinEnd = useCallback(() => {
    setSpinning(false);

    if (spinResult?.is_win) {
      const big = isBigWin(spinResult);
      setBigWin(big);
      setShake(true);
      setTimeout(() => setShake(false), 600);
      sound.win();
      fireConfetti(big);
      if (big && "vibrate" in navigator)
        navigator.vibrate([200, 100, 200, 100, 400]);
    } else {
      sound.lose();
    }

    setTimeout(() => {
      setShowResult(true);
      loadConfig(true);
    }, 400);
  }, [spinResult, loadConfig]);

  const closeResult = useCallback(() => {
    setShowResult(false);
    setSpinResult(null);
    setTargetId(null);
    setBigWin(false);
  }, []);

  const handleTick = useCallback(() => { sound.tick(); }, []);

  /* ── Spin button label ── */
  const spinBtnLabel = () => {
    if (spinning)
      return <><Icon name="loader" size={16} /> Spinning…</>;
    if (!canSpin)
      return `Come back in ${spinStatus?.next_spin_in || "..."}`;
    const type = currentSpinType();
    if (type === "free")
      return <><Icon name="star" size={16} /> SPIN NOW! (Free)</>;
    if (type === "bonus")
      return <><Icon name="gift" size={16} /> SPIN NOW! ({bonusLeft} bonus left)</>;
    return "No Spins Available";
  };

  const wheelSize = Math.min(
    typeof window !== "undefined" ? window.innerWidth - 48 : 320,
    320
  );

  /* ── Nav tab counts ── */
  const navCounts = {
    wheel    : totalSpinsAvailable,
    earn     : pendingTasksCount,
    history  : history.length,
    referrals: referralSpins.length,
  };

  /* ── Error state ── */
  if (!loading && error) {
    return (
      <div className="sw-page">
        <div className="sw-error-state" role="alert">
          <Icon name="warning" size={32} style={{ color: "#f59e0b" }} />
          <p>{error}</p>
          <button
            onClick={() => loadConfig()}
            className="sw-error-retry"
            aria-label="Retry loading"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  /* ══════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════ */
  return (
    <div className="sw-page">

      {/* Toast */}
      <BonusSpinToast
        bonus={bonusToast}
        onClose={() => setBonusToast(null)}
      />

      {/* ── Topbar ── */}
      <div className="sw-topbar">
        <button
          className="sw-back"
          onClick={() => navigate(-1)}
          aria-label="Go back"
        >
          <Icon name="arrowLeft" size={20} />
        </button>

        <div>
          <h1 className="sw-topbar-title">
            <Icon
              name="spin"
              size={20}
              style={{ color: "#e8630a" }}
            />{" "}
            Spin &amp; Win
          </h1>
          <p className="sw-topbar-sub">
            {totalSpinsAvailable > 0
              ? `${totalSpinsAvailable} spin${totalSpinsAvailable > 1 ? "s" : ""} available`
              : "1 free spin per day"}
          </p>
        </div>

        <button
          className="sw-sound-btn"
          onClick={() => setSoundOn((s) => !s)}
          aria-label={soundOn ? "Mute sounds" : "Unmute sounds"}
        >
          <Icon name={soundOn ? "soundOn" : "soundOff"} size={20} />
        </button>

        <div className="sw-topbar-stats">
          {stats && (
            <div
              className="sw-topbar-win-rate"
              aria-label={`${stats.total_wins} wins`}
            >
              <span>{stats.total_wins}</span>
              <small>wins</small>
            </div>
          )}
        </div>
      </div>

      {/* ── Nav ── */}
      <nav className="sw-nav" aria-label="Spin wheel sections">
        {NAV_TABS.map((t) => (
          <button
            key={t.key}
            className={`sw-nav-btn${tab === t.key ? " active" : ""}`}
            onClick={() => setTab(t.key)}
            aria-selected={tab === t.key}
            aria-label={t.label}
          >
            <Icon name={t.iconName} size={15} />
            <span>{t.label}</span>
            {navCounts[t.key] > 0 && (
              <span
                className={`sw-nav-count${
                  t.key === "earn" ? " sw-nav-count--earn" : ""
                }`}
                aria-hidden="true"
              >
                {navCounts[t.key]}
              </span>
            )}
          </button>
        ))}
      </nav>

      <div className="sw-scroll">

        {/* ══════════ WHEEL TAB ══════════ */}
        {tab === "wheel" && (
          <>
            <SpinCounterBadge spinStatus={spinStatus} />

            {!canSpin && spinStatus?.next_spin_seconds && (
              <CountdownTimer
                secondsLeft={spinStatus.next_spin_seconds}
              />
            )}

            {/* Streak */}
            {(stats?.streak || spinStatus?.streak || 0) > 0 && (
              <div className="sw-streak">
                <Icon
                  name="flame"
                  size={22}
                  className="sw-streak-icon"
                  style={{ color: "#f97316" }}
                />
                <div className="sw-streak-body">
                  <p className="sw-streak-title">Spin Streak!</p>
                  <p className="sw-streak-sub">
                    Keep spinning daily to maintain your streak
                  </p>
                </div>
                <div
                  className="sw-streak-days"
                  aria-label={`${
                    stats?.streak || spinStatus?.streak
                  } day streak`}
                >
                  {stats?.streak || spinStatus?.streak || 0}
                  <small>days</small>
                </div>
              </div>
            )}

            {/* No spins banner */}
            {spinStatus && !canSpin && (
              <div className="sw-status-banner" role="status">
                <Icon
                  name="clock"
                  size={20}
                  style={{ color: "#f59e0b" }}
                />
                <div>
                  <p>
                    Next spin in{" "}
                    <strong>{spinStatus.next_spin_in}</strong>
                  </p>
                  <small>
                    Complete tasks to earn bonus spins instantly!
                  </small>
                </div>
              </div>
            )}

            {/* Free spin ready */}
            {canFreeSpin && (
              <div className="sw-ready-banner" role="status">
                <Icon
                  name="sparkle"
                  size={20}
                  style={{ color: "#e8630a" }}
                />
                <p>Your free spin is ready!</p>
              </div>
            )}

            {/* Bonus spins */}
            {bonusLeft > 0 && (
              <div className="sw-bonus-banner" role="status">
                <Icon
                  name="gift"
                  size={20}
                  style={{ color: "#6366f1" }}
                />
                <div>
                  <p>
                    You have{" "}
                    <strong>
                      {bonusLeft} bonus spin
                      {bonusLeft > 1 ? "s" : ""}
                    </strong>{" "}
                    from referrals &amp; tasks!
                  </p>
                  <small>
                    These don't expire — use them any time
                  </small>
                </div>
              </div>
            )}

            {/* Wheel */}
            <div className="sw-wheel-wrap">
              <div
                className={`sw-pointer${
                  canSpin && !spinning ? " sw-pointer--ready" : ""
                }`}
                aria-hidden="true"
              >
                <Icon
                  name="pointerDown"
                  size={28}
                  style={{ color: "#e8630a" }}
                />
              </div>

              <div
                className={`sw-canvas-outer${shake ? " shake" : ""}`}
              >
                <div
                  className={`sw-canvas-wrap${
                    bigWin ? " sw-canvas-wrap--big-win" : ""
                  }`}
                  style={{ width: wheelSize, height: wheelSize }}
                >
                  {loading ? (
                    <div
                      className="sw-canvas-loading"
                      style={{ width: wheelSize, height: wheelSize }}
                    >
                      <div
                        className="sw-sk-wheel"
                        style={{
                          width : wheelSize,
                          height: wheelSize,
                        }}
                      />
                    </div>
                  ) : (
                    <WheelCanvas
                      segments={segments}
                      targetSegmentId={targetId}
                      spinning={spinning}
                      onSpinEnd={handleSpinEnd}
                      onTick={handleTick}
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Spin button */}
            <button
              className={[
                "sw-spin-btn",
                spinning                          ? "sw-spin-btn--spinning" : "",
                !canSpin                          ? "sw-spin-btn--disabled" : "",
                canSpin && !spinning              ? "sw-spin-btn--pulse"    : "",
                spinType === "bonus" && !spinning ? "sw-spin-btn--bonus"    : "",
              ].filter(Boolean).join(" ")}
              onClick={handleSpin}
              disabled={spinning || !canSpin || loading}
              aria-label={
                spinning          ? "Spinning…"          :
                !canSpin          ? "No spins available"  :
                spinType === "bonus" ? "Use bonus spin"   :
                "Spin the wheel for free"
              }
            >
              {spinBtnLabel()}
            </button>

            {/* Earn shortcut */}
            {pendingTasksCount > 0 && (
              <button
                className="sw-earn-shortcut"
                onClick={() => setTab("earn")}
                aria-label={`Complete ${pendingTasksCount} tasks to earn more spins`}
              >
                <div className="sw-earn-shortcut-left">
                  <div className="sw-earn-shortcut-icon">
                    <Icon
                      name="bolt"
                      size={18}
                      style={{ color: "#fff" }}
                    />
                  </div>
                  <div>
                    <p className="sw-earn-shortcut-title">
                      Earn More Spins —{" "}
                      {pendingTasksCount} task
                      {pendingTasksCount > 1 ? "s" : ""} available
                    </p>
                    <p className="sw-earn-shortcut-sub">
                      Follow us &amp; join groups to get up to{" "}
                      {totalPossibleSpins} bonus spins!
                    </p>
                  </div>
                </div>
                <Icon
                  name="chevronRight"
                  size={18}
                  style={{ color: "#e8630a" }}
                />
              </button>
            )}

            {/* Invite CTA */}
            <Link
              to="/invite"
              className="sw-earn-more"
              aria-label="Invite friends to earn bonus spins"
            >
              <Icon
                name="rocket"
                size={20}
                className="sw-earn-more-icon"
                style={{ color: "#e8630a" }}
              />
              <div className="sw-earn-more-body">
                <p className="sw-earn-more-title">Want more spins?</p>
                <p className="sw-earn-more-sub">
                  Invite a friend → they sign up → you get{" "}
                  <strong>+1 bonus spin</strong> instantly!
                </p>
              </div>
              <Icon
                name="chevronRight"
                size={18}
                style={{ color: "#e8630a" }}
              />
            </Link>

            {/* Prizes grid */}
            <div className="sw-prizes">
              <h2 className="sw-prizes-title">
                <Icon
                  name="gift"
                  size={18}
                  style={{ color: "#e8630a" }}
                />{" "}
                Prizes You Can Win
              </h2>
              <div className="sw-prizes-grid" role="list">
                {segments.map((seg) => (
                  <div
                    key={seg.id}
                    className="sw-prize-item"
                    role="listitem"
                    style={{
                      background  : seg.bg,
                      borderColor : seg.color + "44",
                    }}
                  >
                    <span
                      className="sw-prize-emoji"
                      aria-hidden="true"
                    >
                      {seg.emoji || "★"}
                    </span>
                    <span
                      className="sw-prize-label"
                      style={{ color: seg.color }}
                    >
                      {seg.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Rules */}
            <div className="sw-rules">
              <h3 className="sw-rules-title">
                <Icon
                  name="list"
                  size={16}
                  style={{ color: "#6b7280" }}
                />{" "}
                Rules
              </h3>
              {RULES.map((rule, i) => (
                <div key={i} className="sw-rule">
                  <span className="sw-rule-dot" aria-hidden="true" />
                  <span>{rule}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ══════════ EARN TAB ══════════ */}
        {tab === "earn" && (
          <EarnTab
            completedTaskIds={completedTasks}
            onTaskClaimed={handleTaskClaimed}
            totalEarned={taskStats?.total_earned}
          />
        )}

        {/* ══════════ HISTORY TAB ══════════ */}
        {tab === "history" && (
          <HistoryTab history={history} stats={stats} />
        )}

        {/* ══════════ REFERRALS TAB ══════════ */}
        {tab === "referrals" && (
          <>
            {/* Summary */}
            <div
              className="sw-ref-summary"
              role="region"
              aria-label="Referral summary"
            >
              <div className="sw-ref-summary-row">
                {[
                  {
                    val     : referralSpins.length,
                    label   : "Friends Joined",
                    color   : "#fff",
                    iconName: "users",
                  },
                  {
                    val     : referralSpins.reduce(
                      (a, r) => a + (r.spins_awarded || 0), 0
                    ),
                    label   : "Spins Earned",
                    color   : "#e8630a",
                    iconName: "spin",
                  },
                  {
                    val     : bonusLeft,
                    label   : "Remaining",
                    color   : "#6366f1",
                    iconName: "bolt",
                  },
                ].map((s, i, arr) => (
                  <div
                    key={s.label}
                    style={{ display: "flex", alignItems: "center" }}
                  >
                    <div className="sw-ref-summary-stat">
                      <Icon
                        name={s.iconName}
                        size={16}
                        style={{ color: s.color, marginBottom: 4 }}
                      />
                      <span
                        className="sw-ref-summary-val"
                        style={{ color: s.color }}
                      >
                        {s.val}
                      </span>
                      <span className="sw-ref-summary-label">
                        {s.label}
                      </span>
                    </div>
                    {i < arr.length - 1 && (
                      <div
                        className="sw-ref-summary-divider"
                        aria-hidden="true"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* How it works */}
            <div className="sw-how-it-works">
              <h3 className="sw-how-title">How Bonus Spins Work</h3>
              {[
                {
                  step    : "1",
                  iconName: "share",
                  text    : "Share your invite code from the Invite Friends page",
                },
                {
                  step    : "2",
                  iconName: "users",
                  text    : "Your friend signs up using your code",
                },
                {
                  step    : "3",
                  iconName: "checkCircle",
                  text    : "They verify their email address",
                },
                {
                  step    : "4",
                  iconName: "spin",
                  text    : "You instantly receive +1 bonus spin!",
                },
              ].map((item) => (
                <div key={item.step} className="sw-how-step">
                  <div
                    className="sw-how-step-num"
                    aria-hidden="true"
                  >
                    {item.step}
                  </div>
                  <Icon
                    name={item.iconName}
                    size={20}
                    style={{ color: "#e8630a", flexShrink: 0 }}
                  />
                  <p className="sw-how-step-text">{item.text}</p>
                </div>
              ))}
            </div>

            <ReferralSpinsPanel referralSpins={referralSpins} />

            {referralSpins.length === 0 && (
              <div className="sw-empty">
                <Icon
                  name="gift"
                  size={40}
                  style={{ color: "#d1d5db" }}
                />
                <p>No referral spins yet</p>
                <small>Invite friends to earn bonus spins!</small>
                <Link to="/invitation" className="sw-empty-invite-btn">
                  Go to Invite Page{" "}
                  <Icon name="arrowRight" size={14} />
                </Link>
              </div>
            )}

            <Link
              to="/invitation"
              className="sw-ref-cta"
              aria-label="Invite more friends"
            >
              <Icon
                name="share"
                size={20}
                style={{ color: "#e8630a" }}
              />
              <div style={{ flex: 1 }}>
                <p className="sw-ref-cta-title">
                  Invite More Friends
                </p>
                <p className="sw-ref-cta-sub">
                  Each signup = +1 bonus spin for you
                </p>
              </div>
              <Icon
                name="chevronRight"
                size={18}
                style={{ color: "#e8630a" }}
              />
            </Link>
          </>
        )}

        <p className="sw-footer">
          © {new Date().getFullYear()} Loemart — Spin responsibly!
        </p>
      </div>

      {/* Result modal */}
      {showResult && spinResult && (
        <ResultModal result={spinResult} onClose={closeResult} />
      )}
    </div>
  );
}