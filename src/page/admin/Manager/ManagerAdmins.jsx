// src/pages/admin/Manager/ManagerAdmins.jsx

import { useState, useMemo } from "react";
import { Pill, Card, Rfr } from "../adminlayout/atoms";
import { ROLE_LABEL } from "../adminlayout/helpers";

export default function ManagerAdmins({ admins, reloadAdmins, currentUser }) {
  const [search,     setSearch]     = useState("");
  const [filterRole, setFilterRole] = useState("all");

  const roleLabel = (v) => ROLE_LABEL[v] ?? v;

  const roles = useMemo(() =>
    [...new Set(admins.map((a) => a.role).filter(Boolean))],
    [admins],
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return admins.filter((a) => {
      const matchSearch =
        (a.name  ?? "").toLowerCase().includes(q) ||
        (a.email ?? "").toLowerCase().includes(q);
      const matchRole = filterRole === "all" || a.role === filterRole;
      return matchSearch && matchRole;
    });
  }, [admins, search, filterRole]);

  return (
    <>
      <div className="ph">
        <div className="ph-left">
          <h1>
            Team Members{" "}
            <span style={{ color: "var(--muted)", fontWeight: 400, fontSize: "1rem" }}>
              ({admins.length})
            </span>
          </h1>
          <p style={{ color: "var(--muted)", fontSize: ".78rem", marginTop: 4 }}>
            View-only list of platform admins. Contact a Super Admin to add or modify.
          </p>
        </div>
        <div className="ph-right">
          <Rfr onClick={reloadAdmins} />
        </div>
      </div>

      {/* Info banner */}
      <div style={{
        padding      : "10px 14px",
        background   : "#3b82f61a",
        border       : "1px solid #3b82f640",
        borderRadius : 8,
        fontSize     : ".78rem",
        color        : "#93c5fd",
        marginBottom : 12,
      }}>
        ℹ️ You are viewing this page in read-only mode.
        Only Super Admins can create, edit or deactivate admins.
      </div>

      {/* Filters */}
      <Card>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            className="input"
            style={{ flex: 1, minWidth: 200 }}
            placeholder="🔍 Search by name or email…"
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
              <option key={r} value={r}>{roleLabel(r)}</option>
            ))}
          </select>
        </div>
      </Card>

      {/* Table */}
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
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => {
                const isYou    = a.id === currentUser.id;
                const isBanned = a.status === "banned";
                return (
                  <tr key={a.id} style={isBanned ? { opacity: 0.55 } : {}}>
                    <td style={{ fontWeight: 700 }}>
                      {a.name}
                      {isYou && (
                        <span style={{
                          marginLeft: 6, fontSize: ".62rem",
                          color: "var(--accent)", fontWeight: 700,
                        }}>
                          (You)
                        </span>
                      )}
                    </td>
                    <td className="mono dim" style={{ fontSize: ".7rem" }}>
                      {a.email}
                    </td>
                    <td><Pill s={a.role} label={roleLabel(a.role)} /></td>
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
                  </tr>
                );
              })}
              {!filtered.length && (
                <tr>
                  <td colSpan={6} className="empty">
                    No admins match your search.
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