// src/app/help/article/[slug]/page.tsx

import '@/styles/help/article-detail.css';

import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { formatDate } from '@/lib/help/utils';
import { markArticleHelpful } from '@/lib/help/actions';
import {
  IconArrowLeft,
  IconThumbsUp,
  IconThumbsDown,
  IconEye,
  IconClock,
  IconTag,
  IconMessageCircle,
} from '@/components/help/icons/HelpIcons';

export default async function ArticleDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: article } = await supabase
    .from('faq_articles')
    .select('*, category:faq_categories(name, slug)')
    .eq('slug', slug)
    .eq('is_published', true)
    .single();

  if (!article) notFound();

  // Increment view count
  await supabase
    .from('faq_articles')
    .update({ view_count: (article.view_count || 0) + 1 })
    .eq('id', article.id);

  return (
    <div className="article-detail-page">
      <div className="article-detail-container">
        {/* Breadcrumb */}
        <nav className="article-breadcrumb" aria-label="Breadcrumb">
          <Link href="/help" className="article-breadcrumb-link">
            Help Center
          </Link>
          <span className="article-breadcrumb-sep">/</span>
          <Link
            href={`/help/category/${article.category?.slug}`}
            className="article-breadcrumb-link"
          >
            {article.category?.name}
          </Link>
          <span className="article-breadcrumb-sep">/</span>
          <span className="article-breadcrumb-current">{article.title}</span>
        </nav>

        {/* Article Card */}
        <article className="article-card">
          <span className="article-category-badge">
            {article.category?.name}
          </span>

          <h1 className="article-title">{article.title}</h1>

          <div className="article-meta">
            <span className="article-meta-item">
              <IconClock size={14} />
              Updated {formatDate(article.updated_at)}
            </span>
            <span className="article-meta-item">
              <IconEye size={14} />
              {article.view_count} views
            </span>
          </div>

          <div className="article-divider" />

          <div
            className="article-content"
            dangerouslySetInnerHTML={{ __html: article.content }}
          />

          {/* Tags */}
          {article.tags?.length > 0 && (
            <div className="article-tags">
              <IconTag size={14} className="article-tags-icon" />
              {article.tags.map((tag: string) => (
                <span key={tag} className="article-tag">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </article>

        {/* Helpfulness */}
        <div className="article-helpful">
          <p className="article-helpful-title">Was this article helpful?</p>
          <div className="article-helpful-buttons">
            <form action={markArticleHelpful.bind(null, article.id, true)}>
              <button type="submit" className="article-helpful-yes">
                <IconThumbsUp size={16} />
                Yes ({article.helpful_count})
              </button>
            </form>
            <form action={markArticleHelpful.bind(null, article.id, false)}>
              <button type="submit" className="article-helpful-no">
                <IconThumbsDown size={16} />
                No ({article.not_helpful_count})
              </button>
            </form>
          </div>
        </div>

        {/* Still need help */}
        <div className="article-cta">
          <div className="article-cta-text">
            <p className="article-cta-title">Still need help?</p>
            <p className="article-cta-desc">
              Our support team is here for you.
            </p>
          </div>
          <Link href="/support/contact" className="article-cta-btn">
            <IconMessageCircle size={16} />
            Contact Support
          </Link>
        </div>
      </div>
    </div>
  );
}