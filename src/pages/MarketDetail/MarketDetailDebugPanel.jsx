/**
 * src/pages/MarketDetail/MarketDetailDebugPanel.jsx
 *
 * Always-visible inline debug panel for MarketDetail (/shop/:slug).
 * Shows: Config/Auth, Raw Product & Stock, Selected Variant,
 *        Computed Price/Stock, Cart State, Last Request/Response/Error.
 */

import { useState, memo } from "react";

/* ═══════════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════════ */
const truncateToken = (t) => {
  if (!t) return "❌ Missing (Guest Mode)";
  return `✓ Present (${t.slice(0, 20)}…)`;
};

const jsonPretty = (obj) => {
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return String(obj);
  }
};

const formatTypeAndVal = (val) => {
  if (val === undefined) return "undefined";
  if (val === null) return "null";
  return `${JSON.stringify(val)} (${typeof val})`;
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

/* ═══════════════════════════════════════════════════════════════
   SUB-COMPONENTS
═══════════════════════════════════════════════════════════════ */
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
          color: color,
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
      <span style={{ color: "#64748b", minWidth: 120 }}>{label}:</span>
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
  maxHeight: 240,
  whiteSpace: "pre-wrap",
  wordBreak: "break-all",
};

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════ */
const MarketDetailDebugPanel = memo(function MarketDetailDebugPanel({
  slug,
  apiRoot,
  shopUrl,
  cartUrl,
  cartItemsUrl,
  token,
  product,
  selectedVariant,
  hasVariants,
  displayPrice,
  originalPrice,
  discount,
  stockLeft,
  isOutOfStock,
  qty,
  inCart,
  cartLineQty,
  cartItemId,
  cartCount,
  cartError,
  guestCart,
  lastRequest,
  lastResponse,
  lastError,
  onReloadProduct,
  onTestAddToCart,
}) {
  const [closed, setClosed] = useState(false);

  /* ── Collapsed state: small toggle bar ── */
  if (closed) {
    return (
      <div
        onClick={() => setClosed(false)}
        style={{
          margin: "8px 12px",
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
        🔍 Show MarketDetail Debug Panel
      </div>
    );
  }

  /* ── Expanded panel ── */
  return (
    <div
      style={{
        margin: "12px",
        background: "#0f172a",
        color: "#e2e8f0",
        border: "3px solid #ff5722",
        borderRadius: 12,
        overflow: "auto",
        maxHeight: "70vh",
        padding: 16,
        fontFamily: "monospace",
        fontSize: 12,
        lineHeight: 1.5,
        boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
      }}
    >
      {/* Header */}
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
          flexWrap: "wrap",
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
          🔍 MARKET DETAIL DEBUG PANEL
        </h3>

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {onReloadProduct && (
            <button
              type="button"
              onClick={onReloadProduct}
              style={{
                padding: "6px 10px",
                background: "#3b82f6",
                color: "#fff",
                border: "none",
                borderRadius: 6,
                fontWeight: 700,
                cursor: "pointer",
                fontSize: 11,
              }}
            >
              🔄 Reload Product
            </button>
          )}
          {onTestAddToCart && (
            <button
              type="button"
              onClick={onTestAddToCart}
              style={{
                padding: "6px 10px",
                background: "#10b981",
                color: "#fff",
                border: "none",
                borderRadius: 6,
                fontWeight: 700,
                cursor: "pointer",
                fontSize: 11,
              }}
            >
              🛒 Test Add Cart
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

      {/* 1. CONFIG & AUTH */}
      <Section title="📡 CONFIG & AUTH" color="#fbbf24">
        <Row label="Slug" value={slug} />
        <Row label="API Root" value={apiRoot} />
        <Row label="Shop URL" value={`${shopUrl}/${slug}`} />
        <Row label="Cart URL" value={cartUrl} />
        <Row label="Cart Items URL" value={cartItemsUrl} />
        <Row label="Auth Token" value={truncateToken(token)} />
      </Section>

      {/* 2. RAW PRODUCT DATA */}
      <Section title="📦 RAW PRODUCT (FROM DB)" color="#60a5fa">
        {product ? (
          <>
            <Row label="Product ID" value={product.id} />
            <Row label="Name" value={product.name} />
            <Row label="Status" value={formatTypeAndVal(product.status)} />
            <Row label="is_active" value={formatTypeAndVal(product.is_active)} />
            <Row label="raw price" value={formatTypeAndVal(product.price)} />
            <Row
              label="raw selling_price"
              value={formatTypeAndVal(product.selling_price)}
            />
            <Row
              label="raw sale_price"
              value={formatTypeAndVal(product.sale_price)}
            />
            <Row
              label="raw original_price"
              value={formatTypeAndVal(product.original_price)}
            />
            <Row label="raw stock" value={formatTypeAndVal(product.stock)} />
            <Row
              label="Variants count"
              value={`${product.variants?.length ?? 0} (hasVariants: ${String(
                hasVariants
              )})`}
            />
          </>
        ) : (
          <div style={{ color: "#fca5a5" }}>❌ Product not loaded</div>
        )}
      </Section>

      {/* 3. SELECTED VARIANT */}
      <Section title="🎨 SELECTED VARIANT" color="#f472b6">
        {selectedVariant ? (
          <>
            <Row label="Variant ID" value={selectedVariant.id} />
            <Row label="Name / SKU" value={`${selectedVariant.name ?? "—"} / ${selectedVariant.sku ?? "—"}`} />
            <Row label="raw price" value={formatTypeAndVal(selectedVariant.price)} />
            <Row label="raw stock" value={formatTypeAndVal(selectedVariant.stock)} />
            <pre style={preStyle}>{jsonPretty(selectedVariant)}</pre>
          </>
        ) : (
          <div style={{ color: "#94a3b8" }}>
            ℹ️ No variant selected (Single product mode)
          </div>
        )}
      </Section>

      {/* 4. COMPUTED PRICING & STOCK */}
      <Section title="🧮 COMPUTED PRICE & STOCK" color="#a78bfa">
        <Row
          label="displayPrice"
          value={
            <span
              style={{
                color: displayPrice > 0 ? "#4ade80" : "#f87171",
                fontWeight: 700,
              }}
            >
              ₦{displayPrice} ({formatTypeAndVal(displayPrice)})
            </span>
          }
        />
        <Row label="originalPrice" value={`₦${originalPrice}`} />
        <Row label="discount" value={`${discount}%`} />
        <Row
          label="stockLeft"
          value={
            stockLeft === null
              ? "null (Unlimited / Untracked)"
              : formatTypeAndVal(stockLeft)
          }
        />
        <Row
          label="isOutOfStock"
          value={
            <span
              style={{
                color: isOutOfStock ? "#f87171" : "#4ade80",
                fontWeight: 700,
              }}
            >
              {isOutOfStock ? "❌ TRUE (Blocked)" : "✓ FALSE (Can Buy)"}
            </span>
          }
        />
      </Section>

      {/* 5. CART STATE */}
      <Section title="🛒 CART STATE" color="#10b981">
        <Row label="Mode" value={token ? "Server Cart (Logged In)" : "Guest Cart (localStorage)"} />
        <Row label="inCart" value={inCart ? "✓ Yes" : "No"} />
        <Row label="Selected qty" value={qty} />
        <Row label="cartLineQty" value={cartLineQty} />
        <Row label="cartItemId" value={cartItemId ?? "null"} />
        <Row label="Total cartCount" value={cartCount} />
        <Row
          label="cartError"
          value={
            cartError ? (
              <span style={{ color: "#f87171", fontWeight: 700 }}>
                {cartError}
              </span>
            ) : (
              "None"
            )
          }
        />
        {!token && guestCart?.length > 0 && (
          <>
            <div style={{ marginTop: 6, color: "#94a3b8" }}>
              Guest Cart (localStorage):
            </div>
            <pre style={preStyle}>{jsonPretty(guestCart)}</pre>
          </>
        )}
      </Section>

      {/* 6. LAST REQUEST */}
      {lastRequest && (
        <Section title="📤 LAST API REQUEST" color="#fbbf24">
          <Row label="Method" value={lastRequest.method} />
          <Row label="URL" value={lastRequest.url} />
          <Row label="Time" value={lastRequest.time} />
          {lastRequest.payload && (
            <pre style={preStyle}>{jsonPretty(lastRequest.payload)}</pre>
          )}
        </Section>
      )}

      {/* 7. LAST RESPONSE */}
      {lastResponse && (
        <Section title="📥 LAST API RESPONSE" color="#10b981">
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

      {/* 8. LAST ERROR */}
      {lastError && (
        <Section title="❌ LAST API ERROR" color="#ef4444">
          <Row
            label="Status"
            value={
              <>
                {lastError.status ?? "Network Error"}{" "}
                {statusBadge(lastError.status)}
              </>
            }
          />
          <Row label="Message" value={lastError.message} />
          <Row label="URL" value={lastError.url} />
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
                📥 Full Backend Error Response:
              </div>
              <pre
                style={{
                  ...preStyle,
                  background: "#450a0a",
                  color: "#fecaca",
                }}
              >
                {jsonPretty(lastError.fullResponse)}
              </pre>
            </>
          )}
        </Section>
      )}
    </div>
  );
});

export default MarketDetailDebugPanel;
