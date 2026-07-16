// src/pages/Profile/components/Skeletons.jsx
import "./Skeletons.css";

export function StatsSkeleton() {
  return (
    <div className="stats-skeleton-grid">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="stats-skeleton__card skeleton">
          <div className="skeleton__circle" />
          <div className="skeleton__line skeleton__line--lg" />
          <div className="skeleton__line skeleton__line--sm" />
        </div>
      ))}
    </div>
  );
}

export function ProdSkeleton() {
  return (
    <div className="prod-skeleton-list">
      {[1, 2, 3].map((i) => (
        <div key={i} className="prod-skeleton__card skeleton">
          <div className="skeleton__img" />
          <div className="skeleton__body">
            <div className="skeleton__line skeleton__line--lg" />
            <div className="skeleton__line skeleton__line--md" />
            <div className="skeleton__line skeleton__line--sm" />
          </div>
        </div>
      ))}
    </div>
  );
}