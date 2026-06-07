import React, {
  useState, useEffect, useCallback, useMemo,
} from "react";
import {
  Wallet, ArrowDownToLine, Clock, CheckCircle,
  XCircle, AlertCircle, RefreshCw, ChevronLeft,
  ChevronRight, Copy, Eye, X, TrendingUp,
  Banknote, Info, ShieldCheck, Gift,
} from "lucide-react";
import api from "../../utils/api";
import toast from "react-hot-toast";
import {
  formatNGN,
  formatTimeAgo,
  DashboardSkeleton,
  DashboardError,
} from "./Shared";

// ─── Fee calc (mirrors server) ────────────────────────────────────────────────
const clientCalcFee = (amount, withdrawalsToday) => {
  if (withdrawalsToday < 3) return 0;
  if (amount <= 9_999)      return 50;
  if (amount <= 99_999)     return 100;
  if (amount <= 500_000)    return 150;
  return 200;
};

const FEE_TIERS = [
  { label: "₦0 – ₦9,999",          fee: "₦50"  },
  { label: "₦10,000 – ₦99,999",    fee: "₦100" },
  { label: "₦100,000 – ₦500,000",  fee: "₦150" },
  { label: "Above ₦500,000",        fee: "₦200" },
];

// ─── Date formatter ───────────────────────────────────────────────────────────
const fmtDate = (d) =>
  d ? new Date(d).toLocaleString("en-NG", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }) : "—";

const copyText = (t) =>
  navigator.clipboard.writeText(t).then(() => toast.success("Copied!"));

// ─── Payout status config ─────────────────────────────────────────────────────
const PAYOUT_STATUS = {
  pending: {
    label: "Pending",
    chip:  "bg-amber-100 text-amber-700 border-amber-200",
    Icon:  Clock,
    spin:  false,
  },
  processing: {
    label: "Processing",
    chip:  "bg-blue-100 text-blue-700 border-blue-200",
    Icon:  RefreshCw,
    spin:  true,
  },
  success: {
    label: "Success",
    chip:  "bg-green-100 text-green-700 border-green-200",
    Icon:  CheckCircle,
    spin:  false,
  },
  failed: {
    label: "Failed",
    chip:  "bg-red-100 text-red-700 border-red-200",
    Icon:  XCircle,
    spin:  false,
  },
  cancelled: {
    label: "Cancelled",
    chip:  "bg-gray-100 text-gray-500 border-gray-200",
    Icon:  X,
    spin:  false,
  },
};

