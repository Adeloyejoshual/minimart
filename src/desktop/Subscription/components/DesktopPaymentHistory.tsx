import { useState, useEffect, useCallback } from "react";
import "./styles/desktop-payment-history.css";

const getToken = () =>
  localStorage.getItem("marketplace_token") ||
  localStorage.getItem("token") ||
  null;

interface Transaction {
  id:          string;
  reference:   string;
  provider:    string;
  amount:      number;
  amountNaira: number;
  currency:    string;
  status:      string;
  type:        string;
  paid_at:     string | null;
  created_at:  string;
  plan_slug:   string | null;
  plan_name:   string | null;
  plan_badge:  string | null;
}

interface Pagination {
  page:        number;
  limit:       number;
  total:       number;
  totalPages:  number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

const STATUS_CLASS: Record<string, string> = {
  success:  "dph-status--success",
  pending:  "dph-status--pending",
  failed:   "dph-status--failed",
  refunded: "dph-status--refunded",
};

const fmt = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("en-NG", {
        year: "numeric", month: "short", day: "numeric",
      })
    : "—";

const truncRef = (r: string | null) =>
  r ? r.length > 28 ? r.slice(0, 28) + "…" : r : "—";

const DesktopPaymentHistory = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [pagination,   setPagination]   = useState<Pagination | null>(null);
  const [page,         setPage]         = useState(1);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState<string | null>(null);

  const fetchHistory = useCallback(async (p: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/subscription/payments/history?page=${p}&limit=12`,
        { headers: { Authorization: `Bearer ${getToken()}` } }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setTransactions(data.transactions);
      setPagination(data.pagination);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load history.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchHistory(page); }, [page, fetchHistory]);

  if (loading) {
    return (
      <div className="dph-wrap">
        <div className="dph-sk-title" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="dph-sk-row" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="dph-error">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <div>
          <p className="dph-error__title">Failed to load payment history</p>
          <p className="dph-error__msg">{error}</p>
          <button onClick={() => fetchHistory(page)} className="dph-retry">Try again</button>
        </div>
      </div>
    );
  }

  return (
    <div className="dph-wrap">
      <div className="dph-header">
        <h2 className="dph-title">Payment History</h2>
        {pagination && (
          <span className="dph-count">{pagination.total} transaction(s)</span>
        )}
      </div>

      {!transactions.length ? (
        <div className="dph-empty">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
          <p>No payment records yet.</p>
        </div>
      ) : (
        <>
          <div className="dph-table-wrap">
            <table className="dph-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Plan</th>
                  <th>Reference</th>
                  <th>Provider</th>
                  <th>Type</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr key={tx.id}>
                    <td className="dph-table__nowrap">{fmt(tx.created_at)}</td>
                    <td>
                      {tx.plan_name ? (
                        <span className="dph-table__plan">
                          {tx.plan_badge && <span>{tx.plan_badge}</span>}
                          <span>{tx.plan_name}</span>
                        </span>
                      ) : (
                        <span className="dph-table__muted">—</span>
                      )}
                    </td>
                    <td>
                      <span className="dph-table__ref" title={tx.reference ?? ""}>
                        {truncRef(tx.reference)}
                      </span>
                    </td>
                    <td className="dph-table__capitalize">{tx.provider}</td>
                    <td className="dph-table__capitalize">{tx.type}</td>
                    <td className="dph-table__amount">
                      ₦{Number(tx.amountNaira).toLocaleString("en-NG")}
                    </td>
                    <td>
                      <span className={`dph-status ${STATUS_CLASS[tx.status] ?? "dph-status--pending"}`}>
                        {tx.status.charAt(0).toUpperCase() + tx.status.slice(1)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="dph-pagination">
              <span className="dph-pagination__info">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <div className="dph-pagination__btns">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="dph-pg-btn"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                  Prev
                </button>

                {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === pagination.totalPages || Math.abs(p - page) <= 1)
                  .reduce<(number | string)[]>((acc, p, i, arr) => {
                    if (i > 0 && (p as number) - (arr[i - 1] as number) > 1) acc.push("…");
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((item, idx) =>
                    item === "…" ? (
                      <span key={`e${idx}`} className="dph-pg-ellipsis">…</span>
                    ) : (
                      <button
                        key={item}
                        onClick={() => setPage(item as number)}
                        className={`dph-pg-btn ${item === page ? "dph-pg-btn--active" : ""}`}
                      >
                        {item}
                      </button>
                    )
                  )}

                <button
                  disabled={page >= pagination.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="dph-pg-btn"
                >
                  Next
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default DesktopPaymentHistory;