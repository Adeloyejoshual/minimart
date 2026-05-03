/**
 * pages/Deals.jsx
 * Route: /deals
 */

import React from "react";
import SectionFeedPage from "./SectionFeedPage";

const CONFIG = {
  section:     "deals",
  title:       "Cheap Deals",
  subtitle:    "Best value listings across Nigeria",
  icon:        "💸",
  accent:      "#2ecc71",
  emptyMsg:    "No deals available right now — check back soon.",
  sortOptions: [
    { label: "Lowest Price",  value: "price_asc"  },
    { label: "Highest Price", value: "price_desc" },
    { label: "Newest",        value: "newest"     },
    { label: "Trending",      value: "engagement" },
  ],
};

export default function Deals() {
  return <SectionFeedPage config={CONFIG} />;
}
