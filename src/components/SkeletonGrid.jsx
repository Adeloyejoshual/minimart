import "./SkeletonGrid.css";

export default function SkeletonGrid({ count = 8, isHorizontal = false, className = "" }) {
  const skeletons = Array.from({ length: count }, (_, i) => i);

  return (
    <section className={`skeleton-section ${className}`}>
      {/* Section Title Skeleton */}
      <div className="skeleton-title"></div>
      
      {/* Grid or Horizontal */}
      <div className={`skeleton-grid ${isHorizontal ? 'horizontal' : ''}`}>
        {skeletons.map((i) => (
          <div key={i} className={`skeleton-card ${isHorizontal ? 'horizontal-card' : ''}`}>
            {/* Image Skeleton */}
            <div className="skeleton-image"></div>
            
            {/* Content Skeleton */}
            <div className="skeleton-content">
              <div className="skeleton-line title-line"></div>
              <div className="skeleton-line price-line"></div>
              <div className="skeleton-line location-line"></div>
              {isHorizontal || <div className="skeleton-line views-line"></div>}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}