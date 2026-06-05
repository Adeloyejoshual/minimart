// SuperAdmin/VendorVerification.jsx
import { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";

const BASE = "https://minimart-ivrm.onrender.com/api/admin";

const api = () => {
  const token = localStorage.getItem("admin_token");
  const h     = { Authorization: `Bearer ${token}` };
  return {
    get:   (p)       => axios.get(`${BASE}${p}`,      { headers: h }),
    patch: (p, b)    => axios.patch(`${BASE}${p}`, b, { headers: h }),
    post:  (p, b={}) => axios.post(`${BASE}${p}`, b,  { headers: h }),
  };
};

const STATUS_CONFIG = {
  pending:      { label: "Pending",      color: "#f59e0b", bg: "#fffbeb" },
  under_review: { label: "Under Review", color: "#3b82f6", bg: "#eff6ff" },
  approved:     { label: "Approved",     color: "#10b981", bg: "#ecfdf5" },
  active:       { label: "Active",       color: "#6366f1", bg: "#eef2ff" },
  rejected:     { label: "Rejected",     color: "#ef4444", bg: "#fef2f2" },
  suspended:    { label: "Suspended",    color: "#6b7280", bg: "#f9fafb" },
};

const ALLOWED_TRANSITIONS = {
  pending:      ["under_review", "rejected"],
  under_review: ["approved", "rejected"],
  approved:     ["active", "rejected"],
  active:       ["suspended"],
  suspended:    ["active"],
  rejected:     [],
};

const STATUS_FILTERS = [
  "all", "pending", "under_review",
  "approved", "active", "rejected", "suspended",
];

const LIMIT = 20;

const ID_LABELS = {
  nin:      "NIN",
  passport: "Passport",
  drivers:  "Driver's Licence",
  voters:   "Voter's Card",
};

// ══════════════════════════════════════════════════════════════
export default function VendorVerification({ confirm, onMutation }) {
  const [vendors,        setVendors]        = useState([]);
  const [statusCounts,   setStatusCounts]   = useState({});
  const [pagination,     setPagination]     = useState({
    total: 0, page: 1, limit: LIMIT, total_pages: 1,
  });
  const [loading,        setLoading]        = useState(true);
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [detailLoading,  setDetailLoading]  = useState(false);
  const [actionLoading,  setActionLoading]  = useState(null);
  const [statusFilter,   setStatusFilter]   = useState("pending");
  const [search,         setSearch]         = useState("");
  const [activeTab,      setActiveTab]      = useState("info");
  const [notes,          setNotes]          = useState("");

  const [statusModal, setStatusModal] = useState({
    open: false, status: "", reason: "",
  });

  const walletCacheRef = useRef({});

  // ── Debounced search ──────────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => fetchVendors(1), 500);
    return () => clearTimeout(timer);
  }, [search, statusFilter]);

  // ── Fetch vendors ─────────────────────────────────────────
  const fetchVendors = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page, limit: LIMIT,
        ...(statusFilter !== "all" && { status: statusFilter }),
        ...(search.trim()          && { search: search.trim() }),
      });

      const { data } = await api().get(`/vendors?${params}`);
      setVendors(data.vendors ?? []);
      setStatusCounts(data.status_counts ?? {});

      const total = Number(data.pagination?.total ?? data.total ?? 0);
      setPagination({
        total, page, limit: LIMIT,
        total_pages: Math.max(1, Math.ceil(total / LIMIT)),
      });
    } catch (err) {
      console.error("[VendorVerification] fetch:", err.message);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search]);

  // ── Fetch vendor detail ───────────────────────────────────
  const fetchDetail = useCallback(async (id) => {
    setDetailLoading(true);
    setActiveTab("info");
    try {
      const { data } = await api().get(`/vendors/${id}`);
      setSelectedVendor(data);
      setNotes(
        data?.vendor?.verification_notes ??
        data?.vendor?.notes              ?? ""
      );
    } catch (err) {
      console.error("[VendorVerification] detail:", err.message);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  // ── Update status ─────────────────────────────────────────
  const updateStatus = useCallback(async () => {
    const { status, reason } = statusModal;
    const vendorId = selectedVendor?.vendor?.id;
    if (!vendorId || !status) return;

    setActionLoading("status");
    try {
      const { data } = await api().patch(
        `/vendors/${vendorId}/status`,
        { status, ...(reason.trim() && { reason: reason.trim() }) }
      );

      await Promise.all([
        fetchDetail(vendorId),
        fetchVendors(pagination.page),
      ]);

      onMutation?.();
      setStatusModal({ open: false, status: "", reason: "" });

      if (data.virtual_account) {
        alert(
          `✅ Virtual account created!\n` +
          `Account: ${data.virtual_account.account_number}\n` +
          `Bank: ${data.virtual_account.bank_name}`
        );
      }
    } catch (err) {
      alert(err.response?.data?.message ?? "Failed to update status");
    } finally {
      setActionLoading(null);
    }
  }, [statusModal, selectedVendor, pagination.page, fetchDetail, fetchVendors, onMutation]);

  // ── Retry virtual account ─────────────────────────────────
  const retryVirtualAccount = useCallback(async (vendorId) => {
    setActionLoading("va");
    try {
      const { data } = await api().post(`/vendors/${vendorId}/create-virtual-account`);
      delete walletCacheRef.current[vendorId];
      await fetchDetail(vendorId);
      alert(
        `✅ Virtual account created!\n` +
        `Account: ${data.virtual_account?.account_number}\n` +
        `Bank: ${data.virtual_account?.bank_name}`
      );
    } catch (err) {
      alert(err.response?.data?.message ?? "Virtual account creation failed");
    } finally {
      setActionLoading(null);
    }
  }, [fetchDetail]);

  // ── Save notes ────────────────────────────────────────────
  const saveNotes = useCallback(async (vendorId) => {
    if (!notes.trim()) return;
    setActionLoading("notes");
    try {
      await api().patch(`/vendors/${vendorId}/verification-notes`, { notes });
      await fetchDetail(vendorId);
    } catch (err) {
      alert(err.response?.data?.message ?? "Failed to save notes");
    } finally {
      setActionLoading(null);
    }
  }, [notes, fetchDetail]);

  return (
    <div style={s.wrap}>

      {/* ── Header ─────────────────────────────────────── */}
      <div style={s.header}>
        <div>
          <h2 style={s.title}>🏪 Vendor Verification</h2>
          <p style={s.subtitle}>Review and approve seller applications</p>
        </div>
        <div style={s.countPills}>
          {["pending", "under_review", "active"].map((st) => {
            const cfg = STATUS_CONFIG[st];
            return (
              <div key={st} style={{ ...s.countPill, background: cfg.bg, color: cfg.color }}>
                <span style={{ fontWeight: 800 }}>{statusCounts[st] ?? 0}</span>
                <span style={{ fontSize: "0.75rem" }}>{cfg.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Filters ──────────────────────────────────────── */}
      <div style={s.filters}>
        <div style={s.tabs}>
          {STATUS_FILTERS.map((st) => (
            <button
              key={st}
              style={{ ...s.tab, ...(statusFilter === st ? s.tabActive : {}) }}
              onClick={() => { setStatusFilter(st); setSelectedVendor(null); }}
            >
              {st === "all" ? "All" : STATUS_CONFIG[st]?.label ?? st}
              {st !== "all" && statusCounts[st] ? ` (${statusCounts[st]})` : ""}
            </button>
          ))}
        </div>
        <input
          style={s.search}
          placeholder="🔍 Search store, owner, email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* ── Layout ───────────────────────────────────────── */}
      <div style={s.layout}>

        {/* List */}
        <div style={s.list}>
          {loading ? <LoadingRows /> :
           vendors.length === 0 ? <div style={s.empty}>No vendors found</div> :
           vendors.map((v) => (
            <VendorRow
              key={v.id}
              vendor={v}
              selected={selectedVendor?.vendor?.id === v.id}
              onClick={() => fetchDetail(v.id)}
            />
          ))}
          {pagination.total_pages > 1 && (
            <Pagination pagination={pagination} onPage={(p) => fetchVendors(p)} />
          )}
        </div>

        {/* Detail */}
        {selectedVendor ? (
          <div style={s.detail}>
            {detailLoading ? (
              <div style={s.detailLoading}>Loading...</div>
            ) : (
              <DetailPanel
                data={selectedVendor}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                statusModal={statusModal}
                setStatusModal={setStatusModal}
                updateStatus={updateStatus}
                actionLoading={actionLoading}
                retryVirtualAccount={retryVirtualAccount}
                notes={notes}
                setNotes={setNotes}
                saveNotes={saveNotes}
                walletCacheRef={walletCacheRef}
                onClose={() => setSelectedVendor(null)}
              />
            )}
          </div>
        ) : (
          <div style={s.detailEmpty}>
            <div style={{ fontSize: "3rem" }}>🏪</div>
            <p>Select a vendor to review</p>
          </div>
        )}
      </div>

      {statusModal.open && (
        <StatusModal
          modal={statusModal}
          setModal={setStatusModal}
          onConfirm={updateStatus}
          loading={actionLoading === "status"}
        />
      )}
    </div>
  );
}

// ── Vendor Row ────────────────────────────────────────────────
function VendorRow({ vendor, selected, onClick }) {
  const cfg = STATUS_CONFIG[vendor.status] ?? STATUS_CONFIG.pending;
  return (
    <div style={{ ...s.vendorRow, ...(selected ? s.vendorRowSelected : {}) }} onClick={onClick}>
      {vendor.store_logo ? (
        <img src={vendor.store_logo} alt="" style={s.vendorLogo} />
      ) : (
        <div style={s.vendorLogoPlaceholder}>
          {vendor.store_name?.[0]?.toUpperCase() ?? "S"}
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={s.vendorName}>{vendor.store_name}</div>
        <div style={s.vendorOwner}>{vendor.owner_email}</div>
        <div style={s.vendorMeta}>
          {vendor.store_category} · {new Date(vendor.created_at).toLocaleDateString()}
        </div>
      </div>
      <span style={{ ...s.statusBadge, color: cfg.color, background: cfg.bg }}>
        {cfg.label}
      </span>
    </div>
  );
}

// ── Detail Panel ──────────────────────────────────────────────
function DetailPanel({
  data, activeTab, setActiveTab,
  statusModal, setStatusModal,
  updateStatus, actionLoading,
  retryVirtualAccount,
  notes, setNotes, saveNotes,
  walletCacheRef, onClose,
}) {
  const { vendor, history } = data;
  const cfg     = STATUS_CONFIG[vendor.status] ?? STATUS_CONFIG.pending;
  const allowed = ALLOWED_TRANSITIONS[vendor.status] ?? [];

  return (
    <div style={s.detailWrap}>

      {/* Header */}
      <div style={s.detailHeader}>
        <div style={s.detailHeaderLeft}>
          {vendor.store_logo ? (
            <img src={vendor.store_logo} alt="" style={s.detailLogo} />
          ) : (
            <div style={s.detailLogoPlaceholder}>
              {vendor.store_name?.[0]?.toUpperCase() ?? "S"}
            </div>
          )}
          <div>
            <h3 style={s.detailName}>{vendor.store_name}</h3>
            <span style={{ ...s.statusBadge, color: cfg.color, background: cfg.bg }}>
              {cfg.label}
            </span>
          </div>
        </div>
        <button style={s.closeBtn} onClick={onClose}>✕</button>
      </div>

      {/* Actions */}
      {allowed.length > 0 && (
        <div style={s.actionRow}>
          {allowed.map((st) => {
            const c = STATUS_CONFIG[st];
            return (
              <button
                key={st}
                style={{
                  ...s.actionBtn,
                  background: c.bg, color: c.color,
                  border: `1px solid ${c.color}`,
                  opacity: actionLoading ? 0.6 : 1,
                }}
                disabled={!!actionLoading}
                onClick={() => {
                  if (["rejected", "suspended"].includes(st)) {
                    if (!window.confirm(`Are you sure you want to ${st} this vendor?`)) return;
                  }
                  setStatusModal({ open: true, status: st, reason: "" });
                }}
              >
                {st === "active"       && "✅ Activate"}
                {st === "approved"     && "👍 Approve"}
                {st === "under_review" && "🔍 Under Review"}
                {st === "rejected"     && "❌ Reject"}
                {st === "suspended"    && "🚫 Suspend"}
              </button>
            );
          })}
          {vendor.status === "active" &&
           !vendor.virtual_account_number &&
           !actionLoading && (
            <button
              style={{ ...s.actionBtn, background: "#eef2ff", color: "#6366f1", border: "1px solid #6366f1" }}
              onClick={() => retryVirtualAccount(vendor.id)}
            >
              🏦 Create Virtual Account
            </button>
          )}
        </div>
      )}

      {/* Tabs */}
      <div style={s.detailTabs}>
        {[
          { key: "info",    label: "ℹ️ Info"    },
          { key: "id",      label: "🪪 ID"       },
          { key: "docs",    label: "📄 Docs"    },
          { key: "bank",    label: "🏦 Bank"    },
          { key: "wallet",  label: "💳 Wallet"  },
          { key: "history", label: "📋 History" },
        ].map((tab) => (
          <button
            key={tab.key}
            style={{ ...s.detailTab, ...(activeTab === tab.key ? s.detailTabActive : {}) }}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={s.detailBody}>

        {/* INFO TAB */}
        {activeTab === "info" && (
          <div style={s.infoGrid}>
            <InfoRow label="Owner"    value={vendor.owner_name}     />
            <InfoRow label="Email"    value={vendor.owner_email}    />
            <InfoRow label="Phone"    value={vendor.owner_phone}    />
            <InfoRow label="Category" value={vendor.store_category} />
            <InfoRow label="Applied"  value={new Date(vendor.created_at).toLocaleDateString()} />
            {vendor.approved_at && (
              <InfoRow label="Approved"  value={new Date(vendor.approved_at).toLocaleDateString()} />
            )}
            {vendor.activated_at && (
              <InfoRow label="Activated" value={new Date(vendor.activated_at).toLocaleDateString()} />
            )}
            {vendor.rejection_reason && (
              <InfoRow label="Rejected Reason"  value={vendor.rejection_reason}  danger />
            )}
            {vendor.suspended_reason && (
              <InfoRow label="Suspended Reason" value={vendor.suspended_reason}  danger />
            )}
            {vendor.store_description && (
              <div style={s.descBox}>
                <span style={s.descLabel}>Description</span>
                <p style={s.descText}>{vendor.store_description}</p>
              </div>
            )}
            {/* Internal notes */}
            <div style={s.notesSection}>
              <label style={s.notesLabel}>Internal Notes</label>
              {vendor.verification_notes && (
                <div style={s.existingNote}>{vendor.verification_notes}</div>
              )}
              <textarea
                style={s.notesInput}
                placeholder="Add review notes (internal only)..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
              <button
                style={{ ...s.saveNotesBtn, opacity: actionLoading === "notes" || !notes.trim() ? 0.6 : 1 }}
                disabled={actionLoading === "notes" || !notes.trim()}
                onClick={() => saveNotes(vendor.id)}
              >
                {actionLoading === "notes" ? "Saving..." : "Save Notes"}
              </button>
            </div>
          </div>
        )}

        {/* ✅ ID TAB — NIN/Passport number + address */}
        {activeTab === "id" && (
          <div style={s.infoGrid}>
            <div style={s.idSectionTitle}>🪪 Identity Information</div>

            {vendor.id_type ? (
              <>
                <InfoRow
                  label="ID Type"
                  value={ID_LABELS[vendor.id_type] ?? vendor.id_type?.toUpperCase()}
                />
                <InfoRow
                  label="ID Number"
                  value={
                    <span style={{
                      fontFamily:    "monospace",
                      letterSpacing: "0.08em",
                      fontSize:      "0.9rem",
                    }}>
                      {vendor.id_number ?? "—"}
                    </span>
                  }
                />
              </>
            ) : (
              <div style={s.noIdBox}>
                ⚠️ No ID information submitted yet
              </div>
            )}

            <div style={{ ...s.idSectionTitle, marginTop: "0.75rem" }}>
              📍 Residential Address
            </div>

            {vendor.seller_address ? (
              <div style={s.addressBox}>
                <span style={{ fontSize: "1.1rem" }}>📍</span>
                <p style={s.addressText}>{vendor.seller_address}</p>
              </div>
            ) : (
              <div style={s.noIdBox}>
                ⚠️ No address submitted yet
              </div>
            )}

            {/* Verification status */}
            {vendor.verification_status && (
              <>
                <div style={{ ...s.idSectionTitle, marginTop: "0.75rem" }}>
                  📋 Verification Status
                </div>
                <InfoRow
                  label="Doc Status"
                  value={vendor.verification_status}
                />
              </>
            )}
          </div>
        )}

        {/* ✅ DOCS TAB — now includes id_card_back */}
        {activeTab === "docs" && (
          <div>
            {/* ID front + back side by side */}
            <div style={s.docsGrid}>
              <DocImage
                label="🪪 ID / Passport — Front"
                url={vendor.id_card_url}
                required
                side="front"
              />
              <DocImage
                label="🪪 ID / Passport — Back"
                url={vendor.id_card_back_url}
                required
                side="back"
              />
            </div>

            {/* Selfie + optional docs */}
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginTop: "1rem" }}>
              <DocImage label="🤳 Selfie with ID"        url={vendor.selfie_url}        required />
              <DocImage label="📄 Business Registration" url={vendor.business_doc_url}           />
              <DocImage label="📍 Address Proof"         url={vendor.address_proof_url}          />
            </div>
          </div>
        )}

        {/* BANK TAB */}
        {activeTab === "bank" && (
          <div style={s.infoGrid}>
            <InfoRow label="Bank Name"      value={vendor.bank_name}    />
            <InfoRow label="Account Number" value={vendor.bank_account} />
            <InfoRow label="Account Name"   value={vendor.account_name} />

            {vendor.virtual_account_number ? (
              <>
                <div style={s.sectionDivider}>🏦 Virtual Account</div>
                <InfoRow label="Virtual Account" value={vendor.virtual_account_number} />
                <InfoRow label="Virtual Bank"    value={vendor.virtual_bank_name}      />
                <InfoRow label="Virtual Name"    value={vendor.virtual_account_name}   />
                <InfoRow label="VA Status"       value={vendor.virtual_account_status} />
              </>
            ) : (
              <div style={s.noVA}>
                ⚠️ No virtual account yet
                {vendor.status !== "active" && (
                  <span style={s.noVAHint}> — created when vendor is activated</span>
                )}
              </div>
            )}
          </div>
        )}

        {/* WALLET TAB */}
        {activeTab === "wallet" && (
          <WalletTab vendorId={vendor.id} walletCacheRef={walletCacheRef} />
        )}

        {/* HISTORY TAB */}
        {activeTab === "history" && (
          <div style={s.historyList}>
            {!history?.length ? (
              <div style={s.empty}>No status changes yet</div>
            ) : history.map((h, i) => (
              <div key={i} style={s.historyRow}>
                <div style={s.historyBadges}>
                  <StatusBadge status={h.old_status} />
                  <span style={s.arrow}>→</span>
                  <StatusBadge status={h.new_status} />
                </div>
                <div style={s.historyMeta}>
                  {h.changed_by_name && <span>by {h.changed_by_name}</span>}
                  <span>{new Date(h.created_at).toLocaleString()}</span>
                </div>
                {h.reason && (
                  <div style={s.historyReason}>"{h.reason}"</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Wallet Tab ────────────────────────────────────────────────
function WalletTab({ vendorId, walletCacheRef }) {
  const [walletData, setWalletData] = useState(null);
  const [loading,    setLoading]    = useState(true);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      if (walletCacheRef.current[vendorId]) {
        setWalletData(walletCacheRef.current[vendorId]);
        setLoading(false);
        return;
      }
      try {
        const { data } = await api().get(`/vendors/${vendorId}/wallet`);
        walletCacheRef.current[vendorId] = data;
        setWalletData(data);
      } catch (err) {
        console.error("[WalletTab]", err.message);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [vendorId, walletCacheRef]);

  if (loading) return <div style={s.empty}>Loading wallet...</div>;
  if (!walletData?.wallet) {
    return <div style={s.empty}>💳 No wallet yet — created when vendor is activated</div>;
  }

  const balance         = walletData.wallet;
  const virtual_account = walletData.virtual_account;
  const transactions    = walletData.transactions ?? [];
  const withdrawals     = walletData.withdrawals  ?? [];

  return (
    <div>
      <div style={s.balanceGrid}>
        <BalanceCard label="Available"     value={balance?.available_balance ?? 0} color="#10b981" />
        <BalanceCard label="Pending"       value={balance?.pending_balance   ?? 0} color="#f59e0b" />
        <BalanceCard label="Total Received"value={balance?.total_received    ?? 0} color="#6366f1" />
        <BalanceCard label="Withdrawn"     value={balance?.total_withdrawn   ?? 0} color="#6b7280" />
      </div>

      {virtual_account && (
        <div style={s.vaBox}>
          <span style={s.vaLabel}>🏦 Virtual Account</span>
          <span style={s.vaNumber}>{virtual_account.account_number}</span>
          <span style={s.vaBank}>
            {virtual_account.account_name} · {virtual_account.bank_name}
          </span>
        </div>
      )}

      {transactions.length > 0 && (
        <div style={s.txSection}>
          <div style={s.txTitle}>Recent Transactions</div>
          {transactions.slice(0, 5).map((tx) => (
            <div key={tx.id} style={s.txRow}>
              <span style={{ ...s.txType, color: tx.type === "credit" ? "#10b981" : "#ef4444" }}>
                {tx.type === "credit" ? "↑" : "↓"} {tx.type}
              </span>
              <span style={s.txAmount}>₦{Number(tx.amount).toLocaleString()}</span>
              <span style={s.txDate}>{new Date(tx.created_at).toLocaleDateString()}</span>
              <TxStatus status={tx.status} />
            </div>
          ))}
        </div>
      )}

      {withdrawals.length > 0 && (
        <div style={{ ...s.txSection, marginTop: "1rem" }}>
          <div style={s.txTitle}>Recent Withdrawals</div>
          {withdrawals.slice(0, 5).map((wd) => (
            <div key={wd.id} style={s.txRow}>
              <span style={{ ...s.txType, color: "#ef4444" }}>↓ withdrawal</span>
              <span style={s.txAmount}>₦{Number(wd.amount).toLocaleString()}</span>
              <span style={s.txDate}>{new Date(wd.created_at).toLocaleDateString()}</span>
              <TxStatus status={wd.status} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Status Modal ──────────────────────────────────────────────
function StatusModal({ modal, setModal, onConfirm, loading }) {
  const cfg            = STATUS_CONFIG[modal.status] ?? {};
  const requiresReason = ["rejected", "suspended"].includes(modal.status);

  return (
    <div style={s.modalOverlay} onClick={() => setModal({ ...modal, open: false })}>
      <div style={s.modal} onClick={(e) => e.stopPropagation()}>
        <h3 style={s.modalTitle}>Confirm Status Change</h3>
        <p style={s.modalBody}>
          Change vendor status to{" "}
          <span style={{ color: cfg.color, fontWeight: 700 }}>{cfg.label}</span>?
        </p>
        {requiresReason && (
          <div style={s.modalReasonWrap}>
            <label style={s.modalReasonLabel}>
              Reason <span style={{ color: "#ef4444" }}>*</span>
            </label>
            <textarea
              style={s.modalReason}
              placeholder={
                modal.status === "rejected"
                  ? "e.g. Documents unclear, invalid ID..."
                  : "e.g. Policy violation..."
              }
              value={modal.reason}
              onChange={(e) => setModal({ ...modal, reason: e.target.value })}
              rows={3}
              autoFocus
            />
          </div>
        )}
        <div style={s.modalBtns}>
          <button style={s.modalCancelBtn} onClick={() => setModal({ ...modal, open: false })}>
            Cancel
          </button>
          <button
            style={{
              ...s.modalConfirmBtn,
              background: cfg.color ?? "#6366f1",
              opacity: loading || (requiresReason && !modal.reason.trim()) ? 0.6 : 1,
            }}
            disabled={loading || (requiresReason && !modal.reason.trim())}
            onClick={onConfirm}
          >
            {loading ? "Updating..." : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Small components ──────────────────────────────────────────
function DocImage({ label, url, required, side }) {
  if (!url) {
    return (
      <div style={s.docMissing}>
        <div>
          <span>{label}</span>
          {side && (
            <span style={{
              ...s.sideBadge,
              background: side === "front" ? "#eef2ff" : "#f0fdf4",
              color:      side === "front" ? "#6366f1" : "#16a34a",
            }}>
              {side}
            </span>
          )}
        </div>
        <span style={{ color: required ? "#ef4444" : "#9ca3af" }}>
          {required ? "⚠️ Missing" : "Not provided"}
        </span>
      </div>
    );
  }
  return (
    <div style={s.docCard}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <span style={s.docLabel}>{label}</span>
        {side && (
          <span style={{
            ...s.sideBadge,
            background: side === "front" ? "#eef2ff" : "#f0fdf4",
            color:      side === "front" ? "#6366f1" : "#16a34a",
          }}>
            {side}
          </span>
        )}
      </div>
      <a href={url} target="_blank" rel="noreferrer">
        <img src={url} alt={label} style={s.docImg} />
      </a>
      <a href={url} target="_blank" rel="noreferrer" style={s.docLink}>
        Open full size ↗
      </a>
    </div>
  );
}

function InfoRow({ label, value, danger }) {
  return (
    <div style={s.infoRow}>
      <span style={s.infoLabel}>{label}</span>
      <span style={{ ...s.infoValue, color: danger ? "#ef4444" : "#1f2937" }}>
        {value ?? "—"}
      </span>
    </div>
  );
}

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, color: "#6b7280", bg: "#f9fafb" };
  return (
    <span style={{
      padding: "0.15rem 0.5rem", borderRadius: "100px",
      fontSize: "0.72rem", fontWeight: 700,
      color: cfg.color, background: cfg.bg,
    }}>
      {cfg.label}
    </span>
  );
}

function BalanceCard({ label, value, color }) {
  return (
    <div style={{ ...s.balanceCard, borderTop: `3px solid ${color}` }}>
      <span style={{ ...s.balanceAmount, color }}>
        ₦{Number(value).toLocaleString("en-NG", { minimumFractionDigits: 2 })}
      </span>
      <span style={s.balanceLabel}>{label}</span>
    </div>
  );
}

function TxStatus({ status }) {
  const map = {
    success: { color: "#10b981", label: "Success" },
    pending: { color: "#f59e0b", label: "Pending" },
    failed:  { color: "#ef4444", label: "Failed"  },
  };
  const cfg = map[status] ?? map.pending;
  return <span style={{ fontSize: "0.72rem", fontWeight: 600, color: cfg.color }}>{cfg.label}</span>;
}

function Pagination({ pagination, onPage }) {
  const { page, total_pages, total } = pagination;
  return (
    <div style={s.pagination}>
      <button style={s.pageBtn} disabled={page <= 1} onClick={() => onPage(page - 1)}>← Prev</button>
      <span style={s.pageInfo}>
        {page} / {total_pages}
        <span style={{ color: "#9ca3af", marginLeft: "0.5rem" }}>({total} total)</span>
      </span>
      <button style={s.pageBtn} disabled={page >= total_pages} onClick={() => onPage(page + 1)}>Next →</button>
    </div>
  );
}

function LoadingRows() {
  return (
    <div>
      {[1,2,3,4,5].map((i) => (
        <div key={i} style={s.skeletonRow}>
          <div style={s.skeletonCircle} />
          <div style={{ flex: 1 }}>
            <div style={s.skeletonLine} />
            <div style={{ ...s.skeletonLine, width: "60%", marginTop: 6 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────
const s = {
  wrap:      { display: "flex", flexDirection: "column", gap: "1.25rem" },
  header:    { display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" },
  title:     { fontSize: "1.35rem", fontWeight: 800, color: "var(--text,#1f2937)", margin: 0 },
  subtitle:  { color: "var(--muted,#6b7280)", fontSize: "0.875rem", margin: "0.25rem 0 0" },
  countPills:{ display: "flex", gap: "0.75rem", flexWrap: "wrap" },
  countPill: { display: "flex", flexDirection: "column", alignItems: "center", padding: "0.5rem 1rem", borderRadius: "12px", minWidth: "70px", gap: "0.15rem" },
  filters:   { display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" },
  tabs:      { display: "flex", gap: "0.35rem", flexWrap: "wrap" },
  tab:       { padding: "0.4rem 0.875rem", border: "1px solid #e5e7eb", borderRadius: "100px", background: "white", fontSize: "0.8rem", color: "#6b7280", cursor: "pointer", fontWeight: 500 },
  tabActive: { background: "#6366f1", color: "white", borderColor: "#6366f1", fontWeight: 700 },
  search:    { flex: 1, minWidth: "200px", padding: "0.5rem 0.875rem", border: "1px solid #e5e7eb", borderRadius: "10px", fontSize: "0.875rem", outline: "none" },
  layout:    { display: "grid", gridTemplateColumns: "340px 1fr", gap: "1.25rem", minHeight: "500px" },
  list:               { background: "white", borderRadius: "14px", border: "1px solid #f3f4f6", overflow: "hidden", display: "flex", flexDirection: "column" },
  vendorRow:          { display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.875rem 1rem", cursor: "pointer", borderBottom: "1px solid #f9fafb", transition: "background 0.1s" },
  vendorRowSelected:  { background: "#eef2ff" },
  vendorLogo:         { width: "40px", height: "40px", borderRadius: "10px", objectFit: "cover", flexShrink: 0 },
  vendorLogoPlaceholder: { width: "40px", height: "40px", borderRadius: "10px", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: "1.1rem", flexShrink: 0 },
  vendorName:  { fontWeight: 600, color: "#1f2937", fontSize: "0.875rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  vendorOwner: { fontSize: "0.78rem", color: "#6b7280", marginTop: "0.15rem" },
  vendorMeta:  { fontSize: "0.72rem", color: "#9ca3af", marginTop: "0.1rem" },
  statusBadge: { display: "inline-block", padding: "0.15rem 0.6rem", borderRadius: "100px", fontSize: "0.72rem", fontWeight: 700, whiteSpace: "nowrap", flexShrink: 0 },
  detail:      { background: "white", borderRadius: "14px", border: "1px solid #f3f4f6", overflow: "hidden" },
  detailEmpty: { background: "white", borderRadius: "14px", border: "1px solid #f3f4f6", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#9ca3af", gap: "0.75rem", minHeight: "400px" },
  detailLoading: { display: "flex", alignItems: "center", justifyContent: "center", minHeight: "300px", color: "#9ca3af" },
  detailWrap:       { display: "flex", flexDirection: "column", height: "100%" },
  detailHeader:     { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1rem 1.25rem", borderBottom: "1px solid #f3f4f6" },
  detailHeaderLeft: { display: "flex", alignItems: "center", gap: "0.875rem" },
  detailLogo:       { width: "48px", height: "48px", borderRadius: "12px", objectFit: "cover" },
  detailLogoPlaceholder: { width: "48px", height: "48px", borderRadius: "12px", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: "1.25rem" },
  detailName:  { fontWeight: 800, color: "#1f2937", margin: "0 0 0.25rem" },
  closeBtn:    { background: "none", border: "none", fontSize: "1.1rem", cursor: "pointer", color: "#9ca3af", padding: "0.25rem" },
  actionRow:   { display: "flex", gap: "0.5rem", padding: "0.75rem 1.25rem", flexWrap: "wrap", borderBottom: "1px solid #f3f4f6" },
  actionBtn:   { padding: "0.45rem 0.875rem", borderRadius: "8px", fontWeight: 600, fontSize: "0.8rem", cursor: "pointer", transition: "all 0.15s" },
  detailTabs:     { display: "flex", borderBottom: "1px solid #f3f4f6", overflowX: "auto" },
  detailTab:      { padding: "0.65rem 1rem", border: "none", background: "transparent", color: "#6b7280", fontSize: "0.85rem", cursor: "pointer", whiteSpace: "nowrap", fontWeight: 500, borderBottom: "2px solid transparent" },
  detailTabActive:{ color: "#6366f1", borderBottomColor: "#6366f1", fontWeight: 700 },
  detailBody:     { padding: "1.25rem", overflowY: "auto", flex: 1 },
  infoGrid:    { display: "flex", flexDirection: "column", gap: "0.5rem" },
  infoRow:     { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.5rem 0.75rem", background: "#f8fafc", borderRadius: "8px" },
  infoLabel:   { color: "#6b7280", fontSize: "0.8rem", fontWeight: 500 },
  infoValue:   { fontWeight: 600, fontSize: "0.875rem", textAlign: "right", wordBreak: "break-all" },
  descBox:     { padding: "0.75rem", background: "#f8fafc", borderRadius: "8px" },
  descLabel:   { color: "#6b7280", fontSize: "0.8rem", fontWeight: 500, display: "block", marginBottom: "0.35rem" },
  descText:    { fontSize: "0.875rem", color: "#374151", margin: 0, lineHeight: 1.5 },
  notesSection:{ marginTop: "1rem", display: "flex", flexDirection: "column", gap: "0.5rem" },
  notesLabel:  { fontWeight: 600, color: "#374151", fontSize: "0.85rem" },
  existingNote:{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: "8px", padding: "0.5rem 0.75rem", fontSize: "0.8rem", color: "#92400e" },
  notesInput:  { width: "100%", padding: "0.75rem", border: "1px solid #e5e7eb", borderRadius: "8px", fontSize: "0.875rem", resize: "vertical", outline: "none", boxSizing: "border-box" },
  saveNotesBtn:{ alignSelf: "flex-end", padding: "0.45rem 1rem", background: "#6366f1", color: "white", border: "none", borderRadius: "8px", fontWeight: 600, fontSize: "0.8rem", cursor: "pointer" },

  // ✅ ID tab styles
  idSectionTitle: { fontWeight: 700, color: "#374151", fontSize: "0.85rem", padding: "0.25rem 0", borderBottom: "1px solid #f3f4f6", marginBottom: "0.25rem" },
  noIdBox:   { background: "#fffbeb", border: "1px solid #fde68a", borderRadius: "8px", padding: "0.75rem", color: "#92400e", fontSize: "0.85rem" },
  addressBox:{ display: "flex", alignItems: "flex-start", gap: "0.75rem", background: "#ecfdf5", border: "1px solid #a7f3d0", borderRadius: "8px", padding: "0.875rem 1rem" },
  addressText:{ color: "#064e3b", fontWeight: 600, fontSize: "0.875rem", margin: 0, lineHeight: 1.5 },

  docsGrid:  { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" },
  docCard:   { background: "#f8fafc", borderRadius: "10px", padding: "0.75rem", display: "flex", flexDirection: "column", gap: "0.5rem" },
  docLabel:  { fontWeight: 600, color: "#374151", fontSize: "0.8rem" },
  docImg:    { width: "100%", borderRadius: "8px", objectFit: "cover", maxHeight: "180px", border: "1px solid #e5e7eb" },
  docLink:   { fontSize: "0.75rem", color: "#6366f1", textDecoration: "none" },
  docMissing:{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.75rem", background: "#f8fafc", borderRadius: "10px", fontSize: "0.8rem", color: "#374151", gap: "0.5rem" },
  sideBadge: { fontSize: "0.65rem", fontWeight: 700, padding: "0.1rem 0.45rem", borderRadius: "100px", textTransform: "uppercase", letterSpacing: "0.04em" },

  sectionDivider:{ fontWeight: 700, color: "#6366f1", fontSize: "0.8rem", padding: "0.5rem 0", borderTop: "1px solid #f3f4f6", marginTop: "0.5rem" },
  noVA:  { background: "#fffbeb", border: "1px solid #fde68a", borderRadius: "8px", padding: "0.75rem", color: "#92400e", fontSize: "0.85rem" },
  noVAHint: { color: "#a16207", fontSize: "0.8rem" },
  balanceGrid:  { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "1rem" },
  balanceCard:  { background: "#f8fafc", borderRadius: "10px", padding: "0.875rem", display: "flex", flexDirection: "column", gap: "0.25rem" },
  balanceAmount:{ fontWeight: 800, fontSize: "1.1rem" },
  balanceLabel: { fontSize: "0.75rem", color: "#9ca3af", fontWeight: 500 },
  vaBox:  { background: "#ecfdf5", border: "1px solid #a7f3d0", borderRadius: "10px", padding: "0.875rem", marginBottom: "1rem", display: "flex", flexDirection: "column", gap: "0.25rem" },
  vaLabel:{ fontSize: "0.75rem", fontWeight: 600, color: "#065f46" },
  vaNumber:{ fontWeight: 800, fontSize: "1.15rem", color: "#064e3b" },
  vaBank: { fontSize: "0.8rem", color: "#047857" },
  txSection:{ marginTop: "0.75rem" },
  txTitle:  { fontWeight: 700, color: "#374151", fontSize: "0.85rem", marginBottom: "0.5rem" },
  txRow:    { display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.5rem 0", borderBottom: "1px solid #f9fafb", fontSize: "0.82rem" },
  txType:   { fontWeight: 600, width: "80px", flexShrink: 0 },
  txAmount: { fontWeight: 700, color: "#1f2937", flex: 1 },
  txDate:   { color: "#9ca3af", flexShrink: 0 },
  historyList:  { display: "flex", flexDirection: "column", gap: "0.75rem" },
  historyRow:   { background: "#f8fafc", borderRadius: "10px", padding: "0.75rem 1rem" },
  historyBadges:{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.35rem" },
  arrow:        { color: "#9ca3af", fontSize: "0.8rem" },
  historyMeta:  { display: "flex", gap: "1rem", fontSize: "0.75rem", color: "#9ca3af" },
  historyReason:{ fontSize: "0.8rem", color: "#6b7280", marginTop: "0.35rem", fontStyle: "italic" },
  modalOverlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 },
  modal:        { background: "white", borderRadius: "16px", padding: "2rem", maxWidth: "420px", width: "90%", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" },
  modalTitle:   { fontWeight: 800, color: "#1f2937", margin: "0 0 0.75rem", fontSize: "1.1rem" },
  modalBody:    { color: "#6b7280", lineHeight: 1.6, margin: "0 0 1.25rem", fontSize: "0.9rem" },
  modalReasonWrap: { marginBottom: "1.25rem" },
  modalReasonLabel:{ fontWeight: 600, color: "#374151", fontSize: "0.85rem", display: "block", marginBottom: "0.5rem" },
  modalReason:  { width: "100%", padding: "0.75rem", border: "1px solid #e5e7eb", borderRadius: "8px", fontSize: "0.875rem", resize: "vertical", outline: "none", boxSizing: "border-box" },
  modalBtns:    { display: "flex", gap: "0.75rem", justifyContent: "flex-end" },
  modalCancelBtn: { padding: "0.6rem 1.25rem", border: "1px solid #e5e7eb", background: "white", borderRadius: "8px", fontWeight: 600, cursor: "pointer", fontSize: "0.875rem" },
  modalConfirmBtn:{ padding: "0.6rem 1.5rem", border: "none", borderRadius: "8px", color: "white", fontWeight: 700, cursor: "pointer", fontSize: "0.875rem" },
  pagination:  { display: "flex", alignItems: "center", justifyContent: "center", gap: "1rem", padding: "0.875rem", borderTop: "1px solid #f3f4f6", marginTop: "auto" },
  pageBtn:     { padding: "0.4rem 0.875rem", border: "1px solid #e5e7eb", borderRadius: "8px", background: "white", cursor: "pointer", fontSize: "0.82rem", fontWeight: 500 },
  pageInfo:    { color: "#6b7280", fontSize: "0.82rem" },
  skeletonRow:   { display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.875rem 1rem", borderBottom: "1px solid #f9fafb" },
  skeletonCircle:{ width: "40px", height: "40px", borderRadius: "10px", background: "linear-gradient(90deg,#f3f4f6 25%,#e5e7eb 50%,#f3f4f6 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite", flexShrink: 0 },
  skeletonLine:  { height: "12px", width: "80%", borderRadius: "6px", background: "linear-gradient(90deg,#f3f4f6 25%,#e5e7eb 50%,#f3f4f6 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite" },
  empty: { textAlign: "center", color: "#9ca3af", padding: "2rem", fontSize: "0.875rem" },
};