const PayoutStatusBadge = ({ status }) => {
  const m = PAYOUT_STATUS[status] ?? {
    label: status, chip: "bg-gray-100 text-gray-500 border-gray-200",
    Icon: null, spin: false,
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full
                      text-xs font-medium border ${m.chip}`}>
      {m.Icon && <m.Icon size={11} className={m.spin ? "animate-spin" : ""} />}
      {m.label}
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
      <p className="text-xs font-medium opacity-70 mb-0.5 truncate">{label}</p>
      <p className="text-lg font-bold truncate">{value}</p>
      {sub && <p className="text-xs opacity-60 mt-0.5">{sub}</p>}
    </div>
  </div>
);

// ─── FeeTable ─────────────────────────────────────────────────────────────────
const FeeTable = ({ freeRemaining, withdrawalsToday }) => (
  <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
    <div className="px-4 py-3 border-b bg-gray-50 flex items-center gap-2">
      <Info size={14} className="text-gray-400" />
      <h3 className="text-sm font-semibold text-gray-700">Withdrawal Fee Schedule</h3>
    </div>

    <div className={`px-4 py-3 border-b flex items-center gap-3 ${
      freeRemaining > 0 ? "bg-green-50 border-green-100" : "bg-gray-50 border-gray-200"
    }`}>
      <Gift size={18} className={freeRemaining > 0 ? "text-green-600" : "text-gray-400"} />
      <div>
        {freeRemaining > 0 ? (
          <>
            <p className="text-sm font-semibold text-green-800">
              {freeRemaining} free withdrawal{freeRemaining > 1 ? "s" : ""} remaining today
            </p>
            <p className="text-xs text-green-600">First 3 each day are always free</p>
          </>
        ) : (
          <>
            <p className="text-sm font-semibold text-gray-600">All free withdrawals used today</p>
            <p className="text-xs text-gray-400">Fees apply to withdrawal #{withdrawalsToday + 1}+</p>
          </>
        )}
      </div>
    </div>

    <div className="divide-y divide-gray-100">
      {FEE_TIERS.map(({ label, fee }) => (
        <div key={label} className="flex justify-between items-center px-4 py-2.5 text-sm">
          <span className="text-gray-500">{label}</span>
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
  const [amount,   setAmount]   = useState("");
  const [loading,  setLoading]  = useState(false);
  const [showFees, setShowFees] = useState(false);

  const { wallet, bank, limits } = info;
  const parsedAmount = parseFloat(amount) || 0;

  const preview = useMemo(() => {
    if (!parsedAmount || parsedAmount <= 0) return null;
    const fee = clientCalcFee(parsedAmount, limits.withdrawals_today);
    return {
      amount: parsedAmount,
      fee,
      net:    parseFloat((parsedAmount - fee).toFixed(2)),
      isFree: fee === 0,
    };
  }, [parsedAmount, limits.withdrawals_today]);

  const maxAllowed = Math.min(
    wallet.available_balance,
    limits.daily_remaining,
    limits.max_withdrawal
  );

  const setQuick = (pct) => {
    const val = Math.min(
      parseFloat(((wallet.available_balance * pct) / 100).toFixed(2)),
      maxAllowed
    );
    setAmount(String(val));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!parsedAmount || parsedAmount < limits.min_withdrawal) {
      return toast.error(`Minimum withdrawal is ${formatNGN(limits.min_withdrawal)}`);
    }
    if (parsedAmount > wallet.available_balance) {
      return toast.error("Insufficient balance");
    }
    if (parsedAmount > limits.daily_remaining) {
      return toast.error(`Daily limit exceeded. Remaining: ${formatNGN(limits.daily_remaining)}`);
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
        <div className="flex items-center justify-between p-5 border-b
                        sticky top-0 bg-white z-10">
          <div className="flex items-center gap-2">
            <ArrowDownToLine size={20} className="text-blue-600" />
            <h2 className="text-lg font-bold text-gray-900">Withdraw Funds</h2>
          </div>
          <button onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5">

          {/* free badge */}
          {limits.free_remaining > 0 && (
            <div className="flex items-center gap-2.5 bg-green-50 border
                            border-green-200 rounded-xl px-4 py-3">
              <Gift size={16} className="text-green-600 shrink-0" />
              <p className="text-sm font-medium text-green-700">
                {limits.free_remaining} free withdrawal
                {limits.free_remaining > 1 ? "s" : ""} remaining — no fees!
              </p>
            </div>
          )}

          {/* payout bank */}
          {bank.account_number && bank.account_name ? (
            <div className="flex items-start gap-3 bg-gray-50 border
                            border-gray-200 rounded-xl p-4">
              <CheckCircle size={16} className="text-green-500 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-gray-400 mb-0.5">Payout to</p>
                <p className="font-semibold text-gray-900 truncate">{bank.account_name}</p>
                <p className="text-sm text-gray-500">
                  {bank.account_number} — {bank.bank_name}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex gap-2.5 bg-amber-50 border border-amber-200 rounded-xl p-4">
              <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-800">No payout bank configured</p>
                <p className="text-xs text-amber-600 mt-0.5">
                  Go to Settings → Bank Account to set up your payout account
                </p>
              </div>
            </div>
          )}

          {/* available balance */}
          <div className="flex justify-between items-center py-2 border-y border-gray-100">
            <span className="text-sm text-gray-500">Available balance</span>
            <span className="font-bold text-lg text-green-600">
              {formatNGN(wallet.available_balance)}
            </span>
          </div>

          {/* quick % */}
          <div className="grid grid-cols-4 gap-2">
            {[25, 50, 75, 100].map((pct) => (
              <button key={pct} type="button" onClick={() => setQuick(pct)}
                className="py-2 text-xs rounded-xl border border-gray-200
                           hover:border-blue-400 hover:text-blue-600
                           hover:bg-blue-50 transition-colors font-medium">
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
              placeholder={`Min ${formatNGN(limits.min_withdrawal)}`}
              className="w-full border border-gray-300 rounded-xl px-4 py-3.5
                         text-2xl font-bold focus:outline-none focus:ring-2
                         focus:ring-blue-500 focus:border-transparent
                         placeholder:text-gray-300 placeholder:font-normal
                         placeholder:text-base"
              required
            />
          </div>

          {/* fee preview */}
          {preview && (
            <div className={`rounded-xl border p-4 space-y-2.5 text-sm ${
              preview.isFree
                ? "bg-green-50 border-green-200"
                : "bg-blue-50 border-blue-100"
            }`}>
              <div className="flex justify-between text-gray-600">
                <span>Gross amount</span>
                <span>{formatNGN(preview.amount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Processing fee</span>
                {preview.isFree ? (
                  <span className="text-green-600 font-semibold flex items-center gap-1">
                    <Gift size={12} /> Free
                  </span>
                ) : (
                  <span className="text-red-500 font-medium">
                    −{formatNGN(preview.fee)}
                  </span>
                )}
              </div>
              <div className="flex justify-between font-bold text-base
                              pt-2 border-t border-black/5">
                <span className="text-gray-900">You receive</span>
                <span className={preview.isFree ? "text-green-700" : "text-blue-700"}>
                  {formatNGN(preview.net)}
                </span>
              </div>
            </div>
          )}

          {/* daily info */}
          <div className="flex items-start gap-2 text-xs text-gray-500
                          bg-gray-50 rounded-xl p-3.5">
            <Info size={13} className="shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p>
                Daily remaining:{" "}
                <strong className="text-gray-800">
                  {formatNGN(limits.daily_remaining)}
                </strong>
                {" "}of {formatNGN(limits.daily_limit)}
              </p>
              <p>
                Withdrawals today:{" "}
                <strong className="text-gray-800">{limits.withdrawals_today}</strong>
                {limits.free_remaining > 0 && (
                  <span className="text-green-600 ml-1">
                    ({limits.free_remaining} free left)
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* fee schedule toggle */}
          <button type="button" onClick={() => setShowFees((v) => !v)}
            className="text-xs text-blue-600 hover:underline w-full text-left">
            {showFees ? "▲ Hide" : "▼ View"} full fee schedule
          </button>

          {showFees && (
            <div className="rounded-xl border border-gray-200 overflow-hidden text-xs">
              <div className="bg-green-50 border-b border-green-100 px-3.5 py-2.5
                              flex items-center gap-2 text-green-700 font-medium">
                <Gift size={12} /> First 3 withdrawals per day are FREE
              </div>
              {FEE_TIERS.map(({ label, fee }) => (
                <div key={label} className="flex justify-between px-3.5 py-2.5
                                            border-b border-gray-100 last:border-0">
                  <span className="text-gray-500">{label}</span>
                  <span className="font-semibold text-gray-800">{fee}</span>
                </div>
              ))}
            </div>
          )}

          {/* submit */}
          <button
            type="submit"
            disabled={loading || !bank.account_number || !amount || parsedAmount <= 0}
            className="w-full bg-blue-600 hover:bg-blue-700
                       disabled:opacity-50 disabled:cursor-not-allowed
                       text-white font-bold py-4 rounded-xl transition-colors
                       flex items-center justify-center gap-2 text-base"
          >
            {loading ? (
              <>
                <RefreshCw size={18} className="animate-spin" />
                Initiating…
              </>
            ) : (
              <>
                <ArrowDownToLine size={18} />
                Withdraw {preview ? formatNGN(preview.amount) : ""}
                {preview?.isFree && (
                  <span className="bg-green-500 text-white text-xs px-2 py-0.5
                                   rounded-full font-medium">Free</span>
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
      else toast.error("Failed to load details");
    } catch {
      toast.error("Failed to load details");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleCancel = async () => {
    if (!window.confirm("Cancel this withdrawal and restore your balance?")) return;
    setCancelling(true);
    try {
      const { data: res } = await api.post(
        `/seller/payout/withdrawal/${id}/cancel`
      );
      if (res.success) {
        toast.success("Cancelled. Balance restored.");
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

        {/* header */}
        <div className="flex items-center justify-between px-6 py-4 border-b
                        sticky top-0 bg-white z-10">
          <h2 className="font-bold text-gray-900 text-lg">Withdrawal Details</h2>
          <div className="flex items-center gap-1">
            <button onClick={load} title="Refresh"
              className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-500">
              <RefreshCw size={16} />
            </button>
            <button onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
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

            {/* status row */}
            <div className="flex items-center justify-between">
              <PayoutStatusBadge status={wd.status} />
              {data.live_status && (
                <span className="text-xs text-gray-400 bg-gray-50 border
                                 border-gray-200 px-2.5 py-1 rounded-full">
                  FLW: {data.live_status}
                </span>
              )}
            </div>

            {/* amount hero */}
            <div className="bg-gradient-to-br from-blue-600 to-indigo-600
                            rounded-2xl p-6 text-white text-center">
              <p className="text-sm opacity-75 mb-1">Amount requested</p>
              <p className="text-4xl font-bold mb-4">{formatNGN(wd.amount)}</p>
              <div className="grid grid-cols-2 gap-4 bg-white/10 rounded-xl p-3">
                <div>
                  <p className="text-xs opacity-70 mb-0.5">Processing fee</p>
                  {Number(wd.fee) === 0 ? (
                    <p className="font-semibold flex items-center justify-center gap-1">
                      <Gift size={13} /> Free
                    </p>
                  ) : (
                    <p className="font-semibold">−{formatNGN(wd.fee)}</p>
                  )}
                </div>
                <div>
                  <p className="text-xs opacity-70 mb-0.5">You receive</p>
                  <p className="font-bold text-green-300">
                    {formatNGN(wd.net_amount)}
                  </p>
                </div>
              </div>
            </div>

            {/* destination */}
            <section>
              <h3 className="text-xs font-semibold text-gray-400 uppercase
                             tracking-wider mb-3">Destination</h3>
              <div className="bg-gray-50 rounded-xl p-4 space-y-2.5 text-sm">
                {[
                  ["Account Name",   wd.account_name],
                  ["Account Number", wd.account_number],
                  ["Bank",           wd.bank_name],
                ].map(([label, val]) => (
                  <div key={label} className="flex justify-between">
                    <span className="text-gray-500">{label}</span>
                    <span className="font-medium text-gray-900">{val}</span>
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
                  wd.flw_transfer_id
                    ? ["FLW Transfer", wd.flw_transfer_id]
                    : null,
                ].filter(Boolean).map(([label, val]) => (
                  <div key={label}
                    className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">{label}</span>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-xs text-gray-700
                                       max-w-[180px] truncate">{val}</span>
                      <button onClick={() => copyText(val)}
                        className="p-1 text-gray-400 hover:text-blue-600
                                   transition-colors">
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
                  <div className="text-right">
                    <span className="text-gray-900 block">
                      {fmtDate(wd.requested_at)}
                    </span>
                    <span className="text-xs text-gray-400">
                      {formatTimeAgo(wd.requested_at)}
                    </span>
                  </div>
                </div>
                {wd.processed_at && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Processed</span>
                    <div className="text-right">
                      <span className="text-gray-900 block">
                        {fmtDate(wd.processed_at)}
                      </span>
                      <span className="text-xs text-gray-400">
                        {formatTimeAgo(wd.processed_at)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* failure reason */}
            {wd.failure_reason && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <p className="text-xs font-semibold text-red-700 mb-1">
                  Failure Reason
                </p>
                <p className="text-sm text-red-600">{wd.failure_reason}</p>
              </div>
            )}

            {/* webhook notice */}
            <div className="flex items-start gap-2 text-xs text-gray-400
                            bg-gray-50 rounded-xl p-3.5">
              <ShieldCheck size={13}
                className="shrink-0 mt-0.5 text-green-500" />
              <span>
                Balance is finalised only after Flutterwave confirms the
                transfer. Tap refresh to check the latest status.
              </span>
            </div>

            {/* cancel */}
            {wd.status === "processing" && !wd.flw_transfer_id && (
              <button onClick={handleCancel} disabled={cancelling}
                className="w-full border border-red-300 text-red-600
                           hover:bg-red-50 font-semibold py-3 rounded-xl
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
const STATUS_FILTERS = [
  { key: "",           label: "All"        },
  { key: "pending",    label: "Pending"    },
  { key: "processing", label: "Processing" },
  { key: "success",    label: "Success"    },
  { key: "failed",     label: "Failed"     },
  { key: "cancelled",  label: "Cancelled"  },
];

export default function Payouts() {
  const [info,           setInfo]           = useState(null);
  const [history,        setHistory]        = useState(null);
  const [loadingInfo,    setLoadingInfo]    = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [error,          setError]          = useState(null);
  const [showWithdraw,   setShowWithdraw]   = useState(false);
  const [selectedId,     setSelectedId]     = useState(null);
  const [statusFilter,   setStatusFilter]   = useState("");
  const [page,           setPage]           = useState(1);

  const loadInfo = useCallback(async () => {
    setLoadingInfo(true);
    setError(null);
    try {
      const { data } = await api.get("/seller/payout/info");
      if (data.success) setInfo(data);
      else setError(data.message);
    } catch (err) {
      setError(err.response?.data?.message ?? "Failed to load wallet info");
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

  const refresh = useCallback(() => {
    loadInfo();
    loadHistory();
  }, [loadInfo, loadHistory]);

  // ── loading / error states ──────────────────────────────────────────────
  if (loadingInfo) return <DashboardSkeleton />;

  if (error || !info) {
    return (
      <DashboardError
        error={error ?? "Failed to load payout information"}
        onRetry={loadInfo}
      />
    );
  }

  const { wallet, bank, virtual_account, limits } = info;

  const canWithdraw =
    wallet.available_balance >= limits.min_withdrawal &&
    limits.daily_remaining   >= limits.min_withdrawal;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-5">

        {/* ── page header ─────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Payouts</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Manage your earnings and withdrawals
            </p>
          </div>
          <button onClick={refresh}
            className="p-2.5 hover:bg-white rounded-xl border border-gray-200
                       text-gray-500 hover:text-blue-600 transition-colors">
            <RefreshCw size={18} />
          </button>
        </div>

        {/* ── free withdrawal alert ────────────────────────────────── */}
        {limits.free_remaining > 0 && (
          <div className="flex items-center gap-3 bg-green-50 border
                          border-green-200 rounded-2xl p-4">
            <div className="bg-green-100 p-2.5 rounded-xl shrink-0">
              <Gift size={20} className="text-green-600" />
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

        {/* ── stat cards ──────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            icon={<Wallet size={20} />}
            color="blue"
            label="Available"
            value={formatNGN(wallet.available_balance)}
          />
          <StatCard
            icon={<Clock size={20} />}
            color="amber"
            label="Pending"
            value={formatNGN(wallet.pending_balance)}
            sub="Awaiting settlement"
          />
          <StatCard
            icon={<TrendingUp size={20} />}
            color="green"
            label="Total Received"
            value={formatNGN(wallet.total_received)}
          />
          <StatCard
            icon={<Banknote size={20} />}
            color="purple"
            label="Total Withdrawn"
            value={formatNGN(wallet.total_withdrawn)}
          />
        </div>

        {/* ── virtual account ─────────────────────────────────────── */}
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
                  {virtual_account.account_name} •{" "}
                  {virtual_account.bank_name}
                </p>
              </div>
              <button
                onClick={() => copyText(virtual_account.account_number)}
                className="bg-white/20 hover:bg-white/30 p-2.5 rounded-xl
                           transition-colors shrink-0"
                title="Copy"
              >
                <Copy size={16} />
              </button>
            </div>
          </div>
        )}

        {/* ── withdraw CTA ─────────────────────────────────────────── */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5
                        flex flex-col sm:flex-row items-start sm:items-center
                        justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <h2 className="font-semibold text-gray-900">Withdraw Earnings</h2>
            <p className="text-sm text-gray-500 truncate">
              {bank.account_number
                ? `→ ${bank.account_name} • ${bank.account_number} (${bank.bank_name})`
                : "No payout bank configured — update in Settings"}
            </p>
            <p className="text-xs text-gray-400">
              {limits.fee_schedule_label} • Daily left:{" "}
              {formatNGN(limits.daily_remaining)}
            </p>
          </div>
          <button
            onClick={() => setShowWithdraw(true)}
            disabled={!canWithdraw || !bank.account_number}
            className="shrink-0 bg-blue-600 hover:bg-blue-700
                       disabled:opacity-50 disabled:cursor-not-allowed
                       text-white font-bold px-6 py-3 rounded-xl
                       transition-colors flex items-center gap-2"
          >
            <ArrowDownToLine size={16} />
            Withdraw
            {limits.free_remaining > 0 && (
              <span className="bg-green-500 text-white text-xs px-1.5 py-0.5
                               rounded-full">Free</span>
            )}
          </button>
        </div>

        {/* ── fee schedule ─────────────────────────────────────────── */}
        <FeeTable
          freeRemaining={limits.free_remaining}
          withdrawalsToday={limits.withdrawals_today}
        />

        {/* ── history summary ──────────────────────────────────────── */}
        {history && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Total requests",  val: history.stats.total },
              { label: "Total paid out",  val: formatNGN(history.stats.total_paid_out) },
              { label: "Total fees paid", val: formatNGN(history.stats.total_fees_paid) },
              { label: "Failed",          val: history.stats.failed_count },
            ].map(({ label, val }) => (
              <div key={label}
                className="bg-white border border-gray-200 rounded-xl p-4 text-center">
                <p className="text-xs text-gray-400">{label}</p>
                <p className="text-lg font-bold text-gray-800 mt-0.5">{val}</p>
              </div>
            ))}
          </div>
        )}

        {/* ── withdrawal history table ─────────────────────────────── */}
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">

          {/* filter bar */}
          <div className="flex flex-wrap items-center justify-between gap-3
                          p-4 border-b">
            <h2 className="font-semibold text-gray-900">Withdrawal History</h2>
            <div className="flex flex-wrap gap-1.5">
              {STATUS_FILTERS.map(({ key, label }) => (
                <button key={key}
                  onClick={() => { setStatusFilter(key); setPage(1); }}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                    statusFilter === key
                      ? "bg-blue-600 text-white border-blue-600"
                      : "border-gray-200 text-gray-600 hover:border-blue-300 hover:text-blue-600"
                  }`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {loadingHistory ? (
            <div className="p-12 flex justify-center">
              <RefreshCw size={24} className="animate-spin text-blue-400" />
            </div>
          ) : !history?.withdrawals?.length ? (
            <div className="p-16 text-center">
              <ArrowDownToLine size={36}
                className="text-gray-200 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No withdrawals yet</p>
              <p className="text-gray-400 text-sm mt-1">
                Your withdrawal history will appear here
              </p>
            </div>
          ) : (
            <>
              {/* desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      {["Date", "Amount", "Fee", "Net", "Bank", "Status", ""].map(
                        (h) => (
                          <th key={h}
                            className="text-left text-xs font-semibold text-gray-500
                                       uppercase tracking-wider px-4 py-3">
                            {h}
                          </th>
                        )
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {history.withdrawals.map((w) => (
                      <tr key={w.id}
                        className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="text-gray-500 text-xs block">
                            {fmtDate(w.created_at)}
                          </span>
                          <span className="text-gray-400 text-xs">
                            {formatTimeAgo(w.created_at)}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-bold text-gray-900">
                          {formatNGN(w.amount)}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {Number(w.fee) === 0 ? (
                            <span className="text-green-600 flex items-center gap-1">
                              <Gift size={11} /> Free
                            </span>
                          ) : (
                            <span className="text-red-400">
                              −{formatNGN(w.fee)}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-green-700 font-semibold">
                          {formatNGN(w.net_amount)}
                        </td>
                        <td className="px-4 py-3 text-gray-500 max-w-[140px]
                                       truncate text-xs">
                          {w.bank_name}
                        </td>
                        <td className="px-4 py-3">
                          <PayoutStatusBadge status={w.status} />
                        </td>
                        <td className="px-4 py-3">
                          <button onClick={() => setSelectedId(w.id)}
                            className="p-1.5 text-gray-400 hover:text-blue-600
                                       hover:bg-blue-50 rounded-lg transition-colors">
                            <Eye size={15} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* mobile cards */}
              <div className="md:hidden divide-y divide-gray-100">
                {history.withdrawals.map((w) => (
                  <div key={w.id}
                    className="p-4 hover:bg-gray-50 transition-colors
                               cursor-pointer active:bg-gray-100"
                    onClick={() => setSelectedId(w.id)}>
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-bold text-gray-900">
                          {formatNGN(w.amount)}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          Net:{" "}
                          <span className="text-green-600 font-medium">
                            {formatNGN(w.net_amount)}
                          </span>{" "}
                          {Number(w.fee) === 0 ? (
                            <span className="text-green-500">(Free)</span>
                          ) : (
                            <span className="text-red-400">
                              (−{formatNGN(w.fee)} fee)
                            </span>
                          )}
                        </p>
                      </div>
                      <PayoutStatusBadge status={w.status} />
                    </div>
                    <div className="flex justify-between text-xs text-gray-400">
                      <span>{w.bank_name}</span>
                      <span>{formatTimeAgo(w.created_at)}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* pagination */}
              {history.pagination.total_pages > 1 && (
                <div className="flex items-center justify-between px-4 py-3
                                border-t bg-gray-50">
                  <p className="text-xs text-gray-500">
                    Page {history.pagination.page} of{" "}
                    {history.pagination.total_pages} •{" "}
                    {history.pagination.total} total
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="p-2 rounded-lg border border-gray-200
                                 disabled:opacity-40 hover:bg-white
                                 transition-colors">
                      <ChevronLeft size={15} />
                    </button>
                    <button
                      onClick={() =>
                        setPage((p) =>
                          Math.min(history.pagination.total_pages, p + 1)
                        )
                      }
                      disabled={page === history.pagination.total_pages}
                      className="p-2 rounded-lg border border-gray-200
                                 disabled:opacity-40 hover:bg-white
                                 transition-colors">
                      <ChevronRight size={15} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── modals ──────────────────────────────────────────────── */}
      {showWithdraw && (
        <WithdrawModal
          info={info}
          onClose={() => setShowWithdraw(false)}
          onSuccess={refresh}
        />
      )}
      {selectedId && (
        <DetailDrawer
          id={selectedId}
          onClose={() => setSelectedId(null)}
          onCancelled={refresh}
        />
      )}
    </div>
  );
}