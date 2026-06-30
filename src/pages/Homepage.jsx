// src/pages/Homepage.jsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import TopNav  from "../components/TopNav";
import BottomNav from "../components/BottomNav";

const BASE_URL = import.meta.env.VITE_API_BASE_URL || window.location.origin;
const API      = `${BASE_URL}/api`;

export default function Homepage({ user }) {
  const navigate = useNavigate();

  const [products, setProducts] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);

  useEffect(() => {
    fetch(`${API}/homepage?limit=20&page=0`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        const items = Array.isArray(data.products) ? data.products : [];
        setProducts(items);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ fontFamily: "sans-serif", paddingBottom: 100 }}>
      <TopNav user={user} />

      <div style={{ padding: "20px 16px" }}>

        {/* ── Header ── */}
        <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>
          🛒 Loemart
        </h1>
        <p style={{ color: "#888", fontSize: 14, marginBottom: 20 }}>
          Nigeria's neighbourhood marketplace
        </p>

        {/* ── Search ── */}
        <button
          onClick={() => navigate("/search")}
          style={{
            display       : "flex",
            alignItems    : "center",
            gap           : 8,
            width         : "100%",
            padding       : "12px 16px",
            background    : "#f5f5f5",
            border        : "1.5px solid #e0e0e0",
            borderRadius  : 12,
            fontSize      : 14,
            color         : "#999",
            cursor        : "pointer",
            marginBottom  : 24,
            textAlign     : "left",
            boxSizing     : "border-box",
          }}
        >
          🔍 Search products, brands, locations…
        </button>

        {/* ── Quick links ── */}
        <div style={{
          display       : "flex",
          gap           : 8,
          overflowX     : "auto",
          marginBottom  : 24,
          paddingBottom : 4,
        }}>
          {[
            { label: "🔥 Trending", path: "/trending" },
            { label: "💸 Deals",    path: "/deals"    },
            { label: "🆕 New",      path: "/latest"   },
            { label: "📍 Near You", path: "/nearby"   },
          ].map((p) => (
            <button
              key={p.path}
              onClick={() => navigate(p.path)}
              style={{
                flexShrink   : 0,
                padding      : "8px 16px",
                background   : "#1a1a2e",
                color        : "#fff",
                border       : "none",
                borderRadius : 8,
                fontSize     : 13,
                fontWeight   : 600,
                cursor       : "pointer",
                whiteSpace   : "nowrap",
              }}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* ── Status ── */}
        {loading && (
          <p style={{ textAlign: "center", color: "#888", padding: 40 }}>
            Loading listings…
          </p>
        )}

        {error && (
          <div style={{
            background   : "#fff5f5",
            border       : "1px solid #ffd5d5",
            borderRadius : 12,
            padding      : 20,
            textAlign    : "center",
            marginBottom : 20,
          }}>
            <p style={{ color: "#c62828", fontWeight: 700, margin: "0 0 8px" }}>
              ⚡ Could not load listings
            </p>
            <p style={{ color: "#888", fontSize: 13, margin: "0 0 12px" }}>
              {error}
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{
                background   : "#c62828",
                color        : "#fff",
                border       : "none",
                borderRadius : 8,
                padding      : "8px 20px",
                cursor       : "pointer",
                fontWeight   : 700,
              }}
            >
              Retry
            </button>
          </div>
        )}

        {/* ── Products ── */}
        {!loading && !error && products.length === 0 && (
          <p style={{ textAlign: "center", color: "#888", padding: 40 }}>
            No listings found.
          </p>
        )}

        {!loading && products.length > 0 && (
          <>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>
              Listings ({products.length})
            </h2>

            <div style={{
              display              : "grid",
              gridTemplateColumns  : "repeat(2, 1fr)",
              gap                  : 10,
            }}>
              {products.map((p) => {
                const img   = p.image || p.main_image || p.thumbnail_url
                  || (Array.isArray(p.images) && p.images[0])
                  || null;
                const price = Number(p.price || 0).toLocaleString("en-NG");
                const city  = p.location_city || p.location?.city || "";

                return (
                  <div
                    key={p.id}
                    onClick={() => navigate(`/product/${p.slug || p.id}`)}
                    style={{
                      background   : "#fff",
                      border       : "1px solid #eee",
                      borderRadius : 12,
                      overflow     : "hidden",
                      cursor       : "pointer",
                    }}
                  >
                    {/* Image */}
                    <div style={{
                      width      : "100%",
                      aspectRatio: "4/3",
                      background : "#f5f5f5",
                      overflow   : "hidden",
                    }}>
                      {img ? (
                        <img
                          src={typeof img === "string" ? img : img.url || ""}
                          alt={p.title || "Product"}
                          style={{
                            width     : "100%",
                            height    : "100%",
                            objectFit : "cover",
                            display   : "block",
                          }}
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                          }}
                        />
                      ) : (
                        <div style={{
                          width          : "100%",
                          height         : "100%",
                          display        : "flex",
                          alignItems     : "center",
                          justifyContent : "center",
                          fontSize       : 28,
                          color          : "#ccc",
                        }}>
                          🛍
                        </div>
                      )}
                    </div>

                    {/* Body */}
                    <div style={{ padding: "8px 10px 10px" }}>
                      <p style={{
                        fontSize    : 13,
                        fontWeight  : 600,
                        color       : "#1a1a1a",
                        margin      : "0 0 4px",
                        display     : "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow    : "hidden",
                        lineHeight  : 1.35,
                      }}>
                        {p.title || "Untitled"}
                      </p>

                      <p style={{
                        fontSize   : 15,
                        fontWeight : 800,
                        color      : "#1a1a2e",
                        margin     : "0 0 4px",
                      }}>
                        ₦{price}
                      </p>

                      {city && (
                        <p style={{
                          fontSize : 11,
                          color    : "#999",
                          margin   : 0,
                        }}>
                          📍 {city}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* ── Sell CTA ── */}
        {!loading && (
          <div style={{
            marginTop    : 32,
            background   : "#1a1a2e",
            borderRadius : 16,
            padding      : "24px 20px",
            textAlign    : "center",
          }}>
            <p style={{
              color      : "#fff",
              fontWeight : 800,
              fontSize   : 18,
              margin     : "0 0 8px",
            }}>
              Start Selling on Loemart
            </p>
            <p style={{
              color     : "rgba(255,255,255,0.65)",
              fontSize  : 13,
              margin    : "0 0 16px",
              lineHeight: 1.5,
            }}>
              List your products for free and reach thousands of buyers.
            </p>
            <button
              onClick={() => navigate("/minimart/add")}
              style={{
                background   : "#ff6b35",
                color        : "#fff",
                border       : "none",
                borderRadius : 10,
                padding      : "12px 24px",
                fontSize     : 14,
                fontWeight   : 700,
                cursor       : "pointer",
              }}
            >
              List for Free →
            </button>
          </div>
        )}

      </div>

      {/* FAB */}
      <button
        onClick={() => navigate("/minimart/add")}
        style={{
          position     : "fixed",
          bottom       : 80,
          right        : 16,
          background   : "#ff6b35",
          color        : "#fff",
          border       : "none",
          borderRadius : 99,
          padding      : "13px 18px",
          fontSize     : 14,
          fontWeight   : 700,
          cursor       : "pointer",
          boxShadow    : "0 4px 18px rgba(255,107,53,0.45)",
          zIndex       : 100,
          display      : "flex",
          alignItems   : "center",
          gap          : 6,
        }}
      >
        + Sell Now
      </button>

      <BottomNav />
    </div>
  );
}