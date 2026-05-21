import { useState } from "react";
import { Pill, Card, Rfr } from "../adminlayout/atoms";

export default function Admins({
  admins, banAdmin, registerAdmin, busy, reloadAdmins, confirm,
}) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "", email: "", password: "", role: "moderator",
  });

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    if (!form.name || !form.email || !form.password) return;
    await registerAdmin(form);
    setForm({ name: "", email: "", password: "", role: "moderator" });
    setShowForm(false);
  };

  return (
    <>
      <div className="ph">
        <div className="ph-left">
          <h1>
            Admins{" "}
            <span style={{ color: "var(--muted)", fontWeight: 400, fontSize: "1rem" }}>
              ({admins.length})
            </span>
          </h1>
        </div>
        <div className="ph-right">
          <Rfr onClick={reloadAdmins} />
          <button className="btn b-solid" onClick={() => setShowForm((s) => !s)}>
            {showForm ? "Close" : "+ New Admin"}
          </button>
        </div>
      </div>

      {showForm && (
        <Card title="Register New Admin">
          <div className="form-grid">
            <div className="form-group">
              <label>Full Name</label>
              <input className="input" value={form.name} onChange={set("name")} placeholder="Jane Doe" />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input className="input" value={form.email} onChange={set("email")} placeholder="jane@example.com" />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input className="input" type="password" value={form.password} onChange={set("password")} placeholder="••••••••" />
            </div>
            <div className="form-group">
              <label>Role</label>
              <select className="input" value={form.role} onChange={set("role")}>
                <option value="moderator">Moderator</option>
                <option value="support">Support</option>
                <option value="super_admin">Super Admin</option>
              </select>
            </div>
            <div className="form-full" style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button className="btn b-ghost" onClick={() => setShowForm(false)}>Cancel</button>
              <button className="btn b-solid" onClick={submit}>Create Admin</button>
            </div>
          </div>
        </Card>
      )}

      <Card>
        <div className="tw">
          <table>
            <thead>
              <tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Action</th></tr>
            </thead>
            <tbody>
              {admins.map((a) => (
                <tr key={a.id}>
                  <td style={{ fontWeight: 700 }}>{a.name}</td>
                  <td className="mono dim" style={{ fontSize: ".7rem" }}>{a.email}</td>
                  <td><Pill s={a.role} /></td>
                  <td><Pill s={a.status || "active"} /></td>
                  <td>
                    {a.status === "banned" ? (
                      <span className="dim" style={{ fontSize: ".68rem" }}>Banned</span>
                    ) : (
                      <button
                        className="btn b-red"
                        disabled={busy === `ba-${a.id}`}
                        onClick={() =>
                          confirm({
                            title:   "Ban Admin?",
                            body:    `Revoke access for "${a.name}"?`,
                            danger:  true,
                            confirm: "Ban",
                            action:  () => banAdmin(a.id),
                          })
                        }
                      >
                        {busy === `ba-${a.id}` ? "…" : "Ban"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {!admins.length && (
                <tr><td colSpan={5} className="empty">No admins found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}