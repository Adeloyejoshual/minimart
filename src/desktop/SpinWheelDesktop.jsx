// src/desktop/SpinWheelDesktop.jsx
import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate, Link }                         from "react-router-dom";

/* ── Shared components ── */
import Icon               from "../components/SpinWheel/Icon.jsx";
import SpinCounterBadge   from "../components/SpinWheel/SpinCounterBadge.jsx";
import CountdownTimer     from "../components/SpinWheel/CountdownTimer.jsx";
import BonusSpinToast     from "../components/SpinWheel/BonusSpinToast.jsx";
import ReferralSpinsPanel from "../components/SpinWheel/ReferralSpinsPanel.jsx";
import EarnTab            from "../components/SpinWheel/EarnTab.jsx";
import WheelCanvas        from "../components/SpinWheel/WheelCanvas.jsx";
import ResultModal        from "../components/SpinWheel/ResultModal.jsx";
import HistoryTab         from "../components/SpinWheel/HistoryTab.jsx";

/* ── Utilities ── */
import { sound }        from "../components/SpinWheel/SoundManager.js";
import { fireConfetti } from "../components/SpinWheel/confetti.js";
import {
  API, authH, getToken, isBigWin, EARN_TASKS,
} from "../components/SpinWheel/helpers.js";

import "./styles/SpinWheelDesktop.css";

