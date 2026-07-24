// ════════════════════════════════════════════════════════════
// FILE: src/page/admin/Support/SupportDashboard.jsx
// Main entry point for Support Admin — wraps SupportAdmin shell
// with the standard layout (Sidebar + Topbar) and API context
// ════════════════════════════════════════════════════════════

import { useEffect, useState, useMemo, useCallback } from "react";
import axios from "axios";

// ── Layout ────────────────────────────────────────────────────
import Sidebar from "../adminlayout/Sidebar";
import Topbar  from "../adminlayout/Topbar";
import { css } from "../adminlayout/css";

// ── Support shell (your existing index.jsx) ──────────────────
import SupportAdmin from "./index";

/* ════════════════════════════════════════════════════════════
   ENV + API base
════════════════════════════════════════════════════════════ */
const BASE = `${import.meta.env.VITE_API_BASE_URL}/api/admin`;

const NOTIF_POLL_INTERVAL = 15_000;

/* ════════════════════════════════════════════════════════════
   createApi
════════════════════════════════════════════════════════════ */
const createApi = (token) => {
  const h = { Authorization: `Bearer ${token}` };
  return {
    get   : (p, base = BASE)         => axios.get   (base + p,     { headers: h }),
    post  : (p, b = {}, base = BASE) => axios.post  (base + p, b,  { headers: h }),
    put   : (p, b = {}, base = BASE) => axios.put   (base + p, b,  { headers: h }),
    patch : (p, b = {}, base = BASE) => axios.patch (base + p, b,  { headers: h }),
    del   : (p, base = BASE)         => axios.delete(base + p,     { headers: h }),
  };
};

/* ════════════════════════════════════════════════════════════
   CONFIRM MODAL
════════════════════════════════════════════════════════════ */
function Confirm({ cfg, onClose }) {
  if (!cfg) return null;
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">{cfg.title}</div>
        <p style={{ fontSize: ".82rem", color: "var(--muted)", lineHeight: 1.6 }}>
          {cfg.body}
        </p>
        <div className="modal-btns">
          <button className="btn b-ghost" onClick={onClose}>Cancel</button>
          <button
            className={`btn ${cfg.danger ? "b-red" : "b-solid"}`}
            onClick={() => { cfg.action(); onClose(); }}
          >
            {cfg.confirm || "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   useSupportStats — polls badge counts for the sidebar
════════════════════════════════════════════════════════════ */
function useSupportStats(api) {
  const [stats, setStats] = useState({
    ticketsOpen  : 0,
    reportsOpen  : 0,
    disputesOpen : 0,
    appealsOpen  : 0,
    loading      : true,
  });

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/support/stats");
      setStats({
        ticketsOpen  : data?.tickets?.open       ?? 0,
        reportsOpen  : data?.reports_pending     ?? 0,
        disputesOpen : data?.disputes_open       ?? 0,
        appealsOpen  : data?.appeals_open        ?? 0,
        loading      : false,
      });
    } catch (err) {
      console.warn("[support] stats:", err.message);
      setStats((s) => ({ ...s, loading: false }));
    }
  }, [api]);

  useEffect(() => {
    load();
    const iv = setInterval(load, NOTIF_POLL_INTERVAL);
    return () => clearInterval(iv);
  }, [load]);

  return { stats, reloadStats: load };
}

/* ════════════════════════════════════════════════════════════
   SUPPORT DASHBOARD
════════════════════════════════════════════════════════════ */
export default function SupportDashboard() {
  const token = useMemo(() => localStorage.getItem("admin_token"), []);
  const api   = useMemo(() => createApi(token), [token]);

  const currentUser = useMemo(() => {
    try {
      const stored = localStorage.getItem("admin");
      if (stored) return JSON.parse(stored);
    } catch {}
    return { id: null, name: null, email: null, role: null };
  }, []);

  const adminName = currentUser?.name || "Support Admin";

  const [confirmCfg, setConfirmCfg] = useState(null);
  const confirm = useCallback((cfg) => setConfirmCfg(cfg), []);

  const { stats, reloadStats } = useSupportStats(api);

  const totalNotifCount =
    stats.ticketsOpen +
    stats.reportsOpen +
    stats.disputesOpen +
    stats.appealsOpen;

  if (stats.loading) {
    return (
      <>
        <style>{css}</style>
        <div className="loading">
          <span className="live-dot" /> Loading support panel...
        </div>
      </>
    );
  }

  return (
    <>
      <style>{css}</style>

      <div className="wrap">

        {/* ── Sidebar — pass Support counts so badges show ── */}
        <Sidebar
          page="support"
          setPage={() => {}}         // Support has its own inner nav
          role="support_admin"
          supportTicketsOpen={stats.ticketsOpen}
          supportReportsOpen={stats.reportsOpen}
          supportDisputesOpen={stats.disputesOpen}
          supportAppealsOpen={stats.appealsOpen}
        />

        <div className="main">
          <Topbar
            page="support"
            adminName={adminName}
            notifCount={totalNotifCount}
            roleBadge="Support"
          />
          <div className="body">
            <SupportAdmin
              api={api}
              confirm={confirm}
              currentUser={currentUser}
              onMutation={reloadStats}
            />
          </div>
        </div>
      </div>

      <Confirm cfg={confirmCfg} onClose={() => setConfirmCfg(null)} />
    </>
  );
}