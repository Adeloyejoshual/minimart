// src/pages/admin/Manager/ManagerPayments.jsx

import { fmt, fmtN, fmtDate } from "../adminlayout/helpers";
import { Pill, Card, Rfr, Srch } from "../adminlayout/atoms";

export default function ManagerPayments({
  filteredPayments, payQ, setPayQ, reloadPayments,
}) {
  return (
    <>
      <div className="ph">
        <div className="ph-left">
          <h1>
            Payments{" "}
            <span style={{ color: "var(--muted)", fontWeight: 400, fontSize: "1rem" }}>
              ({fmt(filteredPayments.length)})
            </span>
          </h1>
          <p style={{ color: "var(--muted)", fontSize: ".78rem", marginTop: 4 }}>
            View payment transactions. Refunds must be processed by a Super Admin or Finance Admin.
          </p>
        </div>
        <div className="ph-right">
          <Srch value={payQ} onChange={setPayQ} placeholder="Search…" />
          <Rfr onClick={reloadPayments} />
        </div>
      </div>

      <div style={{
        padding      : "10px 14px",
        background   : "#f59e421a",
        border       : "1px solid #f59e4240",
        borderRadius : 8,
        fontSize     : ".78rem",
        color        : "#fcd34d",
        marginBottom : 12,
      }}>
        ⚠️ Read-only mode. You cannot issue refunds from this account.
      </div>

      <Card>
        <div className="tw">
          <table>
            <thead>
              <tr>
                <th>Reference</th>
                <th>User</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Method</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {filteredPayments.map((p) => (
                <tr key={p.id}>
                  <td className="mono" style={{ fontSize: ".7rem" }}>
                    {p.reference || p.id}
                  </td>
                  <td>{p.user || "—"}</td>
                  <td className="mono" style={{ color: "var(--green)" }}>
                    {fmtN(p.amount)}
                  </td>
                  <td><Pill s={p.status || "pending"} /></td>
                  <td className="dim" style={{ fontSize: ".7rem" }}>
                    {p.method || "—"}
                  </td>
                  <td className="mono dim" style={{ fontSize: ".68rem" }}>
                    {fmtDate(p.created_at)}
                  </td>
                </tr>
              ))}
              {!filteredPayments.length && (
                <tr>
                  <td colSpan={6} className="empty">
                    No payments found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}