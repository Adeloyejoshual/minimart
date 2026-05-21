import { Card, LogItem, Rfr } from "../adminlayout/atoms";

export default function Logs({ logs, reloadLogs }) {
  return (
    <>
      <div className="ph">
        <div className="ph-left"><h1>Activity Logs</h1></div>
        <div className="ph-right">
          <span style={{ fontSize: ".7rem", color: "var(--muted)", fontFamily: "var(--mono)" }}>
            {logs.length} events
          </span>
          <Rfr onClick={reloadLogs} />
        </div>
      </div>

      <Card
        title="All Events"
        actions={[
          <span key="c" className="live-chip">
            <span className="live-dot" />Auto-refresh 5s
          </span>,
        ]}
      >
        <div className="log-list" style={{ maxHeight: "calc(100vh - 220px)" }}>
          {logs.map((l) => <LogItem key={l.id} log={l} />)}
          {!logs.length && <div className="empty">No activity yet</div>}
        </div>
      </Card>
    </>
  );
}