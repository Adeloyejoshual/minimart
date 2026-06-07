import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Wallet, ArrowDownToLine, Clock, CheckCircle,
  XCircle, AlertCircle, RefreshCw, ChevronLeft,
  ChevronRight, Copy, Eye, X, TrendingUp,
  Banknote, Info, ShieldCheck, Gift,
} from "lucide-react";
import api from "../../utils/api";
import toast from "react-hot-toast";

// ─── fee utility (mirrors server) ────────────────────────────────────────────

const calculateWithdrawalFee = (amount, withdrawalsToday) => {
  if (withdrawalsToday < 3) return 0;
  if (amount <= 9_999)      return 50;
  if (amount <= 99_999)     return 100;
  if (amount <= 500_000)    return 150;
  return 200;
};

const FEE_TIERS = [
  { range: "₦0 – ₦9,999",         fee: "₦50"  },
  { range: "₦10,000 – ₦99,999",   fee: "₦100" },
  { range: "₦100,000 – ₦500,000", fee: "₦150" },
  { range: "Above ₦500,000",       fee: "₦200" },
];

// ─── formatting ───────────────────────────────────────────────────────────────

const fmt = (n) =>
  `₦${Number(n ?? 0).toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const fmtDate = (d) =>
  d
    ? new Date(d).toLocaleString("en-NG", {
        day: "2-digit", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit",
      })
    : "—";

const copyText = (t) =>
  navigator.clipboard.writeText(t).then(() => toast.success("Copied!"));

// ─── status config ────────────────────────────────────────────────────────────

const STATUS_META = {
  pending:    { label: "Pending",    chip: "bg-amber-100 text-amber-700 border-amber-200",  icon: <Clock size={11} /> },
  processing: { label: "Processing", chip: "bg-blue-100 text-blue-700 border-blue-200",     icon: <RefreshCw size={11} className="animate-spin" /> },
  success:    { label: "Success",    chip: "bg-green-100 text-green-700 border-green-200",  icon: <CheckCircle size={11} /> },
  failed:     { label: "Failed",     chip: "bg-red-100 text-red-700 border-red-200",        icon: <XCircle size={11} /> },
  cancelled:  { label: "Cancelled",  chip: "bg-gray-100 text-gray-500 border-gray-200",     icon: <X size={11} /> },
};

const StatusBadge = ({ status }) => {
  const m = STATUS_META[status] ?? { label: status, chip: "bg-gray-100 text-gray-500 border-gray-200", icon: null };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full
                      text-xs font-medium border ${m.chip}`}>
      {m.icon}{m.label}
    </span>
  );
};

// ─── StatCard ─────────────────────────────────────────────────────────────────

const CARD_COLORS = {
  blue:   "bg-blue-50   border-blue-100   text-blue-700",
  green:  "bg-green-50  border-green-100  text-green-700",
  amber:  "bg-amber-50  border-amber-100  text-amber-700",
  purple: "bg-purple-50 border-purple-100 text-purple-700",
};

const StatCard = ({ icon, label, value, sub, color = "blue" }) => (
  <div className={`rounded-2xl border p-4 flex items-start gap-3 ${CARD_COLORS[color]}`}>
    <div className="p-2 rounded-xl bg-white/70 shrink-0">{icon}</div>
    <div className="min-w-0">
      <p className="text-xs font-medium opacity-70 mb-0.5">{label}</p>
      <p className="text-lg font-bold truncate">{value}</p>
      {sub && <p className="text-xs opacity-60 mt-0.5">{sub}</p>}
    </div>
  </div>
);

// ─── Fee Schedule Table ───────────────────────────────────────────────────────

