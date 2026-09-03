/**
 * src/pages/MarketDetail/RateProductDebugPanel.jsx
 *
 * Always-visible inline debug panel for Rate Product.
 * Same style as CheckoutDebugPanel.
 */

import { useState, memo } from "react";

const truncateToken = (t) => {
  if (!t) return "❌ Missing";
  return `✓ Present (${t.slice(0, 20)}…)`;
};

const jsonPretty = (obj) => {
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return String(obj);
  }
};

const statusBadge = (status) => {
  if (!status) return null;
  const isOk = status >= 200 && status < 300;
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 700,
        background: isOk ? "#10b981" : "#ef4444",
        color: "#fff",
        marginLeft: 6,
      }}
    >
      {status}
    </span>
  );
};

const Section = memo(function Section({ title, color, children }) {
  return (
    <div
      style={{
        marginBottom: 14,
        padding: 12,
        background: "#1e293b",
        borderRadius: 8,
        borderLeft: `3px solid ${color}`,
      }}
    >
      <div
        style={{
          color,
          fontWeight: 800,
          fontSize: 13,
          marginBottom: 8,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
});

const Row = memo(function Row({ label, value }) {
  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        marginBottom: 3,
        flexWrap: "wrap",
      }}
    >
      <span style={{ color: "#64748b", minWidth: 100 }}>{label}:</span>
      <span
        style={{
          color: "#e2e8f0",
          wordBreak: "break-all",
          flex: 1,
        }}
      >
        {value ?? <em style={{ color: "#64748b" }}>—</em>}
      </span>
    </div>
  );
});

const preStyle = {
  marginTop: 8,
  padding: 10,
  background: "#0f172a",
  border: "1px solid #334155",
  borderRadius: 6,
  fontSize: 11,
  color: "#67e8f9",
  overflow: "auto",
  maxHeight: 220,
  whiteSpace: "pre-wrap",
  wordBreak: "break-all",
};

