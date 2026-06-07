import React, {
  useState, useEffect, useRef, useCallback,
} from "react";
import {
  Building2, Hash, User, CheckCircle, XCircle,
  Loader2, ChevronDown, Search, AlertCircle, RefreshCw,
} from "lucide-react";
import api from "../../utils/api";
import toast from "react-hot-toast";

// ─── debounce hook ────────────────────────────────────────────────────────────
function useDebounce(value, delay = 600) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// ─── BankDropdown ─────────────────────────────────────────────────────────────
function BankDropdown({ banks, selected, onSelect, disabled }) {
  const [open,   setOpen]   = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = search.trim()
    ? banks.filter((b) => b.name.toLowerCase().includes(search.toLowerCase()))
    : banks;

  return (
    <div ref={ref} className="relative">
      <label className="block text-sm font-medium text-gray-700 mb-1.5">
        Bank <span className="text-red-500">*</span>
      </label>

      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((v) => !v)}
        className={`w-full flex items-center justify-between px-4 py-3 border
                    rounded-xl text-left transition-all duration-150
                    ${disabled
                      ? "bg-gray-50 text-gray-400 cursor-not-allowed border-gray-200"
                      : open
                      ? "border-blue-500 ring-2 ring-blue-500/20 bg-white"
                      : "border-gray-300 hover:border-gray-400 bg-white"}`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <Building2 size={16} className="text-gray-400 shrink-0" />
          <span className={`truncate ${selected ? "text-gray-900 font-medium" : "text-gray-400"}`}>
            {selected ? selected.name : "Select a bank"}
          </span>
        </div>
        <ChevronDown
          size={16}
          className={`text-gray-400 shrink-0 transition-transform duration-200
                      ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute z-50 mt-1.5 w-full bg-white border border-gray-200
                        rounded-xl shadow-2xl max-h-72 overflow-hidden flex flex-col">
          {/* search bar */}
          <div className="p-2.5 border-b border-gray-100">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                autoFocus
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search banks…"
                className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200
                           rounded-lg focus:outline-none focus:ring-2
                           focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* list */}
          <div className="overflow-y-auto flex-1">
            {filtered.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-gray-400">
                No banks found
              </div>
            ) : (
              filtered.map((bank) => (
                <button
                  key={bank.code}
                  type="button"
                  onClick={() => { onSelect(bank); setOpen(false); setSearch(""); }}
                  className={`w-full text-left px-4 py-2.5 text-sm flex items-center
                              gap-2.5 transition-colors
                              ${selected?.code === bank.code
                                ? "bg-blue-50 text-blue-700 font-medium"
                                : "text-gray-700 hover:bg-gray-50"}`}
                >
                  <Building2 size={14} className="text-gray-400 shrink-0" />
                  <span className="truncate">{bank.name}</span>
                  {selected?.code === bank.code && (
                    <CheckCircle size={14} className="ml-auto text-blue-600 shrink-0" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ResolveStatus ────────────────────────────────────────────────────────────
function ResolveStatus({ status, name, error, onRetry }) {
  if (status === "idle") return null;

  if (status === "loading") {
    return (
      <div className="flex items-center gap-2.5 mt-2 px-4 py-3 bg-blue-50
                      border border-blue-100 rounded-xl">
        <Loader2 size={15} className="animate-spin text-blue-500 shrink-0" />
        <span className="text-sm text-blue-600 font-medium">Verifying account…</span>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="flex items-center gap-2.5 mt-2 px-4 py-3 bg-green-50
                      border border-green-200 rounded-xl">
        <CheckCircle size={15} className="text-green-600 shrink-0" />
        <div className="min-w-0">
          <p className="text-xs text-green-600 font-medium leading-none mb-0.5">
            Account verified
          </p>
          <p className="text-sm font-bold text-green-800 truncate">{name}</p>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex items-center justify-between mt-2 px-4 py-3
                      bg-red-50 border border-red-200 rounded-xl gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <XCircle size={15} className="text-red-500 shrink-0" />
          <p className="text-sm text-red-600 truncate">
            {error ?? "Verification failed"}
          </p>
        </div>
        <button
          type="button"
          onClick={onRetry}
          title="Retry"
          className="shrink-0 p-1.5 text-red-400 hover:text-red-600
                     hover:bg-red-100 rounded-lg transition-colors"
        >
          <RefreshCw size={14} />
        </button>
      </div>
    );
  }

  return null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// BankAccountInput
//
// Props
//   value    { bank_name, bank_code, account_number, account_name }
//   onChange (newValue) => void
//   disabled boolean
// ═══════════════════════════════════════════════════════════════════════════════
export default function BankAccountInput({ value = {}, onChange, disabled = false }) {
  const [banks,        setBanks]        = useState([]);
  const [banksLoaded,  setBanksLoaded]  = useState(false);
  const [selectedBank, setSelectedBank] = useState(null);
  const [acctNum,      setAcctNum]      = useState(value.account_number ?? "");
  const [resolveState, setResolveState] = useState({
    status: value.account_name ? "success" : "idle", // idle|loading|success|error
    name:   value.account_name ?? "",
    error:  null,
  });

  const debouncedAcctNum = useDebounce(acctNum, 600);
  const requestRef       = useRef(0);

  // ── load banks ─────────────────────────────────────────────────────────────
  useEffect(() => {
    api.get("/seller/payout/banks")
      .then(({ data }) => {
        if (!data.success) return;
        setBanks(data.banks);

        if (value.bank_name) {
          const match = data.banks.find(
            (b) => b.name.toLowerCase() === value.bank_name.toLowerCase()
          );
          if (match) setSelectedBank(match);
        }
      })
      .catch(() => toast.error("Failed to load banks"))
      .finally(() => setBanksLoaded(true));
  }, []); // eslint-disable-line

  // ── auto-resolve ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedBank || !/^\d{10}$/.test(debouncedAcctNum)) {
      setResolveState({ status: "idle", name: "", error: null });
      return;
    }

    const id = ++requestRef.current;

    setResolveState({ status: "loading", name: "", error: null });

    api.post("/seller/payout/resolve-account", {
      account_number: debouncedAcctNum,
      bank_name:      selectedBank.name,
    })
      .then(({ data }) => {
        if (requestRef.current !== id) return;

        if (data.success && data.account_name) {
          setResolveState({ status: "success", name: data.account_name, error: null });
          onChange?.({
            bank_name:      data.bank_name,
            bank_code:      data.bank_code,
            account_number: data.account_number,
            account_name:   data.account_name,
          });
        } else {
          setResolveState({ status: "error", name: "", error: data.message });
        }
      })
      .catch((err) => {
        if (requestRef.current !== id) return;
        setResolveState({
          status: "error",
          name:   "",
          error:  err.response?.data?.message ?? "Could not verify account",
        });
      });
  }, [debouncedAcctNum, selectedBank]); // eslint-disable-line

  // ── handlers ───────────────────────────────────────────────────────────────
  const handleBankSelect = useCallback((bank) => {
    setSelectedBank(bank);
    setResolveState({ status: "idle", name: "", error: null });
    onChange?.({
      bank_name:      bank.name,
      bank_code:      bank.code,
      account_number: acctNum,
      account_name:   "",
    });
  }, [acctNum, onChange]);

  const handleAcctChange = useCallback((e) => {
    const val = e.target.value.replace(/\D/g, "").slice(0, 10);
    setAcctNum(val);
    if (val.length < 10) {
      setResolveState({ status: "idle", name: "", error: null });
    }
  }, []);

  const handleRetry = useCallback(() => {
    setResolveState({ status: "idle", name: "", error: null });
    setAcctNum((prev) => prev); // trigger useEffect
    // bump debounce by forcing a re-render with same value
    setTimeout(() => requestRef.current++, 50);
  }, []);

  const digitCount   = acctNum.length;
  const showProgress = digitCount > 0 && digitCount < 10;

  return (
    <div className="space-y-4">

      {/* Bank dropdown */}
      <BankDropdown
        banks={banks}
        selected={selectedBank}
        onSelect={handleBankSelect}
        disabled={disabled || !banksLoaded}
      />

      {/* Account number input */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Account Number <span className="text-red-500">*</span>
        </label>

        <div className="relative">
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
            <Hash size={16} className="text-gray-400" />
          </div>

          <input
            type="text"
            inputMode="numeric"
            pattern="\d*"
            maxLength={10}
            value={acctNum}
            onChange={handleAcctChange}
            disabled={disabled || !selectedBank}
            placeholder={selectedBank ? "Enter 10-digit account number" : "Select a bank first"}
            className={`w-full pl-10 pr-12 py-3 border rounded-xl
                        text-lg font-mono tracking-widest transition-all duration-150
                        focus:outline-none focus:ring-2 focus:border-transparent
                        ${disabled || !selectedBank
                          ? "bg-gray-50 text-gray-400 cursor-not-allowed border-gray-200"
                          : resolveState.status === "success"
                          ? "border-green-400 focus:ring-green-500 bg-white"
                          : resolveState.status === "error"
                          ? "border-red-400 focus:ring-red-500 bg-white"
                          : "border-gray-300 focus:ring-blue-500 bg-white"}`}
          />

          {/* right icon */}
          <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
            {resolveState.status === "loading" ? (
              <Loader2 size={16} className="animate-spin text-blue-500" />
            ) : resolveState.status === "success" ? (
              <CheckCircle size={16} className="text-green-500" />
            ) : resolveState.status === "error" ? (
              <XCircle size={16} className="text-red-500" />
            ) : showProgress ? (
              <span className="text-xs font-mono text-gray-400 tabular-nums">
                {digitCount}/10
              </span>
            ) : null}
          </div>
        </div>

        {/* progress bar */}
        {showProgress && (
          <div className="mt-1.5 h-1 w-full bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-400 rounded-full transition-all duration-300"
              style={{ width: `${(digitCount / 10) * 100}%` }}
            />
          </div>
        )}

        {/* helper */}
        {!selectedBank && !disabled && (
          <p className="mt-1.5 text-xs text-gray-400 flex items-center gap-1">
            <AlertCircle size={11} />
            Select a bank above to enable this field
          </p>
        )}
      </div>

      {/* resolve status */}
      <ResolveStatus
        status={resolveState.status}
        name={resolveState.name}
        error={resolveState.error}
        onRetry={handleRetry}
      />

      {/* confirmed summary card */}
      {resolveState.status === "success" && resolveState.name && (
        <div className="flex items-center gap-3 p-4 bg-gray-50 border
                        border-gray-200 rounded-xl">
          <div className="w-10 h-10 rounded-full bg-green-100 flex items-center
                          justify-center shrink-0">
            <User size={18} className="text-green-600" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 truncate">
              {resolveState.name}
            </p>
            <p className="text-sm text-gray-500 truncate">
              {acctNum} · {selectedBank?.name}
            </p>
          </div>
          <CheckCircle size={18} className="text-green-500 shrink-0 ml-auto" />
        </div>
      )}
    </div>
  );
}