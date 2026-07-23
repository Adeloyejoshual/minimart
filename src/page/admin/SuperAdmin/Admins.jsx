import { useState } from "react";
import { Pill, Card, Rfr } from "../adminlayout/atoms";

export default function Admins({
  admins, banAdmin, unbanAdmin, registerAdmin, editAdminRole,
  busy, reloadAdmins, confirm, currentUser,
}) {
  const [showForm, setShowForm]     = useState(false);
  const [search, setSearch]         = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [editingId, setEditingId]   = useState(null);
  const [editRole, setEditRole]     = useState("");

  const [form, setForm] = useState({
    name: "", email: "", password: "", role: "admin",
  });

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  // ── helpers ───────────────────────────────────────────────────────────────

  const roles = [
    { value: "admin",             label: "Admin / Manager"    },
    { value: "content_moderator", label: "Content Moderator"  },
    { value: "finance_admin",     label: "Finance Admin"      },
    { value: "support_admin",     label: "Support Admin"      },
    { value: "super_admin",       label: "Super Admin / Owner"},
  ];

  const roleLabel = (value) =>
    roles.find((r) => r.value === value)?.label ?? value;

  const activeSuperAdmins = admins.filter(
    (a) => a.role === "super_admin" && a.status !== "banned",
  );

  const filtered = admins.filter((a) => {
    const q = search.toLowerCase();
    const matchSearch =
      a.name.toLowerCase().includes(q) ||
      a.email.toLowerCase().includes(q);
    const matchRole =
      filterRole === "all" || a.role === filterRole;
    return matchSearch && matchRole;
  });

  // ── actions ───────────────────────────────────────────────────────────────

  const submit = async () => {
    if (!form.name || !form.email || !form.password) return;
    await registerAdmin(form);
    setForm({ name: "", email: "", password: "", role: "admin" });
    setShowForm(false);
  };

  const startEdit = (a) => {
    setEditingId(a.id);
    setEditRole(a.role);
  };

  const saveEdit = (a) => {
    if (editRole === "super_admin" && currentUser.role !== "super_admin") {
      alert("Only a Super Admin can assign the Super Admin role.");
      return;
    }
    editAdminRole(a.id, editRole);
    setEditingId(null);
  };

  const handleBanToggle = (a) => {
    // Prevent acting on yourself
    if (a.id === currentUser.id) {
      alert("You cannot deactivate your own account.");
      return;
    }
    // Prevent removing the last Super Admin
    if (
      a.role === "super_admin" &&
      a.status !== "banned" &&
      activeSuperAdmins.length === 1
    ) {
      alert("Cannot deactivate the last Super Admin.");
      return;
    }

    if (a.status === "banned") {
      confirm({
        title:   "Reactivate Admin?",
        body:    `Restore access for "${a.name}"?`,
        confirm: "Reactivate",
        action:  () => unbanAdmin(a.id),
      });
    } else {
      confirm({
        title:   "Deactivate Admin?",
        body:    `Revoke access for "${a.name}"?`,
        danger:  true,
        confirm: "Deactivate",
        action:  () => banAdmin(a.id),
      });
    }
  };

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Page Header */}
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

      {/* Create Admin Form */}
      {showForm && (
        <Card title="Register New Admin">
          <div className="form-grid">

            <div className="form-group">
              <label>Full Name</label>
              <input
                className="input"
                value={form.name}
                onChange={set("name")}
                placeholder="Jane Doe"
              />
            </div>

            <div className="form-group">
              <label>Email</label>
              <input
                className="input"
                type="email"
                value={form.email}
                onChange={set("email")}
                placeholder="jane@example.com"
              />
            </div>

            <div className="form-group">
              <label>Password</label>
              <input
                className="input"
                type="password"
                value={form.password}
                onChange={set("password")}
                placeholder="••••••••"
              />
            </div>

            <div className="form-group">
              <label>Role</label>
              <select className="input" value={form.role} onChange={set("role")}>
                <option value="admin">Admin / Manager</option>
                <option value="content_moderator">Content Moderator</option>
                <option value="finance_admin">Finance Admin</option>
                <option value="support_admin">Support Admin</option>
                {/* Only Super Admin can create another Super Admin */}
                {currentUser.role === "super_admin" && (
                  <option value="super_admin">Super Admin / Owner</option>
                )}
              </select>
            </div>

            <div
              className="form-full"
              style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}
            >
              <button className="btn b-ghost" onClick={() => setShowForm(false)}>
                Cancel
              </button>
              <button className="btn b-solid" onClick={submit}>
                Create Admin
              </button>
            </div>

          </div>
        </Card>
      )}

      {/* Search & Filter */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input
          className="input"
          style={{ flex: 1, minWidth: 200 }}
          placeholder="Search by name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="input"
          style={{ minWidth: 180 }}
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value)}
        >
          <option value="all">All Roles</option>
          {roles.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
      </div>

      {/* Admins Table */}
      <Card>
        <div className="tw">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Created</th>
                <th>Last Login</th>
                <th>Created By</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => (
                <tr key={a.id}>

                  {/* Name */}
                  <td style={{ fontWeight: 700 }}>{a.name}</td>

                  {/* Email */}
                  <td className="mono dim" style={{ fontSize: ".7rem" }}>
                    {a.email}
                  </td>

                  {/* Role — inline edit */}
                  <td>
                    {editingId === a.id ? (
                      <select
                        className="input"
                        style={{ fontSize: ".75rem", padding: "2px 6px" }}
                        value={editRole}
                        onChange={(e) => setEditRole(e.target.value)}
                      >
                        {roles.map((r) => {
                          // Hide Super Admin option for non-super-admins
                          if (
                            r.value === "super_admin" &&
                            currentUser.role !== "super_admin"
                          ) return null;
                          return (
                            <option key={r.value} value={r.value}>
                              {r.label}
                            </option>
                          );
                        })}
                      </select>
                    ) : (
                      <Pill s={a.role} label={roleLabel(a.role)} />
                    )}
                  </td>

                  {/* Status */}
                  <td><Pill s={a.status || "active"} /></td>

                  {/* Date Created */}
                  <td className="dim" style={{ fontSize: ".7rem" }}>
                    {a.createdAt
                      ? new Date(a.createdAt).toLocaleDateString()
                      : "—"}
                  </td>

                  {/* Last Login */}
                  <td className="dim" style={{ fontSize: ".7rem" }}>
                    {a.lastLogin
                      ? new Date(a.lastLogin).toLocaleDateString()
                      : "Never"}
                  </td>

                  {/* Created By */}
                  <td className="dim" style={{ fontSize: ".7rem" }}>
                    {a.createdBy || "—"}
                  </td>

                  {/* Actions */}
                  <td>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>

                      {/* Edit Role / Save / Cancel */}
                      {editingId === a.id ? (
                        <>
                          <button
                            className="btn b-solid"
                            style={{ fontSize: ".72rem", padding: "2px 10px" }}
                            onClick={() => saveEdit(a)}
                          >
                            Save
                          </button>
                          <button
                            className="btn b-ghost"
                            style={{ fontSize: ".72rem", padding: "2px 10px" }}
                            onClick={() => setEditingId(null)}
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          className="btn b-ghost"
                          style={{ fontSize: ".72rem", padding: "2px 10px" }}
                          onClick={() => startEdit(a)}
                        >
                          Edit Role
                        </button>
                      )}

                      {/* Deactivate / Reactivate */}
                      <button
                        className={`btn ${a.status === "banned" ? "b-solid" : "b-red"}`}
                        style={{ fontSize: ".72rem", padding: "2px 10px" }}
                        disabled={
                          busy === `ba-${a.id}` ||
                          busy === `uba-${a.id}`
                        }
                        onClick={() => handleBanToggle(a)}
                      >
                        {busy === `ba-${a.id}` || busy === `uba-${a.id}`
                          ? "…"
                          : a.status === "banned"
                          ? "Reactivate"
                          : "Deactivate"}
                      </button>

                    </div>
                  </td>

                </tr>
              ))}

              {!filtered.length && (
                <tr>
                  <td colSpan={8} className="empty">
                    {search || filterRole !== "all"
                      ? "No admins match your search."
                      : "No admins found."}
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