const FeeScheduleTable = ({ freeRemaining, withdrawalsToday }) => (
  <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
    <div className="px-4 py-3 border-b bg-gray-50 flex items-center gap-2">
      <Info size={14} className="text-gray-500" />
      <h3 className="text-sm font-semibold text-gray-700">Withdrawal Fee Schedule</h3>
    </div>

    {/* free withdrawals banner */}
    <div className={`px-4 py-3 flex items-center gap-3 border-b ${
      freeRemaining > 0
        ? "bg-green-50 border-green-100"
        : "bg-gray-50 border-gray-200"
    }`}>
      <Gift size={18} className={freeRemaining > 0 ? "text-green-600" : "text-gray-400"} />
      <div>
        {freeRemaining > 0 ? (
          <>
            <p className="text-sm font-semibold text-green-700">
              {freeRemaining} free withdrawal{freeRemaining > 1 ? "s" : ""} remaining today
            </p>
            <p className="text-xs text-green-600">
              First 3 withdrawals each day are always free
            </p>
          </>
        ) : (
          <>
            <p className="text-sm font-semibold text-gray-600">
              Free withdrawals used for today
            </p>
            <p className="text-xs text-gray-400">
              Fee tiers below apply to withdrawal #{withdrawalsToday + 1}+
            </p>
          </>
        )}
      </div>
    </div>

    {/* fee tiers */}
    <div className="divide-y divide-gray-100">
      {FEE_TIERS.map(({ range, fee }) => (
        <div key={range} className="flex justify-between items-center px-4 py-2.5 text-sm">
          <span className="text-gray-600">{range}</span>
          <span className={`font-semibold ${
            freeRemaining > 0 ? "text-gray-300 line-through" : "text-gray-900"
          }`}>
            {fee}
          </span>
        </div>
      ))}
    </div>
  </div>
);

// ══════════════════════════════════════════════════════════════════════════════
// WithdrawModal
// ══════════════════════════════════════════════════════════════════════════════

