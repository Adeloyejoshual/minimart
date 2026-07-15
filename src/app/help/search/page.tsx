// src/app/help/search/page.tsx

import '@/styles/help/search-results.css';

import { searchFaqArticles } from '@/lib/help/queries';
import { stripHtml, truncateText } from '@/lib/help/utils';
import Link from 'next/link';
import {
  IconSearch,
  IconArrowLeft,
  IconBookOpen,
  IconChevronRight,
  IconMessageCircle,
} from '@/components/help/icons/HelpIcons';

export const metadata = { title: 'Search Results | Loemart Help Center' };

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const articles = q ? await searchFaqArticles(q) : [];

  return (
    <div className="search-results-page">
      <div className="search-results-container">
        {/* Header */}
        <div className="search-results-header">
          <Link href="/help" className="search-results-back">
            <IconArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="search-results-title">
              Search Results
              {q && <span className="search-results-query">&ldquo;{q}&rdquo;</span>}
            </h1>
            <p className="search-results-count">
              {articles.length}{' '}
              {articles.length === 1 ? 'result' : 'results'} found
            </p>
          </div>
        </div>

        {/* Results */}
        {articles.length === 0 ? (
          <div className="search-results-empty">
            <IconSearch size={48} className="search-results-empty-icon" />
            <h3 className="search-results-empty-title">No results found</h3>
            <p className="search-results-empty-desc">
              Try different keywords or browse by category.
            </p>
            <Link href="/help" className="search-results-empty-btn">
              Browse Help Center
            </Link>
          </div>
        ) : (
          <div className="search-results-list">
            {articles.map((article) => (
              <Link
                key={article.id}
                href={`/help/article/${article.slug}`}
                className="search-result-card"
              >
                <div className="search-result-icon-wrapper">
                  <IconBookOpen size={16} />
                </div>
                <div className="search-result-content">
                  <p className="search-result-category">
                    {article.category?.name}
                  </p>
                  <h3 className="search-result-title">{article.title}</h3>
                  <p className="search-result-excerpt">
                    {truncateText(stripHtml(article.content), 150)}
                  </p>
                </div>
                <IconChevronRight
                  size={16}
                  className="search-result-arrow"
                />
              </Link>
            ))}
          </div>
        )}

        {/* Still need help */}
        <div className="search-results-cta">
          <p className="search-results-cta-text">
            Did not find what you are looking for?
          </p>
          <Link href="/support/contact" className="search-results-cta-btn">
            <IconMessageCircle size={16} />
            Contact Support
          </Link>
        </div>
      </div>
    </div>
  );
}