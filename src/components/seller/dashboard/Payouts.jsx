// components/seller/dashboard/Payouts.jsx
import { useState, useEffect } from "react";
import axios from "axios";
import { formatNGN } from "./Shared";

const api = () => {
  const token = localStorage.getItem("token");
  return axios.create({
    headers: { Authorization: `Bearer ${token}` },
  });
};

export const Payouts = ({ vendor }) => {
  const [wallet,      setWallet]      = useState(null);
  const [transactions,setTransactions]= useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [withdrawAmt, setWithdrawAmt] = useState("");
  const [withdrawing, setWithdrawing] = useState(false);
  const [msg,         setMsg]         = useState({ type: "", text: "" });

  // ── Fetch wallet ────────────────────────────────────────────
  useEffect(() => {
    const fetchWallet = async () => {
      try {
        const { data } = await api().get("/api/seller-wallet/balance");
        setWallet(data);
      } catch (err) {
        console.error("[Payouts]", err.message);
      } finally {
        setLoading(false);
      }
    };

    const fetchHistory = async () => {
      try {
        const [txRes, wdRes] = await Promise.all([
          api().get("/api/seller-wallet/transactions?limit=10"),
          api().get("/api/seller-wallet/withdrawals?limit=5"),
        ]);
        setTransactions(txRes.data.transactions ?? []);
        setWithdrawals(wdRes.data.withdrawals   ?? []);
      } catch {}
    };

    fetchWallet();
    fetchHistory();
  }, []);

  // ── Request withdrawal ──────────────────────────────────────
  const handleWithdraw = async () => {
    const amount = Number(withdrawAmt);
    if (!amount || amount < 500) {
      setMsg({ type: "error", text: "Minimum withdrawal is ₦500" });
      return;
    }

    const available = Number(wallet?.balance?.available ?? 0);
    if (amount > available) {
      setMsg({ type: "error", text: `Insufficient balance. Available: ${formatNGN(available)}` });
      return;
    }

    setWithdrawing(true);
    setMsg({ type: "", text: "" });

    try {
      const { data } = await api().post("/api/seller-wallet/withdraw", { amount });
      setMsg({ type: "success", text: `✅ ${data.message}` });
      setWithdrawAmt("");

      // Refresh wallet
      const { data: refreshed } = await api().get("/api/seller-wallet/balance");
      setWallet(refreshed);
    } catch (err) {
      setMsg({
        type: "error",
        text: err.response?.data?.message ?? "Withdrawal failed",
      });
    } finally {
      setWithdrawing(false);
    }
  };

  if (loading) {
    return (
      <div className="sd-card" style={{ textAlign: "center", padding: "3rem" }}>
        <div style={{ color: "#9ca3af" }}>Loading wallet...</div>
      </div>
    );
  }

  const balance        = wallet?.balance;
  const virtualAccount = wallet?.virtual_account;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

      {/* ── Balance cards ─────────────────────────────────── */}
      <div style={s.balanceGrid}>
        <BalanceCard
          label="Available Balance"
          value={balance?.available ?? 0}
          color="#10b981"
          icon="💰"
          primary
        />
        <BalanceCard
          label="Pending"
          value={balance?.pending ?? 0}
          color="#f59e0b"
          icon="⏳"
        />
        <BalanceCard
          label="Total Received"
          value={balance?.total_received ?? 0}
          color="#6366f1"
          icon="📥"
        />
        <BalanceCard
          label="Total Withdrawn"
          value={balance?.total_withdrawn ?? 0}
          color="#6b7280"
          icon="📤"
        />
      </div>

      {/* ── Virtual account ───────────────────────────────── */}
      {virtualAccount ? (
        <div className="sd-card">
          <h3 className="sd-card-title">🏦 Your Virtual Account</h3>
          <p style={{ color: "#6b7280", fontSize: "0.875rem", marginBottom: "1rem" }}>
            Share this account number to receive payments from buyers
          </p>
          <div style={s.vaBox}>
            <div style={s.vaRow}>
              <span style={s.vaLabel}>Account Number</span>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span style={s.vaNumber}>{virtualAccount.account_number}</span>
                <button
                  style={s.copyBtn}
                  onClick={() => {
                    navigator.clipboard.writeText(virtualAccount.account_number);
                    alert("Account number copied!");
                  }}
                >
                  📋 Copy
                </button>
              </div>
            </div>
            <div style={s.vaRow}>
              <span style={s.vaLabel}>Account Name</span>
              <span style={s.vaValue}>{virtualAccount.account_name}</span>
            </div>
            <div style={s.vaRow}>
              <span style={s.vaLabel}>Bank</span>
              <span style={s.vaValue}>{virtualAccount.bank_name}</span>
            </div>
          </div>

          <div style={s.vaNote}>
            💡 Buyers pay directly to this account. Funds are
            credited to your wallet automatically.
          </div>
        </div>
      ) : (
        <div className="sd-card">
          <div style={s.noVa}>
            <span style={{ fontSize: "2rem" }}>🏦</span>
            <p style={{ fontWeight: 600, color: "#374151" }}>
              No Virtual Account Yet
            </p>
            <p style={{ color: "#9ca3af", fontSize: "0.875rem" }}>
              Your virtual account will be created automatically once
              your store is approved and activated by admin.
            </p>
          </div>
        </div>
      )}

      {/* ── Withdrawal ────────────────────────────────────── */}
      <div className="sd-card">
        <h3 className="sd-card-title">💸 Request Withdrawal</h3>
        <p style={{ color: "#6b7280", fontSize: "0.875rem", marginBottom: "1.25rem" }}>
          Withdraw to your registered bank account
        </p>

        {/* Payout bank info */}
        <div style={s.bankBox}>
          <div style={s.bankRow}>
            <span style={s.bankLabel}>Bank</span>
            <span style={s.bankValue}>{vendor?.bank_name ?? "—"}</span>
          </div>
          <div style={s.bankRow}>
            <span style={s.bankLabel}>Account</span>
            <span style={s.bankValue}>
              {"•".repeat(6) + (vendor?.bank_account?.slice(-4) ?? "——")}
            </span>
          </div>
          <div style={s.bankRow}>
            <span style={s.bankLabel}>Name</span>
            <span style={s.bankValue}>{vendor?.account_name ?? "—"}</span>
          </div>
        </div>

        {/* Amount input */}
        <div style={{ position: "relative", marginTop: "1rem" }}>
          <span style={s.currencyPrefix}>₦</span>
          <input
            type="number"
            placeholder="Enter amount (min ₦500)"
            value={withdrawAmt}
            onChange={(e) => setWithdrawAmt(e.target.value)}
            style={s.withdrawInput}
          />
        </div>

        {/* Quick amounts */}
        <div style={s.quickAmounts}>
          {[1000, 5000, 10000, 50000].map((amt) => (
            <button
              key={amt}
              style={{
                ...s.quickAmtBtn,
                background: withdrawAmt == amt ? "#6366f1" : "#f8fafc",
                color:      withdrawAmt == amt ? "white"   : "#374151",
                borderColor:withdrawAmt == amt ? "#6366f1" : "#e5e7eb",
              }}
              onClick={() => setWithdrawAmt(String(amt))}
            >
              {formatNGN(amt, 0)}
            </button>
          ))}
          <button
            style={{ ...s.quickAmtBtn, background: "#f8fafc", color: "#6366f1", borderColor: "#6366f1" }}
            onClick={() => setWithdrawAmt(String(balance?.available ?? 0))}
          >
            All
          </button>
        </div>

        {/* Message */}
        {msg.text && (
          <div style={{
            padding:      "0.75rem 1rem",
            borderRadius: "10px",
            fontSize:     "0.875rem",
            marginTop:    "1rem",
            background:   msg.type === "error" ? "#fef2f2" : "#ecfdf5",
            color:        msg.type === "error" ? "#991b1b" : "#065f46",
            border:       `1px solid ${msg.type === "error" ? "#fecaca" : "#a7f3d0"}`,
          }}>
            {msg.text}
          </div>
        )}

        <button
          style={{
            ...s.withdrawBtn,
            opacity: withdrawing || !withdrawAmt ? 0.6 : 1,
          }}
          disabled={withdrawing || !withdrawAmt}
          onClick={handleWithdraw}
        >
          {withdrawing ? "Processing..." : "💸 Request Withdrawal"}
        </button>

        <p style={s.withdrawNote}>
          ⏱ Processed within 1–3 business days · Minimum ₦500
        </p>
      </div>

      {/* ── Transaction history ───────────────────────────── */}
      {transactions.length > 0 && (
        <div className="sd-card">
          <h3 className="sd-card-title">📊 Transaction History</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {transactions.map((tx) => (
              <TxRow key={tx.id} tx={tx} />
            ))}
          </div>
        </div>
      )}

      {/* ── Withdrawal history ────────────────────────────── */}
      {withdrawals.length > 0 && (
        <div className="sd-card">
          <h3 className="sd-card-title">📤 Withdrawal History</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {withdrawals.map((wd) => (
              <WdRow key={wd.id} wd={wd} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ── Balance card ──────────────────────────────────────────────
const BalanceCard = ({ label, value, color, icon, primary }) => (
  <div style={{
    background:   primary
      ? `linear-gradient(135deg, ${color}, ${color}cc)`
      : "white",
    borderRadius: "16px",
    padding:      "1.25rem",
    border:       primary ? "none" : `1px solid #f3f4f6`,
    boxShadow:    primary ? `0 4px 20px ${color}30` : "0 1px 3px rgba(0,0,0,0.04)",
  }}>
  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
    <span style={{ fontSize: "1.25rem" }}>{icon}</span>
    <span style={{ fontSize: "0.8rem", fontWeight: 500, color: primary ? "rgba(255,255,255,0.85)" : "#9ca3af" }}>
      {label}
    </span>
  </div>
  <div style={{ fontSize: "1.5rem", fontWeight: 800, color: primary ? "white" : color }}>
    {formatNGN(value)}
  </div>
</div>
);

// ── Transaction row ───────────────────────────────────────────
const TxRow = ({ tx }) => (
  <div style={{
    display:       "flex",
    alignItems:    "center",
    gap:           "0.75rem",
    padding:       "0.75rem",
    background:    "#f8fafc",
    borderRadius:  "10px",
  }}>
    <span style={{
      fontSize:   "1.25rem",
      width:      "36px",
      height:     "36px",
      display:    "flex",
      alignItems: "center",
      justifyContent: "center",
      borderRadius: "8px",
      background: tx.type === "credit" ? "#ecfdf5" : "#fef2f2",
    }}>
      {tx.type === "credit" ? "📥" : "📤"}
    </span>
    <div style={{ flex: 1 }}>
      <p style={{ fontWeight: 600, color: "#1f2937", margin: 0, fontSize: "0.875rem" }}>
        {tx.narration ?? tx.type}
      </p>
      <p style={{ color: "#9ca3af", margin: 0, fontSize: "0.75rem" }}>
        {new Date(tx.created_at).toLocaleDateString("en-NG")}
      </p>
    </div>
    <span style={{
      fontWeight: 800,
      fontSize:   "0.9rem",
      color:      tx.type === "credit" ? "#10b981" : "#ef4444",
    }}>
      {tx.type === "credit" ? "+" : "-"}{formatNGN(tx.amount)}
    </span>
  </div>
);

// ── Withdrawal row ────────────────────────────────────────────
const STATUS_COLORS = {
  success:    { color: "#10b981", bg: "#ecfdf5" },
  pending:    { color: "#f59e0b", bg: "#fffbeb" },
  processing: { color: "#3b82f6", bg: "#eff6ff" },
  failed:     { color: "#ef4444", bg: "#fef2f2" },
};

const WdRow = ({ wd }) => {
  const sc = STATUS_COLORS[wd.status] ?? STATUS_COLORS.pending;
  return (
    <div style={{
      display:        "flex",
      alignItems:     "center",
      gap:            "0.75rem",
      padding:        "0.75rem",
      background:     "#f8fafc",
      borderRadius:   "10px",
    }}>
      <span style={{
        fontSize:       "1.1rem",
        width:          "36px",
        height:         "36px",
        display:        "flex",
        alignItems:     "center",
        justifyContent: "center",
        borderRadius:   "8px",
        background:     "#fef2f2",
      }}>
        💸
      </span>
      <div style={{ flex: 1 }}>
        <p style={{ fontWeight: 600, color: "#1f2937", margin: 0, fontSize: "0.875rem" }}>
          Withdrawal to {wd.bank_name}
        </p>
        <p style={{ color: "#9ca3af", margin: 0, fontSize: "0.75rem" }}>
          {new Date(wd.created_at).toLocaleDateString("en-NG")}
        </p>
      </div>
      <div style={{ textAlign: "right" }}>
        <p style={{ fontWeight: 800, color: "#ef4444", margin: 0, fontSize: "0.9rem" }}>
          -{formatNGN(wd.amount)}
        </p>
        <span style={{
          fontSize:     "0.7rem",
          fontWeight:   700,
          color:        sc.color,
          background:   sc.bg,
          padding:      "0.1rem 0.45rem",
          borderRadius: "100px",
        }}>
          {wd.status}
        </span>
      </div>
    </div>
  );
};

// ── Styles ────────────────────────────────────────────────────
const s = {
  balanceGrid: {
    display:               "grid",
    gridTemplateColumns:   "repeat(auto-fill, minmax(200px, 1fr))",
    gap:                   "1rem",
  },
  vaBox: {
    background:   "#f8fafc",
    borderRadius: "12px",
    padding:      "1rem",
    border:       "1px solid #e5e7eb",
    display:      "flex",
    flexDirection:"column",
    gap:          "0.75rem",
  },
  vaRow: {
    display:        "flex",
    justifyContent: "space-between",
    alignItems:     "center",
  },
  vaLabel:  { color: "#6b7280", fontSize: "0.85rem", fontWeight: 500 },
  vaValue:  { fontWeight: 600, color: "#1f2937",  fontSize: "0.875rem" },
  vaNumber: { fontWeight: 800, color: "#6366f1",  fontSize: "1.1rem",  fontFamily: "monospace", letterSpacing: "0.08em" },
  copyBtn:  { padding: "0.25rem 0.75rem", background: "#eef2ff", color: "#6366f1", border: "none", borderRadius: "6px", fontWeight: 600, fontSize: "0.78rem", cursor: "pointer" },
  vaNote:   { background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: "10px", padding: "0.75rem 1rem", color: "#1e40af", fontSize: "0.82rem", marginTop: "1rem" },
  noVa:     { textAlign: "center", padding: "2rem", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem" },

  bankBox: {
    background:   "#f8fafc",
    borderRadius: "12px",
    padding:      "1rem",
    border:       "1px solid #e5e7eb",
    display:      "flex",
    flexDirection:"column",
    gap:          "0.5rem",
  },
  bankRow:   { display: "flex", justifyContent: "space-between", alignItems: "center" },
  bankLabel: { color: "#6b7280", fontSize: "0.82rem", fontWeight: 500 },
  bankValue: { fontWeight: 600, color: "#1f2937", fontSize: "0.875rem" },

  currencyPrefix: {
    position:   "absolute",
    left:       "1rem",
    top:        "50%",
    transform:  "translateY(-50%)",
    fontWeight: 700,
    color:      "#374151",
    fontSize:   "1rem",
  },
  withdrawInput: {
    width:        "100%",
    padding:      "0.875rem 1rem 0.875rem 2rem",
    border:       "2px solid #e5e7eb",
    borderRadius: "12px",
    fontSize:     "1.1rem",
    fontWeight:   600,
    outline:      "none",
    boxSizing:    "border-box",
  },
  quickAmounts: {
    display:   "flex",
    gap:       "0.5rem",
    marginTop: "0.75rem",
    flexWrap:  "wrap",
  },
  quickAmtBtn: {
    padding:      "0.4rem 0.875rem",
    borderRadius: "100px",
    border:       "1px solid",
    cursor:       "pointer",
    fontSize:     "0.82rem",
    fontWeight:   600,
    transition:   "all 0.15s",
  },
  withdrawBtn: {
    width:         "100%",
    padding:       "1rem",
    marginTop:     "1rem",
    background:    "linear-gradient(135deg, #10b981, #059669)",
    color:         "white",
    border:        "none",
    borderRadius:  "14px",
    fontWeight:    700,
    fontSize:      "1rem",
    cursor:        "pointer",
  },
  withdrawNote: {
    color:      "#9ca3af",
    fontSize:   "0.8rem",
    textAlign:  "center",
    marginTop:  "0.75rem",
  },
};