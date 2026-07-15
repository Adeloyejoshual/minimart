import { memo, useState, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import type { ListingsGridProps, Listing } from "./types";
import { useDragScroll } from "./hooks";

/* ── Lazy MasonryCard ── */
const MasonryCard = lazy(() =>
  import("../../components/MasonryCard").catch(() => ({
    default: () => null,
  }))
);

const spring   = { type: "spring", stiffness: 300, damping: 26 } as const;
const viewOnce = { once: true, amount: 0.1 } as const;
const stagger  = { hidden: {}, visible: { transition: { staggerChildren: 0.05 } } };
const cardIn   = { hidden: { opacity: 0, y: 22, scale: 0.93 }, visible: { opacity: 1, y: 0, scale: 1 } };

/* Icons */
const PkgIcon     = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>;
const ChevronIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>;

/* Helpers */
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

/* Skeleton loader */
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

/* ── Main ── */
export const ListingsGrid = memo(function ListingsGrid({
  listings,
  onViewAll,
}: ListingsGridProps) {
  const navigate = useNavigate();

  if (!listings.length) return null;

  const goTo = (item: Listing) =>
    navigate(item.slug ? `/product/${item.slug}` : `/product/${item.id}`);

  return (
    <motion.section
      className="dp-listings-section"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={viewOnce}
      transition={{ ...spring, delay: 0.08 }}
    >
      {/* Header */}
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
        >
          View All <ChevronIcon />
        </motion.button>
      </div>

      {/* Grid with MasonryCard */}
      <Suspense fallback={<GridSkeleton count={listings.length} />}>
        <motion.div
          className="dp-grid"
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={viewOnce}
          role="list"
        >
          {listings.map((item, i) => (
            <motion.div
              key={item.id}
              variants={cardIn}
              transition={{ ...spring, delay: i * 0.04 }}
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