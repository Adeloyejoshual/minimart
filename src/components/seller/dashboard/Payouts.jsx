// components/seller/dashboard/Payouts.jsx
import { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import { formatNGN } from "./Shared";

// ── Constants ─────────────────────────────────────────────────
const MIN_AMOUNT = 500;
const MAX_DAILY = 5;

// ── API client ────────────────────────────────────────────────
const getApi = () => {
  const token = localStorage.getItem("token");
  return axios.create({
    headers: { Authorization: `Bearer ${token}` },
    timeout: 15000,
  });
};

// ── Animated counter ──────────────────────────────────────────
const useCounter = (target, duration = 900) => {
  const [value, setValue] = useState(0);
  const raf = useRef(null);
  useEffect(() => {
    const start = value;
    const diff = target - start;
    if (diff === 0) return;
    const t0 = performance.now();
    const step = (now) => {
      const p = Math.min((now - t0) / duration, 1);
      setValue(start + diff * (1 - Math.pow(1 - p, 4)));
      if (p < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [target]);
  return value;
};

// ── Copy hook ─────────────────────────────────────────────────
const useCopy = () => {
  const [copied, setCopied] = useState(false);
  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.cssText = "position:fixed;opacity:0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
    }
    setTimeout(() => setCopied(false), 2000);
  };
  return { copied, copy };
};

// ── Date formatter ────────────────────────────────────────────
const fmtDate = (d) =>
  new Date(d).toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

// ── Idempotency key ───────────────────────────────────────────
const genKey = () =>
  `idem-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

// ══════════════════════════════════════════════════════════════
// TABS
// ══════════════════════════════════════════════════════════════
const TabBar = ({ tabs, active, onChange }) => (
  <div style={S.tabBar}>
    <div style={S.tabInner}>
      {tabs.map((t) => {
        const isActive = active === t.key;
        return (
          <button
            key={t.key}
            onClick={() => onChange(t.key)}
            style={{
              ...S.tab,
              ...(isActive ? S.tabOn : S.tabOff),
            }}
          >
            <span>{t.icon}</span>
            <span>{t.label}</span>
            {t.count > 0 && (
              <span
                style={{
                  ...S.tabCount,
                  background: isActive ? "#fff" : "rgba(99,102,241,0.12)",
                  color: isActive ? "#6366f1" : "#6366f1",
                }}
              >
                {t.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  </div>
);

// ══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════
export const Payouts = ({ vendor }) => {
  const [wallet, setWallet] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [withdrawAmt, setWithdrawAmt] = useState("");
  const [withdrawing, setWithdrawing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [msg, setMsg] = useState({ type: "", text: "" });
  const [activeTab, setActiveTab] = useState("overview");
  const [hoveredCard, setHoveredCard] = useState(null);
  const [feePreview, setFeePreview] = useState(null);
  const [loadingFee, setLoadingFee] = useState(false);
  const [idemKey, setIdemKey] = useState(genKey());

  const balance = wallet?.balance;
  const wdInfo = wallet?.withdrawal_info;
  const feeRules = wdInfo?.fee_rules;
  const minAmount = wdInfo?.min_amount ?? MIN_AMOUNT;
  const maxDaily = wdInfo?.daily_limit ?? MAX_DAILY;

  const animAvail = useCounter(balance?.available ?? 0);
  const animPending = useCounter(balance?.pending ?? 0);
  const animReceived = useCounter(balance?.total_received ?? 0);
  const animWithdrawn = useCounter(balance?.total_withdrawn ?? 0);
  const { copied, copy } = useCopy();

  // ── Load data ───────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const api = getApi();
        const [w, tx, wd] = await Promise.all([
          api.get("/api/seller-wallet/balance"),
          api.get("/api/seller-wallet/transactions?limit=20"),
          api.get("/api/seller-wallet/withdrawals?limit=10"),
        ]);
        setWallet(w.data);
        setTransactions(tx.data.transactions ?? []);
        setWithdrawals(wd.data.withdrawals ?? []);
        setLoadError("");
      } catch (err) {
        setLoadError(err.response?.data?.message ?? "Unable to load wallet");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ── Fee timer cleanup ───────────────────────────────────
  const feeTimer = useRef(null);
  useEffect(() => () => clearTimeout(feeTimer.current), []);

  // ── Fee preview ─────────────────────────────────────────
  const previewFee = useCallback((amt) => {
    clearTimeout(feeTimer.current);
    if (!amt || Number(amt) < minAmount) {
      setFeePreview(null);
      return;
    }
    setLoadingFee(true);
    feeTimer.current = setTimeout(async () => {
      try {
        const { data } = await getApi().get(
          `/api/seller-wallet/withdrawal-preview?amount=${amt}`
        );
        setFeePreview(data.preview);
      } catch {
        setFeePreview(null);
      } finally {
        setLoadingFee(false);
      }
    }, 400);
  }, [minAmount]);

  const handleAmtChange = (val) => {
    setWithdrawAmt(val);
    setMsg({ type: "", text: "" });
    previewFee(val);
  };

  // ── Refresh ─────────────────────────────────────────────
  const refresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      const api = getApi();
      const [w, tx, wd] = await Promise.all([
        api.get("/api/seller-wallet/balance"),
        api.get("/api/seller-wallet/transactions?limit=20"),
        api.get("/api/seller-wallet/withdrawals?limit=10"),
      ]);
      setWallet(w.data);
      setTransactions(tx.data.transactions ?? []);
      setWithdrawals(wd.data.withdrawals ?? []);
    } catch {}
    setRefreshing(false);
  };

  // ── Withdraw ────────────────────────────────────────────
  const handleWithdraw = async () => {
    const amount = Number(withdrawAmt);
    if (!amount || amount < minAmount) {
      setMsg({ type: "error", text: `Minimum withdrawal is ₦${minAmount.toLocaleString("en-NG")}` });
      return;
    }
    const available = Number(balance?.available ?? 0);
    if (amount > available) {
      setMsg({
        type: "error",
        text: `Insufficient balance. You have ${formatNGN(available)} but need ${formatNGN(amount)}.`,
      });
      return;
    }
    if (wdInfo && wdInfo.daily_remaining <= 0) {
      setMsg({ type: "error", text: `Daily limit reached (${maxDaily}/day). Try again tomorrow.` });
      return;
    }
    if (feePreview && !feePreview.can_withdraw) {
      setMsg({
        type: "error",
        text: feePreview.insufficient_for_fees
          ? `Amount too small after fees (₦${feePreview.fee}). Increase amount.`
          : "Cannot process withdrawal right now.",
      });
      return;
    }

    setWithdrawing(true);
    setMsg({ type: "", text: "" });

    try {
      const { data } = await getApi().post("/api/seller-wallet/withdraw", {
        amount,
        idempotency_key: idemKey,
      });
      setMsg({ type: "success", text: data.message });
      setWithdrawAmt("");
      setFeePreview(null);
      setIdemKey(genKey());
      await refresh();
    } catch (err) {
      setMsg({
        type: "error",
        text: err.response?.data?.message ?? "Withdrawal failed. Try again.",
      });
    } finally {
      setWithdrawing(false);
    }
  };

  // ── Loading ─────────────────────────────────────────────
  if (loading) {
    return (
      <div style={S.loaderWrap}>
        <div style={S.loaderRing}>
          <div style={S.loaderDot} />
        </div>
        <p style={S.loaderText}>Fetching wallet data…</p>
      </div>
    );
  }

  if (loadError && !wallet) {
    return (
      <div style={S.errorWrap}>
        <div style={S.errorIcon}>!</div>
        <h3 style={S.errorTitle}>Wallet Unavailable</h3>
        <p style={S.errorDesc}>{loadError}</p>
        <button onClick={() => window.location.reload()} style={S.errorBtn}>
          Try Again
        </button>
      </div>
    );
  }

  const virtualAccount = wallet?.virtual_account;
  const pendingWd = withdrawals.filter(
    (w) => w.status === "pending" || w.status === "processing"
  ).length;

  const TABS = [
    { key: "overview", label: "Overview", icon: "📊", count: 0 },
    { key: "transactions", label: "History", icon: "💳", count: transactions.length },
    { key: "withdraw", label: "Withdraw", icon: "⚡", count: pendingWd },
  ];

  return (
    <div style={S.root}>
      {/* Header */}
      <div style={S.pageHeader}>
        <div>
          <div style={S.titleRow}>
            <h2 style={S.pageTitle}>Wallet</h2>
            <span style={S.instantTag}>⚡ Instant Payouts</span>
          </div>
          <p style={S.pageSub}>Manage your earnings and withdraw instantly</p>
        </div>
        <div style={S.headerActions}>
          {wdInfo && (
            <div style={S.dailyPill}>
              <div style={S.dailyPillDots}>
                {Array.from({ length: maxDaily }).map((_, i) => (
                  <span
                    key={i}
                    style={{
                      ...S.dailyMiniDot,
                      background:
                        i < wdInfo.daily_used
                          ? i < 2 ? "#10b981" : "#f59e0b"
                          : "rgba(255,255,255,0.3)",
                    }}
                  />
                ))}
              </div>
              <span>{wdInfo.daily_remaining} left today</span>
            </div>
          )}
          <button
            onClick={refresh}
            disabled={refreshing}
            style={{
              ...S.iconBtn,
              animation: refreshing ? "spin 1s linear infinite" : "none",
            }}
          >
            ↻
          </button>
        </div>
      </div>

      {loadError && <div style={S.alertBar}>⚠ {loadError}</div>}

      <TabBar tabs={TABS} active={activeTab} onChange={setActiveTab} />

      {activeTab === "overview" && (
        <OverviewTab
          balance={balance}
          anims={{ animAvail, animPending, animReceived, animWithdrawn }}
          virtualAccount={virtualAccount}
          transactions={transactions}
          wdInfo={wdInfo}
          feeRules={feeRules}
          maxDaily={maxDaily}
          hoveredCard={hoveredCard}
          setHoveredCard={setHoveredCard}
          setActiveTab={setActiveTab}
          copied={copied}
          copy={copy}
        />
      )}
      {activeTab === "transactions" && (
        <TransactionsTab transactions={transactions} withdrawals={withdrawals} />
      )}
      {activeTab === "withdraw" && (
        <WithdrawTab
          vendor={vendor}
          balance={balance}
          wdInfo={wdInfo}
          feeRules={feeRules}
          minAmount={minAmount}
          maxDaily={maxDaily}
          withdrawAmt={withdrawAmt}
          handleAmtChange={handleAmtChange}
          withdrawing={withdrawing}
          handleWithdraw={handleWithdraw}
          msg={msg}
          withdrawals={withdrawals}
          feePreview={feePreview}
          loadingFee={loadingFee}
        />
      )}
    </div>
  );
};

// ══════════════════════════════════════════════════════════════
// OVERVIEW TAB
// ══════════════════════════════════════════════════════════════
const OverviewTab = ({
  balance, anims, virtualAccount, transactions,
  wdInfo, feeRules, maxDaily, hoveredCard, setHoveredCard,
  setActiveTab, copied, copy,
}) => {
  const { animAvail, animPending, animReceived, animWithdrawn } = anims;

  const cards = [
    { key: "available", label: "Available", value: animAvail, icon: "💰", primary: true, desc: "Ready to withdraw" },
    { key: "pending", label: "Pending", value: animPending, icon: "⏳", desc: "Being processed" },
    { key: "received", label: "Received", value: animReceived, icon: "📥", desc: "All-time income" },
    { key: "withdrawn", label: "Withdrawn", value: animWithdrawn, icon: "📤", desc: "Total cashouts" },
  ];

  return (
    <div style={S.stack}>
      {/* Balance grid */}
      <div style={S.cardGrid}>
        {cards.map((c) => {
          const hovered = hoveredCard === c.key;
          return (
            <div
              key={c.key}
              onMouseEnter={() => setHoveredCard(c.key)}
              onMouseLeave={() => setHoveredCard(null)}
              style={{
                ...S.statCard,
                ...(c.primary ? S.statCardPrimary : {}),
                transform: hovered ? "translateY(-6px)" : "none",
                boxShadow: hovered
                  ? c.primary
                    ? "0 24px 48px rgba(99,102,241,0.35)"
                    : "0 16px 40px rgba(0,0,0,0.08)"
                  : c.primary
                    ? "0 8px 32px rgba(99,102,241,0.2)"
                    : "0 2px 8px rgba(0,0,0,0.03)",
              }}
            >
              <div style={S.statTop}>
                <span style={{
                  ...S.statIcon,
                  background: c.primary ? "rgba(255,255,255,0.18)" : "#f3f4f6",
                }}>
                  {c.icon}
                </span>
                <span style={{
                  ...S.statLabel,
                  color: c.primary ? "rgba(255,255,255,0.8)" : "#6b7280",
                }}>
                  {c.label}
                </span>
              </div>
              <div style={{
                ...S.statValue,
                color: c.primary ? "#fff" : "#111827",
              }}>
                {formatNGN(c.value)}
              </div>
              <div style={{
                ...S.statDesc,
                color: c.primary ? "rgba(255,255,255,0.6)" : "#9ca3af",
              }}>
                {c.desc}
              </div>
              {c.primary && (
                <button
                  onClick={() => setActiveTab("withdraw")}
                  style={S.statCta}
                >
                  ⚡ Withdraw Now
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Daily tracker */}
      {wdInfo && (
        <div style={S.trackerCard}>
          <div style={S.trackerHeader}>
            <div>
              <p style={S.trackerTitle}>Daily Withdrawal Tracker</p>
              <p style={S.trackerSub}>
                {wdInfo.daily_used} of {maxDaily} used today
              </p>
            </div>
            <span style={S.trackerPercent}>
              {Math.round((wdInfo.daily_used / maxDaily) * 100)}%
            </span>
          </div>
          <div style={S.trackerBar}>
            <div
              style={{
                ...S.trackerFill,
                width: `${(wdInfo.daily_used / maxDaily) * 100}%`,
                background:
                  wdInfo.daily_used >= maxDaily
                    ? "#ef4444"
                    : wdInfo.daily_used >= 3
                      ? "#f59e0b"
                      : "#6366f1",
              }}
            />
          </div>
          {feeRules && (
            <div style={S.trackerChips}>
              <span style={S.chip}>{feeRules.above_10k?.label ?? "₦50 above ₦10K"}</span>
              <span style={S.chip}>{feeRules.extra_daily?.label ?? "+₦10 after 2nd"}</span>
            </div>
          )}
        </div>
      )}

      {/* Virtual account */}
      {virtualAccount ? (
        <div style={S.vaWrap}>
          <div style={S.vaTop}>
            <div>
              <h3 style={S.vaH3}>Virtual Account</h3>
              <p style={S.vaSub}>Receive buyer payments directly</p>
            </div>
            <span style={S.liveTag}>
              <span style={S.livePulse} />
              Active
            </span>
          </div>
          <div style={S.vaContent}>
            <div>
              <p style={S.vaSmall}>ACCOUNT NUMBER</p>
              <div style={S.vaNumRow}>
                <span style={S.vaNum}>{virtualAccount.account_number}</span>
                <button
                  onClick={() => copy(virtualAccount.account_number)}
                  style={{
                    ...S.copyChip,
                    background: copied ? "#dcfce7" : "#eef2ff",
                    color: copied ? "#15803d" : "#4f46e5",
                  }}
                >
                  {copied ? "✓ Copied!" : "Copy"}
                </button>
              </div>
            </div>
            <div style={S.vaRow}>
              <div>
                <p style={S.vaSmall}>ACCOUNT NAME</p>
                <p style={S.vaDetail}>{virtualAccount.account_name}</p>
              </div>
              <div>
                <p style={S.vaSmall}>BANK</p>
                <p style={S.vaDetail}>{virtualAccount.bank_name}</p>
              </div>
            </div>
          </div>
          <div style={S.vaTip}>
            Funds credited automatically after buyer payment confirmation.
          </div>
        </div>
      ) : (
        <div style={S.noVaWrap}>
          <div style={S.noVaCircle}>🏦</div>
          <h3 style={S.noVaH3}>Virtual Account Pending</h3>
          <p style={S.noVaSub}>
            Your account will be created once the admin activates your store.
          </p>
          <div style={S.timeline}>
            {[
              { label: "Registered", done: true },
              { label: "Documents", done: true },
              { label: "Review", active: true },
              { label: "Active", done: false },
            ].map((s, i) => (
              <div key={i} style={S.tlStep}>
                <div
                  style={{
                    ...S.tlDot,
                    background: s.done ? "#6366f1" : s.active ? "#f59e0b" : "#e5e7eb",
                    color: s.done || s.active ? "#fff" : "#9ca3af",
                  }}
                >
                  {s.done ? "✓" : i + 1}
                </div>
                <span style={{
                  ...S.tlLabel,
                  color: s.done ? "#6366f1" : s.active ? "#f59e0b" : "#9ca3af",
                }}>
                  {s.label}
                </span>
                {i < 3 && <div style={{
                  ...S.tlLine,
                  background: s.done ? "#6366f1" : "#e5e7eb",
                }} />}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent activity */}
      <div style={S.panel}>
        <div style={S.panelHead}>
          <h3 style={S.panelH3}>Recent Activity</h3>
          {transactions.length > 0 && (
            <button onClick={() => setActiveTab("transactions")} style={S.linkBtn}>
              See all →
            </button>
          )}
        </div>
        {transactions.length === 0 ? (
          <Empty icon="📭" title="No activity yet" desc="Transactions appear when you receive payments" />
        ) : (
          <div style={S.listCol}>
            {transactions.slice(0, 5).map((tx) => (
              <TxRow key={tx.id} tx={tx} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════
// TRANSACTIONS TAB
// ══════════════════════════════════════════════════════════════
const TransactionsTab = ({ transactions, withdrawals }) => {
  const [filter, setFilter] = useState("all");
  const filtered =
    filter === "all"
      ? transactions
      : transactions.filter((t) => t.type === filter);

  return (
    <div style={S.stack}>
      <div style={S.filterRow}>
        {[
          { key: "all", label: "All", icon: "📋" },
          { key: "credit", label: "Credits", icon: "📥" },
          { key: "debit", label: "Debits", icon: "📤" },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            style={{
              ...S.filterChip,
              ...(filter === f.key ? S.filterOn : {}),
            }}
          >
            {f.icon} {f.label}
          </button>
        ))}
      </div>

      <div style={S.panel}>
        {filtered.length === 0 ? (
          <Empty
            icon="📭"
            title="Nothing here"
            desc={filter !== "all" ? `No ${filter}s yet` : "Transactions appear here"}
          />
        ) : (
          <div style={S.listCol}>
            {filtered.map((tx) => (
              <TxRow key={tx.id} tx={tx} expanded />
            ))}
          </div>
        )}
      </div>

      {withdrawals.length > 0 && (
        <div style={S.panel}>
          <h3 style={{ ...S.panelH3, marginBottom: 16 }}>Withdrawal History</h3>
          <div style={S.listCol}>
            {withdrawals.map((wd) => (
              <WdRow key={wd.id} wd={wd} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ══════════════════════════════════════════════════════════════
// WITHDRAW TAB
// ══════════════════════════════════════════════════════════════
const WithdrawTab = ({
  vendor, balance, wdInfo, feeRules, minAmount, maxDaily,
  withdrawAmt, handleAmtChange, withdrawing, handleWithdraw,
  msg, withdrawals, feePreview, loadingFee,
}) => {
  const available = Number(balance?.available ?? 0);
  const pct = withdrawAmt
    ? Math.min((Number(withdrawAmt) / (available || 1)) * 100, 100)
    : 0;
  const exhausted = wdInfo && wdInfo.daily_remaining <= 0;
  const cantWithdraw =
    withdrawing || !withdrawAmt || exhausted || (feePreview && !feePreview.can_withdraw);

  return (
    <div className="withdraw-grid" style={S.wdGrid}>
      {/* ── Left column ──────────────────────────────────── */}
      <div style={S.panel}>
        <div style={S.wdHeader}>
          <h3 style={S.panelH3}>Instant Withdrawal</h3>
          <span style={S.lightningBadge}>⚡ Instant</span>
        </div>
        <p style={S.panelSub}>Funds arrive in your bank within minutes</p>

        {exhausted && (
          <div style={S.exhaustedBar}>
            Daily limit reached ({maxDaily} withdrawals). Try again tomorrow.
          </div>
        )}

        {/* Bank */}
        <div style={S.bankStrip}>
          <div style={S.bankLeft}>
            <div style={S.bankAvatar}>🏦</div>
            <div>
              <p style={S.bankTitle}>{vendor?.bank_name ?? "No bank"}</p>
              <p style={S.bankSub}>
                ••••••{vendor?.bank_account?.slice(-4) ?? "——"} · {vendor?.account_name ?? "—"}
              </p>
            </div>
          </div>
          <span style={S.bankChip}>⚡</span>
        </div>

        {/* Amount */}
        <div style={S.fieldGroup}>
          <label style={S.fieldLabel}>Withdrawal Amount</label>
          <div style={S.inputWrap}>
            <span style={S.inputCurrency}>₦</span>
            <input
              type="number"
              placeholder="0.00"
              value={withdrawAmt}
              onChange={(e) => handleAmtChange(e.target.value)}
              disabled={exhausted}
              style={{
                ...S.bigInput,
                borderColor:
                  feePreview && !feePreview.can_withdraw
                    ? "#fca5a5"
                    : "#ddd6fe",
              }}
            />
          </div>

          {/* Progress */}
          {available > 0 && (
            <div style={S.pctWrap}>
              <div style={S.pctTrack}>
                <div
                  style={{
                    ...S.pctBar,
                    width: `${pct}%`,
                    background:
                      pct > 90 ? "#ef4444" : pct > 60 ? "#f59e0b" : "#6366f1",
                  }}
                />
              </div>
              <div style={S.pctLabels}>
                <span>{pct > 0 ? `${Math.round(pct)}%` : "—"}</span>
                <span>Balance: {formatNGN(available)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Fee breakdown */}
        {(feePreview || loadingFee) && (
          <div
            style={{
              ...S.feeBox,
              borderColor:
                feePreview && !feePreview.can_withdraw ? "#fca5a5" : "#e9d5ff",
            }}
          >
            {loadingFee ? (
              <p style={S.feeLoading}>Calculating fees…</p>
            ) : feePreview ? (
              <>
                <p style={S.feeTitle}>Fee Summary</p>
                <div style={S.feeList}>
                  <FeeItem label="Amount" value={formatNGN(feePreview.amount)} />
                  {feePreview.breakdown?.above_10k_fee > 0 && (
                    <FeeItem
                      label="Above ₦10K fee"
                      value={`−${formatNGN(feePreview.breakdown.above_10k_fee)}`}
                      warn
                    />
                  )}
                  {feePreview.breakdown?.extra_withdrawal_fee > 0 && (
                    <FeeItem
                      label="Extra withdrawal fee"
                      value={`−${formatNGN(feePreview.breakdown.extra_withdrawal_fee)}`}
                      warn
                    />
                  )}
                  <div style={S.feeLine} />
                  <div style={S.feeRow}>
                    <span style={{ fontWeight: 700 }}>You receive</span>
                    <span
                      style={{
                        fontWeight: 800,
                        fontSize: "1.15rem",
                        color: feePreview.can_withdraw ? "#059669" : "#dc2626",
                      }}
                    >
                      {formatNGN(feePreview.net_amount)}
                    </span>
                  </div>
                </div>
                {feePreview.insufficient_balance && (
                  <div style={S.feeAlert}>
                    Insufficient balance. Need {formatNGN(feePreview.amount)}, have{" "}
                    {formatNGN(feePreview.available_balance)}.
                  </div>
                )}
                {feePreview.insufficient_for_fees && (
                  <div style={S.feeAlert}>
                    Amount too small after fees. Increase your withdrawal.
                  </div>
                )}
              </>
            ) : null}
          </div>
        )}

        {/* Quick amounts */}
        <div style={S.quickWrap}>
          {[1000, 2000, 5000, 10000, 25000, 50000].map((amt) => (
            <button
              key={amt}
              disabled={amt > available || exhausted}
              onClick={() => handleAmtChange(String(amt))}
              style={{
                ...S.quickChip,
                ...(Number(withdrawAmt) === amt ? S.quickOn : {}),
                opacity: amt > available || exhausted ? 0.35 : 1,
              }}
            >
              {formatNGN(amt, 0)}
            </button>
          ))}
          <button
            disabled={exhausted || available <= 0}
            onClick={() => {
              if (available > 0) handleAmtChange(String(available));
            }}
            style={{
              ...S.quickChip,
              ...S.quickAll,
              gridColumn: "span 2",
              opacity: exhausted || available <= 0 ? 0.35 : 1,
            }}
          >
            Withdraw All — {formatNGN(available)}
          </button>
        </div>

        {/* Message */}
        {msg.text && (
          <div
            style={{
              ...S.msgBar,
              background: msg.type === "error" ? "#fef2f2" : "#ecfdf5",
              borderColor: msg.type === "error" ? "#fca5a5" : "#86efac",
              color: msg.type === "error" ? "#991b1b" : "#065f46",
            }}
          >
            {msg.type === "error" ? "⚠️" : "✅"} {msg.text}
          </div>
        )}

        {/* Submit */}
        <button
          disabled={cantWithdraw}
          onClick={handleWithdraw}
          style={{
            ...S.submitBtn,
            opacity: cantWithdraw ? 0.5 : 1,
            cursor: cantWithdraw ? "not-allowed" : "pointer",
          }}
        >
          {withdrawing ? (
            <span style={S.btnSpinWrap}>
              <span style={S.btnSpin} />
              Processing…
            </span>
          ) : (
            "⚡ Withdraw Instantly"
          )}
        </button>

        <p style={S.footNote}>
          ⚡ Instant · Min ₦{minAmount.toLocaleString("en-NG")} · {maxDaily}/day · Commercial banks only
        </p>
      </div>

      {/* ── Right column ─────────────────────────────────── */}
      <div style={S.stack}>
        <div style={S.panel}>
          <h3 style={{ ...S.panelH3, marginBottom: 16 }}>Recent Withdrawals</h3>
          {withdrawals.length === 0 ? (
            <Empty icon="📭" title="No withdrawals" desc="History appears here" />
          ) : (
            <div style={S.listCol}>
              {withdrawals.map((wd) => (
                <WdRow key={wd.id} wd={wd} />
              ))}
            </div>
          )}
        </div>

        <div style={S.rulesBox}>
          <h4 style={S.rulesTitle}>Withdrawal Rules</h4>
          {[
            { dot: "#6366f1", text: `Minimum: ₦${minAmount.toLocaleString("en-NG")}` },
            { dot: "#8b5cf6", text: `Max ${maxDaily} withdrawals per day` },
            { dot: "#f59e0b", text: feeRules?.above_10k?.label ?? "₦50 fee above ₦10,000" },
            { dot: "#ef4444", text: feeRules?.extra_daily?.label ?? "+₦10 from 3rd daily withdrawal" },
            { dot: "#10b981", text: "Instant via Flutterwave" },
            { dot: "#0ea5e9", text: "Commercial banks only" },
          ].map((r, i) => (
            <div key={i} style={S.ruleRow}>
              <span style={{ ...S.ruleDot, background: r.dot }} />
              <span style={S.ruleText}>{r.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════
// TX ROW
// ══════════════════════════════════════════════════════════════
const TxRow = ({ tx, expanded }) => {
  const credit = tx.type === "credit";
  return (
    <div style={S.row}>
      <div style={{ ...S.rowIcon, background: credit ? "#ecfdf5" : "#fef2f2" }}>
        {credit ? "↓" : "↑"}
      </div>
      <div style={S.rowBody}>
        <p style={S.rowTitle}>{tx.narration ?? tx.type}</p>
        <p style={S.rowMeta}>
          {fmtDate(tx.created_at)}
          {expanded && tx.tx_ref && (
            <span style={S.rowRef}> · {tx.tx_ref}</span>
          )}
        </p>
      </div>
      <div style={S.rowRight}>
        <span style={{ ...S.rowAmt, color: credit ? "#059669" : "#dc2626" }}>
          {credit ? "+" : "−"}{formatNGN(tx.amount)}
        </span>
        {Number(tx.fee) > 0 && (
          <span style={S.rowFee}>fee {formatNGN(tx.fee)}</span>
        )}
      </div>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════
// WD ROW
// ══════════════════════════════════════════════════════════════
const WD_STATUS = {
  success: { bg: "#ecfdf5", color: "#059669", border: "#86efac", icon: "✓", label: "Success" },
  pending: { bg: "#fefce8", color: "#a16207", border: "#fde68a", icon: "⏳", label: "Pending" },
  processing: { bg: "#eff6ff", color: "#2563eb", border: "#93c5fd", icon: "⚙", label: "Processing" },
  failed: { bg: "#fef2f2", color: "#dc2626", border: "#fca5a5", icon: "✕", label: "Failed" },
};

const WdRow = ({ wd }) => {
  const st = WD_STATUS[wd.status] ?? WD_STATUS.pending;
  return (
    <div style={S.row}>
      <div style={{ ...S.rowIcon, background: st.bg, color: st.color, fontWeight: 800 }}>
        {st.icon}
      </div>
      <div style={S.rowBody}>
        <p style={S.rowTitle}>To {wd.bank_name}</p>
        <p style={S.rowMeta}>
          {fmtDate(wd.created_at)}
          {wd.account_number && <span> · ••••{wd.account_number.slice(-4)}</span>}
        </p>
      </div>
      <div style={S.rowRight}>
        <span style={{ ...S.rowAmt, color: "#dc2626" }}>−{formatNGN(wd.amount)}</span>
        {Number(wd.fee) > 0 && <span style={S.rowFee}>fee {formatNGN(wd.fee)}</span>}
        <span
          style={{
            ...S.statusPill,
            background: st.bg,
            color: st.color,
            border: `1px solid ${st.border}`,
          }}
        >
          {st.label}
        </span>
      </div>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════
const Empty = ({ icon, title, desc }) => (
  <div style={S.emptyWrap}>
    <span style={{ fontSize: "2.5rem" }}>{icon}</span>
    <p style={S.emptyTitle}>{title}</p>
    <p style={S.emptyDesc}>{desc}</p>
  </div>
);

const FeeItem = ({ label, value, warn }) => (
  <div style={S.feeRow}>
    <span>{label}</span>
    <span style={{ fontWeight: 700, color: warn ? "#d97706" : "#374151" }}>
      {value}
    </span>
  </div>
);

// ══════════════════════════════════════════════════════════════
// STYLES — Completely new design system
// ══════════════════════════════════════════════════════════════
const S = {
  // Root
  root: {
    display: "flex",
    flexDirection: "column",
    gap: 20,
    fontFamily: '"Inter",-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
    color: "#1e1b4b",
  },
  stack: { display: "flex", flexDirection: "column", gap: 20 },

  // Page header
  pageHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    flexWrap: "wrap",
    gap: 16,
  },
  titleRow: { display: "flex", alignItems: "center", gap: 10 },
  pageTitle: {
    fontSize: 28,
    fontWeight: 800,
    margin: 0,
    background: "linear-gradient(135deg,#4f46e5,#7c3aed)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
  },
  instantTag: {
    background: "linear-gradient(135deg,#fbbf24,#f59e0b)",
    color: "#78350f",
    padding: "4px 12px",
    borderRadius: 20,
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: 0.3,
  },
  pageSub: { color: "#6b7280", fontSize: 14, margin: "4px 0 0" },
  headerActions: { display: "flex", alignItems: "center", gap: 10 },
  dailyPill: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    background: "linear-gradient(135deg,#4f46e5,#6366f1)",
    color: "#fff",
    padding: "6px 14px",
    borderRadius: 20,
    fontSize: 12,
    fontWeight: 700,
  },
  dailyPillDots: { display: "flex", gap: 3 },
  dailyMiniDot: { width: 6, height: 6, borderRadius: "50%" },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    border: "1px solid #e5e7eb",
    background: "#fff",
    fontSize: 18,
    fontWeight: 700,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#6366f1",
    transition: "all 0.2s",
  },
  alertBar: {
    background: "#fef3c7",
    border: "1px solid #fde68a",
    borderRadius: 12,
    padding: "10px 16px",
    color: "#92400e",
    fontSize: 13,
    fontWeight: 600,
  },

  // Tabs
  tabBar: { background: "#f9fafb", borderRadius: 16, padding: 4, border: "1px solid #f3f4f6" },
  tabInner: { display: "flex", gap: 4 },
  tab: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: "10px 16px",
    borderRadius: 12,
    border: "none",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 600,
    transition: "all 0.2s",
    whiteSpace: "nowrap",
  },
  tabOn: {
    background: "#fff",
    color: "#4f46e5",
    boxShadow: "0 2px 12px rgba(79,70,229,0.1)",
  },
  tabOff: { background: "transparent", color: "#6b7280" },
  tabCount: {
    fontSize: 10,
    fontWeight: 800,
    padding: "1px 7px",
    borderRadius: 20,
  },

  // Loading
  loaderWrap: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "80px 20px",
    background: "#fff",
    borderRadius: 24,
    border: "1px solid #f3f4f6",
  },
  loaderRing: {
    width: 48,
    height: 48,
    borderRadius: "50%",
    border: "3px solid #ede9fe",
    borderTopColor: "#6366f1",
    animation: "spin 0.9s linear infinite",
    position: "relative",
  },
  loaderDot: {
    position: "absolute",
    top: -3,
    left: "50%",
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: "#6366f1",
    transform: "translateX(-50%)",
  },
  loaderText: { color: "#9ca3af", marginTop: 16, fontSize: 14 },

  // Error
  errorWrap: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "60px 20px",
    background: "#fff",
    borderRadius: 24,
    border: "1px solid #fee2e2",
    textAlign: "center",
  },
  errorIcon: {
    width: 56,
    height: 56,
    borderRadius: "50%",
    background: "#fef2f2",
    color: "#dc2626",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 24,
    fontWeight: 800,
    marginBottom: 16,
  },
  errorTitle: { fontWeight: 700, color: "#1f2937", margin: "0 0 6px", fontSize: 18 },
  errorDesc: { color: "#6b7280", fontSize: 14, margin: 0 },
  errorBtn: {
    marginTop: 20,
    padding: "10px 24px",
    background: "#6366f1",
    color: "#fff",
    border: "none",
    borderRadius: 12,
    fontWeight: 700,
    cursor: "pointer",
    fontSize: 14,
  },

  // Stat cards
  cardGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))",
    gap: 16,
  },
  statCard: {
    borderRadius: 20,
    padding: 24,
    background: "#fff",
    border: "1px solid #f3f4f6",
    transition: "all 0.35s cubic-bezier(0.4,0,0.2,1)",
    cursor: "default",
    position: "relative",
    overflow: "hidden",
  },
  statCardPrimary: {
    background: "linear-gradient(135deg,#4f46e5,#7c3aed)",
    border: "none",
  },
  statTop: { display: "flex", alignItems: "center", gap: 10, marginBottom: 16 },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 18,
  },
  statLabel: { fontSize: 13, fontWeight: 600 },
  statValue: { fontSize: 26, fontWeight: 800, letterSpacing: -0.5 },
  statDesc: { fontSize: 12, marginTop: 6, fontWeight: 500 },
  statCta: {
    marginTop: 16,
    padding: "8px 16px",
    background: "rgba(255,255,255,0.2)",
    backdropFilter: "blur(8px)",
    border: "1px solid rgba(255,255,255,0.3)",
    borderRadius: 10,
    color: "#fff",
    fontWeight: 700,
    fontSize: 13,
    cursor: "pointer",
  },

  // Daily tracker
  trackerCard: {
    background: "#fff",
    borderRadius: 20,
    padding: 24,
    border: "1px solid #f3f4f6",
  },
  trackerHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  trackerTitle: { fontWeight: 700, fontSize: 15, margin: 0, color: "#1e1b4b" },
  trackerSub: { fontSize: 12, color: "#9ca3af", margin: "4px 0 0" },
  trackerPercent: {
    fontSize: 22,
    fontWeight: 800,
    color: "#6366f1",
  },
  trackerBar: {
    height: 8,
    background: "#f3f4f6",
    borderRadius: 100,
    overflow: "hidden",
    marginBottom: 12,
  },
  trackerFill: {
    height: "100%",
    borderRadius: 100,
    transition: "width 0.5s, background 0.5s",
  },
  trackerChips: { display: "flex", gap: 8, flexWrap: "wrap" },
  chip: {
    background: "#fef3c7",
    color: "#92400e",
    padding: "4px 12px",
    borderRadius: 20,
    fontSize: 11,
    fontWeight: 700,
  },

  // Virtual account
  vaWrap: {
    background: "#fff",
    borderRadius: 20,
    border: "1px solid #e5e7eb",
    overflow: "hidden",
  },
  vaTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: "24px 24px 0",
  },
  vaH3: { fontSize: 16, fontWeight: 700, margin: 0, color: "#1e1b4b" },
  vaSub: { color: "#9ca3af", fontSize: 13, margin: "4px 0 0" },
  liveTag: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    background: "#ecfdf5",
    color: "#059669",
    padding: "4px 12px",
    borderRadius: 20,
    fontSize: 12,
    fontWeight: 700,
  },
  livePulse: {
    width: 7,
    height: 7,
    borderRadius: "50%",
    background: "#10b981",
    animation: "pulse 2s infinite",
  },
  vaContent: {
    padding: 24,
    display: "flex",
    flexDirection: "column",
    gap: 20,
  },
  vaSmall: {
    fontSize: 10,
    fontWeight: 700,
    color: "#9ca3af",
    textTransform: "uppercase",
    letterSpacing: 1,
    margin: "0 0 6px",
  },
  vaNumRow: { display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" },
  vaNum: {
    fontWeight: 800,
    fontSize: 28,
    color: "#4f46e5",
    fontFamily: '"JetBrains Mono",monospace',
    letterSpacing: 3,
  },
  copyChip: {
    padding: "6px 14px",
    border: "none",
    borderRadius: 8,
    fontWeight: 700,
    fontSize: 12,
    cursor: "pointer",
    transition: "all 0.2s",
  },
  vaRow: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 },
  vaDetail: { fontWeight: 700, fontSize: 15, color: "#1e1b4b", margin: 0 },
  vaTip: {
    padding: "14px 24px",
    background: "#f5f3ff",
    borderTop: "1px solid #ede9fe",
    color: "#5b21b6",
    fontSize: 13,
    fontWeight: 500,
  },

  // No VA
  noVaWrap: {
    background: "#fff",
    borderRadius: 20,
    border: "2px dashed #e5e7eb",
    padding: "48px 24px",
    textAlign: "center",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  noVaCircle: {
    width: 72,
    height: 72,
    borderRadius: "50%",
    background: "#f5f3ff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 32,
    marginBottom: 16,
  },
  noVaH3: { fontWeight: 700, fontSize: 18, color: "#1e1b4b", margin: "0 0 8px" },
  noVaSub: { color: "#9ca3af", fontSize: 14, maxWidth: 360, lineHeight: 1.6, margin: "0 0 24px" },
  timeline: { display: "flex", alignItems: "flex-start", gap: 0 },
  tlStep: { display: "flex", flexDirection: "column", alignItems: "center", position: "relative" },
  tlDot: {
    width: 32,
    height: 32,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 12,
    fontWeight: 800,
    zIndex: 1,
  },
  tlLabel: { fontSize: 11, fontWeight: 700, marginTop: 6 },
  tlLine: { position: "absolute", top: 16, left: 32, width: 48, height: 2 },

  // Panel
  panel: {
    background: "#fff",
    borderRadius: 20,
    border: "1px solid #f3f4f6",
    padding: 24,
  },
  panelHead: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  panelH3: { fontSize: 16, fontWeight: 700, color: "#1e1b4b", margin: 0 },
  panelSub: { color: "#9ca3af", fontSize: 13, margin: "4px 0 20px" },
  linkBtn: {
    background: "none",
    border: "none",
    color: "#6366f1",
    fontWeight: 700,
    fontSize: 13,
    cursor: "pointer",
  },

  // Filter
  filterRow: { display: "flex", gap: 8, flexWrap: "wrap" },
  filterChip: {
    padding: "8px 16px",
    borderRadius: 12,
    border: "1px solid #e5e7eb",
    background: "#fff",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 600,
    color: "#6b7280",
    transition: "all 0.15s",
  },
  filterOn: {
    background: "#4f46e5",
    color: "#fff",
    borderColor: "#4f46e5",
  },

  // Row
  row: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    padding: "14px 16px",
    background: "#fafafa",
    borderRadius: 14,
    transition: "background 0.15s",
  },
  rowIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 16,
    fontWeight: 800,
    flexShrink: 0,
  },
  rowBody: { flex: 1, minWidth: 0 },
  rowTitle: {
    fontWeight: 600,
    color: "#1e1b4b",
    margin: 0,
    fontSize: 14,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  rowMeta: { color: "#9ca3af", fontSize: 12, margin: "3px 0 0" },
  rowRef: { fontFamily: "monospace", fontSize: 11 },
  rowRight: { textAlign: "right", flexShrink: 0 },
  rowAmt: { fontWeight: 800, fontSize: 14, display: "block" },
  rowFee: { fontSize: 11, color: "#d97706", display: "block", marginTop: 2 },
  statusPill: {
    display: "inline-block",
    fontSize: 10,
    fontWeight: 800,
    padding: "2px 8px",
    borderRadius: 20,
    marginTop: 4,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  listCol: { display: "flex", flexDirection: "column", gap: 8 },

  // Withdraw grid
  wdGrid: {
    display: "grid",
    gridTemplateColumns: "1.3fr 0.7fr",
    gap: 20,
    alignItems: "start",
  },
  wdHeader: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 2,
  },
  lightningBadge: {
    background: "linear-gradient(135deg,#fbbf24,#f59e0b)",
    color: "#78350f",
    padding: "3px 10px",
    borderRadius: 20,
    fontSize: 11,
    fontWeight: 800,
  },
  exhaustedBar: {
    background: "#fef2f2",
    border: "1px solid #fca5a5",
    borderRadius: 14,
    padding: "12px 16px",
    color: "#991b1b",
    fontSize: 13,
    fontWeight: 600,
    marginBottom: 16,
  },

  // Bank
  bankStrip: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    background: "linear-gradient(135deg,#1e1b4b,#312e81)",
    borderRadius: 16,
    padding: "18px 20px",
    marginBottom: 24,
  },
  bankLeft: { display: "flex", alignItems: "center", gap: 14 },
  bankAvatar: {
    width: 44,
    height: 44,
    borderRadius: 12,
    background: "rgba(255,255,255,0.12)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 20,
  },
  bankTitle: { fontWeight: 700, fontSize: 14, margin: 0, color: "#fff" },
  bankSub: {
    fontFamily: "monospace",
    fontSize: 12,
    margin: "3px 0 0",
    color: "rgba(255,255,255,0.6)",
  },
  bankChip: {
    width: 36,
    height: 36,
    borderRadius: 10,
    background: "rgba(251,191,36,0.2)",
    color: "#fbbf24",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 16,
  },

  // Amount input
  fieldGroup: { marginBottom: 16 },
  fieldLabel: {
    fontSize: 12,
    fontWeight: 700,
    color: "#4b5563",
    display: "block",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  inputWrap: { position: "relative" },
  inputCurrency: {
    position: "absolute",
    left: 18,
    top: "50%",
    transform: "translateY(-50%)",
    fontWeight: 800,
    color: "#4f46e5",
    fontSize: 18,
  },
  bigInput: {
    width: "100%",
    padding: "18px 18px 18px 40px",
    border: "2px solid #ddd6fe",
    borderRadius: 16,
    fontSize: 22,
    fontWeight: 800,
    outline: "none",
    boxSizing: "border-box",
    background: "#faf5ff",
    color: "#1e1b4b",
    transition: "border-color 0.2s",
  },

  // Progress
  pctWrap: { marginTop: 10 },
  pctTrack: { height: 5, background: "#f3f4f6", borderRadius: 100, overflow: "hidden" },
  pctBar: { height: "100%", borderRadius: 100, transition: "width 0.4s,background 0.4s" },
  pctLabels: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: 11,
    color: "#9ca3af",
    fontWeight: 600,
    marginTop: 6,
  },

  // Fee box
  feeBox: {
    background: "#faf5ff",
    border: "1px solid #e9d5ff",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    transition: "border-color 0.2s",
  },
  feeLoading: { textAlign: "center", color: "#9ca3af", fontSize: 13, margin: 0 },
  feeTitle: { fontWeight: 700, fontSize: 14, color: "#5b21b6", margin: "0 0 12px" },
  feeList: { display: "flex", flexDirection: "column", gap: 8 },
  feeRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontSize: 13,
    color: "#4b5563",
  },
  feeLine: { height: 1, background: "#e9d5ff", margin: "4px 0" },
  feeAlert: {
    marginTop: 12,
    background: "#fef2f2",
    borderRadius: 10,
    padding: "8px 12px",
    color: "#dc2626",
    fontSize: 12,
    fontWeight: 600,
    textAlign: "center",
  },

  // Quick amounts
  quickWrap: {
    display: "grid",
    gridTemplateColumns: "repeat(3,1fr)",
    gap: 8,
    marginBottom: 16,
  },
  quickChip: {
    padding: "10px 8px",
    borderRadius: 12,
    border: "1.5px solid #e5e7eb",
    background: "#fff",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 700,
    color: "#374151",
    transition: "all 0.15s",
    textAlign: "center",
  },
  quickOn: {
    background: "#4f46e5",
    color: "#fff",
    borderColor: "#4f46e5",
  },
  quickAll: {
    background: "linear-gradient(135deg,#4f46e5,#7c3aed)",
    color: "#fff",
    border: "none",
  },

  // Message
  msgBar: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "12px 16px",
    borderRadius: 14,
    fontSize: 13,
    fontWeight: 600,
    marginBottom: 16,
    border: "1px solid",
  },

  // Submit
  submitBtn: {
    width: "100%",
    padding: "16px 24px",
    background: "linear-gradient(135deg,#4f46e5,#7c3aed)",
    color: "#fff",
    border: "none",
    borderRadius: 16,
    fontWeight: 800,
    fontSize: 16,
    transition: "all 0.25s",
    letterSpacing: 0.3,
  },
  btnSpinWrap: { display: "flex", alignItems: "center", justifyContent: "center", gap: 10 },
  btnSpin: {
    width: 20,
    height: 20,
    border: "3px solid rgba(255,255,255,0.3)",
    borderTopColor: "#fff",
    borderRadius: "50%",
    animation: "spin 0.7s linear infinite",
  },
  footNote: {
    color: "#9ca3af",
    fontSize: 12,
    textAlign: "center",
    marginTop: 12,
    lineHeight: 1.6,
  },

  // Rules
  rulesBox: {
    background: "#faf5ff",
    borderRadius: 16,
    padding: 24,
    border: "1px solid #ede9fe",
  },
  rulesTitle: { fontWeight: 700, fontSize: 14, color: "#5b21b6", margin: "0 0 16px" },
  ruleRow: { display: "flex", alignItems: "center", gap: 10, marginBottom: 10 },
  ruleDot: { width: 8, height: 8, borderRadius: "50%", flexShrink: 0 },
  ruleText: { fontSize: 13, color: "#4b5563", lineHeight: 1.4 },

  // Empty
  emptyWrap: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "48px 24px",
    gap: 8,
  },
  emptyTitle: { fontWeight: 700, color: "#374151", margin: 0, fontSize: 16 },
  emptyDesc: { color: "#9ca3af", fontSize: 13, margin: 0 },
};

// ── Inject keyframes + responsive ─────────────────────────────
if (typeof document !== "undefined") {
  const id = "payouts-v2-styles";
  if (!document.getElementById(id)) {
    const el = document.createElement("style");
    el.id = id;
    el.textContent = `
      @keyframes spin { to { transform: rotate(360deg); } }
      @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
      @media (max-width: 768px) {
        .withdraw-grid {
          grid-template-columns: 1fr !important;
        }
      }
      @media (max-width: 480px) {
        .withdraw-grid input[type="number"] {
          font-size: 18px !important;
        }
      }
    `;
    document.head.appendChild(el);
  }
}