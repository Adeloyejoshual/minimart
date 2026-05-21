import { fmtN, fmtDate } from "../adminlayout/helpers";
import { Pill, Card, Rfr, Srch } from "../adminlayout/atoms";

export default function Payments({
  filteredPayments, payQ, setPayQ,
  refundPayment, busy, reloadPayments, confirm,
}) {
  return (
    <>
      <div className="ph">
        <div className="ph-left">
          <h1>
            Payments{" "}
            <span style={{ color: "var(--muted)", fontWeight: 400, fontSize: "1rem" }}>
              ({filteredPayments.length})
            </span>
          </h1>
        </div>
        <div className="ph-right">
          <Srch value={payQ} onChange={setPayQ} placeholder="Search user or ref…" />
          <Rfr onClick={reloadPayments} />
        </div>
      </div>

      <Card>
        <div className="tw">
          <table>
            <thead>
              <tr>
                <th>User</th><th>Reference</th><th>Amount</th>
                <th>Type</th><th>Status</th><th>Date</th><th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredPayments.map((p) => (
                <tr key={p.id}>
                  <td style={{ fontWeight: 600 }}>{p.user || p.user_name || "—"}</td>
                  <td className="mono dim" style={{ fontSize: ".7rem" }}>{p.reference || p.ref || "—"}</td>
                  <td className="mono" style={{ color: "var(--green)" }}>{fmtN(p.amount)}</td>
                  <td className="dim"  style={{ fontSize: ".72rem" }}>{p.type || "—"}</td>
                  <td><Pill s={p.status} /></td>
                  <td className="mono dim" style={{ fontSize: ".68rem" }}>{fmtDate(p.created_at)}</td>
                  <td>
                    {["paid", "completed", "success"].includes(p.status) ? (
                      <button
                        className="btn b-amber"
                        disabled={busy === `rf-${p.id}`}
                        onClick={() =>
                          confirm({
                            title:   "Issue Refund?",
                            body:    `Refund ${fmtN(p.amount)} to ${p.user || "this user"}?`,
                            danger:  true,
                            confirm: "Refund",
                            action:  () => refundPayment(p.id),
                          })
                        }
                      >
                        {busy === `rf-${p.id}` ? "…" : "Refund"}
                      </button>
                    ) : (
                      <span className="dim" style={{ fontSize: ".68rem" }}>—</span>
                    )}
                  </td>
                </tr>
              ))}
              {!filteredPayments.length && (
                <tr><td colSpan={7} className="empty">No payments found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}