// ════════════════════════════════════════════════════════════
// FILE: src/pages/Help/HelpSearchResults.jsx
// ════════════════════════════════════════════════════════════

import '../../styles/help/search-results.css';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import {
  IconSearch,
  IconArrowLeft,
  IconBookOpen,
  IconChevronRight,
  IconMessageCircle,
  IconClock,
  IconEye,
} from '../../components/help/icons/HelpIcons';

/* ════════════════════════════════════════════════════════════
   STATIC FAQ DATA
   In production replace this with an API call:
   GET /api/help/articles?search=query
════════════════════════════════════════════════════════════ */
const ALL_ARTICLES = [
  {
    id:           '1',
    slug:         'how-to-create-account',
    title:        'How do I create a Loemart account?',
    categorySlug: 'account',
    category:     'Account',
    content:      'Download the Loemart app or visit the website, select Sign Up, enter your details, verify your phone number or email, and complete your profile.',
    views:        1240,
    date:         '15 Jan 2025',
  },
  {
    id:           '2',
    slug:         'verify-phone-number',
    title:        'How do I verify my phone number?',
    categorySlug: 'account',
    category:     'Account',
    content:      'Enter the OTP (One-Time Password) sent to your phone. If you do not receive it, request a new OTP after the countdown ends.',
    views:        890,
    date:         '15 Jan 2025',
  },
  {
    id:           '3',
    slug:         'forgot-password',
    title:        'I forgot my password. What should I do?',
    categorySlug: 'account',
    category:     'Account',
    content:      'Select Forgot Password on the login page and follow the instructions to reset your password securely.',
    views:        2100,
    date:         '15 Jan 2025',
  },
  {
    id:           '4',
    slug:         'account-security',
    title:        'How can I keep my account secure?',
    categorySlug: 'account',
    category:     'Account',
    content:      'Use a strong password, never share your login details or OTP with anyone, and only make payments through official Loemart channels.',
    views:        560,
    date:         '15 Jan 2025',
  },
  {
    id:           '5',
    slug:         'how-to-start-selling',
    title:        'How do I start selling?',
    categorySlug: 'selling',
    category:     'Selling',
    content:      'Sign in to your account, tap Sell, complete your seller profile if required, and create your first product listing.',
    views:        1500,
    date:         '15 Jan 2025',
  },
  {
    id:           '6',
    slug:         'how-to-post-product',
    title:        'How do I post a product?',
    categorySlug: 'selling',
    category:     'Selling',
    content:      'Select Sell, choose the correct category, upload clear photos, add a title, description, price, and location, then publish your listing.',
    views:        980,
    date:         '15 Jan 2025',
  },
  {
    id:           '7',
    slug:         'product-pending-review',
    title:        'Why is my product pending review?',
    categorySlug: 'selling',
    category:     'Selling',
    content:      'Some listings are reviewed to ensure they comply with Loemart policies. Reviews are usually completed as quickly as possible.',
    views:        430,
    date:         '15 Jan 2025',
  },
  {
    id:           '8',
    slug:         'listing-rejected-removed',
    title:        'Why was my listing rejected or removed?',
    categorySlug: 'selling',
    category:     'Selling',
    content:      'Listings may be removed if they violate marketplace rules, contain prohibited items, misleading information, duplicate content, or inappropriate images.',
    views:        670,
    date:         '15 Jan 2025',
  },
  {
    id:           '9',
    slug:         'how-to-buy',
    title:        'How do I buy an item?',
    categorySlug: 'buying',
    category:     'Buying',
    content:      'Browse products, select the item you want, review the details, and follow the checkout process to complete your purchase.',
    views:        2300,
    date:         '15 Jan 2025',
  },
  {
    id:           '10',
    slug:         'wrong-or-damaged-item',
    title:        'What should I do if I receive the wrong or damaged item?',
    categorySlug: 'buying',
    category:     'Buying',
    content:      'Report the issue through Help and Support as soon as possible and include photos and your order details so our team can investigate.',
    views:        1100,
    date:         '15 Jan 2025',
  },
  {
    id:           '11',
    slug:         'payment-methods',
    title:        'What payment methods are available?',
    categorySlug: 'payments',
    category:     'Payments',
    content:      'Loemart supports secure online payments. Available payment options are displayed during checkout.',
    views:        1800,
    date:         '15 Jan 2025',
  },
  {
    id:           '12',
    slug:         'payment-safety',
    title:        'Is it safe to pay on Loemart?',
    categorySlug: 'payments',
    category:     'Payments',
    content:      'Yes. We use trusted payment partners and security measures to help protect transactions. Always complete payments through official Loemart channels.',
    views:        900,
    date:         '15 Jan 2025',
  },
  {
    id:           '13',
    slug:         'how-subscriptions-work',
    title:        'How do subscriptions work?',
    categorySlug: 'subscriptions',
    category:     'Subscriptions',
    content:      'Seller subscriptions provide additional benefits such as increased visibility and access to premium selling features. Choose the plan that best fits your business.',
    views:        750,
    date:         '15 Jan 2025',
  },
  {
    id:           '14',
    slug:         'upgrade-subscription',
    title:        'Can I upgrade my subscription?',
    categorySlug: 'subscriptions',
    category:     'Subscriptions',
    content:      'Yes. You can upgrade your subscription at any time from your account settings. Your new benefits become available after successful payment.',
    views:        320,
    date:         '15 Jan 2025',
  },
  {
    id:           '15',
    slug:         'subscription-expires',
    title:        'What happens when my subscription expires?',
    categorySlug: 'subscriptions',
    category:     'Subscriptions',
    content:      'Your premium benefits end when the subscription expires. You can renew your subscription to continue enjoying those features.',
    views:        280,
    date:         '15 Jan 2025',
  },
  {
    id:           '16',
    slug:         'how-wallet-works',
    title:        'How does the Loemart wallet work?',
    categorySlug: 'wallet',
    category:     'Wallet',
    content:      'Your wallet stores eligible funds such as sales proceeds or other supported credits. You can view your balance and transaction history in the Wallet section.',
    views:        1400,
    date:         '15 Jan 2025',
  },
  {
    id:           '17',
    slug:         'how-to-withdraw',
    title:        'How do I withdraw my earnings?',
    categorySlug: 'wallet',
    category:     'Wallet',
    content:      'Go to Wallet, choose Withdraw, enter the amount and confirm your bank details. Withdrawals are processed after the required checks.',
    views:        1600,
    date:         '15 Jan 2025',
  },
  {
    id:           '18',
    slug:         'delivery-fees',
    title:        'How are delivery fees calculated?',
    categorySlug: 'delivery',
    category:     'Delivery',
    content:      'Delivery fees depend on factors such as the order value, delivery location, and selected delivery method. The applicable fee is shown before payment.',
    views:        1900,
    date:         '15 Jan 2025',
  },
  {
    id:           '19',
    slug:         'spin-and-win',
    title:        'How does Spin and Win work?',
    categorySlug: 'promotions-coupons',
    category:     'Promotions & Coupons',
    content:      'Eligible users receive opportunities to spin the reward wheel and may win coupons, discounts, airtime, free shipping, or other promotional rewards.',
    views:        3200,
    date:         '15 Jan 2025',
  },
  {
    id:           '20',
    slug:         'redeem-coupon',
    title:        'How do I redeem a coupon?',
    categorySlug: 'promotions-coupons',
    category:     'Promotions & Coupons',
    content:      'Enter your coupon code during checkout. If the coupon is valid and meets the requirements, the discount will be applied automatically.',
    views:        2800,
    date:         '15 Jan 2025',
  },
  {
    id:           '21',
    slug:         'referral-program',
    title:        'How does the referral program work?',
    categorySlug: 'promotions-coupons',
    category:     'Promotions & Coupons',
    content:      'Share your referral code or invite link with friends. When they join and meet the program requirements, you may receive eligible referral rewards.',
    views:        2100,
    date:         '15 Jan 2025',
  },
  {
    id:           '22',
    slug:         'report-scam',
    title:        'How do I report a scam or suspicious activity?',
    categorySlug: 'safety-security',
    category:     'Safety & Security',
    content:      'Open Help and Support, choose Report a Problem, select the appropriate category, and provide as much detail as possible.',
    views:        780,
    date:         '15 Jan 2025',
  },
  {
    id:           '23',
    slug:         'report-bug',
    title:        'How can I report a bug?',
    categorySlug: 'technical-issues',
    category:     'Technical Issues',
    content:      'Open Help and Support, select Report a Bug, describe the issue, attach screenshots if possible, and submit the report.',
    views:        450,
    date:         '15 Jan 2025',
  },
  {
    id:           '24',
    slug:         'contact-loemart-support',
    title:        'How do I contact Loemart Support?',
    categorySlug: 'technical-issues',
    category:     'Technical Issues',
    content:      'Go to Help and Support, submit a support ticket, and our team will respond as soon as possible. You can also track the progress of your request from your support tickets.',
    views:        1300,
    date:         '15 Jan 2025',
  },
];