/* ══════════════════════════════════════════════════════════════
   CONFIG
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
   MAIN DESKTOP COMPONENT
══════════════════════════════════════════════════════════════ */
export default function SpinWheelDesktop() {
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
     LOAD DATA
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
        setSegments(d.segments     || []);
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
      console.error("[SpinWheelDesktop] loadConfig:", err);
      setError("Could not connect. Check your internet.");
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  /* ── Poll every 90s ── */
  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const res = await fetch(`${API}/spinwheel/config`, { headers: authH() });
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
    return () => clearInterval(id);
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

  const pendingTasksCount = EARN_TASKS.filter(
    (t) => !completedTasks.includes(t.id)
  ).length;

  const totalPossibleSpins = useMemo(
    () => EARN_TASKS.reduce((a, t) => a + t.spins_reward, 0),
    []
  );

  const navCounts = {
    wheel    : totalSpinsAvailable,
    earn     : pendingTasksCount,
    history  : history.length,
    referrals: referralSpins.length,
  };

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
      total_earned: ((prev?.total_earned) || 0) + (task.spins_reward || 1),
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
      return <><Icon name="star"  size={16} /> SPIN NOW! (Free)</>;
    if (type === "bonus")
      return <><Icon name="gift"  size={16} /> SPIN NOW! ({bonusLeft} bonus left)</>;
    return "No Spins Available";
  };

  /* ── Wheel size — fixed on desktop ── */
  const WHEEL_SIZE = 380;

  /* ══════════════════════════════════════════
     ERROR STATE
  ══════════════════════════════════════════ */
  if (!loading && error) {
    return (
      <div className="swd-page">
        <div className="swd-error" role="alert">
          <Icon name="warning" size={36} style={{ color: "#f59e0b" }} />
          <p>{error}</p>
          <button onClick={() => loadConfig()} className="swd-error-retry">
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
    <div className="swd-page">

      {/* Toast */}
      <BonusSpinToast
        bonus={bonusToast}
        onClose={() => setBonusToast(null)}
      />

      {/* ── Page header ── */}
      <div className="swd-header">
        <div className="swd-header-left">
          <button
            className="swd-back"
            onClick={() => navigate(-1)}
            aria-label="Go back"
          >
            <Icon name="arrowLeft" size={20} />
          </button>
          <div>
            <h1 className="swd-title">
              <Icon name="spin" size={22} style={{ color: "#e8630a" }} />
              Spin &amp; Win
            </h1>
            <p className="swd-subtitle">
              {totalSpinsAvailable > 0
                ? `${totalSpinsAvailable} spin${totalSpinsAvailable > 1 ? "s" : ""} available`
                : "1 free spin per day"}
            </p>
          </div>
        </div>

        <div className="swd-header-right">
          {stats && (
            <div className="swd-header-stat">
              <span className="swd-header-stat-val">{stats.total_wins}</span>
              <span className="swd-header-stat-label">wins</span>
            </div>
          )}
          {stats && (
            <div className="swd-header-stat">
              <span className="swd-header-stat-val">{stats.total_spins || 0}</span>
              <span className="swd-header-stat-label">spins</span>
            </div>
          )}
          <button
            className="swd-sound-btn"
            onClick={() => setSoundOn((s) => !s)}
            aria-label={soundOn ? "Mute sounds" : "Unmute sounds"}
          >
            <Icon name={soundOn ? "soundOn" : "soundOff"} size={18} />
            {soundOn ? "Sound On" : "Muted"}
          </button>
          <button
            className="swd-refresh-btn"
            onClick={() => loadConfig()}
            disabled={loading}
            aria-label="Refresh"
          >
            <Icon name="loader" size={16} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── Nav tabs ── */}
      <nav className="swd-nav" aria-label="Spin wheel sections">
        {NAV_TABS.map((t) => (
          <button
            key={t.key}
            className={`swd-nav-btn${tab === t.key ? " swd-nav-btn--active" : ""}`}
            onClick={() => setTab(t.key)}
            aria-selected={tab === t.key}
          >
            <Icon name={t.iconName} size={15} />
            {t.label}
            {navCounts[t.key] > 0 && (
              <span
                className={`swd-nav-badge${
                  t.key === "earn" ? " swd-nav-badge--earn" : ""
                }`}
              >
                {navCounts[t.key]}
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* ══════════════════════════════════════════
          WHEEL TAB — two-column layout
      ══════════════════════════════════════════ */}
      {tab === "wheel" && (
        <div className="swd-layout">

          {/* ── LEFT: Wheel + button ── */}
          <div className="swd-wheel-col">

            <SpinCounterBadge spinStatus={spinStatus} />

            {!canSpin && spinStatus?.next_spin_seconds && (
              <CountdownTimer secondsLeft={spinStatus.next_spin_seconds} />
            )}

            {/* Streak */}
            {(stats?.streak || spinStatus?.streak || 0) > 0 && (
              <div className="swd-streak">
                <Icon
                  name="flame"
                  size={20}
                  style={{ color: "#f97316" }}
                />
                <div className="swd-streak-body">
                  <p className="swd-streak-title">Spin Streak!</p>
                  <p className="swd-streak-sub">
                    Keep spinning daily to maintain your streak
                  </p>
                </div>
                <div className="swd-streak-days">
                  {stats?.streak || spinStatus?.streak || 0}
                  <small>days</small>
                </div>
              </div>
            )}

            {/* Status banners */}
            {spinStatus && !canSpin && (
              <div className="swd-status-banner" role="status">
                <Icon name="clock" size={18} style={{ color: "#f59e0b" }} />
                <div>
                  <p>
                    Next spin in <strong>{spinStatus.next_spin_in}</strong>
                  </p>
                  <small>Complete tasks to earn bonus spins!</small>
                </div>
              </div>
            )}

            {canFreeSpin && (
              <div className="swd-ready-banner" role="status">
                <Icon name="sparkle" size={18} style={{ color: "#e8630a" }} />
                <p>Your free spin is ready!</p>
              </div>
            )}

            {bonusLeft > 0 && (
              <div className="swd-bonus-banner" role="status">
                <Icon name="gift" size={18} style={{ color: "#6366f1" }} />
                <div>
                  <p>
                    You have{" "}
                    <strong>
                      {bonusLeft} bonus spin{bonusLeft > 1 ? "s" : ""}
                    </strong>{" "}
                    from referrals &amp; tasks!
                  </p>
                  <small>These don't expire — use them any time</small>
                </div>
              </div>
            )}

            {/* Wheel canvas */}
            <div className="swd-wheel-wrap">
              <div
                className={`swd-pointer${
                  canSpin && !spinning ? " swd-pointer--ready" : ""
                }`}
              >
                <Icon
                  name="pointerDown"
                  size={32}
                  style={{ color: "#e8630a" }}
                />
              </div>

              <div className={`swd-canvas-outer${shake ? " swd-shake" : ""}`}>
                <div
                  className={`swd-canvas-wrap${
                    bigWin ? " swd-canvas-wrap--big-win" : ""
                  }`}
                  style={{ width: WHEEL_SIZE, height: WHEEL_SIZE }}
                >
                  {loading ? (
                    <div
                      className="swd-sk-wheel"
                      style={{ width: WHEEL_SIZE, height: WHEEL_SIZE }}
                    />
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
                "swd-spin-btn",
                spinning                            ? "swd-spin-btn--spinning" : "",
                !canSpin                            ? "swd-spin-btn--disabled" : "",
                canSpin && !spinning                ? "swd-spin-btn--pulse"    : "",
                spinType === "bonus" && !spinning   ? "swd-spin-btn--bonus"    : "",
              ].filter(Boolean).join(" ")}
              onClick={handleSpin}
              disabled={spinning || !canSpin || loading}
              aria-label={
                spinning            ? "Spinning…"           :
                !canSpin            ? "No spins available"  :
                spinType === "bonus"? "Use bonus spin"       :
                "Spin the wheel for free"
              }
            >
              {spinBtnLabel()}
            </button>

            {/* Earn shortcut */}
            {pendingTasksCount > 0 && (
              <button
                className="swd-earn-shortcut"
                onClick={() => setTab("earn")}
              >
                <div className="swd-earn-shortcut-icon">
                  <Icon name="bolt" size={16} style={{ color: "#fff" }} />
                </div>
                <div style={{ flex: 1 }}>
                  <p className="swd-earn-shortcut-title">
                    Earn More Spins — {pendingTasksCount} task
                    {pendingTasksCount > 1 ? "s" : ""} available
                  </p>
                  <p className="swd-earn-shortcut-sub">
                    Follow us &amp; join groups to get up to{" "}
                    {totalPossibleSpins} bonus spins!
                  </p>
                </div>
                <Icon
                  name="chevronRight"
                  size={16}
                  style={{ color: "#e8630a" }}
                />
              </button>
            )}

            {/* Invite CTA */}
            <Link to="/invite" className="swd-invite-cta">
              <Icon name="rocket" size={18} style={{ color: "#e8630a" }} />
              <div style={{ flex: 1 }}>
                <p className="swd-invite-title">Want more spins?</p>
                <p className="swd-invite-sub">
                  Invite a friend → they sign up → you get{" "}
                  <strong>+1 bonus spin</strong> instantly!
                </p>
              </div>
              <Icon
                name="chevronRight"
                size={16}
                style={{ color: "#e8630a" }}
              />
            </Link>
          </div>

          {/* ── RIGHT: Sidebar ── */}
          <aside className="swd-sidebar">

            {/* Prizes */}
            <div className="swd-sidebar-card">
              <h2 className="swd-sidebar-card-title">
                <Icon name="gift" size={16} style={{ color: "#e8630a" }} />
                Prizes You Can Win
              </h2>
              <div className="swd-prizes-grid" role="list">
                {loading
                  ? [1, 2, 3, 4].map((i) => (
                      <div key={i} className="swd-sk-prize" />
                    ))
                  : segments.map((seg) => (
                      <div
                        key={seg.id}
                        className="swd-prize-item"
                        role="listitem"
                        style={{
                          background : seg.bg,
                          borderColor: seg.color + "44",
                        }}
                      >
                        <span className="swd-prize-emoji" aria-hidden="true">
                          {seg.emoji || "★"}
                        </span>
                        <span
                          className="swd-prize-label"
                          style={{ color: seg.color }}
                        >
                          {seg.label}
                        </span>
                      </div>
                    ))}
              </div>
            </div>

            {/* Stats */}
            {stats && (
              <div className="swd-sidebar-card">
                <h2 className="swd-sidebar-card-title">
                  <Icon name="history" size={16} style={{ color: "#e8630a" }} />
                  Your Stats
                </h2>
                {[
                  { label: "Total Spins",  val: stats.total_spins  || 0 },
                  { label: "Total Wins",   val: stats.total_wins   || 0 },
                  { label: "Win Rate",     val: stats.win_rate
                      ? `${stats.win_rate}%` : "—"               },
                  { label: "Best Win",     val: stats.best_win     || "—" },
                  { label: "Spin Streak",  val: `${stats.streak    || 0}d` },
                ].map((s) => (
                  <div key={s.label} className="swd-stat-row">
                    <span className="swd-stat-label">{s.label}</span>
                    <span className="swd-stat-val">{s.val}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Rules */}
            <div className="swd-sidebar-card">
              <h2 className="swd-sidebar-card-title">
                <Icon name="list" size={16} style={{ color: "#6b7280" }} />
                Rules
              </h2>
              {RULES.map((rule, i) => (
                <div key={i} className="swd-rule">
                  <span className="swd-rule-dot" aria-hidden="true" />
                  <span>{rule}</span>
                </div>
              ))}
            </div>

          </aside>
        </div>
      )}

      {/* ══════════ EARN TAB ══════════ */}
      {tab === "earn" && (
        <div className="swd-tab-content">
          <EarnTab
            completedTaskIds={completedTasks}
            onTaskClaimed={handleTaskClaimed}
            totalEarned={taskStats?.total_earned}
          />
        </div>
      )}

      {/* ══════════ HISTORY TAB ══════════ */}
      {tab === "history" && (
        <div className="swd-tab-content">
          <HistoryTab history={history} stats={stats} />
        </div>
      )}

      {/* ══════════ REFERRALS TAB ══════════ */}
      {tab === "referrals" && (
        <div className="swd-tab-content">

          {/* Summary cards */}
          <div className="swd-ref-cards">
            {[
              {
                val     : referralSpins.length,
                label   : "Friends Joined",
                color   : "#111",
                iconName: "users",
                bg      : "#f5f3ef",
              },
              {
                val     : referralSpins.reduce(
                  (a, r) => a + (r.spins_awarded || 0), 0
                ),
                label   : "Spins Earned",
                color   : "#e8630a",
                iconName: "spin",
                bg      : "#fff0e6",
              },
              {
                val     : bonusLeft,
                label   : "Remaining",
                color   : "#6366f1",
                iconName: "bolt",
                bg      : "#eef2ff",
              },
            ].map((s) => (
              <div
                key={s.label}
                className="swd-ref-card"
                style={{ background: s.bg }}
              >
                <Icon
                  name={s.iconName}
                  size={20}
                  style={{ color: s.color }}
                />
                <span
                  className="swd-ref-card-val"
                  style={{ color: s.color }}
                >
                  {s.val}
                </span>
                <span className="swd-ref-card-label">{s.label}</span>
              </div>
            ))}
          </div>

          <div className="swd-ref-layout">

            {/* Left: panel + CTA */}
            <div className="swd-ref-main">
              <ReferralSpinsPanel referralSpins={referralSpins} />

              {referralSpins.length === 0 && (
                <div className="swd-empty">
                  <Icon name="gift" size={44} style={{ color: "#d1d5db" }} />
                  <p>No referral spins yet</p>
                  <small>Invite friends to earn bonus spins!</small>
                  <Link to="/invitation" className="swd-empty-invite-btn">
                    Go to Invite Page
                    <Icon name="arrowRight" size={14} />
                  </Link>
                </div>
              )}

              <Link to="/invitation" className="swd-ref-cta">
                <Icon name="share" size={18} style={{ color: "#e8630a" }} />
                <div style={{ flex: 1 }}>
                  <p className="swd-ref-cta-title">Invite More Friends</p>
                  <p className="swd-ref-cta-sub">
                    Each signup = +1 bonus spin for you
                  </p>
                </div>
                <Icon
                  name="chevronRight"
                  size={16}
                  style={{ color: "#e8630a" }}
                />
              </Link>
            </div>

            {/* Right: how it works */}
            <div className="swd-how-it-works">
              <h3 className="swd-how-title">How Bonus Spins Work</h3>
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
                <div key={item.step} className="swd-how-step">
                  <div className="swd-how-step-num">{item.step}</div>
                  <Icon
                    name={item.iconName}
                    size={18}
                    style={{ color: "#e8630a", flexShrink: 0 }}
                  />
                  <p className="swd-how-step-text">{item.text}</p>
                </div>
              ))}
            </div>

          </div>
        </div>
      )}

      <p className="swd-footer">
        © {new Date().getFullYear()} Loemart — Spin responsibly!
      </p>

      {/* Result modal */}
      {showResult && spinResult && (
        <ResultModal result={spinResult} onClose={closeResult} />
      )}
    </div>
  );
}