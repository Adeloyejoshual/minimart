// src/app/help/page.tsx

import '@/styles/help/help-page.css';

import { Suspense } from 'react';
import { getFaqCategories } from '@/lib/help/queries';
import HelpCenter from '@/components/help/HelpCenter';

export const metadata = {
  title: 'Help Center | Loemart',
  description:
    'Find answers, contact support, and manage your requests on Loemart.',
};

export default async function HelpPage() {
  const categories = await getFaqCategories();

  return (
    <Suspense fallback={<HelpPageSkeleton />}>
      <HelpCenter categories={categories} />
    </Suspense>
  );
}

function HelpPageSkeleton() {
  return (
    <div className="help-page-skeleton">
      <div className="skeleton-hero" />
      <div className="skeleton-grid">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="skeleton-card" />
        ))}
      </div>
    </div>
  );
}