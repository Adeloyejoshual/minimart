/* ═══════════════════════════════════════════════════════════════
   LISTINGS GRID — Desktop masonry-style grid
═══════════════════════════════════════════════════════════════ */
import { memo, useState, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import type { ListingsGridProps, Listing } from "./types";
import { useDragScroll } from "./hooks";

const spring   = { type: "spring", stiffness: 300, damping: 26 } as const;
const viewOnce = { once: true, amount: 0.1 } as const;
const stagger  = { hidden: {}, visible: { transition: { staggerChildren: 0.055 } } };
const cardReveal = {
  hidden:  { opacity: 0, y: 24, scale: 0.93 },
  visible: { opacity: 1, y: 0,  scale: 1    },
};

/* ── Lazy MasonryCard ── */
const MasonryCard = lazy(() =>
  import("../../components/MasonryCard").catch(() => ({
    default: () => null,
  }))
);

/* ── Icons ── */
const PkgIcon     = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>;
const ChevronIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>;
const EyeIcon     = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>;
const ZapIcon     = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>;

/* ── Helpers ── */
const naira  = (n: number | string) => "₦" + Number(n || 0).toLocaleString("en-NG");
const fmtNum = (n: number) => {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "m";
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + "k";
  return n.toLocaleString();
};
const timeAgo = (d?: string) => {
  if (!d) return "";
  const diff  = Date.now() - new Date(d).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 1)   return "Just now";
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 30)  return `${days}d ago`;
  return new Date(d).toLocaleDateString("en-NG", { month: "short", day: "numeric" });
};

const resolveImage = (item: Listing): string | null => {
  if (item.image)         return item.image;
  if (item.main_image)    return item.main_image;
  if (item.thumbnail_url) return item.thumbnail_url;
  if (Array.isArray(item.images) && item.images.length > 0) {
    const f = item.images[0];
    if (typeof f === "string") return f;
    if (f && typeof f === "object" && "url" in f) return f.url ?? null;
  }
  return null;
};

/* ── Skeleton ── */
const GridSkeleton = memo(function GridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="dp-grid" aria-label="Loading listings">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="dp-grid-sk">
          <div className="dp-grid-sk__img dp-shimmer" />
          <div className="dp-grid-sk__body">
            <div className="dp-grid-sk__line dp-shimmer" style={{ width: "78%" }} />
            <div className="dp-grid-sk__line dp-shimmer" style={{ width: "45%", height: "9px" }} />
          </div>
        </div>
      ))}
    </div>
  );
});

/* ── Listing card (fallback when MasonryCard unavailable) ── */
const ListingCard = memo(function ListingCard({
  item,
  index = 0,
  onClick,
}: {
  item: Listing;
  index?: number;
  onClick: () => void;
}) {
  const img = resolveImage(item);
  const [imgErr, setImgErr] = useState(false);

  return (
    <motion.article
      className="dp-lcard"
      variants={cardReveal}
      transition={{ ...spring, delay: index * 0.045 }}
      onClick={onClick}
      role="button"
      tabIndex={0}
      aria-label={`View listing: ${item.title}`}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onClick()}
      whileHover={{ y: -5, boxShadow: "0 12px 40px rgba(0,0,0,0.2)" }}
      whileTap={{ scale: 0.98 }}
    >
      <div className="dp-lcard__img">
        {img && !imgErr ? (
          <img
            src={img}
            alt={item.title}
            loading="lazy"
            onError={() => setImgErr(true)}
          />
        ) : (
          <div className="dp-lcard__placeholder">
            <PkgIcon />
          </div>
        )}

        {/* Status badge */}
        {item.status && !item.status.startsWith("active") && (
          <span className={`dp-lcard__status dp-lcard__status--${item.status.split("_")[0]}`}>
            {item.status.replace(/_/g, " ")}
          </span>
        )}

        {/* Promoted */}
        {item.is_promoted && (
          <span className="dp-lcard__status dp-lcard__status--hot">
            <ZapIcon /> Boosted
          </span>
        )}

        {/* Hover overlay */}
        <div className="dp-lcard__overlay">
          <span className="dp-lcard__view-cta">View Listing</span>
        </div>

        {/* Price float */}
        <p className="dp-lcard__price-float">{naira(item.price)}</p>
      </div>

      <div className="dp-lcard__body">
        <h3 className="dp-lcard__title">{item.title}</h3>
        <div className="dp-lcard__meta">
          <span className="dp-lcard__views">
            <EyeIcon /> {fmtNum(item.views || 0)}
          </span>
          <span className="dp-lcard__time">{timeAgo(item.created_at)}</span>
        </div>
      </div>
    </motion.article>
  );
});

/* ── Main export ── */
export const ListingsGrid = memo(function ListingsGrid({
  listings,
  onViewAll,
}: ListingsGridProps) {
  const navigate  = useNavigate();
  const scrollRef = useDragScroll(true);

  if (!listings.length) return null;

  const goTo = (item: Listing) =>
    navigate(item.slug ? `/product/${item.slug}` : `/product/${item.id}`);

  return (
    <motion.section
      className="dp-listings-section"
      aria-label="Recent listings"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={viewOnce}
      transition={{ ...spring, delay: 0.08 }}
    >
      {/* Section header */}
      <div className="dp-listings-hdr">
        <div className="dp-listings-hdr__left">
          <span className="dp-listings-hdr__icon"><PkgIcon /></span>
          <div>
            <h2 className="dp-listings-hdr__title">My Recent Listings</h2>
            <p className="dp-listings-hdr__sub">{listings.length} items</p>
          </div>
        </div>
        <motion.button
          className="dp-listings-hdr__btn"
          onClick={onViewAll}
          whileHover={{ x: 4 }}
          whileTap={{ scale: 0.95 }}
          aria-label="View all listings in dashboard"
        >
          View All <ChevronIcon />
        </motion.button>
      </div>

      {/* Grid */}
      <Suspense fallback={<GridSkeleton count={listings.length} />}>
        <motion.div
          className="dp-grid"
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={viewOnce}
          role="list"
          ref={scrollRef}
        >
          {listings.map((item, i) => (
            <motion.div
              key={item.id}
              variants={cardReveal}
              transition={{ ...spring, delay: i * 0.045 }}
              role="listitem"
            >
              <MasonryCard
                id={item.id}
                title={item.title}
                price={item.price}
                image={resolveImage(item)}
                status={item.status}
                isPromoted={item.is_promoted}
                views={item.views}
                createdAt={item.created_at}
                slug={item.slug}
                onClick={() => goTo(item)}
              />
            </motion.div>
          ))}
        </motion.div>
      </Suspense>
    </motion.section>
  );
});