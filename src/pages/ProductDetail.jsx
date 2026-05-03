// ProductDetail.jsx
import { useState, useEffect, useCallback, useRef } from "react";

// ─── Constants ────────────────────────────────────────────────────────────────

const API_BASE = import.meta.env?.VITE_API_BASE ?? "/api";

const formatPrice = (n) =>
  new Intl.NumberFormat("en-NG", {
    style:    "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(n);

const timeAgo = (dateStr) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60)   return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)    return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30)   return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton({ className = "" }) {
  return (
    <div
      className={`animate-pulse rounded bg-gray-100 ${className}`}
      aria-hidden="true"
    />
  );
}

// ─── Image Gallery ────────────────────────────────────────────────────────────

function ImageGallery({ images = [], title = "" }) {
  const [active, setActive] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  const touchStart = useRef(null);

  const prev = () => setActive((i) => (i - 1 + images.length) % images.length);
  const next = () => setActive((i) => (i + 1) % images.length);

  const onTouchStart = (e) => {
    touchStart.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e) => {
    if (touchStart.current === null) return;
    const delta = touchStart.current - e.changedTouches[0].clientX;
    if (Math.abs(delta) > 40) delta > 0 ? next() : prev();
    touchStart.current = null;
  };

  if (!images.length) {
    return (
      <div className="aspect-square w-full rounded-2xl bg-gray-100 flex items-center justify-center text-gray-400 text-sm">
        No image
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Main image */}
      <div
        className="relative aspect-square w-full overflow-hidden rounded-2xl bg-gray-50 cursor-zoom-in select-none"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onClick={() => setZoomed(true)}
      >
        <img
          key={active}
          src={images[active]}
          alt={`${title} – image ${active + 1}`}
          className="absolute inset-0 w-full h-full object-cover transition-opacity duration-200"
          loading="eager"
        />

        {images.length > 1 && (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); prev(); }}
              className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/80 backdrop-blur flex items-center justify-center shadow text-gray-700 hover:bg-white transition"
              aria-label="Previous image"
            >
              ‹
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); next(); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/80 backdrop-blur flex items-center justify-center shadow text-gray-700 hover:bg-white transition"
              aria-label="Next image"
            >
              ›
            </button>
            <span className="absolute bottom-3 right-3 text-xs bg-black/50 text-white px-2 py-0.5 rounded-full">
              {active + 1}/{images.length}
            </span>
          </>
        )}
      </div>

      {/* Thumbnails */}
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {images.map((src, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              className={`flex-shrink-0 w-16 h-16 rounded-xl overflow-hidden border-2 transition ${
                i === active ? "border-orange-500" : "border-transparent"
              }`}
            >
              <img
                src={src}
                alt={`thumb ${i + 1}`}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </button>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {zoomed && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4"
          onClick={() => setZoomed(false)}
        >
          <img
            src={images[active]}
            alt={title}
            className="max-w-full max-h-full object-contain rounded-lg"
          />
          <button
            className="absolute top-4 right-4 text-white text-3xl leading-none"
            onClick={() => setZoomed(false)}
            aria-label="Close"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Spec Table ───────────────────────────────────────────────────────────────

function SpecTable({ specs = {} }) {
  const entries = Object.entries(specs).filter(
    ([, v]) => v != null && v !== "" && !Array.isArray(v)
  );
  if (!entries.length) return null;

  return (
    <div className="rounded-2xl border border-gray-100 overflow-hidden text-sm">
      {entries.map(([key, value], i) => (
        <div
          key={key}
          className={`flex ${i % 2 === 0 ? "bg-gray-50" : "bg-white"}`}
        >
          <span className="w-2/5 px-4 py-2.5 text-gray-500 capitalize font-medium">
            {key.replace(/_/g, " ")}
          </span>
          <span className="w-3/5 px-4 py-2.5 text-gray-800">{String(value)}</span>
        </div>
      ))}
    </div>
  );
}

// ─── FAQ ──────────────────────────────────────────────────────────────────────

function FAQ({ items = [] }) {
  const [open, setOpen] = useState(null);
  if (!items.length) return null;

  return (
    <div className="divide-y divide-gray-100 rounded-2xl border border-gray-100 overflow-hidden">
      {items.map((item, i) => (
        <div key={i}>
          <button
            className="w-full flex justify-between items-start gap-3 px-4 py-3.5 text-left text-sm font-medium text-gray-800 hover:bg-gray-50 transition"
            onClick={() => setOpen(open === i ? null : i)}
          >
            <span>{item.question ?? item.q}</span>
            <span className="text-gray-400 mt-0.5 text-base leading-none flex-shrink-0">
              {open === i ? "−" : "+"}
            </span>
          </button>
          {open === i && (
            <div className="px-4 pb-4 text-sm text-gray-600 leading-relaxed">
              {item.answer ?? item.a}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Seller Card ──────────────────────────────────────────────────────────────

function SellerCard({ seller }) {
  if (!seller) return null;

  const initials = (seller.name ?? "S")
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const trustColor =
    seller.trust_score >= 80
      ? "text-green-600 bg-green-50"
      : seller.trust_score >= 50
      ? "text-yellow-700 bg-yellow-50"
      : "text-red-600 bg-red-50";

  return (
    <div className="flex items-center gap-3 p-4 rounded-2xl bg-gray-50 border border-gray-100">
      <div className="w-11 h-11 rounded-full overflow-hidden flex-shrink-0 bg-orange-100 flex items-center justify-center text-orange-700 font-bold text-sm">
        {seller.avatar ? (
          <img
            src={seller.avatar}
            alt={seller.name}
            className="w-full h-full object-cover"
          />
        ) : (
          initials
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-900 text-sm truncate">
          {seller.name}
        </p>
        <p className="text-xs text-gray-500">
          {seller.total_listings} listing{seller.total_listings !== 1 ? "s" : ""}{" "}
          {seller.joined_at && `· joined ${timeAgo(seller.joined_at)}`}
        </p>
      </div>
      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${trustColor}`}>
        {seller.trust_score}% trust
      </span>
    </div>
  );
}

// ─── Related Products ─────────────────────────────────────────────────────────

function RelatedCard({ product, onClick }) {
  return (
    <button
      onClick={() => onClick(product.slug)}
      className="flex-shrink-0 w-36 text-left"
    >
      <div className="aspect-square w-full rounded-xl overflow-hidden bg-gray-100 mb-2">
        {product.image ? (
          <img
            src={product.image}
            alt={product.title}
            className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">
            No image
          </div>
        )}
      </div>
      <p className="text-xs font-medium text-gray-800 line-clamp-2 leading-snug mb-0.5">
        {product.title}
      </p>
      <p className="text-xs font-bold text-orange-600">
        {formatPrice(product.price)}
      </p>
    </button>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ProductDetail({ slug, onNavigate }) {
  const [data, setData]       = useState(null);   // { product, related }
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [activeTab, setActiveTab] = useState("details");
  const [ctaClicked, setCtaClicked] = useState(false);

  // ── Fetch ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!slug) return;

    setLoading(true);
    setError(null);
    setData(null);
    setActiveTab("details");
    setCtaClicked(false);

    fetch(`${API_BASE}/products/${encodeURIComponent(slug)}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((json) => {
        if (!json.success) throw new Error(json.message ?? "Not found");
        setData({ product: json.product, related: json.related ?? [] });
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [slug]);

  // ── Click tracking ────────────────────────────────────────────────────────
  const trackClick = useCallback((productId) => {
    fetch(`${API_BASE}/products/${productId}/click`, { method: "POST" }).catch(
      () => {}
    );
  }, []);

  const handleCTA = (type) => {
    if (!data?.product) return;
    const { id, phone, whatsapp, whatsapp_link, title } = data.product;

    trackClick(id);
    setCtaClicked(true);

    if (type === "whatsapp") {
      const link =
        whatsapp_link ||
        (whatsapp
          ? `https://wa.me/${whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(
              `Hi, I'm interested in "${title}"`
            )}`
          : null);
      if (link) window.open(link, "_blank", "noopener,noreferrer");
    } else if (type === "call") {
      if (phone) window.location.href = `tel:${phone}`;
    }
  };

  // ── Render: Loading ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="max-w-lg mx-auto p-4 space-y-4">
        <Skeleton className="aspect-square w-full rounded-2xl" />
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-12 w-full rounded-2xl" />
        <Skeleton className="h-12 w-full rounded-2xl" />
      </div>
    );
  }

  // ── Render: Error ─────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="max-w-lg mx-auto p-8 text-center space-y-3">
        <div className="text-5xl">😕</div>
        <h2 className="font-semibold text-gray-800">Product not found</h2>
        <p className="text-sm text-gray-500">{error}</p>
        {onNavigate && (
          <button
            onClick={() => onNavigate("/")}
            className="mt-4 text-sm text-orange-600 font-medium underline underline-offset-2"
          >
            ← Back to listings
          </button>
        )}
      </div>
    );
  }

  if (!data) return null;

  const { product, related } = data;

  const {
    title,
    description,
    price,
    images = [],
    attributes = {},
    highlights = [],
    specifications = {},
    faq = [],
    delivery = {},
    location,
    seller,
    phone,
    whatsapp,
    whatsapp_link,
    is_promoted,
    category_name,
    subcategory_name,
    views,
    created_at,
  } = product;

  const hasWhatsapp = !!(whatsapp || whatsapp_link);
  const hasCall     = !!phone;

  // Build tab list dynamically — only show tabs that have content
  const tabs = [
    { id: "details",  label: "Details"  },
    Object.keys(specifications).length  ? { id: "specs",   label: "Specs"    } : null,
    faq.length                          ? { id: "faq",     label: "FAQ"      } : null,
    Object.keys(delivery).length        ? { id: "delivery", label: "Delivery" } : null,
  ].filter(Boolean);

  return (
    <div className="max-w-lg mx-auto pb-36">

      {/* ── Back / Breadcrumb ───────────────────────────────────────────── */}
      {onNavigate && (
        <div className="flex items-center gap-1 px-4 pt-4 pb-2 text-sm text-gray-500">
          <button
            onClick={() => onNavigate("/")}
            className="hover:text-orange-600 transition"
          >
            Home
          </button>
          {category_name && (
            <>
              <span>/</span>
              <span className="text-gray-700">{category_name}</span>
            </>
          )}
          {subcategory_name && (
            <>
              <span>/</span>
              <span className="text-gray-700">{subcategory_name}</span>
            </>
          )}
        </div>
      )}

      {/* ── Gallery ─────────────────────────────────────────────────────── */}
      <div className="px-4 pb-4">
        <ImageGallery images={images} title={title} />
      </div>

      {/* ── Title + Price ────────────────────────────────────────────────── */}
      <div className="px-4 pb-4 space-y-1">
        {is_promoted && (
          <span className="inline-block text-xs font-semibold bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full mb-1">
            ✦ Featured
          </span>
        )}
        <h1 className="text-xl font-bold text-gray-900 leading-snug">{title}</h1>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-extrabold text-orange-600">
            {formatPrice(price)}
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-400 pt-0.5">
          {location?.label && (
            <span className="flex items-center gap-1">
              <span>📍</span>
              {location.label}
            </span>
          )}
          {views > 0 && <span>{views} views</span>}
          {created_at && <span>{timeAgo(created_at)}</span>}
        </div>
      </div>

      {/* ── Highlights ──────────────────────────────────────────────────── */}
      {highlights.length > 0 && (
        <div className="px-4 pb-4">
          <ul className="space-y-1.5">
            {highlights.map((h, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                <span className="text-green-500 mt-0.5 flex-shrink-0">✓</span>
                <span>{typeof h === "string" ? h : h.text ?? JSON.stringify(h)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Attribute chips (RAM, storage, condition, etc.) ──────────────── */}
      {Object.keys(attributes).length > 0 && (
        <div className="px-4 pb-4">
          <div className="flex flex-wrap gap-2">
            {Object.entries(attributes)
              .filter(([k, v]) =>
                k !== "features" &&
                v != null &&
                v !== "" &&
                typeof v !== "object"
              )
              .map(([key, value]) => (
                <span
                  key={key}
                  className="text-xs bg-gray-100 text-gray-700 px-3 py-1 rounded-full capitalize"
                >
                  <span className="text-gray-400">{key.replace(/_/g, " ")}: </span>
                  {String(value)}
                </span>
              ))}
          </div>
        </div>
      )}

      {/* ── Features list ────────────────────────────────────────────────── */}
      {Array.isArray(attributes.features) && attributes.features.length > 0 && (
        <div className="px-4 pb-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Features
          </p>
          <div className="flex flex-wrap gap-2">
            {attributes.features.map((f, i) => (
              <span
                key={i}
                className="text-xs bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full"
              >
                {f}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Seller ──────────────────────────────────────────────────────── */}
      <div className="px-4 pb-4">
        <SellerCard seller={seller} />
      </div>

      {/* ── Tabs ────────────────────────────────────────────────────────── */}
      {tabs.length > 1 && (
        <div className="px-4 pb-0 sticky top-0 bg-white z-10 border-b border-gray-100">
          <div className="flex gap-0 -mb-px">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition whitespace-nowrap ${
                  activeTab === tab.id
                    ? "border-orange-500 text-orange-600"
                    : "border-transparent text-gray-500 hover:text-gray-800"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Tab content ─────────────────────────────────────────────────── */}
      <div className="px-4 py-4">

        {/* Details tab */}
        {(activeTab === "details" || tabs.length <= 1) && (
          <div className="space-y-2">
            {description ? (
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
                {description}
              </p>
            ) : (
              <p className="text-sm text-gray-400 italic">No description provided.</p>
            )}
          </div>
        )}

        {/* Specs tab */}
        {activeTab === "specs" && (
          <SpecTable specs={specifications} />
        )}

        {/* FAQ tab */}
        {activeTab === "faq" && (
          <FAQ items={faq} />
        )}

        {/* Delivery tab */}
        {activeTab === "delivery" && (
          <div className="space-y-2 text-sm text-gray-700">
            {Object.entries(delivery)
              .filter(([, v]) => v != null && v !== "")
              .map(([key, value]) => (
                <div key={key} className="flex justify-between py-2 border-b border-gray-50">
                  <span className="text-gray-500 capitalize">{key.replace(/_/g, " ")}</span>
                  <span className="font-medium">{String(value)}</span>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* ── Related Products ─────────────────────────────────────────────── */}
      {related.length > 0 && (
        <div className="px-4 pb-4">
          <p className="text-sm font-semibold text-gray-800 mb-3">Similar listings</p>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {related.map((p) => (
              <RelatedCard
                key={p.id}
                product={p}
                onClick={onNavigate ? (s) => onNavigate(`/products/${s}`) : () => {}}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Sticky CTA bar ──────────────────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 z-20 bg-white border-t border-gray-100 shadow-[0_-4px_24px_rgba(0,0,0,0.08)]">
        <div className="max-w-lg mx-auto flex gap-3 p-4">

          {hasCall && (
            <button
              onClick={() => handleCTA("call")}
              className="flex-1 flex items-center justify-center gap-2 h-12 rounded-2xl border-2 border-gray-200 text-gray-800 font-semibold text-sm hover:border-gray-400 active:scale-[0.97] transition"
            >
              <span>📞</span> Call
            </button>
          )}

          {hasWhatsapp && (
            <button
              onClick={() => handleCTA("whatsapp")}
              className="flex-1 flex items-center justify-center gap-2 h-12 rounded-2xl bg-[#25D366] text-white font-semibold text-sm shadow hover:bg-[#1ebe5d] active:scale-[0.97] transition"
            >
              <span>💬</span> WhatsApp
            </button>
          )}

          {!hasCall && !hasWhatsapp && (
            <div className="flex-1 flex items-center justify-center h-12 rounded-2xl bg-gray-100 text-sm text-gray-400">
              No contact info
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