/* ════════════════════════════════════════════════════════════
   HELPERS
════════════════════════════════════════════════════════════ */
function truncate(text = '', max = 150) {
  if (text.length <= max) return text;
  return text.slice(0, max).trimEnd() + '...';
}

function highlight(text = '', query = '') {
  if (!query.trim()) return text;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex   = new RegExp(`(${escaped})`, 'gi');
  const parts   = text.split(regex);

  return parts.map((part, i) =>
    regex.test(part)
      ? <mark key={i} className="sr-highlight">{part}</mark>
      : part
  );
}

function searchArticles(query) {
  if (!query.trim()) return [];
  const q = query.toLowerCase().trim();

  return ALL_ARTICLES
    .filter((a) =>
      a.title.toLowerCase().includes(q) ||
      a.content.toLowerCase().includes(q) ||
      a.category.toLowerCase().includes(q)
    )
    .sort((a, b) => {
      /* Title matches rank higher than content matches */
      const aTitle = a.title.toLowerCase().includes(q);
      const bTitle = b.title.toLowerCase().includes(q);
      if (aTitle && !bTitle) return -1;
      if (!aTitle && bTitle) return  1;
      /* Then sort by views descending */
      return b.views - a.views;
    });
}

/* ════════════════════════════════════════════════════════════
   COMPONENT
════════════════════════════════════════════════════════════ */
export default function HelpSearchResults() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const query   = searchParams.get('q') || '';
  const results = searchArticles(query);

  /* ── Local search input (refine without navigation) ── */
  const [localQuery, setLocalQuery] = useState(query);

  /* Sync local input when URL param changes */
  useEffect(() => {
    setLocalQuery(query);
  }, [query]);

  const handleSearch = useCallback(
    (e) => {
      e.preventDefault();
      const trimmed = localQuery.trim();
      if (trimmed) {
        setSearchParams({ q: trimmed });
      }
    },
    [localQuery, setSearchParams]
  );

  return (
    <div className="search-results-page">
      <div className="search-results-container">

        {/* ── Header ── */}
        <div className="search-results-header">
          <button
            className="search-results-back"
            onClick={() => navigate('/help')}
            aria-label="Back to Help Center"
          >
            <IconArrowLeft size={20} />
          </button>
          <div>
            <h1 className="search-results-title">
              Search Results
              {query && (
                <span className="search-results-query">
                  &ldquo;{query}&rdquo;
                </span>
              )}
            </h1>
            <p className="search-results-count">
              {results.length}{' '}
              {results.length === 1 ? 'result' : 'results'} found
            </p>
          </div>
        </div>

        {/* ── Inline search bar (refine query) ── */}
        <form onSubmit={handleSearch} className="search-results-refine">
          <div className="search-results-refine-wrapper">
            <IconSearch size={16} className="search-results-refine-icon" />
            <input
              type="text"
              value={localQuery}
              onChange={(e) => setLocalQuery(e.target.value)}
              placeholder="Refine your search..."
              className="search-results-refine-input"
              aria-label="Refine search"
            />
            {localQuery && (
              <button
                type="button"
                className="search-results-refine-clear"
                onClick={() => {
                  setLocalQuery('');
                  setSearchParams({});
                }}
                aria-label="Clear search"
              >
                ×
              </button>
            )}
          </div>
          <button type="submit" className="search-results-refine-btn">
            Search
          </button>
        </form>

        {/* ── No query state ── */}
        {!query && (
          <div className="search-results-empty">
            <IconSearch size={48} className="search-results-empty-icon" />
            <h3 className="search-results-empty-title">
              What are you looking for?
            </h3>
            <p className="search-results-empty-desc">
              Type a keyword in the search bar above to find help articles.
            </p>
            <Link to="/help" className="search-results-empty-btn">
              Browse Help Center
            </Link>
          </div>
        )}

        {/* ── No results state ── */}
        {query && results.length === 0 && (
          <div className="search-results-empty">
            <IconSearch size={48} className="search-results-empty-icon" />
            <h3 className="search-results-empty-title">No results found</h3>
            <p className="search-results-empty-desc">
              We could not find any articles matching{' '}
              <strong>&ldquo;{query}&rdquo;</strong>.
              Try different keywords or browse by category.
            </p>
            <div className="search-results-empty-actions">
              <Link to="/help" className="search-results-empty-btn">
                Browse Help Center
              </Link>
              <Link
                to="/support/contact"
                className="search-results-empty-btn-outline"
              >
                Contact Support
              </Link>
            </div>
          </div>
        )}

        {/* ── Results list ── */}
        {results.length > 0 && (
          <>
            <div className="search-results-list">
              {results.map((article) => (
                <Link
                  key={article.id}
                  to={`/help/article/${article.slug}`}
                  className="search-result-card"
                >
                  {/* Icon */}
                  <div className="search-result-icon-wrapper">
                    <IconBookOpen size={16} />
                  </div>

                  {/* Content */}
                  <div className="search-result-content">
                    <p className="search-result-category">
                      {article.category}
                    </p>
                    <h3 className="search-result-title">
                      {highlight(article.title, query)}
                    </h3>
                    <p className="search-result-excerpt">
                      {highlight(truncate(article.content, 160), query)}
                    </p>
                    <div className="search-result-meta">
                      <span className="search-result-meta-item">
                        <IconClock size={12} />
                        {article.date}
                      </span>
                      <span className="search-result-meta-item">
                        <IconEye size={12} />
                        {article.views.toLocaleString()} views
                      </span>
                    </div>
                  </div>

                  {/* Arrow */}
                  <IconChevronRight
                    size={16}
                    className="search-result-arrow"
                  />
                </Link>
              ))}
            </div>

            {/* ── Popular categories after results ── */}
            <div className="search-results-categories">
              <p className="search-results-categories-label">
                Browse by category
              </p>
              <div className="search-results-categories-chips">
                {[
                  { label: 'Account',     slug: 'account' },
                  { label: 'Selling',     slug: 'selling' },
                  { label: 'Buying',      slug: 'buying' },
                  { label: 'Payments',    slug: 'payments' },
                  { label: 'Wallet',      slug: 'wallet' },
                  { label: 'Delivery',    slug: 'delivery' },
                ].map((cat) => (
                  <Link
                    key={cat.slug}
                    to={`/help/category/${cat.slug}`}
                    className="search-results-chip"
                  >
                    {cat.label}
                  </Link>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ── CTA ── */}
        <div className="search-results-cta">
          <p className="search-results-cta-text">
            Did not find what you are looking for?
          </p>
          <Link to="/support/contact" className="search-results-cta-btn">
            <IconMessageCircle size={16} />
            Contact Support
          </Link>
        </div>

      </div>
    </div>
  );
}