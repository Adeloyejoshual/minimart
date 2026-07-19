/**
 * src/pages/SettingsPage.jsx
 * Entry point — lazy-loads the real page from the feature folder.
 */
import { lazy, Suspense } from "react";

const SettingsPage = lazy(() =>
  import("./SettingsPage/SettingsPage.jsx")
);

export default function SettingsPageEntry() {
  return (
    <Suspense fallback={<SettingsSkeleton />}>
      <SettingsPage />
    </Suspense>
  );
}

function SettingsSkeleton() {
  return (
    <div className="settings-skeleton" aria-busy="true" aria-label="Loading settings">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="settings-skeleton__block" />
      ))}
    </div>
  );
}