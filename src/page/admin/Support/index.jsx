// ════════════════════════════════════════════════════════════
// FILE: src/pages/admin/Support/index.jsx
// ════════════════════════════════════════════════════════════

import { useState, useCallback, useMemo } from "react";
import { supportCss } from "./supportCss";      // ✅ Import CSS as string

import SupportOverview  from "./SupportOverview";
import TicketList       from "./TicketList";
import TicketDetail     from "./TicketDetail";
import ReportList       from "./ReportList";
import DisputeList      from "./DisputeList";
import DisputeDetail    from "./DisputeDetail";
import AppealList       from "./AppealList";
import FaqManager       from "./FaqManager";
import SupportAnalytics from "./SupportAnalytics";

const NAV = [
  { key: "overview",  label: "Overview"  },
  { key: "tickets",   label: "Tickets"   },
  { key: "reports",   label: "Reports"   },
  { key: "disputes",  label: "Disputes"  },
  { key: "appeals",   label: "Appeals"   },
  { key: "faq",       label: "FAQ"       },
  { key: "analytics", label: "Analytics" },
];

export default function SupportAdmin({
  api,
  confirm,
  currentUser,
  onMutation,
}) {
  const [page,     setPage]     = useState("overview");
  const [detailId, setDetailId] = useState(null);

  const goTo = useCallback((nextPage, id = null) => {
    setPage(nextPage);
    setDetailId(id);
  }, []);

  const openTicket = useCallback((id) => {
    setDetailId(id);
    setPage("ticket_detail");
  }, []);

  const openDispute = useCallback((id) => {
    setDetailId(id);
    setPage("dispute_detail");
  }, []);

  const back = useCallback((fallback = "overview") => {
    setDetailId(null);
    setPage(fallback);
  }, []);

  const shared = useMemo(
    () => ({ api, confirm, currentUser, onMutation, goTo }),
    [api, confirm, currentUser, onMutation, goTo],
  );

  const pageMap = {
    overview:       <SupportOverview  {...shared} setPage={setPage} />,
    tickets:        <TicketList       {...shared} setPage={setPage} setDetailId={setDetailId} openTicket={openTicket} />,
    ticket_detail:  <TicketDetail     {...shared} ticketId={detailId} setPage={setPage} back={() => back("tickets")} />,
    reports:        <ReportList       {...shared} />,
    disputes:       <DisputeList      {...shared} setPage={setPage} setDetailId={setDetailId} openDispute={openDispute} />,
    dispute_detail: <DisputeDetail    {...shared} disputeId={detailId} setPage={setPage} back={() => back("disputes")} />,
    appeals:        <AppealList       {...shared} />,
    faq:            <FaqManager       {...shared} />,
    analytics:      <SupportAnalytics {...shared} />,
  };

  const isActive = (key) => page === key || page === `${key}_detail`;

  return (
    <>
      {/* ✅ Inject CSS directly — guaranteed to load */}
      <style>{supportCss}</style>

      <div className="sp-shell">
        <nav className="sp-nav">
          {NAV.map((n) => (
            <button
              key={n.key}
              type="button"
              className={`sp-nav-btn${isActive(n.key) ? " sp-nav-active" : ""}`}
              onClick={() => {
                setPage(n.key);
                setDetailId(null);
              }}
            >
              {n.label}
            </button>
          ))}
        </nav>

        <div className="sp-content">
          {pageMap[page] ?? (
            <div className="sp-empty">
              Page not found — <button onClick={() => back()}>Go back</button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}