// src/components/help/HelpCenter.tsx
'use client';

import '@/styles/help/help-center.css';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { FaqCategory } from '@/types/help';
import { getArticleCount } from '@/lib/help/utils';
import {
  IconSearch,
  IconUser,
  IconShoppingCart,
  IconTag,
  IconCreditCard,
  IconTruck,
  IconWallet,
  IconStar,
  IconGift,
  IconShield,
  IconRefresh,
  IconFileText,
  IconSettings,
  IconChevronRight,
  IconMessageCircle,
  IconAlertTriangle,
  IconScale,
  IconHelpCircle,
  IconBookOpen,
  IconPlus,
} from '@/components/help/icons/HelpIcons';

const ICON_MAP: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  User: IconUser,
  ShoppingCart: IconShoppingCart,
  Tag: IconTag,
  CreditCard: IconCreditCard,
  Truck: IconTruck,
  Wallet: IconWallet,
  Star: IconStar,
  Gift: IconGift,
  Shield: IconShield,
  RefreshCw: IconRefresh,
  FileText: IconFileText,
  Settings: IconSettings,
};

const POPULAR_QUESTIONS = [
  { question: 'How do I reset my password?', categorySlug: 'account' },
  { question: 'How do I track my order?', categorySlug: 'delivery' },
  { question: 'How do I request a refund?', categorySlug: 'returns-refunds' },
  { question: 'How does the wallet work?', categorySlug: 'wallet' },
  { question: 'How do I contact a seller?', categorySlug: 'buying' },
  { question: 'Why was my listing rejected?', categorySlug: 'selling' },
];

const QUICK_ACTIONS = [
  {
    label: 'Submit Ticket',
    description: 'Get help from support',
    icon: IconMessageCircle,
    href: '/support/contact',
    variant: 'action-primary',
  },
  {
    label: 'My Tickets',
    description: 'Track your requests',
    icon: IconFileText,
    href: '/support/tickets',
    variant: 'action-secondary',
  },
  {
    label: 'Report Issue',
    description: 'Report violations',
    icon: IconAlertTriangle,
    href: '/support/report',
    variant: 'action-danger',
  },
  {
    label: 'Open Dispute',
    description: 'Resolve order issues',
    icon: IconScale,
    href: '/support/disputes',
    variant: 'action-warning',
  },
];

interface HelpCenterProps {
  categories: FaqCategory[];
}

export default function HelpCenter({ categories }: HelpCenterProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const router = useRouter();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/help/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <div className="help-center">
      {/* ── Hero Section ── */}
      <section className="help-hero">
        <div className="help-hero-content">
          <div className="help-hero-title-wrapper">
            <IconHelpCircle size={40} className="help-hero-icon" />
            <h1 className="help-hero-title">Help Center</h1>
          </div>
          <p className="help-hero-subtitle">How can we help you today?</p>

          <form onSubmit={handleSearch} className="help-search-form">
            <div className="help-search-wrapper">
              <IconSearch size={20} className="help-search-icon" />
              <input
                type="text"
                placeholder="Search for answers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="help-search-input"
                aria-label="Search help articles"
              />
              <button type="submit" className="help-search-button">
                Search
              </button>
            </div>
          </form>

          <div className="help-popular-tags">
            {POPULAR_QUESTIONS.map((item) => (
              <Link
                key={item.question}
                href={`/help/search?q=${encodeURIComponent(item.question)}`}
                className="help-popular-tag"
              >
                {item.question}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── Quick Actions ── */}
      <section className="help-quick-actions-wrapper">
        <div className="help-quick-actions">
          {QUICK_ACTIONS.map(({ label, description, icon: Icon, href, variant }) => (
            <Link key={href} href={href} className={`help-quick-action ${variant}`}>
              <div className="help-quick-action-icon">
                <Icon size={22} />
              </div>
              <div className="help-quick-action-text">
                <span className="help-quick-action-label">{label}</span>
                <span className="help-quick-action-desc">{description}</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ── FAQ Categories ── */}
      <section className="help-categories-section">
        <h2 className="help-section-title">Browse by Category</h2>
        <div className="help-categories-grid">
          {categories.map((category) => {
            const Icon = ICON_MAP[category.icon] || IconHelpCircle;
            const count = getArticleCount(category.article_count);

            return (
              <Link
                key={category.id}
                href={`/help/category/${category.slug}`}
                className="help-category-card"
              >
                <div className="help-category-icon-wrapper">
                  <Icon size={24} />
                </div>
                <h3 className="help-category-name">{category.name}</h3>
                <span className="help-category-count">
                  {count} {count === 1 ? 'article' : 'articles'}
                </span>
                <IconChevronRight size={16} className="help-category-arrow" />
              </Link>
            );
          })}
        </div>
      </section>

      {/* ── Popular Questions ── */}
      <section className="help-popular-section">
        <h2 className="help-section-title">Frequently Asked Questions</h2>
        <div className="help-popular-list">
          {POPULAR_QUESTIONS.map(({ question, categorySlug }) => (
            <Link
              key={question}
              href={`/help/category/${categorySlug}`}
              className="help-popular-item"
            >
              <span className="help-popular-question">{question}</span>
              <IconChevronRight size={16} className="help-popular-arrow" />
            </Link>
          ))}
        </div>
      </section>

      {/* ── Footer CTA ── */}
      <section className="help-footer-cta">
        <p className="help-footer-subtitle">Still need help?</p>
        <h3 className="help-footer-title">Contact Our Support Team</h3>
        <div className="help-footer-actions">
          <Link href="/support/contact" className="help-footer-btn-primary">
            Submit a Request
          </Link>
          <Link href="/support/tickets" className="help-footer-btn-outline">
            Track My Tickets
          </Link>
        </div>
      </section>
    </div>
  );
}