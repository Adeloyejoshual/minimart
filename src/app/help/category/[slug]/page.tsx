// src/app/help/category/[slug]/page.tsx

import '@/styles/help/category-page.css';

import { getFaqArticlesByCategory } from '@/lib/help/queries';
import { stripHtml, truncateText, formatDate } from '@/lib/help/utils';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  IconArrowLeft,
  IconChevronRight,
  IconBookOpen,
  IconClock,
  IconEye,
  IconMessageCircle,
} from '@/components/help/icons/HelpIcons';

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const articles = await getFaqArticlesByCategory(slug);

  if (articles.length === 0) {
    // Still render page with empty state, not 404
  }

  const categoryName = articles[0]?.category?.name || slug.replace(/-/g, ' ');

  return (
    <div className="category-page">
      <div className="category-container">
        {/* Header */}
        <div className="category-header">
          <Link href="/help" className="category-back-link">
            <IconArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="category-title">{categoryName}</h1>
            <p className="category-count">
              {articles.length}{' '}
              {articles.length === 1 ? 'article' : 'articles'}
            </p>
          </div>
        </div>

        {/* Articles */}
        {articles.length === 0 ? (
          <div className="category-empty">
            <IconBookOpen size={48} className="category-empty-icon" />
            <h3 className="category-empty-title">No articles yet</h3>
            <p className="category-empty-desc">
              We are working on adding content for this category.
            </p>
            <Link href="/support/contact" className="category-empty-btn">
              <IconMessageCircle size={16} />
              Contact Support
            </Link>
          </div>
        ) : (
          <div className="category-articles">
            {articles.map((article) => (
              <Link
                key={article.id}
                href={`/help/article/${article.slug}`}
                className="category-article-card"
              >
                <div className="category-article-icon">
                  <IconBookOpen size={18} />
                </div>
                <div className="category-article-content">
                  <h3 className="category-article-title">{article.title}</h3>
                  <p className="category-article-excerpt">
                    {truncateText(stripHtml(article.content), 120)}
                  </p>
                  <div className="category-article-meta">
                    <span className="category-article-meta-item">
                      <IconClock size={12} />
                      {formatDate(article.updated_at)}
                    </span>
                    <span className="category-article-meta-item">
                      <IconEye size={12} />
                      {article.view_count} views
                    </span>
                  </div>
                </div>
                <IconChevronRight
                  size={16}
                  className="category-article-arrow"
                />
              </Link>
            ))}
          </div>
        )}

        {/* CTA */}
        <div className="category-cta">
          <p className="category-cta-text">
            Did not find what you are looking for?
          </p>
          <Link href="/support/contact" className="category-cta-btn">
            Contact Support
          </Link>
        </div>
      </div>
    </div>
  );
}