// ════════════════════════════════════════════════════════════
// FILE: src/pages/Help/HelpCenter.jsx
// ════════════════════════════════════════════════════════════

import "../../styles/help/help-page.css";
import "../../styles/help/help-center.css";

import { useState, useEffect } from "react";
import { useNavigate, Link }   from "react-router-dom";
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
} from "../../components/help/icons/HelpIcons";

const ICON_MAP = {
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

const FAQ_CATEGORIES = [
  { id: "1",  name: "Account",              slug: "account",           icon: "User",         articleCount: 4 },
  { id: "2",  name: "Buying",               slug: "buying",            icon: "ShoppingCart",  articleCount: 2 },
  { id: "3",  name: "Selling",              slug: "selling",           icon: "Tag",           articleCount: 4 },
  { id: "4",  name: "Payments",             slug: "payments",          icon: "CreditCard",    articleCount: 2 },
  { id: "5",  name: "Delivery",             slug: "delivery",          icon: "Truck",         articleCount: 1 },
  { id: "6",  name: "Wallet",               slug: "wallet",            icon: "Wallet",        articleCount: 2 },
  { id: "7",  name: "Subscriptions",        slug: "subscriptions",     icon: "Star",          articleCount: 3 },
  { id: "8",  name: "Promotions & Coupons", slug: "promotions-coupons",icon: "Gift",          articleCount: 3 },
  { id: "9",  name: "Safety & Security",    slug: "safety-security",   icon: "Shield",        articleCount: 1 },
  { id: "10", name: "Returns & Refunds",    slug: "returns-refunds",   icon: "RefreshCw",     articleCount: 0 },
  { id: "11", name: "Policies",             slug: "policies",          icon: "FileText",      articleCount: 0 },
  { id: "12", name: "Technical Issues",     slug: "technical-issues",  icon: "Settings",      articleCount: 2 },
];

const POPULAR_QUESTIONS = [
  { question: "How do I reset my password?",   categorySlug: "account" },
  { question: "How do I track my order?",      categorySlug: "delivery" },
  { question: "How do I request a refund?",    categorySlug: "returns-refunds" },
  { question: "How does the wallet work?",     categorySlug: "wallet" },
  { question: "How do I contact a seller?",    categorySlug: "buying" },
  { question: "Why was my listing rejected?",  categorySlug: "selling" },
];

const QUICK_ACTIONS = [
  { label: "Submit Ticket",  description: "Get help from support",  icon: IconMessageCircle, href: "/support/contact",  variant: "action-primary" },
  { label: "My Tickets",     description: "Track your requests",    icon: IconFileText,      href: "/support/tickets",  variant: "action-secondary" },
  { label: "Report Issue",   description: "Report violations",      icon: IconAlertTriangle, href: "/support/report",   variant: "action-danger" },
  { label: "Open Dispute",   description: "Resolve order issues",   icon: IconScale,         href: "/support/disputes", variant: "action-warning" },
];

export default function HelpCenter() {
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/help/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <div className="help-center">
      {/* Hero */}
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
                to={`/help/search?q=${encodeURIComponent(item.question)}`}
                className="help-popular-tag"
              >
                {item.question}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Quick Actions */}
      <section className="help-quick-actions-wrapper">
        <div className="help-quick-actions">
          {QUICK_ACTIONS.map(({ label, description, icon: Icon, href, variant }) => (
            <Link key={href} to={href} className={`help-quick-action ${variant}`}>
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

      {/* Categories */}
      <section className="help-categories-section">
        <h2 className="help-section-title">Browse by Category</h2>
        <div className="help-categories-grid">
          {FAQ_CATEGORIES.map((category) => {
            const Icon = ICON_MAP[category.icon] || IconHelpCircle;
            return (
              <Link
                key={category.id}
                to={`/help/category/${category.slug}`}
                className="help-category-card"
              >
                <div className="help-category-icon-wrapper">
                  <Icon size={24} />
                </div>
                <h3 className="help-category-name">{category.name}</h3>
                <span className="help-category-count">
                  {category.articleCount} {category.articleCount === 1 ? "article" : "articles"}
                </span>
                <IconChevronRight size={16} className="help-category-arrow" />
              </Link>
            );
          })}
        </div>
      </section>

      {/* Popular Questions */}
      <section className="help-popular-section">
        <h2 className="help-section-title">Frequently Asked Questions</h2>
        <div className="help-popular-list">
          {POPULAR_QUESTIONS.map(({ question, categorySlug }) => (
            <Link
              key={question}
              to={`/help/category/${categorySlug}`}
              className="help-popular-item"
            >
              <span className="help-popular-question">{question}</span>
              <IconChevronRight size={16} className="help-popular-arrow" />
            </Link>
          ))}
        </div>
      </section>

      {/* Footer CTA */}
      <section className="help-footer-cta">
        <p className="help-footer-subtitle">Still need help?</p>
        <h3 className="help-footer-title">Contact Our Support Team</h3>
        <div className="help-footer-actions">
          <Link to="/support/contact" className="help-footer-btn-primary">
            Submit a Request
          </Link>
          <Link to="/support/tickets" className="help-footer-btn-outline">
            Track My Tickets
          </Link>
        </div>
      </section>
    </div>
  );
}