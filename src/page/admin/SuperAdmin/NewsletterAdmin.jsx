import React, { useState, useEffect, useCallback } from "react";
import { Card, StatCard, Rfr } from "../adminlayout/atoms";

export default function NewsletterAdmin({ api, confirm }) {
  const [testEmail, setTestEmail]     = useState("adeloyejoshua2020@gmail.com");
  const [sendingTest, setSendingTest] = useState(false);
  const [testResult, setTestResult]   = useState(null);

  const [triggering, setTriggering]   = useState(false);
  const [triggerMsg, setTriggerMsg]   = useState(null);

  const [stats, setStats] = useState({
    total_sent: 0,
    sent_last_4days: 0,
    eligible_users: 0,
    total_failed: 0,
  });
  const [logs, setLogs]       = useState([]);
  const [loading, setLoading] = useState(false);

  /* Fetch Stats and Logs via Admin API Client */
  const fetchData = useCallback(async () => {
    if (!api) return;
    setLoading(true);
    try {
      const [resStats, resLogs] = await Promise.all([
        api.get("/newsletter/stats").catch(() => ({ data: {} })),
        api.get("/newsletter/logs").catch(() => ({ data: {} })),
      ]);

      if (resStats?.data?.success) setStats(resStats.data.stats || {});
      if (resLogs?.data?.success)  setLogs(resLogs.data.logs || []);
    } catch (err) {
      console.error("[newsletter] Failed to load data:", err?.message);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /* Handle Test Email Send */
  const handleSendTest = async (e) => {
    e.preventDefault();
    if (!testEmail || !api) return;

    setSendingTest(true);
    setTestResult(null);

    try {
      const { data } = await api.post("/newsletter/test", { email: testEmail });
      setTestResult(data);
      if (data?.success) fetchData();
    } catch (err) {
      setTestResult({
        success: false,
        error: err.response?.data?.error || err.message || "Failed to send test email",
      });
    } finally {
      setSendingTest(false);
    }
  };

  /* Handle Manual 50-User Batch Trigger */
  const handleTrigger4Day = async () => {
    const doDispatch = async () => {
      if (!api) return;
      setTriggering(true);
      setTriggerMsg(null);
      try {
        const { data } = await api.post("/newsletter/trigger-4day");
        setTriggerMsg(data?.message || "Batch process started in background.");
        fetchData();
      } catch (err) {
        setTriggerMsg("Failed to start batch: " + (err.response?.data?.error || err.message));
      } finally {
        setTriggering(false);
      }
    };

    if (confirm) {
      confirm({
        title: "Trigger 50-User Deal Newsletter",
        body: "Are you sure you want to send the deal newsletter to 50 random eligible users now?",
        confirm: "Start Dispatch",
        action: doDispatch,
      });
    } else {
      if (window.confirm("Send Deal Newsletter to 50 random eligible users now?")) {
        doDispatch();
      }
    }
  };

  return (
    <>
      {/* Page Header */}
      <div className="ph">
        <div className="ph-left">
          <h1>Deal Newsletter & Marketing</h1>
        </div>
        <div className="ph-right">
          <Rfr onClick={() => fetchData()} />
        </div>
      </div>

      {/* Summary Metrics */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: 12,
        marginBottom: 16
      }}>
        <StatCard label="Total Sent All-Time" value={(stats?.total_sent || 0).toLocaleString()} color="c-green" />
        <StatCard label="Sent Last 4 Days" value={(stats?.sent_last_4days || 0).toLocaleString()} color="c-blue" />
        <StatCard label="Eligible Users" value={(stats?.eligible_users || 0).toLocaleString()} color="c-purple" />
        <StatCard label="Total Failed" value={(stats?.total_failed || 0).toLocaleString()} color="c-orange" />
      </div>

      {/* Actions Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16, marginBottom: 16 }}>
        
        {/* Send Test Email Card */}
        <Card title="🧪 Send Test Deal Newsletter">
          <form onSubmit={handleSendTest} style={{ padding: 16 }}>
            <p style={{ fontSize: ".8rem", color: "var(--muted)", marginBottom: 12 }}>
              Send an instant preview email with top-ranked DB products to verify template styling.
            </p>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <input
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="Enter email address"
                required
                style={{
                  flex: 1,
                  padding: "8px 12px",
                  borderRadius: 6,
                  border: "1.5px solid var(--border, #e8e6e0)",
                  fontSize: ".82rem",
                  outline: "none",
                }}
              />
              <button
                type="submit"
                disabled={sendingTest}
                className="btn b-primary"
                style={{ padding: "8px 16px", fontSize: ".82rem" }}
              >
                {sendingTest ? "Sending..." : "Send Test"}
              </button>
            </div>

            {testResult && (
              <div style={{
                padding: "8px 12px",
                borderRadius: 6,
                fontSize: ".78rem",
                background: testResult.success ? "#dcfce7" : "#ffe4e6",
                color: testResult.success ? "#166534" : "#9f1239",
                border: `1px solid ${testResult.success ? "#86efac" : "#fecdd3"}`,
              }}>
                {testResult.success
                  ? `✅ Test email sent to ${testResult.targetEmail}!`
                  : `❌ Error: ${testResult.error}`}
              </div>
            )}
          </form>
        </Card>

        {/* Manual Batch Trigger Card */}
        <Card title="🚀 Manual 50-User Batch Trigger">
          <div style={{ padding: 16 }}>
            <p style={{ fontSize: ".8rem", color: "var(--muted)", marginBottom: 16 }}>
              Manually trigger the 4-day deal newsletter dispatch now. Samples 50 random verified users who haven't received an email in 4 days.
            </p>

            <button
              type="button"
              onClick={handleTrigger4Day}
              disabled={triggering}
              className="btn"
              style={{
                background: "#000",
                color: "#fff",
                padding: "10px 20px",
                fontSize: ".82rem",
                fontWeight: 700,
                width: "100%",
                borderRadius: 6,
                cursor: "pointer",
              }}
            >
              {triggering ? "Dispatching Batch..." : "Trigger 50-User Dispatch Now"}
            </button>

            {triggerMsg && (
              <div style={{ marginTop: 12, padding: "8px 12px", background: "#f0fdf4", color: "#166534", borderRadius: 6, fontSize: ".78rem", border: "1px solid #bbf7d0" }}>
                {triggerMsg}
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Logs Table */}
      <Card title="Recent Dispatch Logs">
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: ".8rem" }}>
            <thead>
              <tr style={{ background: "var(--card2, #fafaf8)", borderBottom: "1px solid var(--border, #eee)", textAlign: "left" }}>
                <th style={{ padding: "10px 14px" }}>Recipient</th>
                <th style={{ padding: "10px 14px" }}>Status</th>
                <th style={{ padding: "10px 14px" }}>Batch Key</th>
                <th style={{ padding: "10px 14px" }}>Sent At</th>
                <th style={{ padding: "10px 14px" }}>Details / Error</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan="5" style={{ padding: 20, textAlign: "center", color: "#aaa" }}>Loading logs...</td></tr>
              )}
              {!loading && (!logs || logs.length === 0) && (
                <tr><td colSpan="5" style={{ padding: 20, textAlign: "center", color: "#aaa" }}>No newsletter logs found.</td></tr>
              )}
              {logs && logs.map((log) => (
                <tr key={log.id || Math.random()} style={{ borderBottom: "1px solid var(--border, #f0f0f0)" }}>
                  <td style={{ padding: "10px 14px", fontWeight: 600 }}>
                    {log.user_email || "Unknown"}
                    {log.user_name && <span style={{ color: "#aaa", fontWeight: 400, marginLeft: 6 }}>({log.user_name})</span>}
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    <span style={{
                      padding: "2px 8px",
                      borderRadius: 999,
                      fontSize: ".7rem",
                      fontWeight: 700,
                      background: log.status === "sent" ? "#dcfce7" : "#ffe4e6",
                      color: log.status === "sent" ? "#15803d" : "#be123c",
                    }}>
                      {log.status ? log.status.toUpperCase() : "PENDING"}
                    </span>
                  </td>
                  <td style={{ padding: "10px 14px", fontFamily: "var(--mono)", fontSize: ".72rem" }}>
                    {log.week_key || "—"}
                  </td>
                  <td style={{ padding: "10px 14px", color: "var(--muted)" }}>
                    {log.sent_at ? new Date(log.sent_at).toLocaleString() : "—"}
                  </td>
                  <td style={{ padding: "10px 14px", color: "#e11d48", fontSize: ".72rem" }}>
                    {log.error_message || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}