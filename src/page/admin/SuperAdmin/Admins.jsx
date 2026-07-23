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

  // ── custom role creation ────────────────────────────────
  const [customRoles, setCustomRoles] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("customRoles") || "[]");
    } catch { return []; }
  });
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [newRoleName,     setNewRoleName]     = useState("");

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  // ── built-in roles ──────────────────────────────────────
  const builtInRoles = [
    { value: "admin",             label: "Admin / Manager"     },
    { value: "content_moderator", label: "Content Moderator"   },
    { value: "finance_admin",     label: "Finance Admin"       },
    { value: "support_admin",     label: "Support Admin"       },
    { value: "super_admin",       label: "Super Admin / Owner" },
  ];

  const existingRolesInData = [...new Set(admins.map((a) => a.role).filter(Boolean))];

  const allRoles = [
    ...builtInRoles,
    ...customRoles.map((r) => ({ value: r, label: humanize(r) })),
    ...existingRolesInData
      .filter(
        (r) =>
          !builtInRoles.some((b) => b.value === r) &&
          !customRoles.includes(r)
      )
      .map((r) => ({ value: r, label: humanize(r) })),
  ];

  function humanize(slug) {
    if (!slug) return "—";
    return slug
      .split("_")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  }

  const roleLabel = (value) =>
    allRoles.find((r) => r.value === value)?.label ?? humanize(value);

  const activeSuperAdmins = admins.filter(
    (a) => a.role === "super_admin" && a.status !== "banned",
  );

  const filtered = admins.filter((a) => {
    const q = search.toLowerCase();
    const matchSearch =
      (a.name  ?? "").toLowerCase().includes(q) ||
      (a.email ?? "").toLowerCase().includes(q);
    const matchRole =
      filterRole === "all" || a.role === filterRole;
    return matchSearch && matchRole;
  });

  // ── actions with debug alerts ───────────────────────────

  const submit = async () => {
    // Debug: show what we are sending
    const debug =
      `🔍 SUBMITTING FORM\n\n` +
      `Name:     ${form.name || "(empty)"}\n` +
      `Email:    ${form.email || "(empty)"}\n` +
      `Password: ${form.password ? "***" + form.password.length + " chars" : "(empty)"}\n` +
      `Role:     ${form.role || "(empty)"}\n\n` +
      `Current user role: ${currentUser?.role || "(none)"}\n` +
      `Token in storage:  ${localStorage.getItem("admin_token") ? "YES" : "NO"}`;

    console.log(debug);

    // Basic validation
    if (!form.name.trim()) {
      alert("❌ Name is required");
      return;
    }
    if (!form.email.trim()) {
      alert("❌ Email is required");
      return;
    }
    if (!form.password) {
      alert("❌ Password is required");
      return;
    }
    if (form.password.length < 8) {
      alert("❌ Password must be at least 8 characters");
      return;
    }
    if (!form.role) {
      alert("❌ Please select a role");
      return;
    }

    // Show what we are about to send
    alert(debug);

    try {
      await registerAdmin(form);
      // Reset the form only if no error was thrown
      setForm({ name: "", email: "", password: "", role: "admin" });
      setShowForm(false);
      // Reload the list so the new admin appears
      await reloadAdmins();
    } catch (err) {
      alert(
        `❌ SUBMIT ERROR\n\n${err.message || err}\n\n` +
        `Check the browser console and server logs for more details.`
      );
      console.error("[submit]", err);
    }
  };

  const addCustomRole = () => {
    const clean = newRoleName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_ ]/g, "")
      .replace(/\s+/g, "_");

    if (!clean) return;
    if (clean === "super_admin" && currentUser.role !== "super_admin") {
      alert("Only a Super Admin can create the Super Admin role.");
      return;
    }
    if (allRoles.some((r) => r.value === clean)) {
      alert("That role already exists.");
      return;
    }

    const updated = [...customRoles, clean];
    setCustomRoles(updated);
    localStorage.setItem("customRoles", JSON.stringify(updated));

    setForm((f) => ({ ...f, role: clean }));
    setNewRoleName("");
    setShowCustomInput(false);
  };

  const removeCustomRole = (roleValue) => {
    if (currentUser.role !== "super_admin") {
      alert("Only a Super Admin can remove custom roles.");
      return;
    }
    if (admins.some((a) => a.role === roleValue)) {
      alert("Cannot delete a role that is currently assigned to an admin.");
      return;
    }
    const updated = customRoles.filter((r) => r !== roleValue);
    setCustomRoles(updated);
    localStorage.setItem("customRoles", JSON.stringify(updated));
  };

  const startEdit = (a) => {
    setEditingId(a.id);
    setEditRole(a.role);
  };

  const saveEdit = async (a) => {
    if (editRole === "super_admin" && currentUser.role !== "super_admin") {
      alert("Only a Super Admin can assign the Super Admin role.");
      return;
    }
    try {
      await editAdminRole(a.id, editRole);
      setEditingId(null);
      await reloadAdmins();
    } catch (err) {
      alert(`❌ EDIT ROLE ERROR\n\n${err.message || err}`);
      console.error("[saveEdit]", err);
    }
  };

  const handleBanToggle = (a) => {
    if (a.id === currentUser.id) {
      alert("You cannot deactivate your own account.");
      return;
    }
    if (
      a.role === "super_admin" &&
      a.status !== "banned"  &&
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

  // ── render ──────────────────────────────────────────────

  return (
    <>
      {/* DEBUG BANNER — shows current user info so you can verify */}
      <div style={{
        padding      : "8px 14px",
        marginBottom : 10,
        background   : "#1a1f3a",
        borderRadius : 8,
        fontSize     : ".72rem",
        color        : "#8ba1d1",
        fontFamily   : "monospace",
      }}>
        👤 Logged in as: <b>{currentUser?.name || "?"}</b> ({currentUser?.email || "?"}) — 
        Role: <b style={{ color: currentUser?.role === "super_admin" ? "#4ade80" : "#f59e42" }}>
          {currentUser?.role || "NONE"}
        </b> — 
        Token: <b style={{ color: localStorage.getItem("admin_token") ? "#4ade80" : "#ef4444" }}>
          {localStorage.getItem("admin_token") ? "OK" : "MISSING"}
        </b>
      </div>

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
              <label>Password (min 8 chars)</label>
              <input
                className="input"
                type="password"
                value={form.password}
                onChange={set("password")}
                placeholder="••••••••"
              />
            </div>

            <div className="form-group">
              <label>
                Role
                {currentUser.role === "super_admin" && (
                  <button
                    type="button"
                    className="btn b-ghost"
                    style={{
                      marginLeft: 8,
                      fontSize:   ".65rem",
                      padding:    "2px 8px",
                    }}
                    onClick={() => setShowCustomInput((s) => !s)}
                  >
                    {showCustomInput ? "Cancel" : "+ New Role"}
                  </button>
                )}
              </label>

              {showCustomInput ? (
                <div style={{ display: "flex", gap: 6 }}>
                  <input
                    className="input"
                    style={{ flex: 1 }}
                    value={newRoleName}
                    onChange={(e) => setNewRoleName(e.target.value)}
                    placeholder="e.g. marketing_admin"
                    onKeyDown={(e) => e.key === "Enter" && addCustomRole()}
                  />
                  <button
                    type="button"
                    className="btn b-solid"
                    onClick={addCustomRole}
                  >
                    Add
                  </button>
                </div>
              ) : (
                <select
                  className="input"
                  value={form.role}
                  onChange={set("role")}
                >
                  {allRoles.map((r) => {
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
              )}
            </div>

            <div
              className="form-full"
              style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}
            >
              <button className="btn b-ghost" onClick={() => setShowForm(false)}>
                Cancel
              </button>
              <button
                className="btn b-solid"
                disabled={busy === "register"}
                onClick={submit}
              >
                {busy === "register" ? "Creating…" : "Create Admin"}
              </button>
            </div>

          </div>
        </Card>
      )}

      {/* Custom Roles Manager (Super Admin only) */}
      {currentUser.role === "super_admin" && customRoles.length > 0 && (
        <Card title="Custom Roles">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {customRoles.map((r) => (
              <div
                key={r}
                style={{
                  display     : "flex",
                  alignItems  : "center",
                  gap         : 6,
                  padding     : "4px 10px",
                  background  : "var(--card2)",
                  borderRadius: 20,
                  fontSize    : ".75rem",
                }}
              >
                <span>{humanize(r)}</span>
                <button
                  type="button"
                  onClick={() => removeCustomRole(r)}
                  title="Remove role"
                  style={{
                    background : "transparent",
                    border     : "none",
                    color      : "var(--danger)",
                    cursor     : "pointer",
                    fontSize   : "1rem",
                    lineHeight : 1,
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <p className="dim" style={{ fontSize: ".7rem", marginTop: 8 }}>
            Note: Custom roles are saved locally in your browser. Permissions for them
            must be configured on the backend.
          </p>
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
          {allRoles.map((r) => (
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

                  <td style={{ fontWeight: 700 }}>{a.name}</td>

                  <td className="mono dim" style={{ fontSize: ".7rem" }}>
                    {a.email}
                  </td>

                  <td>
                    {editingId === a.id ? (
                      <select
                        className="input"
                        style={{ fontSize: ".75rem", padding: "2px 6px" }}
                        value={editRole}
                        onChange={(e) => setEditRole(e.target.value)}
                      >
                        {allRoles.map((r) => {
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

                  <td><Pill s={a.status || "active"} /></td>

                  <td className="dim" style={{ fontSize: ".7rem" }}>
                    {a.created_at
                      ? new Date(a.created_at).toLocaleDateString()
                      : "—"}
                  </td>

                  <td className="dim" style={{ fontSize: ".7rem" }}>
                    {a.last_login
                      ? new Date(a.last_login).toLocaleDateString()
                      : "Never"}
                  </td>

                  <td className="dim" style={{ fontSize: ".7rem" }}>
                    {a.created_by || "—"}
                  </td>

                  <td>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>

                      {editingId === a.id ? (
                        <>
                          <button
                            className="btn b-solid"
                            style={{ fontSize: ".72rem", padding: "2px 10px" }}
                            disabled={busy === `er-${a.id}`}
                            onClick={() => saveEdit(a)}
                          >
                            {busy === `er-${a.id}` ? "…" : "Save"}
                          </button>
                          <button
                            className="btn b-ghost"
                            style={{ fontSize: ".72rem", padding: "2px 10px" }}
                            disabled={busy === `er-${a.id}`}
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

                      <button
                        className={`btn ${a.status === "banned" ? "b-solid" : "b-red"}`}
                        style={{ fontSize: ".72rem", padding: "2px 10px" }}
                        disabled={
                          busy === `ba-${a.id}`  ||
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