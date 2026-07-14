import { useState, useEffect, useCallback } from "react";
import "../../styles/subscription/index.css";

const History = () => {
  const [transactions, setTransactions] = useState([]);
  const [pagination,   setPagination]   = useState(null);
  const [page,         setPage]         = useState(1);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState(null);

  const fetchHistory = useCallback(async (p) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/subscription/payments/history?page=${p}&limit=10`,
        { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setTransactions(data.transactions);
      setPagination(data.pagination);
    } catch (err) {
      setError(err.message ?? "Failed to load payment history.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchHistory(page); }, [page, fetchHistory]);

  const fmt      = (d) => d ? new Date(d).toLocaleDateString("en-NG", { year: "numeric", month: "short", day: "numeric" }) : "—";
  const truncRef = (r) => r?.length > 22 ? r.slice(0, 22) + "…" : r ?? "—";

  if (loading) {
    return (
      <div className="sub-card">
        <div className="sub-skeleton sub-skeleton--sm" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="sub-skeleton sub-skeleton--row" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="sub-error-box">
        <div className="sub-error-box__icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        </div>
        <div>
          <p className="sub-error-box__title">Failed to load payment history</p>
          <p>{error}</p>
          <button onClick={() => fetchHistory(page)} className="sub-link">Try again</button>
        </div>
      </div>
    );
  }

  return (
    <div className="sub-card">
      <h2 className="sub-card__title">Payment History</h2>

      {!transactions.length ? (
        <div className="sub-empty">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
          <p>No payment records yet.</p>
        </div>
      ) : (
        <>
          <div className="sub-table-wrap">
            <table className="sub-table">
              <thead>
                <tr>
                  {["Date", "Plan", "Reference", "Amount", "Status"].map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr key={tx.id}>
                    <td className="sub-table__nowrap">{fmt(tx.created_at)}</td>
                    <td>
                      {tx.plan_name ? (
                        <span className="sub-table__plan">
                          {tx.plan_badge && <span>{tx.plan_badge}</span>}
                          <span>{tx.plan_name}</span>
                        </span>
                      ) : (
                        <span className="sub-table__muted">—</span>
                      )}
                    </td>
                    <td>
                      <span className="sub-table__ref" title={tx.reference}>
                        {truncRef(tx.reference)}
                      </span>
                    </td>
                    <td className="sub-table__nowrap sub-table__amount">
                      ₦{Number(tx.amountNaira).toLocaleString("en-NG")}
                    </td>
                    <td>
                      <span className={`sub-status-pill sub-status-pill--${tx.status}`}>
                        {tx.status.charAt(0).toUpperCase() + tx.status.slice(1)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pagination && pagination.totalPages > 1 && (
            <div className="sub-pagination">
              <span className="sub-pagination__info">
                Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
              </span>
              <div className="sub-pagination__btns">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="sub-pagination__btn"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                  Prev
                </button>

                {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === pagination.totalPages || Math.abs(p - page) <= 1)
                  .reduce((acc, p, i, arr) => {
                    if (i > 0 && p - arr[i - 1] > 1) acc.push("…");
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((item, idx) =>
                    item === "…" ? (
                      <span key={`e${idx}`} className="sub-pagination__ellipsis">…</span>
                    ) : (
                      <button
                        key={item}
                        onClick={() => setPage(item)}
                        className={`sub-pagination__btn ${
                          item === page ? "sub-pagination__btn--active" : ""
                        }`}
                      >
                        {item}
                      </button>
                    )
                  )}

                <button
                  disabled={page >= pagination.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="sub-pagination__btn"
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

export default History;