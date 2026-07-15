// ════════════════════════════════════════════════════════════
// FILE: src/pages/admin/Support/index.jsx
// Support admin shell — manages its own sub-page routing
// Mount this as a single page in AdminDashboard pageMap:
//   support: <SupportAdmin />
// ════════════════════════════════════════════════════════════

import { useState } from "react";
import SupportOverview  from "./SupportOverview";
import TicketList       from "./TicketList";
import TicketDetail     from "./TicketDetail";
import ReportList       from "./ReportList";
import DisputeList      from "./DisputeList";
import DisputeDetail    from "./DisputeDetail";
import AppealList       from "./AppealList";
import FaqManager       from "./FaqManager";
import SupportAnalytics from "./SupportAnalytics";

/* ── nav items ── */
const NAV = [
  { key: "overview",  label: "Overview"   },
  { key: "tickets",   label: "Tickets"    },
  { key: "reports",   label: "Reports"    },
  { key: "disputes",  label: "Disputes"   },
  { key: "appeals",   label: "Appeals"    },
  { key: "faq",       label: "FAQ"        },
  { key: "analytics", label: "Analytics"  },
];

export default function SupportAdmin() {
  const [page,      setPage]      = useState("overview");
  const [detailId,  setDetailId]  = useState(null);

  const pageMap = {
    overview:       <SupportOverview  setPage={setPage} />,
    tickets:        <TicketList       setPage={setPage} setDetailId={setDetailId} />,
    ticket_detail:  <TicketDetail     ticketId={detailId} setPage={setPage} />,
    reports:        <ReportList />,
    disputes:       <DisputeList      setPage={setPage} setDetailId={setDetailId} />,
    dispute_detail: <DisputeDetail    disputeId={detailId} setPage={setPage} />,
    appeals:        <AppealList />,
    faq:            <FaqManager />,
    analytics:      <SupportAnalytics />,
  };

  return (
    <div className="sp-shell">

      {/* ── sub-nav ── */}
      <nav className="sp-nav">
        {NAV.map((n) => (
          <button
            key={n.key}
            className={`sp-nav-btn${page === n.key || page === `${n.key}_detail` ? " sp-nav-active" : ""}`}
            onClick={() => { setPage(n.key); setDetailId(null); }}
          >
            {n.label}
          </button>
        ))}
      </nav>

      {/* ── content ── */}
      <div className="sp-content">
        {pageMap[page] ?? null}
      </div>
    </div>
  );
}