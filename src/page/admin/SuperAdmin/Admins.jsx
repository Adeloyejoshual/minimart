import { useState, useMemo } from "react";
import { Pill, Card, Rfr }   from "../adminlayout/atoms";
import toast                  from "react-hot-toast";
import axios                  from "axios";

const BASE_URL   = import.meta.env.VITE_API_BASE_URL;
const SOURCE_API = `${BASE_URL}/api/admin/users/source-stats`;

export default function Admins({
  admins, banAdmin, unbanAdmin, registerAdmin, editAdminRole,
  busy, reloadAdmins, confirm, currentUser,
}) {
  // ── state ───────────────────────────────────────────────
  const [activeTab, setActiveTab]       = useState("admins"); // "admins" | "sources"
  const [showForm, setShowForm]         = useState(false);
  const [search, setSearch]             = useState("");
  const [filterRole, setFilterRole]     = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [editingId, setEditingId]       = useState(null);
  const [editRole, setEditRole]         = useState("");
  const [sortBy, setSortBy]             = useState("created_at");
  const [sortDir, setSortDir]           = useState("desc");
  const [showPassword, setShowPassword] = useState(false);

  const [form, setForm] = useState({
    name: "", email: "", password: "", role: "admin",
  });

  const [customRoles, setCustomRoles] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("customRoles") || "[]");
    } catch { return []; }
  });
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [newRoleName,     setNewRoleName]     = useState("");

  // ── source analytics state ───────────────────────────────
  const [sourceData,    setSourceData]    = useState(null);
  const [sourceLoading, setSourceLoading] = useState(false);
  const [sourceError,   setSourceError]   = useState(null);
  const [sourcePeriod,  setSourcePeriod]  = useState("all");
  const [drillSource,   setDrillSource]   = useState(null);
  const [drillData,     setDrillData]     = useState(null);
  const [drillLoading,  setDrillLoading]  = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  // ── constants ────────────────────────────────────────────
  const builtInRoles = [
    { value: "admin",             label: "Admin / Manager"     },
    { value: "content_moderator", label: "Content Moderator"   },
    { value: "finance_admin",     label: "Finance Admin"       },
    { value: "support_admin",     label: "Support Admin"       },
    { value: "super_admin",       label: "Super Admin / Owner" },
  ];

  const SOURCE_ICONS = {
    tiktok    : "🎵", instagram : "📸", facebook  : "📘",
    twitter   : "🐦", snapchat  : "👻", pinterest : "📌",
    linkedin  : "💼", reddit    : "🤖", youtube   : "▶️",
    threads   : "🧵", whatsapp  : "💬", telegram  : "✈️",
    discord   : "🎮", signal    : "🔒", viber     : "📞",
    wechat    : "💚", slack     : "💛", line      : "🟢",
    skype     : "🔵", kakao     : "💛", google    : "🔍",
    bing      : "🔎", yahoo     : "🟣", duckduckgo: "🦆",
    email     : "📧", sms       : "📱", blog      : "📝",
    podcast   : "🎙️", referral  : "🔗", direct    : "🌐",
    other     : "❓",
  };

  const existingRolesInData = [
    ...new Set(admins.map((a) => a.role).filter(Boolean)),
  ];

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

  // ── derived stats ────────────────────────────────────────
  const stats = useMemo(() => {
    const active = admins.filter((a) => a.status !== "banned").length;
    const banned = admins.filter((a) => a.status === "banned").length;
    const supers = admins.filter(
      (a) => a.role === "super_admin" && a.status !== "banned"
    ).length;
    const today = admins.filter((a) => {
      if (!a.created_at) return false;
      const d   = new Date(a.created_at);
      const now = new Date();
      return d.toDateString() === now.toDateString();
    }).length;
    return { total: admins.length, active, banned, supers, today };
  }, [admins]);

  const activeSuperAdmins = admins.filter(
    (a) => a.role === "super_admin" && a.status !== "banned",
  );

  // ── filter + sort ─────────────────────────────────────────
  const filtered = useMemo(() => {
    const q    = search.toLowerCase();
    let   list = admins.filter((a) => {
      const matchSearch =
        (a.name  ?? "").toLowerCase().includes(q) ||
        (a.email ?? "").toLowerCase().includes(q);
      const matchRole   = filterRole   === "all" || a.role === filterRole;
      const matchStatus =
        filterStatus === "all" ||
        (a.status || "active") === filterStatus;
      return matchSearch && matchRole && matchStatus;
    });

    list.sort((a, b) => {
      let va = a[sortBy], vb = b[sortBy];
      if (sortBy === "created_at" || sortBy === "last_login") {
        va = va ? new Date(va).getTime() : 0;
        vb = vb ? new Date(vb).getTime() : 0;
      } else {
        va = (va ?? "").toString().toLowerCase();
        vb = (vb ?? "").toString().toLowerCase();
      }
      if (va < vb) return sortDir === "asc" ? -1 :  1;
      if (va > vb) return sortDir === "asc" ?  1 : -1;
      return 0;
    });

    return list;
  }, [admins, search, filterRole, filterStatus, sortBy, sortDir]);

  const toggleSort = (col) => {
    if (sortBy === col) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortBy(col);
      setSortDir("desc");
    }
  };

  const sortIcon = (col) => {
    if (sortBy !== col) return " ⇅";
    return sortDir === "asc" ? " ↑" : " ↓";
  };

  // ── password strength ─────────────────────────────────────
  const passwordStrength = useMemo(() => {
    const p = form.password;
    if (!p) return { level: 0, label: "" };
    let score = 0;
    if (p.length >= 8)           score++;
    if (p.length >= 12)          score++;
    if (/[A-Z]/.test(p))         score++;
    if (/[0-9]/.test(p))         score++;
    if (/[^A-Za-z0-9]/.test(p))  score++;

    const map = [
      { level: 0, label: "Too short", color: "#ef4444" },
      { level: 1, label: "Weak",      color: "#ef4444" },
      { level: 2, label: "Fair",      color: "#f59e42" },
      { level: 3, label: "Good",      color: "#eab308" },
      { level: 4, label: "Strong",    color: "#22c55e" },
      { level: 5, label: "Excellent", color: "#16a34a" },
    ];
    return map[score];
  }, [form.password]);

  // ── source analytics fetchers ─────────────────────────────
  const fetchSourceStats = async (period = "all") => {
    setSourceLoading(true);
    setSourceError(null);
    setDrillSource(null);
    setDrillData(null);
    try {
      const token = localStorage.getItem("admin_token");
      const { data } = await axios.get(
        `${SOURCE_API}?period=${period}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSourceData(data);
    } catch (err) {
      const msg = err?.response?.data?.error || "Failed to load source stats";
      setSourceError(msg);
      toast.error(msg);
    } finally {
      setSourceLoading(false);
    }
  };

  const fetchDrillDown = async (source) => {
    setDrillSource(source);
    setDrillLoading(true);
    try {
      const token = localStorage.getItem("admin_token");
      const { data } = await axios.get(
        `${SOURCE_API}/${source}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setDrillData(data);
    } catch (err) {
      toast.error(`Failed to load details for "${source}"`);
      setDrillSource(null);
    } finally {
      setDrillLoading(false);
    }
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab === "sources" && !sourceData) {
      fetchSourceStats(sourcePeriod);
    }
  };

  const handlePeriodChange = (period) => {
    setSourcePeriod(period);
    fetchSourceStats(period);
  };

  const exportCsv = () => {
    const token = localStorage.getItem("admin_token");
    const url   = `${SOURCE_API}/export?period=${sourcePeriod}`;
    /* Open in a new tab — browser will trigger the download */
    const a = document.createElement("a");
    a.href  = url;
    a.setAttribute("Authorization", `Bearer ${token}`);
    window.open(url, "_blank");
  };

  // ── admin actions ─────────────────────────────────────────
  const submit = async () => {
    if (!form.name.trim())        return toast.error("Name is required");
    if (!form.email.trim())       return toast.error("Email is required");
    if (!form.password)           return toast.error("Password is required");
    if (form.password.length < 8) return toast.error("Password must be at least 8 characters");
    if (!form.role)               return toast.error("Please select a role");

    try {
      await registerAdmin(form);
      toast.success(`Admin "${form.name}" created successfully`);
      setForm({ name: "", email: "", password: "", role: "admin" });
      setShowForm(false);
      await reloadAdmins();
    } catch (err) {
      toast.error(err.message || "Failed to create admin");
    }
  };

  const addCustomRole = () => {
    const clean = newRoleName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_ ]/g, "")
      .replace(/\s+/g, "_");

    if (!clean) return toast.error("Role name cannot be empty");
    if (clean.length < 3) return toast.error("Role name too short");
    if (clean === "super_admin" && currentUser.role !== "super_admin") {
      return toast.error("Only a Super Admin can create the Super Admin role");
    }
    if (allRoles.some((r) => r.value === clean)) {
      return toast.error("That role already exists");
    }

    const updated = [...customRoles, clean];
    setCustomRoles(updated);
    localStorage.setItem("customRoles", JSON.stringify(updated));
    setForm((f) => ({ ...f, role: clean }));
    setNewRoleName("");
    setShowCustomInput(false);
    toast.success(`Role "${humanize(clean)}" added`);
  };

  const removeCustomRole = (roleValue) => {
    if (currentUser.role !== "super_admin") {
      return toast.error("Only a Super Admin can remove custom roles");
    }
    if (admins.some((a) => a.role === roleValue)) {
      return toast.error("Cannot delete a role assigned to an admin");
    }
    const updated = customRoles.filter((r) => r !== roleValue);
    setCustomRoles(updated);
    localStorage.setItem("customRoles", JSON.stringify(updated));
    toast.success("Custom role removed");
  };

  const startEdit  = (a) => { setEditingId(a.id); setEditRole(a.role); };

  const saveEdit = async (a) => {
    if (editRole === a.role) { setEditingId(null); return; }
    if (editRole === "super_admin" && currentUser.role !== "super_admin") {
      return toast.error("Only a Super Admin can assign the Super Admin role");
    }
    try {
      await editAdminRole(a.id, editRole);
      toast.success(`Role updated to "${roleLabel(editRole)}"`);
      setEditingId(null);
      await reloadAdmins();
    } catch (err) {
      toast.error(err.message || "Failed to update role");
    }
  };

  const handleBanToggle = (a) => {
    if (a.id === currentUser.id)
      return toast.error("You cannot deactivate your own account");
    if (
      a.role === "super_admin" &&
      a.status !== "banned" &&
      activeSuperAdmins.length === 1
    ) {
      return toast.error("Cannot deactivate the last Super Admin");
    }

    if (a.status === "banned") {
      confirm({
        title:   "Reactivate Admin?",
        body:    `Restore full access for "${a.name}" (${a.email})?`,
        confirm: "Yes, Reactivate",
        action:  async () => {
          await unbanAdmin(a.id);
          toast.success(`"${a.name}" reactivated`);
        },
      });
    } else {
      confirm({
        title:   "Deactivate Admin?",
        body:    `Revoke all access for "${a.name}" (${a.email})? They will be logged out immediately.`,
        danger:  true,
        confirm: "Yes, Deactivate",
        action:  async () => {
          await banAdmin(a.id);
          toast.success(`"${a.name}" deactivated`);
        },
      });
    }
  };

  const copyEmail = (email) => {
    navigator.clipboard.writeText(email);
    toast.success(`Copied ${email}`);
  };

  const clearFilters = () => {
    setSearch("");
    setFilterRole("all");
    setFilterStatus("all");
  };

  const hasFilters = search || filterRole !== "all" || filterStatus !== "all";

  // ── render ────────────────────────────────────────────────
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
          <p style={{ color: "var(--muted)", fontSize: ".78rem", marginTop: 4 }}>
            Manage team members, roles, access permissions and traffic source analytics
          </p>
        </div>
        <div className="ph-right">
          <Rfr onClick={reloadAdmins} />
          {currentUser.role === "super_admin" && activeTab === "admins" && (
            <button className="btn b-solid" onClick={() => setShowForm((s) => !s)}>
              {showForm ? "✕ Close" : "+ New Admin"}
            </button>
          )}
          {activeTab === "sources" && sourceData && (
            <button className="btn b-ghost" onClick={exportCsv} title="Download CSV">
              ⬇ Export CSV
            </button>
          )}
        </div>
      </div>

      {/* ── Tab Navigation ── */}
      <div style={{
        display      : "flex",
        gap          : 4,
        marginBottom : 14,
        borderBottom : "2px solid var(--border)",
        paddingBottom: 0,
      }}>
        {[
          { key: "admins",  label: "👥 Admin Accounts" },
          { key: "sources", label: "📊 Source Analytics" },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => handleTabChange(key)}
            style={{
              background   : "transparent",
              border       : "none",
              borderBottom : activeTab === key
                ? "2px solid var(--accent)"
                : "2px solid transparent",
              color        : activeTab === key ? "var(--accent)" : "var(--muted)",
              fontWeight   : activeTab === key ? 700 : 400,
              fontSize     : ".82rem",
              padding      : "8px 16px",
              cursor       : "pointer",
              marginBottom : -2,
              transition   : "all .15s",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════
          TAB: ADMINS
      ══════════════════════════════════════════════════════ */}
      {activeTab === "admins" && (
        <>
          {/* Stats Cards */}
          <div style={{
            display             : "grid",
            gridTemplateColumns : "repeat(auto-fit, minmax(140px, 1fr))",
            gap                 : 10,
            marginBottom        : 12,
          }}>
            <StatBox label="Total"        value={stats.total}  color="#3b82f6" />
            <StatBox label="Active"       value={stats.active} color="#22c55e" />
            <StatBox label="Deactivated"  value={stats.banned} color="#ef4444" />
            <StatBox label="Super Admins" value={stats.supers} color="#a855f7" />
            <StatBox label="Added Today"  value={stats.today}  color="#f59e42" />
          </div>

          {/* Create Admin Form */}
          {showForm && (
            <Card title="Register New Admin">
              <div className="form-grid">

                <div className="form-group">
                  <label>Full Name *</label>
                  <input
                    className="input"
                    value={form.name}
                    onChange={set("name")}
                    placeholder="Jane Doe"
                    autoFocus
                  />
                </div>

                <div className="form-group">
                  <label>Email *</label>
                  <input
                    className="input"
                    type="email"
                    value={form.email}
                    onChange={set("email")}
                    placeholder="jane@example.com"
                  />
                </div>

                <div className="form-group">
                  <label>
                    Password *{" "}
                    <span style={{ color: "var(--muted)", fontWeight: 400 }}>
                      (min 8 chars)
                    </span>
                  </label>
                  <div style={{ position: "relative" }}>
                    <input
                      className="input"
                      type={showPassword ? "text" : "password"}
                      value={form.password}
                      onChange={set("password")}
                      placeholder="••••••••"
                      style={{ paddingRight: 40 }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      style={{
                        position   : "absolute",
                        right      : 8,
                        top        : "50%",
                        transform  : "translateY(-50%)",
                        background : "transparent",
                        border     : "none",
                        color      : "var(--muted)",
                        cursor     : "pointer",
                        fontSize   : ".72rem",
                        padding    : "4px 8px",
                      }}
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                  {form.password && (
                    <div style={{ marginTop: 6 }}>
                      <div style={{
                        height       : 4,
                        background   : "var(--card2)",
                        borderRadius : 2,
                        overflow     : "hidden",
                      }}>
                        <div style={{
                          height     : "100%",
                          width      : `${(passwordStrength.level / 5) * 100}%`,
                          background : passwordStrength.color,
                          transition : "all .2s",
                        }} />
                      </div>
                      <div style={{
                        fontSize   : ".68rem",
                        color      : passwordStrength.color,
                        marginTop  : 3,
                        fontWeight : 600,
                      }}>
                        {passwordStrength.label}
                      </div>
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label style={{
                    display        : "flex",
                    alignItems     : "center",
                    justifyContent : "space-between",
                  }}>
                    <span>Role *</span>
                    {currentUser.role === "super_admin" && (
                      <button
                        type="button"
                        className="btn b-ghost"
                        style={{ fontSize: ".65rem", padding: "2px 8px" }}
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
                        autoFocus
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
                  <p style={{
                    fontSize  : ".68rem",
                    color     : "var(--muted)",
                    marginTop : 4,
                  }}>
                    {roleDescription(form.role)}
                  </p>
                </div>

                <div className="form-full" style={{
                  display        : "flex",
                  justifyContent : "flex-end",
                  gap            : 8,
                  marginTop      : 6,
                }}>
                  <button
                    className="btn b-ghost"
                    onClick={() => setShowForm(false)}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn b-solid"
                    disabled={busy === "register"}
                    onClick={submit}
                  >
                    {busy === "register" ? "Creating…" : "✓ Create Admin"}
                  </button>
                </div>
              </div>
            </Card>
          )}

          {/* Custom Roles Chips */}
          {currentUser.role === "super_admin" && customRoles.length > 0 && (
            <Card title="Custom Roles">
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {customRoles.map((r) => (
                  <div
                    key={r}
                    style={{
                      display      : "flex",
                      alignItems   : "center",
                      gap          : 6,
                      padding      : "5px 12px",
                      background   : "var(--card2)",
                      borderRadius : 20,
                      fontSize     : ".75rem",
                      border       : "1px solid var(--border)",
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
                        fontSize   : "1.1rem",
                        lineHeight : 1,
                        padding    : 0,
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <p className="dim" style={{ fontSize: ".7rem", marginTop: 8 }}>
                Custom roles are saved locally in your browser. Backend
                permissions must be configured separately.
              </p>
            </Card>
          )}

          {/* Search & Filters */}
          <Card>
            <div style={{
              display    : "flex",
              gap        : 8,
              flexWrap   : "wrap",
              alignItems : "center",
            }}>
              <input
                className="input"
                style={{ flex: 2, minWidth: 200 }}
                placeholder="🔍 Search by name or email…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <select
                className="input"
                style={{ flex: 1, minWidth: 140 }}
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
              >
                <option value="all">All Roles</option>
                {allRoles.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
              <select
                className="input"
                style={{ flex: 1, minWidth: 140 }}
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="all">All Statuses</option>
                <option value="active">Active only</option>
                <option value="banned">Deactivated only</option>
              </select>
              {hasFilters && (
                <button className="btn b-ghost" onClick={clearFilters}>
                  Clear
                </button>
              )}
            </div>
            {hasFilters && (
              <div style={{
                marginTop : 8,
                fontSize  : ".72rem",
                color     : "var(--muted)",
              }}>
                Showing <b>{filtered.length}</b> of <b>{admins.length}</b> admins
              </div>
            )}
          </Card>

          {/* Admins Table */}
          <Card>
            <div className="tw">
              <table>
                <thead>
                  <tr>
                    <th onClick={() => toggleSort("name")}       style={thStyle}>Name{sortIcon("name")}</th>
                    <th onClick={() => toggleSort("email")}      style={thStyle}>Email{sortIcon("email")}</th>
                    <th onClick={() => toggleSort("role")}       style={thStyle}>Role{sortIcon("role")}</th>
                    <th onClick={() => toggleSort("status")}     style={thStyle}>Status{sortIcon("status")}</th>
                    <th onClick={() => toggleSort("created_at")} style={thStyle}>Created{sortIcon("created_at")}</th>
                    <th onClick={() => toggleSort("last_login")} style={thStyle}>Last Login{sortIcon("last_login")}</th>
                    <th>Created By</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((a) => {
                    const isYou     = a.id === currentUser.id;
                    const isEditing = editingId === a.id;
                    const isBanned  = a.status === "banned";

                    return (
                      <tr key={a.id} style={isBanned ? { opacity: 0.55 } : {}}>

                        <td style={{ fontWeight: 700 }}>
                          {a.name}
                          {isYou && (
                            <span style={{
                              marginLeft : 6,
                              fontSize   : ".62rem",
                              color      : "var(--accent)",
                              fontWeight : 700,
                            }}>
                              (You)
                            </span>
                          )}
                        </td>

                        <td className="mono dim" style={{ fontSize: ".7rem" }}>
                          <span
                            onClick={() => copyEmail(a.email)}
                            title="Click to copy"
                            style={{ cursor: "pointer" }}
                          >
                            {a.email}
                          </span>
                        </td>

                        <td>
                          {isEditing ? (
                            <select
                              className="input"
                              style={{ fontSize: ".75rem", padding: "2px 6px" }}
                              value={editRole}
                              onChange={(e) => setEditRole(e.target.value)}
                              autoFocus
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
                          {a.last_login ? timeAgo(a.last_login) : "Never"}
                        </td>

                        <td className="dim" style={{ fontSize: ".7rem" }}>
                          {a.created_by || "—"}
                        </td>

                        <td>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>

                            {currentUser.role === "super_admin" && !isYou && (
                              isEditing ? (
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
                              )
                            )}

                            {currentUser.role === "super_admin" && !isYou && (
                              <button
                                className={`btn ${isBanned ? "b-solid" : "b-red"}`}
                                style={{ fontSize: ".72rem", padding: "2px 10px" }}
                                disabled={
                                  busy === `ba-${a.id}` ||
                                  busy === `uba-${a.id}`
                                }
                                onClick={() => handleBanToggle(a)}
                              >
                                {busy === `ba-${a.id}` || busy === `uba-${a.id}`
                                  ? "…"
                                  : isBanned
                                  ? "Reactivate"
                                  : "Deactivate"}
                              </button>
                            )}

                            {isYou && (
                              <span style={{
                                fontSize : ".68rem",
                                color    : "var(--muted)",
                              }}>
                                —
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {!filtered.length && (
                    <tr>
                      <td colSpan={8} className="empty">
                        {hasFilters
                          ? "No admins match your search or filters."
                          : "No admins found."}
                        {hasFilters && (
                          <div style={{ marginTop: 8 }}>
                            <button
                              className="btn b-ghost"
                              onClick={clearFilters}
                            >
                              Clear filters
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {/* ══════════════════════════════════════════════════════
          TAB: SOURCE ANALYTICS
      ══════════════════════════════════════════════════════ */}
      {activeTab === "sources" && (
        <>
          {/* Period Filter */}
          <Card>
            <div style={{
              display    : "flex",
              gap        : 8,
              alignItems : "center",
              flexWrap   : "wrap",
            }}>
              <span style={{
                fontSize   : ".75rem",
                color      : "var(--muted)",
                fontWeight : 600,
              }}>
                Period:
              </span>
              {[
                { value: "all",   label: "All Time" },
                { value: "month", label: "This Month" },
                { value: "week",  label: "This Week" },
                { value: "today", label: "Today" },
              ].map(({ value, label }) => (
                <button
                  key={value}
                  className={`btn ${sourcePeriod === value ? "b-solid" : "b-ghost"}`}
                  style={{ fontSize: ".75rem", padding: "4px 14px" }}
                  onClick={() => handlePeriodChange(value)}
                >
                  {label}
                </button>
              ))}
              <button
                className="btn b-ghost"
                style={{ marginLeft: "auto", fontSize: ".75rem" }}
                onClick={() => fetchSourceStats(sourcePeriod)}
                disabled={sourceLoading}
              >
                {sourceLoading ? "Loading…" : "↻ Refresh"}
              </button>
            </div>
          </Card>

          {/* Loading */}
          {sourceLoading && (
            <Card>
              <div style={{
                textAlign  : "center",
                padding    : "40px 0",
                color      : "var(--muted)",
                fontSize   : ".85rem",
              }}>
                Loading source analytics…
              </div>
            </Card>
          )}

          {/* Error */}
          {sourceError && !sourceLoading && (
            <Card>
              <div style={{
                textAlign : "center",
                padding   : "30px 0",
                color     : "#ef4444",
                fontSize  : ".85rem",
              }}>
                {sourceError}
                <div style={{ marginTop: 10 }}>
                  <button
                    className="btn b-ghost"
                    onClick={() => fetchSourceStats(sourcePeriod)}
                  >
                    Try Again
                  </button>
                </div>
              </div>
            </Card>
          )}

          {/* Source Data */}
          {sourceData && !sourceLoading && (
            <>
              {/* Summary Cards */}
              <div style={{
                display             : "grid",
                gridTemplateColumns : "repeat(auto-fit, minmax(140px, 1fr))",
                gap                 : 10,
                marginBottom        : 12,
              }}>
                <StatBox
                  label="Total Sources"
                  value={sourceData.all_time?.length ?? 0}
                  color="#3b82f6"
                />
                <StatBox
                  label="Top Source"
                  value={SOURCE_ICONS[sourceData.top_source?.source] ?? "🌐"}
                  color="#a855f7"
                  sub={sourceData.top_source?.source ?? "—"}
                />
                <StatBox
                  label="Top Signups"
                  value={sourceData.top_source?.total ?? 0}
                  color="#22c55e"
                />
                <StatBox
                  label="Zero Traffic"
                  value={sourceData.zero_sources?.length ?? 0}
                  color="#ef4444"
                />
              </div>

              {/* Drill-Down Panel */}
              {drillSource && (
                <Card title={
                  <span>
                    {SOURCE_ICONS[drillSource] ?? "🌐"}{" "}
                    {drillSource.charAt(0).toUpperCase() + drillSource.slice(1)} — Deep Dive
                    <button
                      className="btn b-ghost"
                      style={{
                        fontSize  : ".68rem",
                        padding   : "2px 8px",
                        marginLeft: 12,
                      }}
                      onClick={() => { setDrillSource(null); setDrillData(null); }}
                    >
                      ✕ Close
                    </button>
                  </span>
                }>
                  {drillLoading ? (
                    <div style={{
                      textAlign : "center",
                      padding   : "20px 0",
                      color     : "var(--muted)",
                    }}>
                      Loading…
                    </div>
                  ) : drillData ? (
                    <div style={{
                      display             : "grid",
                      gridTemplateColumns : "repeat(auto-fit, minmax(200px, 1fr))",
                      gap                 : 12,
                    }}>
                      {/* Summary */}
                      <div>
                        <div className="dim" style={{ fontSize: ".7rem", marginBottom: 8, fontWeight: 700 }}>
                          SUMMARY
                        </div>
                        {[
                          { label: "Total Users",  value: drillData.summary?.total      ?? 0 },
                          { label: "Today",        value: drillData.summary?.today      ?? 0 },
                          { label: "This Week",    value: drillData.summary?.this_week  ?? 0 },
                          { label: "This Month",   value: drillData.summary?.this_month ?? 0 },
                        ].map(({ label, value }) => (
                          <div key={label} style={{
                            display        : "flex",
                            justifyContent : "space-between",
                            padding        : "5px 0",
                            borderBottom   : "1px solid var(--border)",
                            fontSize       : ".78rem",
                          }}>
                            <span className="dim">{label}</span>
                            <b>{value}</b>
                          </div>
                        ))}
                      </div>

                      {/* Verified Split */}
                      <div>
                        <div className="dim" style={{ fontSize: ".7rem", marginBottom: 8, fontWeight: 700 }}>
                          VERIFIED SPLIT
                        </div>
                        <MiniBar
                          label="Verified"
                          value={drillData.verified_split?.verified ?? 0}
                          total={drillData.summary?.total ?? 1}
                          color="#22c55e"
                        />
                        <MiniBar
                          label="Unverified"
                          value={drillData.verified_split?.unverified ?? 0}
                          total={drillData.summary?.total ?? 1}
                          color="#f59e42"
                        />
                      </div>

                      {/* Status Split */}
                      <div>
                        <div className="dim" style={{ fontSize: ".7rem", marginBottom: 8, fontWeight: 700 }}>
                          STATUS SPLIT
                        </div>
                        {(drillData.status_split ?? []).map((s) => (
                          <MiniBar
                            key={s.status}
                            label={s.status}
                            value={s.total}
                            total={drillData.summary?.total ?? 1}
                            color={
                              s.status === "active" ? "#22c55e" :
                              s.status === "banned" ? "#ef4444" : "#3b82f6"
                            }
                          />
                        ))}
                      </div>

                      {/* Recent Users */}
                      <div style={{ gridColumn: "1 / -1" }}>
                        <div className="dim" style={{ fontSize: ".7rem", marginBottom: 8, fontWeight: 700 }}>
                          LAST 10 USERS FROM THIS SOURCE
                        </div>
                        <div className="tw">
                          <table>
                            <thead>
                              <tr>
                                <th>Name</th>
                                <th>Email</th>
                                <th>Status</th>
                                <th>Verified</th>
                                <th>Joined</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(drillData.recent_users ?? []).map((u) => (
                                <tr key={u.id}>
                                  <td style={{ fontWeight: 600, fontSize: ".78rem" }}>
                                    {u.name}
                                  </td>
                                  <td className="mono dim" style={{ fontSize: ".7rem" }}>
                                    {u.email}
                                  </td>
                                  <td>
                                    <Pill s={u.status || "active"} />
                                  </td>
                                  <td>
                                    <span style={{
                                      color      : u.verified ? "#22c55e" : "#ef4444",
                                      fontWeight : 700,
                                      fontSize   : ".75rem",
                                    }}>
                                      {u.verified ? "✓" : "✗"}
                                    </span>
                                  </td>
                                  <td className="dim" style={{ fontSize: ".7rem" }}>
                                    {u.created_at
                                      ? new Date(u.created_at).toLocaleDateString()
                                      : "—"}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </Card>
              )}

              {/* All-Time Breakdown Table */}
              <Card title="All-Time Source Breakdown">
                <div className="tw">
                  <table>
                    <thead>
                      <tr>
                        <th>Source</th>
                        <th>Users</th>
                        <th>Share</th>
                        <th>Bar</th>
                        <th>First Signup</th>
                        <th>Last Signup</th>
                        <th>Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(sourceData.all_time ?? []).map((row) => (
                        <tr key={row.source}>
                          <td style={{ fontWeight: 700 }}>
                            <span style={{ marginRight: 6 }}>
                              {SOURCE_ICONS[row.source] ?? "🌐"}
                            </span>
                            {row.source.charAt(0).toUpperCase() + row.source.slice(1)}
                          </td>
                          <td style={{ fontWeight: 700 }}>{row.total}</td>
                          <td className="dim" style={{ fontSize: ".78rem" }}>
                            {row.percentage}%
                          </td>
                          <td style={{ minWidth: 120 }}>
                            <div style={{
                              height       : 8,
                              background   : "var(--card2)",
                              borderRadius : 4,
                              overflow     : "hidden",
                            }}>
                              <div style={{
                                height     : "100%",
                                width      : `${Math.min(row.percentage, 100)}%`,
                                background : "var(--accent)",
                                borderRadius: 4,
                              }} />
                            </div>
                          </td>
                          <td className="dim" style={{ fontSize: ".7rem" }}>
                            {row.first_signup
                              ? new Date(row.first_signup).toLocaleDateString()
                              : "—"}
                          </td>
                          <td className="dim" style={{ fontSize: ".7rem" }}>
                            {row.last_signup
                              ? new Date(row.last_signup).toLocaleDateString()
                              : "—"}
                          </td>
                          <td>
                            <button
                              className="btn b-ghost"
                              style={{ fontSize: ".7rem", padding: "2px 10px" }}
                              onClick={() => fetchDrillDown(row.source)}
                            >
                              Drill Down
                            </button>
                          </td>
                        </tr>
                      ))}

                      {!(sourceData.all_time ?? []).length && (
                        <tr>
                          <td colSpan={7} className="empty">
                            No source data yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>

              {/* Period Comparison */}
              <div style={{
                display             : "grid",
                gridTemplateColumns : "repeat(auto-fit, minmax(280px, 1fr))",
                gap                 : 12,
              }}>
                <Card title="📅 Today">
                  <SourceList rows={sourceData.today ?? []} icons={SOURCE_ICONS} />
                </Card>
                <Card title="📅 This Week">
                  <SourceList rows={sourceData.this_week ?? []} icons={SOURCE_ICONS} />
                </Card>
                <Card title="📅 This Month">
                  <SourceList rows={sourceData.this_month ?? []} icons={SOURCE_ICONS} />
                </Card>
              </div>

              {/* Zero Traffic Sources */}
              {(sourceData.zero_sources ?? []).length > 0 && (
                <Card title="🚫 Platforms with Zero Signups">
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {sourceData.zero_sources.map((s) => (
                      <span
                        key={s}
                        style={{
                          padding      : "4px 10px",
                          background   : "var(--card2)",
                          borderRadius : 20,
                          fontSize     : ".72rem",
                          color        : "var(--muted)",
                          border       : "1px solid var(--border)",
                        }}
                      >
                        {SOURCE_ICONS[s] ?? "🌐"} {s}
                      </span>
                    ))}
                  </div>
                  <p style={{
                    fontSize  : ".7rem",
                    color     : "var(--muted)",
                    marginTop : 8,
                  }}>
                    These platforms have been shared with links but have not
                    generated any signups yet.
                  </p>
                </Card>
              )}
            </>
          )}
        </>
      )}
    </>
  );
}

/* ════════════════════════════════════════════════════════════
   SUB-COMPONENTS
════════════════════════════════════════════════════════════ */

/* ── Source list — used in Today / Week / Month cards ── */
function SourceList({ rows, icons }) {
  if (!rows.length) {
    return (
      <div style={{
        textAlign : "center",
        padding   : "16px 0",
        color     : "var(--muted)",
        fontSize  : ".78rem",
      }}>
        No signups in this period
      </div>
    );
  }
  const max = Math.max(...rows.map((r) => r.total), 1);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {rows.map((r) => (
        <div key={r.source}>
          <div style={{
            display        : "flex",
            justifyContent : "space-between",
            fontSize       : ".78rem",
            marginBottom   : 3,
          }}>
            <span>
              {icons[r.source] ?? "🌐"}{" "}
              {r.source.charAt(0).toUpperCase() + r.source.slice(1)}
            </span>
            <b>{r.total}</b>
          </div>
          <div style={{
            height       : 6,
            background   : "var(--card2)",
            borderRadius : 3,
            overflow     : "hidden",
          }}>
            <div style={{
              height       : "100%",
              width        : `${(r.total / max) * 100}%`,
              background   : "var(--accent)",
              borderRadius : 3,
              transition   : "width .3s",
            }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Mini progress bar — used in drill-down splits ── */
function MiniBar({ label, value, total, color }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{
        display        : "flex",
        justifyContent : "space-between",
        fontSize       : ".75rem",
        marginBottom   : 3,
      }}>
        <span className="dim">
          {label.charAt(0).toUpperCase() + label.slice(1)}
        </span>
        <span style={{ fontWeight: 700 }}>{value} <span className="dim">({pct}%)</span></span>
      </div>
      <div style={{
        height       : 6,
        background   : "var(--card2)",
        borderRadius : 3,
        overflow     : "hidden",
      }}>
        <div style={{
          height       : "100%",
          width        : `${pct}%`,
          background   : color,
          borderRadius : 3,
          transition   : "width .3s",
        }} />
      </div>
    </div>
  );
}

/* ── StatBox — summary metric card ── */
function StatBox({ label, value, color, sub }) {
  return (
    <div style={{
      background   : "var(--card)",
      border       : "1px solid var(--border)",
      borderRadius : 10,
      padding      : "12px 14px",
    }}>
      <div style={{
        fontSize      : ".65rem",
        color         : "var(--muted)",
        textTransform : "uppercase",
        letterSpacing : ".5px",
        fontWeight    : 700,
      }}>
        {label}
      </div>
      <div style={{
        fontSize   : "1.4rem",
        fontWeight : 800,
        color,
        marginTop  : 4,
      }}>
        {value}
      </div>
      {sub && (
        <div style={{
          fontSize   : ".68rem",
          color      : "var(--muted)",
          marginTop  : 2,
          fontWeight : 600,
        }}>
          {sub}
        </div>
      )}
    </div>
  );
}

/* ── Table header style ── */
const thStyle = {
  cursor     : "pointer",
  userSelect : "none",
};

/* ── Time ago ── */
function timeAgo(dateStr) {
  const d       = new Date(dateStr);
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  if (seconds < 60)       return "just now";
  if (seconds < 3600)     return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400)    return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800)   return `${Math.floor(seconds / 86400)}d ago`;
  if (seconds < 2592000)  return `${Math.floor(seconds / 604800)}w ago`;
  if (seconds < 31536000) return `${Math.floor(seconds / 2592000)}mo ago`;
  return `${Math.floor(seconds / 31536000)}y ago`;
}

/* ── Role descriptions ── */
function roleDescription(role) {
  const map = {
    super_admin       : "Full access to everything including other admins",
    admin             : "Manage users, products and limited settings",
    content_moderator : "Manage and moderate products and listings",
    finance_admin     : "Manage payments, refunds and financial reports",
    support_admin     : "Handle support tickets and user issues",
  };
  return map[role] || "Custom role — configure permissions in backend";
}