/**
 * src/loemart/HomePageDesktop.jsx
 * Desktop-only Loemart homepage
 *
 * Uses the premium desktop layout with large cards,
 * horizontal scroll sections, and glassmorphism.
 */

import HomePagePremium from "./HomePagePremium";

export default function HomePageDesktop({ user }) {
  return <HomePagePremium user={user} />;
}