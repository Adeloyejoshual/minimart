import { fmt, fmtN, fmtDate } from "../adminlayout/helpers";
import { Pill, Card, Rfr, Srch } from "../adminlayout/atoms";

export default function Orders({
  filteredOrders, orderQ, setOrderQ,
  cancelOrder, busy, reloadOrders, confirm,
}) {
  return (
    <>
      <div className="ph">
        <div className="ph-left">
          <h1>
            Orders{" "}
            <span style={{ color: "var(--muted)", fontWeight: 400, fontSize: "1rem" }}>
              ({filteredOrders.length})
            </span>
          </h1>
        </div>
        <div className="ph-right">
          <Srch value={orderQ} onChange={setOrderQ} placeholder="Search order or buyer…" />
          <Rfr onClick={reloadOrders} />
        </div>
      </div>

      <Card>
        <div className="tw">
          <table>
            <thead>
              <tr>
                <th>Order ID</th><th>Buyer</th><th>Items</th>
                <th>Total</th><th>Status</th><th>Date</th><th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((o) => (
                <tr key={o.id}>
                  <td className="mono" style={{ fontSize: ".7rem", color: "var(--accent)" }}>
                    #{String(o.id).slice(0, 8)}
                  </td>
                  <td style={{ fontWeight: 600 }}>{o.buyer_name || o.user || "—"}</td>
                  <td className="dim">{o.item_count || o.items || 1} item(s)</td>
                  <td className="mono" style={{ color: "var(--green)" }}>{fmtN(o.total)}</td>
                  <td><Pill s={o.status} /></td>
                  <td className="mono dim" style={{ fontSize: ".68rem" }}>{fmtDate(o.created_at)}</td>
                  <td>
                    {["pending", "processing", "active"].includes(o.status) ? (
                      <button
                        className="btn b-red"
                        disabled={busy === `co-${o.id}`}
                        onClick={() =>
                          confirm({
                            title:   "Cancel Order?",
                            body:    `Cancel order #${String(o.id).slice(0, 8)}? This cannot be undone.`,
                            danger:  true,
                            confirm: "Cancel Order",
                            action:  () => cancelOrder(o.id),
                          })
                        }
                      >
                        {busy === `co-${o.id}` ? "…" : "Cancel"}
                      </button>
                    ) : (
                      <span className="dim" style={{ fontSize: ".68rem" }}>—</span>
                    )}
                  </td>
                </tr>
              ))}
              {!filteredOrders.length && (
                <tr><td colSpan={7} className="empty">No orders found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}