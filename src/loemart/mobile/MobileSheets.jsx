/**
 * src/loemart/mobile/MobileSheets.jsx
 *
 * Fullscreen sheets + toasts:
 * - Search sheet (fullscreen with recent + trending)
 * - Filter sheet (bottom sheet)
 * - Cart toast
 * - Menu Drawer (Hamburger Menu)
 */

import { memo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import {
  FiChevronLeft, FiSearch, FiX, FiClock, FiTrendingUp,
  FiArrowRight, FiSliders, FiPackage, FiHome, FiGrid, 
  FiUser, FiHeart, FiSettings, FiHelpCircle, FiChevronRight
} from "react-icons/fi";

import categories from "../../config/categories";
import {
  SORT_OPTIONS, TRENDING_SEARCHES, fmtPrice, primaryImg,
} from "./mobileHelpers";

/* ═══════════════════════════════════════════════════════════════
   SEARCH SHEET (fullscreen)
═══════════════════════════════════════════════════════════════ */
export const SearchSheet = memo(function SearchSheet({
  open, onClose, query, setQuery, onSelect, history, onClearHistory,
}) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const fn = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="lmm-search-sheet" role="dialog" aria-modal="true" aria-label="Search products">
      <div className="lmm-search-sheet__header">
        <button type="button" className="lmm-search-sheet__back" onClick={onClose} aria-label="Close search">
          <FiChevronLeft size={22} />
        </button>
        <form className="lmm-search-sheet__form" onSubmit={(e) => { e.preventDefault(); onSelect(query); }}>
          <FiSearch size={16} className="lmm-search-sheet__icon" aria-hidden="true" />
          <input
            type="search" autoFocus className="lmm-search-sheet__input"
            placeholder="Search products, brands…" value={query}
            onChange={(e) => setQuery(e.target.value)} aria-label="Search"
          />
          {query && (
            <button type="button" className="lmm-search-sheet__clear" onClick={() => setQuery("")} aria-label="Clear">
              <FiX size={14} />
            </button>
          )}
        </form>
      </div>

      <div className="lmm-search-sheet__body">
        {history.length > 0 && !query && (
          <>
            <div className="lmm-search-sheet__section">
              <div className="lmm-search-sheet__title">
                <span><FiClock size={12} /> Recent Searches</span>
                <button type="button" onClick={onClearHistory} className="lmm-search-sheet__title-clear">Clear</button>
              </div>
              {history.map((s) => (
                <button key={s} type="button" className="lmm-search-sheet__row" onClick={() => onSelect(s)}>
                  <FiClock size={13} className="lmm-search-sheet__row-icon" />
                  <span>{s}</span>
                  <FiArrowRight size={13} className="lmm-search-sheet__row-arrow" />
                </button>
              ))}
            </div>
            <div className="lmm-search-sheet__divider" />
          </>
        )}

        {!query && (
          <div className="lmm-search-sheet__section">
            <div className="lmm-search-sheet__title">
              <span><FiTrendingUp size={12} /> Trending</span>
            </div>
            <div className="lmm-search-sheet__chips">
              {TRENDING_SEARCHES.map((s) => (
                <button key={s} type="button" className="lmm-search-sheet__chip" onClick={() => onSelect(s)}>{s}</button>
              ))}
            </div>
          </div>
        )}

        {!query && (
          <div className="lmm-search-sheet__section">
            <div className="lmm-search-sheet__title">
              <span>📂 Popular Categories</span>
            </div>
            <div className="lmm-search-sheet__cat-grid">
              {categories.slice(0, 6).map((c) => (
                <button key={c.id} type="button" className="lmm-search-sheet__cat" onClick={() => onSelect(c.name)}>
                  <span className="lmm-search-sheet__cat-icon">{c.icon}</span>
                  <span className="lmm-search-sheet__cat-label">{c.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {query && (
          <div className="lmm-search-sheet__section">
            <div className="lmm-search-sheet__title"><span>Search for</span></div>
            <button type="button" className="lmm-search-sheet__row lmm-search-sheet__row--query" onClick={() => onSelect(query)}>
              <FiSearch size={14} className="lmm-search-sheet__row-icon" />
              <strong>{query}</strong>
              <FiArrowRight size={14} className="lmm-search-sheet__row-arrow" />
            </button>
            {TRENDING_SEARCHES.filter((s) => s.toLowerCase().includes(query.toLowerCase())).slice(0, 4).map((s) => (
              <button key={s} type="button" className="lmm-search-sheet__row" onClick={() => onSelect(s)}>
                <FiSearch size={13} className="lmm-search-sheet__row-icon" />
                <span>{s}</span>
                <FiArrowRight size={13} className="lmm-search-sheet__row-arrow" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   FILTER SHEET (bottom sheet)
═══════════════════════════════════════════════════════════════ */
export const FilterSheet = memo(function FilterSheet({
  open, onClose, minPrice, setMinPrice, maxPrice, setMaxPrice,
  activeSort, setActiveSort, onApply, onReset,
}) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const fn = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div className="lmm-sheet-overlay" onClick={onClose} aria-hidden="true" />
      <div className="lmm-sheet" role="dialog" aria-modal="true" aria-label="Filters">
        <div className="lmm-sheet__handle" aria-hidden="true" />
        <div className="lmm-sheet__header">
          <h3 className="lmm-sheet__title"><FiSliders size={16} /> Filters</h3>
          <button type="button" className="lmm-sheet__close" onClick={onClose} aria-label="Close"><FiX size={16} /></button>
        </div>
        <div className="lmm-sheet__body">
          <div className="lmm-sheet__section">
            <p className="lmm-sheet__label">Price Range (₦)</p>
            <div className="lmm-price-inputs">
              <input type="number" placeholder="Min" value={minPrice} min={0} className="lmm-price-input" onChange={(e) => setMinPrice(e.target.value)} />
              <span className="lmm-price-sep">—</span>
              <input type="number" placeholder="Max" value={maxPrice} min={0} className="lmm-price-input" onChange={(e) => setMaxPrice(e.target.value)} />
            </div>
            <div className="lmm-price-quick">
              {[
                { label: "Under ₦10K", min: 0, max: 10000 },
                { label: "₦10K–50K", min: 10000, max: 50000 },
                { label: "₦50K–200K", min: 50000, max: 200000 },
                { label: "Over ₦200K", min: 200000, max: "" },
              ].map((r) => (
                <button key={r.label} type="button" className="lmm-price-quick__btn" onClick={() => { setMinPrice(String(r.min)); setMaxPrice(String(r.max)); }}>{r.label}</button>
              ))}
            </div>
          </div>
          <div className="lmm-sheet__section">
            <p className="lmm-sheet__label">Sort By</p>
            <div className="lmm-sheet__chips">
              {SORT_OPTIONS.map((opt) => (
                <button key={opt.value} type="button" className={`lmm-sheet__chip ${activeSort === opt.value ? "lmm-sheet__chip--on" : ""}`} onClick={() => setActiveSort(opt.value)}>{opt.label}</button>
              ))}
            </div>
          </div>
        </div>
        <div className="lmm-sheet__footer">
          <button type="button" className="lmm-btn-reset" onClick={onReset}>Reset</button>
          <button type="button" className="lmm-btn-apply" onClick={onApply}>Apply Filters</button>
        </div>
      </div>
    </>
  );
});

/* ═══════════════════════════════════════════════════════════════
   CART TOAST
═══════════════════════════════════════════════════════════════ */
export function CartToast({ product, onView, onClose }) {
  return (
    <div className="lmm-toast">
      <div className="lmm-toast__img-wrap">
        {primaryImg(product.images) ? (
          <img src={primaryImg(product.images)} alt={product.name} className="lmm-toast__img" />
        ) : (
          <div className="lmm-toast__ph"><FiPackage size={16} /></div>
        )}
      </div>
      <div className="lmm-toast__body">
        <p className="lmm-toast__label">✓ Added</p>
        <p className="lmm-toast__name">{product.name}</p>
      </div>
      <button type="button" className="lmm-toast__view" onClick={onView}>View</button>
      <button type="button" className="lmm-toast__close" onClick={onClose} aria-label="Dismiss"><FiX size={12} /></button>
    </div>
  );
}

export const fireCartToast = (product, navigate) => {
  toast.custom(
    (t) => <CartToast product={product} onView={() => { toast.dismiss(t.id); navigate("/shop/cart"); }} onClose={() => toast.dismiss(t.id)} />,
    { duration: 3200, position: "bottom-center" }
  );
};


/* ═══════════════════════════════════════════════════════════════
   HAMBURGER MENU DRAWER (Slide in from left)
═══════════════════════════════════════════════════════════════ */
export const MenuDrawer = memo(function MenuDrawer({ open, onClose, user }) {
  const navigate = useNavigate();

  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open) return null;

  const navItem = (icon, label, path) => (
    <button type="button" className="lmm-menu-item" onClick={() => { onClose(); navigate(path); }}>
      <span className="lmm-menu-item__icon">{icon}</span>
      <span className="lmm-menu-item__label">{label}</span>
      <FiChevronRight size={16} color="#aaa" />
    </button>
  );

  return (
    <>
      <div className="lmm-sheet-overlay" onClick={onClose} />
      <div className="lmm-menu-drawer">
        <div className="lmm-menu-header">
          {user ? (
            <div className="lmm-menu-user">
              <div className="lmm-menu-avatar">{user.name?.charAt(0).toUpperCase() || "U"}</div>
              <div>
                <h4>{user.name}</h4>
                <p>View Profile</p>
              </div>
            </div>
          ) : (
            <div className="lmm-menu-user" onClick={() => { onClose(); navigate("/auth"); }}>
              <div className="lmm-menu-avatar" style={{ background: "#eee", color: "#666" }}><FiUser /></div>
              <div>
                <h4>Sign In</h4>
                <p>To access your account</p>
              </div>
            </div>
          )}
          <button type="button" className="lmm-menu-close" onClick={onClose}><FiX size={20} /></button>
        </div>

        <div className="lmm-menu-body">
          {navItem(<FiHome size={18} />, "Home", "/loemart")}
          {navItem(<FiGrid size={18} />, "Categories", "/catalog")}
          {navItem(<FiHeart size={18} />, "Saved Items", "/saved")}
          <div className="lmm-menu-divider" />
          {navItem(<FiUser size={18} />, "My Account", "/account/profile")}
          {navItem(<FiSettings size={18} />, "Settings", "/account/settings")}
          {navItem(<FiHelpCircle size={18} />, "Help & Support", "/help")}
        </div>
      </div>
    </>
  );
});