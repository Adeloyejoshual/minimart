import { fmt, fmtN, fmtDate } from "../adminlayout/helpers";
import { Pill, Card, Rfr, Srch } from "../adminlayout/atoms";

export default function Users({
  filteredUsers, userQ, setUserQ,
  banUser, busy, reloadUsers, confirm,
}) {
  return (
    <>
      <div className="ph">
        <div className="ph-left">
          <h1>
            Users{" "}
            <span style={{ color: "var(--muted)", fontWeight: 400, fontSize: "1rem" }}>
              ({fmt(filteredUsers.length)})
            </span>
          </h1>
        </div>
        <div className="ph-right">
          <Srch value={userQ} onChange={setUserQ} placeholder="Search name or email…" />
          <Rfr onClick={reloadUsers} />
        </div>
      </div>

      <Card>
        <div className="tw">
          <table>
            <thead>
              <tr>
                <th>Name</th><th>Email</th><th>Phone</th><th>City</th>
                <th>Status</th><th>Balance</th><th>Joined</th><th>Last Login</th><th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u) => (
                <tr key={u.id}>
                  <td style={{ fontWeight: 700 }}>{u.name}</td>
                  <td className="mono dim" style={{ fontSize: ".7rem" }}>{u.email}</td>
                  <td className="mono"     style={{ fontSize: ".7rem" }}>{u.phone_number || "—"}</td>
                  <td className="dim">{u.city || "—"}</td>
                  <td><Pill s={u.status || "active"} /></td>
                  <td className="mono" style={{ color: "var(--green)" }}>{fmtN(u.balance)}</td>
                  <td className="mono dim" style={{ fontSize: ".68rem" }}>{fmtDate(u.created_at)}</td>
                  <td className="mono dim" style={{ fontSize: ".68rem" }}>{fmtDate(u.last_login)}</td>
                  <td>
                    {u.status === "banned" ? (
                      <span className="dim" style={{ fontSize: ".68rem" }}>Banned</span>
                    ) : (
                      <button
                        className="btn b-red"
                        disabled={busy === `bu-${u.id}`}
                        onClick={() =>
                          confirm({
                            title:   "Ban User?",
                            body:    `Ban "${u.name}"? They will lose access immediately.`,
                            danger:  true,
                            confirm: "Ban",
                            action:  () => banUser(u.id),
                          })
                        }
                      >
                        {busy === `bu-${u.id}` ? "…" : "Ban"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {!filteredUsers.length && (
                <tr><td colSpan={9} className="empty">No users match</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}