const WithdrawModal = ({ info, onClose, onSuccess }) => {
  const [amount,  setAmount]  = useState("");
  const [loading, setLoading] = useState(false);
  const [showFees, setShowFees] = useState(false);

  const { wallet, bank, limits } = info;
  const parsedAmount = parseFloat(amount) || 0;

  const preview = useMemo(() => {
    if (!parsedAmount || parsedAmount <= 0) return null;
    const fee = calculateWithdrawalFee(parsedAmount, limits.withdrawals_today);
    return {
      amount: parsedAmount,
      fee,
      net: parseFloat((parsedAmount - fee).toFixed(2)),
      isFree: fee === 0,
    };
  }, [parsedAmount, limits.withdrawals_today]);

  const maxAllowed = Math.min(
    wallet.available_balance,
    limits.daily_remaining,
    limits.max_withdrawal
  );

  const setQuick = (pct) => {
    const val = parseFloat(((wallet.available_balance * pct) / 100).toFixed(2));
    setAmount(String(Math.min(val, maxAllowed)));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!parsedAmount || parsedAmount < limits.min_withdrawal) {
      return toast.error(`Minimum withdrawal is ${fmt(limits.min_withdrawal)}`);
    }
    if (parsedAmount > wallet.available_balance) {
      return toast.error("Insufficient balance");
    }
    if (parsedAmount > limits.daily_remaining) {
      return toast.error(`Daily limit exceeded. Remaining: ${fmt(limits.daily_remaining)}`);
    }

    setLoading(true);
    try {
      const { data } = await api.post("/seller/payout/withdraw", {
        amount: parsedAmount,
        idempotency_key: `WD-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      });

      if (data.success) {
        toast.success(
          data.withdrawal?.fee === 0
            ? "Withdrawal initiated — free transfer!"
            : `Withdrawal initiated (₦${data.withdrawal?.fee} fee)`
        );
        onSuccess();
        onClose();
      } else {
        toast.error(data.message ?? "Withdrawal failed");
      }
    } catch (err) {
      toast.error(err.response?.data?.message ?? "Withdrawal failed. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center
                    p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md
                      max-h-[92vh] overflow-y-auto">

        {/* header */}
        <div className="flex items-center justify-between p-6 border-b
                        sticky top-0 bg-white z-10">
          <div className="flex items-center gap-2">
            <ArrowDownToLine size={20} className="text-blue-600" />
            <h2 className="text-lg font-bold text-gray-900">Withdraw Funds</h2>
          </div>
          <button onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">

          {/* free withdrawal badge */}
          {limits.free_remaining > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-xl
                            p-3 flex items-center gap-2.5">
              <Gift size={16} className="text-green-600 shrink-0" />
              <p className="text-sm text-green-700 font-medium">
                {limits.free_remaining} free withdrawal
                {limits.free_remaining > 1 ? "s" : ""} remaining today — no fee!
              </p>
            </div>
          )}

          {/* payout bank */}
          {bank.account_number ? (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
              <p className="text-xs text-gray-400 mb-1">Payout to</p>
              <p className="font-semibold text-gray-900">{bank.account_name}</p>
              <p className="text-sm text-gray-500">
                {bank.account_number} — {bank.bank_name}
              </p>
            </div>
          ) : (
            <div className="bg-amber-50 border border-amber-200 rounded-xl
                            p-4 flex gap-2">
              <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-700">
                No payout bank configured. Please update Settings first.
              </p>
            </div>
          )}

          {/* balance row */}
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-500">Available balance</span>
            <span className="font-bold text-green-600">
              {fmt(wallet.available_balance)}
            </span>
          </div>

          {/* quick % */}
          <div className="grid grid-cols-4 gap-2">
            {[25, 50, 75, 100].map((pct) => (
              <button key={pct} type="button" onClick={() => setQuick(pct)}
                className="text-xs py-1.5 rounded-lg border border-gray-200
                           hover:border-blue-400 hover:text-blue-600 transition-colors">
                {pct}%
              </button>
            ))}
          </div>

          {/* amount input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Amount (₦)
            </label>
            <input
              type="number"
              min={limits.min_withdrawal}
              max={maxAllowed}
              step="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={`Min ${fmt(limits.min_withdrawal)}`}
              className="w-full border border-gray-300 rounded-xl px-4 py-3
                         text-lg font-semibold focus:outline-none
                         focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          {/* fee preview */}
          {preview && (
            <div className={`border rounded-xl p-4 space-y-2 text-sm ${
              preview.isFree
                ? "bg-green-50 border-green-200"
                : "bg-blue-50 border-blue-100"
            }`}>
              <div className="flex justify-between text-gray-600">
                <span>Gross amount</span>
                <span>{fmt(preview.amount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Processing fee</span>
                {preview.isFree ? (
                  <span className="text-green-600 font-semibold flex items-center gap-1">
                    <Gift size={13} /> Free
                  </span>
                ) : (
                  <span className="text-red-500">−{fmt(preview.fee)}</span>
                )}
              </div>
              <div className="flex justify-between font-bold text-gray-900
                              pt-2 border-t border-current/10">
                <span>You receive</span>
                <span className={preview.isFree ? "text-green-600" : "text-blue-700"}>
                  {fmt(preview.net)}
                </span>
              </div>
            </div>
          )}

          {/* daily info + fee schedule toggle */}
          <div className="space-y-2">
            <div className="flex items-start gap-2 text-xs text-gray-500
                            bg-gray-50 rounded-lg p-3">
              <Info size={13} className="shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p>
                  Daily remaining:{" "}
                  <strong className="text-gray-700">{fmt(limits.daily_remaining)}</strong>
                  {" "}of {fmt(limits.daily_limit)}
                </p>
                <p>
                  Withdrawals today:{" "}
                  <strong className="text-gray-700">{limits.withdrawals_today}</strong>
                  {limits.free_remaining > 0 && (
                    <span className="text-green-600 ml-1">
                      ({limits.free_remaining} free left)
                    </span>
                  )}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowFees((v) => !v)}
              className="text-xs text-blue-600 hover:underline w-full text-left pl-1"
            >
              {showFees ? "Hide" : "View"} full fee schedule
            </button>

            {showFees && (
              <div className="rounded-xl border border-gray-200 overflow-hidden text-xs">
                <div className="bg-green-50 border-b border-green-100 px-3 py-2
                                flex items-center gap-2 text-green-700">
                  <Gift size={12} />
                  First 3 withdrawals per day are always FREE
                </div>
                {FEE_TIERS.map(({ range, fee }) => (
                  <div key={range}
                    className="flex justify-between px-3 py-2 border-b
                               border-gray-100 last:border-0">
                    <span className="text-gray-500">{range}</span>
                    <span className="font-semibold text-gray-800">{fee}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* submit */}
          <button
            type="submit"
            disabled={loading || !bank.account_number || !amount || parsedAmount <= 0}
            className="w-full bg-blue-600 hover:bg-blue-700
                       disabled:opacity-50 disabled:cursor-not-allowed
                       text-white font-semibold py-3.5 rounded-xl
                       transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <><RefreshCw size={16} className="animate-spin" /> Initiating…</>
            ) : (
              <><ArrowDownToLine size={16} />
                Withdraw {preview ? fmt(preview.amount) : ""}
                {preview?.isFree && (
                  <span className="text-green-200 text-xs">(Free)</span>
                )}
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// DetailDrawer
// ══════════════════════════════════════════════════════════════════════════════

const DetailDrawer = ({ id, onClose, onCancelled }) => {
  const [data,       setData]       = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: res } = await api.get(`/seller/payout/withdrawal/${id}`);
      if (res.success) setData(res);
    } catch {
      toast.error("Failed to load withdrawal details");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleCancel = async () => {
    if (!window.confirm("Cancel this withdrawal and restore your balance?")) return;
    setCancelling(true);
    try {
      const { data: res } = await api.post(`/seller/payout/withdrawal/${id}/cancel`);
      if (res.success) {
        toast.success("Withdrawal cancelled. Balance restored.");
        onCancelled?.();
        onClose();
      } else {
        toast.error(res.message);
      }
    } catch (err) {
      toast.error(err.response?.data?.message ?? "Cancellation failed");
    } finally {
      setCancelling(false);
    }
  };

  const wd = data?.withdrawal;

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="w-full max-w-md bg-white h-full overflow-y-auto
                      shadow-2xl flex flex-col">

        <div className="flex items-center justify-between p-6 border-b
                        sticky top-0 bg-white z-10">
          <h2 className="font-bold text-gray-900">Withdrawal Details</h2>
          <div className="flex items-center gap-2">
            <button onClick={load}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-500">
              <RefreshCw size={15} />
            </button>
            <button onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <X size={18} />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <RefreshCw size={24} className="animate-spin text-blue-400" />
          </div>
        ) : wd ? (
          <div className="p-6 space-y-6 flex-1">

            <div className="flex items-center justify-between">
              <StatusBadge status={wd.status} />
              {data.live_status && (
                <span className="text-xs text-gray-400 bg-gray-50 border
                                 border-gray-200 px-2 py-0.5 rounded-full">
                  FLW: {data.live_status}
                </span>
              )}
            </div>

            {/* amount hero */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50
                            border border-blue-100 rounded-2xl p-5 text-center">
              <p className="text-xs text-gray-500 mb-1">Amount requested</p>
              <p className="text-3xl font-bold text-gray-900">{fmt(wd.amount)}</p>
              <div className="mt-3 flex justify-center gap-8 text-sm">
                <div>
                  <p className="text-xs text-gray-400">Fee</p>
                  {Number(wd.fee) === 0 ? (
                    <p className="text-green-600 font-medium flex items-center gap-1">
                      <Gift size={12} /> Free
                    </p>
                  ) : (
                    <p className="text-red-500 font-medium">−{fmt(wd.fee)}</p>
                  )}
                </div>
                <div>
                  <p className="text-xs text-gray-400">You receive</p>
                  <p className="text-green-600 font-medium">{fmt(wd.net_amount)}</p>
                </div>
              </div>
            </div>

            {/* destination */}
            <section>
              <h3 className="text-xs font-semibold text-gray-400 uppercase
                             tracking-wider mb-3">Destination</h3>
              <div className="space-y-2.5 text-sm">
                {[
                  ["Account Name",   wd.account_name],
                  ["Account Number", wd.account_number],
                  ["Bank",           wd.bank_name],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between">
                    <span className="text-gray-500">{label}</span>
                    <span className="font-medium text-gray-900">{value}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* references */}
            <section>
              <h3 className="text-xs font-semibold text-gray-400 uppercase
                             tracking-wider mb-3">References</h3>
              <div className="space-y-2.5">
                {[
                  ["Tx Ref", wd.tx_ref],
                  wd.flw_transfer_id ? ["FLW Transfer", wd.flw_transfer_id] : null,
                ].filter(Boolean).map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">{label}</span>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-xs text-gray-700
                                       max-w-[180px] truncate">{value}</span>
                      <button onClick={() => copyText(value)}
                        className="text-gray-400 hover:text-blue-600 transition-colors">
                        <Copy size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* timeline */}
            <section>
              <h3 className="text-xs font-semibold text-gray-400 uppercase
                             tracking-wider mb-3">Timeline</h3>
              <div className="space-y-2.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Requested</span>
                  <span className="text-gray-900">{fmtDate(wd.requested_at)}</span>
                </div>
                {wd.processed_at && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Processed</span>
                    <span className="text-gray-900">{fmtDate(wd.processed_at)}</span>
                  </div>
                )}
              </div>
            </section>

            {wd.failure_reason && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <p className="text-xs font-semibold text-red-700 mb-1">Failure Reason</p>
                <p className="text-sm text-red-600">{wd.failure_reason}</p>
              </div>
            )}

            <div className="flex items-start gap-2 text-xs text-gray-400
                            bg-gray-50 rounded-lg p-3">
              <ShieldCheck size={13} className="shrink-0 mt-0.5 text-green-500" />
              <span>
                Balance is settled only after Flutterwave confirms the transfer.
                Refresh to check the latest status.
              </span>
            </div>

            {wd.status === "processing" && !wd.flw_transfer_id && (
              <button onClick={handleCancel} disabled={cancelling}
                className="w-full border border-red-300 text-red-600
                           hover:bg-red-50 font-medium py-3 rounded-xl
                           transition-colors flex items-center justify-center
                           gap-2 disabled:opacity-50">
                {cancelling
                  ? <RefreshCw size={16} className="animate-spin" />
                  : <X size={16} />}
                Cancel Withdrawal
              </button>
            )}
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            Withdrawal not found
          </div>
        )}
      </div>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// Payouts page
// ══════════════════════════════════════════════════════════════════════════════

const STATUS_FILTERS = ["", "pending", "processing", "success", "failed", "cancelled"];

export default function Payouts() {
  const [info,           setInfo]           = useState(null);
  const [history,        setHistory]        = useState(null);
  const [loadingInfo,    setLoadingInfo]    = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [showWithdraw,   setShowWithdraw]   = useState(false);
  const [selectedId,     setSelectedId]     = useState(null);
  const [statusFilter,   setStatusFilter]   = useState("");
  const [page,           setPage]           = useState(1);

  const loadInfo = useCallback(async () => {
    setLoadingInfo(true);
    try {
      const { data } = await api.get("/seller/payout/info");
      if (data.success) setInfo(data);
    } catch (err) {
      toast.error(err.response?.data?.message ?? "Failed to load wallet info");
    } finally {
      setLoadingInfo(false);
    }
  }, []);

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const params = new URLSearchParams({ page, limit: 10 });
      if (statusFilter) params.set("status", statusFilter);
      const { data } = await api.get(`/seller/payout/history?${params}`);
      if (data.success) setHistory(data);
    } catch {
      toast.error("Failed to load history");
    } finally {
      setLoadingHistory(false);
    }
  }, [page, statusFilter]);

  useEffect(() => { loadInfo(); },    [loadInfo]);
  useEffect(() => { loadHistory(); }, [loadHistory]);

  const refresh = () => { loadInfo(); loadHistory(); };

  if (loadingInfo) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 space-y-4 animate-pulse">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-20 bg-gray-200 rounded-2xl" />
        ))}
      </div>
    );
  }

  if (!info) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle size={40} className="text-red-400 mx-auto mb-3" />
          <p className="text-gray-600 font-medium">Failed to load payout info</p>
          <button onClick={loadInfo} className="mt-3 text-blue-600 underline text-sm">
            Try again
          </button>
        </div>
      </div>
    );
  }

  const { wallet, bank, virtual_account, limits } = info;
  const canWithdraw =
    wallet.available_balance >= limits.min_withdrawal &&
    limits.daily_remaining   >= limits.min_withdrawal;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">

        {/* header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Payouts</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Manage your earnings and withdrawals
            </p>
          </div>
          <button onClick={refresh}
            className="p-2 hover:bg-white rounded-xl border border-gray-200
                       text-gray-500 hover:text-blue-600 transition-colors">
            <RefreshCw size={18} />
          </button>
        </div>

        {/* free withdrawal alert */}
        {limits.free_remaining > 0 && (
          <div className="bg-green-50 border border-green-200 rounded-2xl
                          p-4 flex items-center gap-3">
            <div className="bg-green-100 p-2 rounded-xl">
              <Gift size={18} className="text-green-600" />
            </div>
            <div>
              <p className="font-semibold text-green-800">
                {limits.free_remaining} free withdrawal
                {limits.free_remaining > 1 ? "s" : ""} remaining today
              </p>
              <p className="text-sm text-green-600">
                Withdraw now with zero fees
              </p>
            </div>
          </div>
        )}

        {/* stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard icon={<Wallet size={20} />}     label="Available"       value={fmt(wallet.available_balance)} color="blue" />
          <StatCard icon={<Clock size={20} />}      label="Pending"         value={fmt(wallet.pending_balance)}   color="amber"
                    sub="Awaiting settlement" />
          <StatCard icon={<TrendingUp size={20} />} label="Total Received"  value={fmt(wallet.total_received)}    color="green" />
          <StatCard icon={<Banknote size={20} />}   label="Total Withdrawn" value={fmt(wallet.total_withdrawn)}   color="purple" />
        </div>

        {/* virtual account */}
        {virtual_account && (
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600
                          text-white rounded-2xl p-5">
            <p className="text-xs font-medium opacity-70 uppercase tracking-wider mb-2">
              Virtual Account — receive payments here
            </p>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-2xl font-bold tracking-widest">
                  {virtual_account.account_number}
                </p>
                <p className="text-sm opacity-80 mt-0.5">
                  {virtual_account.account_name} • {virtual_account.bank_name}
                </p>
              </div>
              <button onClick={() => copyText(virtual_account.account_number)}
                className="bg-white/20 hover:bg-white/30 p-2.5 rounded-xl transition-colors">
                <Copy size={16} />
              </button>
            </div>
          </div>
        )}

        {/* withdraw CTA */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5
                        flex flex-col sm:flex-row items-start sm:items-center
                        justify-between gap-4">
          <div className="space-y-1">
            <h2 className="font-semibold text-gray-900">Withdraw Earnings</h2>
            <p className="text-sm text-gray-500">
              {bank.account_number
                ? `→ ${bank.account_name} • ${bank.account_number} (${bank.bank_name})`
                : "No payout bank configured — update in Settings"}
            </p>
            <p className="text-xs text-gray-400">
              {limits.fee_schedule_label} • Daily left: {fmt(limits.daily_remaining)}
            </p>
          </div>
          <button
            onClick={() => setShowWithdraw(true)}
            disabled={!canWithdraw || !bank.account_number}
            className="shrink-0 bg-blue-600 hover:bg-blue-700
                       disabled:opacity-50 disabled:cursor-not-allowed
                       text-white font-semibold px-6 py-3 rounded-xl
                       transition-colors flex items-center gap-2"
          >
            <ArrowDownToLine size={16} />
            Withdraw
            {limits.free_remaining > 0 && (
              <span className="bg-green-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                Free
              </span>
            )}
          </button>
        </div>

        {/* fee schedule */}
        <FeeScheduleTable
          freeRemaining={limits.free_remaining}
          withdrawalsToday={limits.withdrawals_today}
        />

        {/* history summary */}
        {history && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "All requests",   val: history.stats.total },
              { label: "Total paid out", val: fmt(history.stats.total_paid_out) },
              { label: "Total fees",     val: fmt(history.stats.total_fees_paid) },
              { label: "Failed",         val: history.stats.failed_count },
            ].map(({ label, val }) => (
              <div key={label}
                className="bg-white border border-gray-200 rounded-xl p-4 text-center">
                <p className="text-xs text-gray-400">{label}</p>
                <p className="text-lg font-bold text-gray-800 mt-0.5">{val}</p>
              </div>
            ))}
          </div>
        )}

        {/* history table */}
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b">
            <h2 className="font-semibold text-gray-900">Withdrawal History</h2>
            <div className="flex flex-wrap gap-1.5">
              {STATUS_FILTERS.map((s) => (
                <button key={s}
                  onClick={() => { setStatusFilter(s); setPage(1); }}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                    statusFilter === s
                      ? "bg-blue-600 text-white border-blue-600"
                      : "border-gray-200 text-gray-600 hover:border-blue-300"
                  }`}>
                  {s === "" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {loadingHistory ? (
            <div className="p-10 flex justify-center">
              <RefreshCw size={24} className="animate-spin text-blue-400" />
            </div>
          ) : !history?.withdrawals?.length ? (
            <div className="p-14 text-center">
              <ArrowDownToLine size={36} className="text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No withdrawals yet</p>
              <p className="text-gray-400 text-sm mt-1">
                Your withdrawal history will appear here
              </p>
            </div>
          ) : (
            <>
              {/* desktop */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      {["Date", "Amount", "Fee", "Net", "Bank", "Status", ""].map((h) => (
                        <th key={h} className="text-left text-xs font-semibold
                                               text-gray-500 uppercase tracking-wider
                                               px-4 py-3">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {history.withdrawals.map((w) => (
                      <tr key={w.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">
                          {fmtDate(w.created_at)}
                        </td>
                        <td className="px-4 py-3 font-semibold text-gray-900">
                          {fmt(w.amount)}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {Number(w.fee) === 0 ? (
                            <span className="text-green-600 flex items-center gap-1">
                              <Gift size={11} /> Free
                            </span>
                          ) : (
                            <span className="text-red-400">−{fmt(w.fee)}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-green-600 font-medium">
                          {fmt(w.net_amount)}
                        </td>
                        <td className="px-4 py-3 text-gray-500 max-w-[140px] truncate text-xs">
                          {w.bank_name}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={w.status} />
                        </td>
                        <td className="px-4 py-3">
                          <button onClick={() => setSelectedId(w.id)}
                            className="text-gray-400 hover:text-blue-600 p-1
                                       rounded transition-colors">
                            <Eye size={15} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* mobile */}
              <div className="md:hidden divide-y divide-gray-100">
                {history.withdrawals.map((w) => (
                  <div key={w.id}
                    className="p-4 hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => setSelectedId(w.id)}>
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-semibold text-gray-900">{fmt(w.amount)}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          Net: {fmt(w.net_amount)}{" "}
                          {Number(w.fee) === 0 ? (
                            <span className="text-green-500">(Free)</span>
                          ) : (
                            <span className="text-red-400">(−{fmt(w.fee)} fee)</span>
                          )}
                        </p>
                      </div>
                      <StatusBadge status={w.status} />
                    </div>
                    <div className="flex justify-between text-xs text-gray-400">
                      <span>{w.bank_name}</span>
                      <span>{fmtDate(w.created_at)}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* pagination */}
              {history.pagination.total_pages > 1 && (
                <div className="flex items-center justify-between px-4 py-3
                                border-t bg-gray-50 text-sm">
                  <p className="text-gray-500 text-xs">
                    Page {history.pagination.page} of{" "}
                    {history.pagination.total_pages} •{" "}
                    {history.pagination.total} total
                  </p>
                  <div className="flex gap-2">
                    <button onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="p-2 rounded-lg border border-gray-200
                                 disabled:opacity-40 hover:bg-white transition-colors">
                      <ChevronLeft size={15} />
                    </button>
                    <button
                      onClick={() => setPage((p) => Math.min(history.pagination.total_pages, p + 1))}
                      disabled={page === history.pagination.total_pages}
                      className="p-2 rounded-lg border border-gray-200
                                 disabled:opacity-40 hover:bg-white transition-colors">
                      <ChevronRight size={15} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {showWithdraw && (
        <WithdrawModal info={info} onClose={() => setShowWithdraw(false)} onSuccess={refresh} />
      )}
      {selectedId && (
        <DetailDrawer id={selectedId} onClose={() => setSelectedId(null)} onCancelled={refresh} />
      )}
    </div>
  );
}