/**
 * src/pages/Checkout/CheckoutDebugPanel.jsx
 *
 * Floating debug panel for checkout troubleshooting.
 *
 * Shows:
 * - Config (API URL, token, login status)
 * - Address load status
 * - Cart load status
 * - Calculate response
 * - Last checkout request payload
 * - Last checkout response (or error)
 *
 * Toggle button appears bottom-right in dev mode.
 */

import { useState, useCallback, memo } from "react";

/* ═══════════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════════ */
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
    <span style={{
      display        : "inline-block",
      padding        : "2px 8px",
      borderRadius   : 999,
      fontSize       : 11,
      fontWeight     : 700,
      background     : isOk ? "#10b981" : "#ef4444",
      color          : "#fff",
      marginLeft     : 6,
    }}>
      {status}
    </span>
  );
};

/* ═══════════════════════════════════════════════════════════════
   COMPONENT
═══════════════════════════════════════════════════════════════ */
const CheckoutDebugPanel = memo(function CheckoutDebugPanel({
  apiBase,
  token,
  user,
  addresses,
  selectedAddress,
  cartItems,
  cartLoading,
  calculation,
  paymentMethod,
  lastRequest,       // { url, payload, time }
  lastResponse,      // { status, data, time }
  lastError,         // { status, message, debug, time }
  onRetry,
}) {
  const [open, setOpen] = useState(false);

  /* Only show in dev mode */
  if (!import.meta.env.DEV) return null;

  /* ── Toggle button (always visible) ── */
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          position     : "fixed",
          bottom       : 20,
          right        : 20,
          width        : 52,
          height       : 52,
          borderRadius : "50%",
          background   : "#111827",
          color        : "#fff",
          border       : "2px solid #10b981",
          fontSize     : 22,
          cursor       : "pointer",
          zIndex       : 9999,
          boxShadow    : "0 6px 20px rgba(0,0,0,0.3)",
          display      : "flex",
          alignItems   : "center",
          justifyContent: "center",
        }}
        aria-label="Open debug panel"
      >
        🔍
      </button>
    );
  }

  /* ── Full panel ── */
  return (
    <div style={{
      position        : "fixed",
      inset           : 12,
      background      : "#0f172a",
      color           : "#e2e8f0",
      border          : "3px solid #ff5722",
      borderRadius    : 12,
      zIndex          : 9999,
      overflow        : "auto",
      padding         : 16,
      fontFamily      : "monospace",
      fontSize        : 12,
      lineHeight      : 1.5,
      boxShadow       : "0 20px 60px rgba(0,0,0,0.5)",
    }}>

      {/* Header */}
      <div style={{
        display        : "flex",
        alignItems     : "center",
        justifyContent : "space-between",
        marginBottom   : 12,
        gap            : 8,
        position       : "sticky",
        top            : 0,
        background     : "#0f172a",
        paddingBottom  : 8,
        borderBottom   : "1px solid #334155",
      }}>
        <h3 style={{
          margin     : 0,
          color      : "#fbbf24",
          fontSize   : 15,
          fontWeight : 800,
        }}>
          🔍 CHECKOUT DEBUG PANEL
        </h3>

        <div style={{ display: "flex", gap: 6 }}>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              style={{
                padding      : "6px 12px",
                background   : "#10b981",
                color        : "#fff",
                border       : "none",
                borderRadius : 6,
                fontWeight   : 700,
                cursor       : "pointer",
                fontSize     : 12,
              }}
            >
              🔄 Retry
            </button>
          )}
          <button
            type="button"
            onClick={() => setOpen(false)}
            style={{
              padding      : "6px 12px",
              background   : "#ef4444",
              color        : "#fff",
              border       : "none",
              borderRadius : 6,
              fontWeight   : 700,
              cursor       : "pointer",
              fontSize     : 14,
            }}
            aria-label="Close debug panel"
          >
            ✕
          </button>
        </div>
      </div>

      {/* ── CONFIG ── */}
      <Section title="📡 CONFIG" color="#fbbf24">
        <Row label="API"       value={apiBase} />
        <Row label="Token"     value={truncateToken(token)} />
        <Row label="Logged in" value={user ? "✓ Yes" : "❌ No"} />
        <Row label="User ID"   value={user?.id} />
        <Row label="Email"     value={user?.email} />
        <Row label="Name"      value={user?.name} />
      </Section>

      {/* ── ADDRESSES ── */}
      <Section title="📍 ADDRESSES" color="#60a5fa">
        <Row label="Loaded"   value={`${addresses?.length ?? 0} saved`} />
        <Row label="Selected" value={selectedAddress?.id ?? "❌ None"} />
        {selectedAddress && (
          <pre style={preStyle}>{jsonPretty({
            id:            selectedAddress.id,
            recipient:     selectedAddress.recipient_name,
            phone:         selectedAddress.phone,
            city:          selectedAddress.city,
            state:         selectedAddress.state,
          })}</pre>
        )}
      </Section>

      {/* ── CART ── */}
      <Section title="🛒 CART" color="#10b981">
        <Row label="Loading" value={cartLoading ? "⏳ Yes" : "✓ Done"} />
        <Row label="Items"   value={cartItems?.length ?? 0} />
        {cartItems?.length > 0 && (
          <pre style={preStyle}>{jsonPretty(cartItems.map((i) => ({
            id:         i.id,
            product_id: i.product_id ?? i.productId,
            name:       i.product_name ?? i.name,
            qty:        i.qty,
            price:      i.price,
          })))}</pre>
        )}
      </Section>

      {/* ── CALCULATION ── */}
      <Section title="💰 CALCULATION" color="#a78bfa">
        {calculation ? (
          <>
            <Row label="Subtotal"    value={`₦${calculation.subtotal}`} />
            <Row label="Delivery"    value={`₦${calculation.deliveryFee}`} />
            <Row label="Discount"    value={`₦${calculation.discount ?? 0}`} />
            <Row label="Grand total" value={`₦${calculation.grandTotal}`} />
            <Row label="Options"     value={
              calculation.paymentOptions?.map((o) => o.key).join(", ") ?? "none"
            } />
            <Row label="Selected"    value={paymentMethod ?? "❌ None"} />
          </>
        ) : (
          <div style={{ color: "#fca5a5" }}>❌ No calculation yet</div>
        )}
      </Section>

      {/* ── LAST REQUEST ── */}
      {lastRequest && (
        <Section title="📤 LAST REQUEST" color="#fbbf24">
          <Row label="URL"    value={lastRequest.url} />
          <Row label="Method" value="POST" />
          <Row label="Time"   value={lastRequest.time} />
          <pre style={preStyle}>{jsonPretty(lastRequest.payload)}</pre>
        </Section>
      )}

      {/* ── LAST RESPONSE (SUCCESS) ── */}
      {lastResponse && !lastError && (
        <Section title="📥 LAST RESPONSE" color="#10b981">
          <Row label="Status" value={<>OK {statusBadge(lastResponse.status)}</>} />
          <Row label="Time"   value={lastResponse.time} />
          <pre style={preStyle}>{jsonPretty(lastResponse.data)}</pre>
        </Section>
      )}

      {/* ── LAST ERROR ── */}
      {lastError && (
        <Section title="❌ LAST ERROR" color="#ef4444">
          <Row label="Status"  value={<>{lastError.status ?? "Network"} {statusBadge(lastError.status)}</>} />
          <Row label="Message" value={lastError.message} />
          <Row label="Time"    value={lastError.time} />

          {lastError.debug && (
            <>
              <div style={{
                marginTop  : 10,
                marginBottom: 4,
                color      : "#fca5a5",
                fontWeight : 700,
              }}>
                🐛 SQL / Backend Debug:
              </div>
              <pre style={{ ...preStyle, background: "#450a0a", color: "#fecaca" }}>
                {jsonPretty(lastError.debug)}
              </pre>
            </>
          )}

          {lastError.fullResponse && (
            <>
              <div style={{
                marginTop  : 10,
                marginBottom: 4,
                color      : "#fca5a5",
                fontWeight : 700,
              }}>
                📥 Full Response Body:
              </div>
              <pre style={{ ...preStyle, background: "#450a0a", color: "#fecaca" }}>
                {jsonPretty(lastError.fullResponse)}
              </pre>
            </>
          )}
        </Section>
      )}

      {/* Footer */}
      <div style={{
        marginTop : 20,
        padding   : 10,
        background: "#1e293b",
        borderRadius: 6,
        color     : "#94a3b8",
        fontSize  : 11,
        textAlign : "center",
      }}>
        💡 Only visible in DEV mode. Won't appear in production.
      </div>
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   REUSABLE SUB-COMPONENTS
═══════════════════════════════════════════════════════════════ */
const Section = memo(function Section({ title, color, children }) {
  return (
    <div style={{
      marginBottom : 14,
      padding      : 12,
      background   : "#1e293b",
      borderRadius : 8,
      borderLeft   : `3px solid ${color}`,
    }}>
      <div style={{
        color       : color,
        fontWeight  : 800,
        fontSize    : 13,
        marginBottom: 8,
      }}>
        {title}
      </div>
      {children}
    </div>
  );
});

const Row = memo(function Row({ label, value }) {
  return (
    <div style={{
      display      : "flex",
      gap          : 8,
      marginBottom : 3,
      flexWrap     : "wrap",
    }}>
      <span style={{ color: "#64748b", minWidth: 90 }}>{label}:</span>
      <span style={{
        color     : "#e2e8f0",
        wordBreak : "break-all",
        flex      : 1,
      }}>
        {value ?? <em style={{ color: "#64748b" }}>—</em>}
      </span>
    </div>
  );
});

const preStyle = {
  marginTop    : 8,
  padding      : 10,
  background   : "#0f172a",
  border       : "1px solid #334155",
  borderRadius : 6,
  fontSize     : 11,
  color        : "#67e8f9",
  overflow     : "auto",
  maxHeight    : 250,
  whiteSpace   : "pre-wrap",
  wordBreak    : "break-all",
};

export default CheckoutDebugPanel;