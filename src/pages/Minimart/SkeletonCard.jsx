import React, { memo } from "react";

const SkeletonCard = memo(() => (
  <div className="mp-card mp-card--skeleton" aria-hidden="true">
    <div className="mp-card-img-wrap">
      <div className="mp-skel mp-skel-img" />
    </div>
    <div className="mp-card-body">
      <div className="mp-skel mp-skel-line" style={{ width: "75%", marginBottom: 8 }} />
      <div className="mp-skel mp-skel-line" style={{ width: "45%", marginBottom: 8 }} />
      <div className="mp-skel mp-skel-line" style={{ width: "60%" }} />
    </div>
  </div>
));

export default SkeletonCard;