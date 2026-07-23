import { useState, useMemo } from "react";
import { fmt, fmtN, fmtDate } from "../adminlayout/helpers";
import { Pill, Card, Rfr, Srch } from "../adminlayout/atoms";
import toast from "react-hot-toast";

export default function Users({
  filteredUsers, userQ, setUserQ,
  banUser, unbanUser, busy, reloadUsers, confirm,
}) {
  // ── local state ─────────────────────────────────────────
  const [filterStatus,   setFilterStatus]   = useState("all");
  const [filterVerified, setFilterVerified] = useState("all");
  const [sortBy,         setSortBy]         = useState("created_at");
  const [sortDir,        setSortDir]        = useState("desc");

  // ── stats ───────────────────────────────────────────────
  const stats = useMemo(() => {
    const total    = filteredUsers.length;
    const active   = filteredUsers.filter((u) => u.status !== "banned").length;
    const banned   = filteredUsers.filter((u) => u.status === "banned").length;
    const verified = filteredUsers.filter((u) => u.verified).length;
    const today    = filteredUsers.filter((u) => {
      if (!u.created_at) return false;
      const d = new Date(u.created_at);
      return d.toDateString() === new Date().toDateString();
    }).length;
    return { total, active, banned, verified, today };
  }, [filteredUsers]);

  // ── filter + sort ───────────────────────────────────────
  const displayed = useMemo(() => {
    let list = filteredUsers.filter((u) => {
      const matchStatus =
        filterStatus === "all" || (u.status || "active") === filterStatus;
      const matchVerified =
        filterVerified === "all" ||
        (filterVerified === "verified"   && u.verified) ||
        (filterVerified === "unverified" && !u.verified);
      return matchStatus && matchVerified;
    });

    list.sort((a, b) => {
      let va = a[sortBy], vb = b[sortBy];
      if (sortBy === "created_at" || sortBy === "last_login") {
        va = va ? new Date(va).getTime() : 0;
        vb = vb ? new Date(vb).getTime() : 0;
      } else if (sortBy === "balance") {
        va = Number(va) || 0;
        vb = Number(vb) || 0;
      } else {
        va = (va ?? "").toString().toLowerCase();
        vb = (vb ?? "").toString().toLowerCase();
      }
      if (va < vb) return sortDir === "asc" ? -1 :  1;
      if (va > vb) return sortDir === "asc" ?  1 : -1;
      return 0;
    });

    return list;
  }, [filteredUsers, filterStatus, filterVerified, sortBy, sortDir]);

  const toggleSort = (col) => {
    if (sortBy === col) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortBy(col); setSortDir("desc"); }
  };

  const sortIcon = (col) =>
    sortBy !== col ? " ⇅" : sortDir === "asc" ? " ↑" : " ↓";

  // ── clipboard ───────────────────────────────────────────
  const copy = (value, label) => {
    if (!value) return;
    navigator.clipboard.writeText(value);
    toast.success(`${label} copied`);
  };

  // ── actions ─────────────────────────────────────────────
  const handleBan = (u) => {
    confirm({
      title:   "Ban User?",
      body:    `Ban "${u.name}" (${u.email})? They will lose access immediately.`,
      danger:  true,
      confirm: "Yes, Ban",
      action:  async () => {
        try {
          await banUser(u.id);
          toast.success(`"${u.name}" has been banned`);
        } catch (err) {
          toast.error(err.message || "Failed to ban user");
        }
      },
    });
  };

  const handleUnban = (u) => {
    confirm({
      title:   "Unban User?",
      body:    `Restore access for "${u.name}" (${u.email})?`,
      confirm: "Yes, Unban",
      action:  async () => {
        try {
          await unbanUser(u.id);
          toast.success(`"${u.name}" has been reactivated`);
        } catch (err) {
          toast.error(err.message || "Failed to unban user");
        }
      },
    });
  };

  const clearFilters = () => {
    setUserQ("");
    setFilterStatus("all");
    setFilterVerified("all");
  };

  const hasFilters =
    userQ || filterStatus !== "all" || filterVerified !== "all";

  // ── render ──────────────────────────────────────────────
  return (
    <>
      {/* Page Header */}
      <div className="ph">
        <div className="ph-left">
          <h1>
            Users{" "}
            <span style={{ color: "var(--muted)", fontWeight: 400, fontSize: "1rem" }}>
              ({fmt(displayed.length)})
            </span>
          </h1>
          <p style={{ color: "var(--muted)", fontSize: ".78rem", marginTop: 4 }}>
            Manage regular platform users and buyer/seller accounts
          </p>
        </div>
        <div className="ph-right">
          <Rfr onClick={reloadUsers} />
        </div>
      </div>

      {/* Stats Cards */}
      <div style={{
        display             : "grid",
        gridTemplateColumns : "repeat(auto-fit, minmax(140px, 1fr))",
        gap                 : 10,
        marginBottom        : 12,
      }}>
        <StatBox label="Total"    value={fmt(stats.total)}    color="#3b82f6" />
        <StatBox label="Active"   value={fmt(stats.active)}   color="#22c55e" />
        <StatBox label="Banned"   value={fmt(stats.banned)}   color="#ef4444" />
        <StatBox label="Verified" value={fmt(stats.verified)} color="#a855f7" />
        <StatBox label="Joined Today" value={fmt(stats.today)} color="#f59e42" />
      </div>

      {/* Search + Filters */}
      <Card>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <input
            className="input"
            style={{ flex: 2, minWidth: 200 }}
            placeholder="🔍 Search by name, email, phone or store…"
            value={userQ}
            onChange={(e) => setUserQ(e.target.value)}
          />
          <select
            className="input"
            style={{ flex: 1, minWidth: 140 }}
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="all">All Statuses</option>
            <option value="active">Active only</option>
            <option value="banned">Banned only</option>
          </select>
          <select
            className="input"
            style={{ flex: 1, minWidth: 140 }}
            value={filterVerified}
            onChange={(e) => setFilterVerified(e.target.value)}
          >
            <option value="all">All Users</option>
            <option value="verified">✓ Verified only</option>
            <option value="unverified">Unverified only</option>
          </select>
          {hasFilters && (
            <button className="btn b-ghost" onClick={clearFilters}>
              Clear
            </button>
          )}
        </div>
        {hasFilters && (
          <div style={{
            marginTop: 8, fontSize: ".72rem", color: "var(--muted)",
          }}>
            Showing <b>{fmt(displayed.length)}</b> of <b>{fmt(filteredUsers.length)}</b> users
          </div>
        )}
      </Card>

      {/* Users Table */}
      <Card>
        <div className="tw">
          <table>
            <thead>
              <tr>
                <th onClick={() => toggleSort("name")}       style={thStyle}>Name{sortIcon("name")}</th>
                <th onClick={() => toggleSort("email")}      style={thStyle}>Email{sortIcon("email")}</th>
                <th>Phone</th>
                <th>Location</th>
                <th onClick={() => toggleSort("status")}     style={thStyle}>Status{sortIcon("status")}</th>
                <th onClick={() => toggleSort("balance")}    style={thStyle}>Balance{sortIcon("balance")}</th>
                <th onClick={() => toggleSort("created_at")} style={thStyle}>Joined{sortIcon("created_at")}</th>
                <th onClick={() => toggleSort("last_login")} style={thStyle}>Last Login{sortIcon("last_login")}</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {displayed.map((u) => {
                const isBanned = u.status === "banned";
                const phone    = u.phone || u.phone_number;
                const location = [u.city, u.state].filter(Boolean).join(", ") || "—";

                return (
                  <tr key={u.id} style={isBanned ? { opacity: 0.55 } : {}}>
                    <td style={{ fontWeight: 700 }}>
                      {u.name || "—"}
                      {u.verified && (
                        <span title="Verified" style={{ marginLeft: 6, color: "#a855f7" }}>
                          ✓
                        </span>
                      )}
                      {u.store_verified && (
                        <span title="Verified Store" style={{ marginLeft: 4, color: "#22c55e" }}>
                          🏪
                        </span>
                      )}
                    </td>

                    <td
                      className="mono dim"
                      style={{ fontSize: ".7rem", cursor: "pointer" }}
                      onClick={() => copy(u.email, "Email")}
                      title="Click to copy"
                    >
                      {u.email}
                    </td>

                    <td
                      className="mono"
                      style={{ fontSize: ".7rem", cursor: phone ? "pointer" : "default" }}
                      onClick={() => copy(phone, "Phone")}
                      title={phone ? "Click to copy" : ""}
                    >
                      {phone || "—"}
                    </td>

                    <td className="dim" style={{ fontSize: ".72rem" }}>{location}</td>

                    <td><Pill s={u.status || "active"} /></td>

                    <td className="mono" style={{ color: "var(--green)" }}>
                      {fmtN(u.balance)}
                    </td>

                    <td className="mono dim" style={{ fontSize: ".68rem" }}>
                      {fmtDate(u.created_at)}
                    </td>

                    <td className="mono dim" style={{ fontSize: ".68rem" }}>
                      {u.last_login ? fmtDate(u.last_login) : "Never"}
                    </td>

                    <td>
                      {isBanned ? (
                        <button
                          className="btn b-solid"
                          style={{ fontSize: ".72rem", padding: "2px 10px" }}
                          disabled={busy === `ubu-${u.id}`}
                          onClick={() => handleUnban(u)}
                        >
                          {busy === `ubu-${u.id}` ? "…" : "Unban"}
                        </button>
                      ) : (
                        <button
                          className="btn b-red"
                          style={{ fontSize: ".72rem", padding: "2px 10px" }}
                          disabled={busy === `bu-${u.id}`}
                          onClick={() => handleBan(u)}
                        >
                          {busy === `bu-${u.id}` ? "…" : "Ban"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}

              {!displayed.length && (
                <tr>
                  <td colSpan={9} className="empty">
                    {hasFilters
                      ? "No users match your search or filters."
                      : "No users found."}
                    {hasFilters && (
                      <div style={{ marginTop: 8 }}>
                        <button className="btn b-ghost" onClick={clearFilters}>
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
  );
}

/* ── helper: stat box ── */
function StatBox({ label, value, color }) {
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
    </div>
  );
}

/* ── helper: table header style ── */
const thStyle = {
  cursor     : "pointer",
  userSelect : "none",
};