const RateProductDebugPanel = memo(function RateProductDebugPanel({
  apiUrlFromConfig,
  resolvedBase,
  targetUrl,
  token,
  productId,
  productName,
  rating,
  comment,
  lastRequest,
  lastResponse,
  lastError,
  onRetry,
}) {
  const [closed, setClosed] = useState(false);

  if (closed) {
    return (
      <div
        onClick={() => setClosed(false)}
        style={{
          margin: "8px 0",
          padding: "8px 12px",
          background: "#0f172a",
          color: "#fbbf24",
          borderRadius: 6,
          fontSize: 12,
          fontWeight: 700,
          textAlign: "center",
          cursor: "pointer",
          fontFamily: "monospace",
          border: "1px dashed #ff5722",
        }}
      >
        🔍 Show Rating Debug Panel
      </div>
    );
  }

  const urlLooksWrong =
    typeof targetUrl === "string" && targetUrl.includes("/api/products/");

  return (
    <div
      style={{
        marginTop: 12,
        background: "#0f172a",
        color: "#e2e8f0",
        border: "3px solid #ff5722",
        borderRadius: 12,
        overflow: "auto",
        maxHeight: "55vh",
        padding: 16,
        fontFamily: "monospace",
        fontSize: 12,
        lineHeight: 1.5,
        boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
        textAlign: "left",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12,
          gap: 8,
          position: "sticky",
          top: 0,
          background: "#0f172a",
          paddingBottom: 8,
          borderBottom: "1px solid #334155",
          zIndex: 1,
        }}
      >
        <h3
          style={{
            margin: 0,
            color: "#fbbf24",
            fontSize: 15,
            fontWeight: 800,
          }}
        >
          🔍 RATE PRODUCT DEBUG
        </h3>

        <div style={{ display: "flex", gap: 6 }}>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              style={{
                padding: "6px 12px",
                background: "#10b981",
                color: "#fff",
                border: "none",
                borderRadius: 6,
                fontWeight: 700,
                cursor: "pointer",
                fontSize: 12,
              }}
            >
              🔄 Retry
            </button>
          )}
          <button
            type="button"
            onClick={() => setClosed(true)}
            style={{
              padding: "6px 12px",
              background: "#ef4444",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              fontWeight: 700,
              cursor: "pointer",
              fontSize: 14,
            }}
            aria-label="Close debug panel"
          >
            ✕
          </button>
        </div>
      </div>

      {urlLooksWrong && (
        <div
          style={{
            marginBottom: 12,
            padding: 10,
            background: "#450a0a",
            border: "1px solid #ef4444",
            borderRadius: 8,
            color: "#fecaca",
            fontWeight: 700,
          }}
        >
          ⚠️ WRONG PATH DETECTED
          <div style={{ fontWeight: 500, marginTop: 4 }}>
            Request is using <code>/api/products/...</code>
            <br />
            MarketDetail GET uses <code>/api/shop/...</code>
            <br />
            Reviews MUST be <code>POST /api/shop/:id/reviews</code>
          </div>
        </div>
      )}

      <Section title="📡 CONFIG" color="#fbbf24">
        <Row label="API_URL cfg" value={apiUrlFromConfig || "❌ empty"} />
        <Row label="Resolved base" value={resolvedBase} />
        <Row label="Target URL" value={targetUrl} />
        <Row label="Token" value={truncateToken(token)} />
        <Row label="Product ID" value={productId} />
        <Row label="Product" value={productName} />
        <Row label="Rating" value={rating} />
        <Row label="Comment" value={comment || "(empty)"} />
      </Section>

      <Section title="🧠 EXPECTED" color="#60a5fa">
        <Row
          label="Correct URL"
          value={`${resolvedBase}/${productId}/reviews`}
        />
        <Row label="Method" value="POST" />
        <Row
          label="Headers"
          value='Authorization: Bearer <marketplace_token>, Content-Type: application/json'
        />
        <Row
          label="Body"
          value='{ "rating": 1-5, "comment": "optional" }'
        />
      </Section>

      {lastRequest && (
        <Section title="📤 LAST REQUEST" color="#fbbf24">
          <Row label="URL" value={lastRequest.url} />
          <Row label="Method" value={lastRequest.method || "POST"} />
          <Row label="Time" value={lastRequest.time} />
          <pre style={preStyle}>{jsonPretty(lastRequest.payload)}</pre>
          {lastRequest.headers && (
            <>
              <div style={{ marginTop: 8, color: "#94a3b8", fontWeight: 700 }}>
                Headers sent:
              </div>
              <pre style={preStyle}>{jsonPretty(lastRequest.headers)}</pre>
            </>
          )}
        </Section>
      )}

      {lastResponse && !lastError && (
        <Section title="📥 LAST RESPONSE" color="#10b981">
          <Row
            label="Status"
            value={
              <>
                OK {statusBadge(lastResponse.status)}
              </>
            }
          />
          <Row label="Time" value={lastResponse.time} />
          <pre style={preStyle}>{jsonPretty(lastResponse.data)}</pre>
        </Section>
      )}

      {lastError && (
        <Section title="❌ LAST ERROR" color="#ef4444">
          <Row
            label="Status"
            value={
              <>
                {lastError.status ?? "Network"} {statusBadge(lastError.status)}
              </>
            }
          />
          <Row label="Message" value={lastError.message} />
          <Row label="Axios msg" value={lastError.axiosMessage} />
          <Row label="Time" value={lastError.time} />

          {lastError.fullResponse && (
            <>
              <div
                style={{
                  marginTop: 10,
                  marginBottom: 4,
                  color: "#fca5a5",
                  fontWeight: 700,
                }}
              >
                📥 Full Response Body:
              </div>
              <pre style={{ ...preStyle, background: "#450a0a", color: "#fecaca" }}>
                {jsonPretty(lastError.fullResponse)}
              </pre>
            </>
          )}
        </Section>
      )}

      {!lastRequest && !lastResponse && !lastError && (
        <div
          style={{
            padding: 20,
            textAlign: "center",
            background: "#1e293b",
            borderRadius: 8,
            color: "#94a3b8",
            fontSize: 12,
          }}
        >
          💤 Waiting for you to click &quot;Submit Rating&quot;…
          <br />
          After you click, request/response details will appear here.
        </div>
      )}
    </div>
  );
});

export default RateProductDebugPanel;