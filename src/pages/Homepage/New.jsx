/**
 * pages/New.jsx
 * Route: /new
 */

import React from "react";
import SectionFeedPage from "./SectionFeedPage";

const CONFIG = {
  section:     "new",
  title:       "New Arrivals",
  subtitle:    "Fresh listings added in the last 24 hours",
  icon:        "🆕",
  accent:      "#3498db",
  emptyMsg:    "No new listings today — check back soon.",
  sortOptions: [
    { label: "Newest First", value: "newest"     },
    { label: "Price ↑",     value: "price_asc"  },
    { label: "Price ↓",     value: "price_desc" },
    { label: "Trending",    value: "engagement" },
  ],
};

export default function New() {
  return <SectionFeedPage config={CONFIG} />;
}
