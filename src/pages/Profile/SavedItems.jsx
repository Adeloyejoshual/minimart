import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import ProfileHeader from "../../components/ProfileHeader.jsx";
import "../../styles/SavedItems.css";

const BASE_URL = import.meta.env.VITE_API_BASE_URL || window.location.origin;
const API      = `${BASE_URL}/api`;

const getToken = () =>
  localStorage.getItem("marketplace_token") ||
  localStorage.getItem("token") || null;

const naira = (n) => "₦" + Number(n || 0).toLocaleString("en-NG");

const timeAgo = (d) => {
  if (!d) return "";
  const s = Math.floor((Date.now() - new Date(d)) / 1_000);
  if (s < 60)     return "just now";
  if (s < 3_600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86_400) return `${Math.floor(s / 3_600)}h ago`;
  return `${Math.floor(s / 86_400)}d ago`;
};

const PH = "https://placehold.co/300x300/f0ede8/b0a89e?text=No+Image";

/* ── Icons ── */
const HeartIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
  </svg>
);

const TrashIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
    <line x1="10" y1="11" x2="10" y2="17"/>
    <line x1="14" y1="11" x2="14" y2="17"/>
  </svg>
);

const MapPinIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
    <circle cx="12" cy="10" r="3"/>
  </svg>
);

const EyeIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
);

const BackIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <polyline points="15 18 9 12 15 6"/>
  </svg>
);

export default function SavedItems({ user }) {
  const navigate = useNavigate();

  const [items,    setItems]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [removing, setRemoving] = useState(null);

  /* ── Fetch ── */
  useEffect(() => {
    const token = getToken();
    if (!token) { navigate("/auth"); return; }

    (async () => {
      try {
        const { data } = await axios.get(`${API}/favorites`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setItems(data.data || []);
      } catch (err) {
        console.error("Fetch saved items error:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [navigate]);

  /* ── Remove ── */
  const handleRemove = async (productId) => {
    const token = getToken();
    if (!token) return;

    setRemoving(productId);
    try {
      await axios.delete(`${API}/favorites/${productId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setItems((prev) => prev.filter((item) => item.id !== productId));
    } catch (err) {
      console.error("Remove saved item error:", err);
    } finally {
      setRemoving(null);
    }
  };

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="sv-page">
        <header className="sv-header">
          <button className="sv-back-btn" onClick={() => navigate(-1)} type="button">
            <BackIcon />
          </button>
          <h1 className="sv-header-title">Saved Items</h1>
          <div className="sv-header-spacer" />
        </header>
        <div className="sv-scroll">
          <div className="sv-grid">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="sv-skeleton">
                <div className="sv-sk sv-sk-img" />
                <div className="sv-sk-body">
                  <div className="sv-sk sv-sk-cat" />
                  <div className="sv-sk sv-sk-title" />
                  <div className="sv-sk sv-sk-price" />
                  <div className="sv-sk sv-sk-meta" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="sv-page">

      {/* ── Header ── */}
      <header className="sv-header">
        <button className="sv-back-btn" onClick={() => navigate(-1)} type="button">
          <BackIcon />
        </button>
        <h1 className="sv-header-title">Saved Items</h1>
        {items.length > 0 && (
          <span className="sv-count">{items.length}</span>
        )}
        {items.length === 0 && <div className="sv-header-spacer" />}
      </header>

      <div className="sv-scroll">

        {/* ── Empty ── */}
        {items.length === 0 ? (
          <div className="sv-empty">
            <div className="sv-empty-icon">
              <HeartIcon />
            </div>
            <h2 className="sv-empty-title">No saved items yet</h2>
            <p className="sv-empty-sub">
              Tap the heart on any listing to save it here
            </p>
            <Link to="/" className="sv-empty-cta">Browse Products</Link>
          </div>
        ) : (

          /* ── Grid ── */
          <div className="sv-grid">
            {items.map((item) => (
              <div
                key={item.favorite_id}
                className={`sv-card${removing === item.id ? " sv-card--removing" : ""}`}
              >
                {/* Image */}
                <Link to={`/product/${item.slug}`} className="sv-card-img-link">
                  <img
                    src={item.thumbnail_url || item.main_image || PH}
                    alt={item.title}
                    className="sv-card-img"
                    loading="lazy"
                    onError={(e) => { e.currentTarget.src = PH; }}
                  />
                  {item.is_promoted && (
                    <span className="sv-promoted">
                      {item.promotion_type || "Promoted"}
                    </span>
                  )}
                </Link>

                {/* Remove */}
                <button
                  className="sv-remove-btn"
                  onClick={() => handleRemove(item.id)}
                  disabled={removing === item.id}
                  aria-label="Remove from saved"
                  type="button"
                >
                  <TrashIcon />
                </button>

                {/* Body */}
                <div className="sv-card-body">
                  {/* Category */}
                  {item.category_name && (
                    <div className="sv-category">
                      <span>{item.category_name}</span>
                      {item.subcategory_name && (
                        <>
                          <span className="sv-cat-dot" />
                          <span>{item.subcategory_name}</span>
                        </>
                      )}
                    </div>
                  )}

                  {/* Title */}
                  <Link to={`/product/${item.slug}`} className="sv-title">
                    {item.title}
                  </Link>

                  {/* Description */}
                  {item.description && (
                    <p className="sv-desc">{item.description}</p>
                  )}

                  {/* Price */}
                  <p className="sv-price">{naira(item.price)}</p>

                  {/* Meta row */}
                  <div className="sv-meta">
                    {(item.location_city || item.location_state) && (
                      <span className="sv-meta-item">
                        <MapPinIcon />
                        <span>
                          {[item.location_city, item.location_state]
                            .filter(Boolean)
                            .join(", ")}
                        </span>
                      </span>
                    )}
                    <span className="sv-meta-item">
                      <EyeIcon />
                      <span>{item.views || 0}</span>
                    </span>
                  </div>

                  {/* Saved date */}
                  <p className="sv-saved-date">Saved {timeAgo(item.saved_at)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}