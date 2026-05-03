/**
 * components/Skeletons.jsx
 * MasonrySkeleton + SkeletonFeatured — used by Homepage.jsx and SectionFeedPage.jsx.
 */

import React from "react";

export const MasonrySkeleton = () => (
  <div className="masonry-grid">
    {[180, 240, 200, 160, 220, 190, 250, 170].map((h, i) => (
      <div key={i} className="sk masonry-sk" style={{ height: h }} />
    ))}
  </div>
);

export const SkeletonFeatured = () => (
  <div className="feat-wrap">
    {[1, 2].map((i) => (
      <div key={i} className="sk sk-ft" />
    ))}
  </div>
);
