/**
 * pages/Trend.jsx
 * Route: /trending
 */

import React from "react";
import SectionFeedPage from "./SectionFeedPage";

const CONFIG = {
  section:     "trending",
  title:       "Trending Now",
  subtitle:    "The most popular listings right now",
  icon:        "🔥",
  accent:      "#ff6b35",
  emptyMsg:    "No trending products yet — check back soon.",
  sortOptions: [
    { label: "Trending",    value: "engagement" },
    { label: "Most Clicks", value: "clicks"     },
    { label: "Newest",      value: "newest"     },
    { label: "Price ↑",    value: "price_asc"  },
    { label: "Price ↓",    value: "price_desc" },
  ],
};

export default function Trend() {
  return <SectionFeedPage config={CONFIG} />;
}
