// ════════════════════════════════════════════════════════════
// FILE: src/pages/Help/HelpCategoryPage.jsx
// ════════════════════════════════════════════════════════════

import "../../styles/help/category-page.css";

import { useParams, Link } from "react-router-dom";
import {
  IconArrowLeft,
  IconChevronRight,
  IconBookOpen,
  IconClock,
  IconEye,
  IconMessageCircle,
} from "../../components/help/icons/HelpIcons";

/* ── Same static data ── */
const ALL_ARTICLES = [
  { id: "1",  slug: "how-to-create-account",    title: "How do I create a Loemart account?",                       categorySlug: "account",           category: "Account",              content: "Download the Loemart app or visit the website, select Sign Up, enter your details, verify your phone number or email, and complete your profile.", views: 1240, date: "15 Jan 2025" },
  { id: "2",  slug: "verify-phone-number",       title: "How do I verify my phone number?",                         categorySlug: "account",           category: "Account",              content: "Enter the OTP sent to your phone. If you do not receive it, request a new OTP after the countdown ends.", views: 890, date: "15 Jan 2025" },
  { id: "3",  slug: "forgot-password",           title: "I forgot my password. What should I do?",                  categorySlug: "account",           category: "Account",              content: "Select Forgot Password on the login page and follow the instructions to reset your password securely.", views: 2100, date: "15 Jan 2025" },
  { id: "4",  slug: "account-security",          title: "How can I keep my account secure?",                        categorySlug: "account",           category: "Account",              content: "Use a strong password, never share your login details or OTP with anyone.", views: 560, date: "15 Jan 2025" },
  { id: "5",  slug: "how-to-start-selling",      title: "How do I start selling?",                                  categorySlug: "selling",           category: "Selling",              content: "Sign in to your account, tap Sell, complete your seller profile if required, and create your first product listing.", views: 1500, date: "15 Jan 2025" },
  { id: "6",  slug: "how-to-post-product",       title: "How do I post a product?",                                 categorySlug: "selling",           category: "Selling",              content: "Select Sell, choose the correct category, upload clear photos, add details, then publish.", views: 980, date: "15 Jan 2025" },
  { id: "7",  slug: "product-pending-review",    title: "Why is my product pending review?",                        categorySlug: "selling",           category: "Selling",              content: "Some listings are reviewed to ensure compliance. Reviews are completed quickly.", views: 430, date: "15 Jan 2025" },
  { id: "8",  slug: "listing-rejected-removed",   title: "Why was my listing rejected or removed?",                  categorySlug: "selling",           category: "Selling",              content: "Listings may be removed for policy violations.", views: 670, date: "15 Jan 2025" },
  { id: "9",  slug: "how-to-buy",                title: "How do I buy an item?",                                    categorySlug: "buying",            category: "Buying",               content: "Browse products, select the item, review details, and complete checkout.", views: 2300, date: "15 Jan 2025" },
  { id: "10", slug: "wrong-or-damaged-item",     title: "What should I do if I receive the wrong or damaged item?",  categorySlug: "buying",            category: "Buying",               content: "Report the issue through Help and Support with photos and order details.", views: 1100, date: "15 Jan 2025" },
  { id: "11", slug: "payment-methods",           title: "What payment methods are available?",                       categorySlug: "payments",          category: "Payments",             content: "Loemart supports secure online payments displayed during checkout.", views: 1800, date: "15 Jan 2025" },
  { id: "12", slug: "payment-safety",            title: "Is it safe to pay on Loemart?",                            categorySlug: "payments",          category: "Payments",             content: "Yes. We use trusted payment partners and security measures.", views: 900, date: "15 Jan 2025" },
  { id: "13", slug: "how-subscriptions-work",    title: "How do subscriptions work?",                               categorySlug: "subscriptions",     category: "Subscriptions",        content: "Seller subscriptions provide additional benefits.", views: 750, date: "15 Jan 2025" },
  { id: "14", slug: "upgrade-subscription",      title: "Can I upgrade my subscription?",                           categorySlug: "subscriptions",     category: "Subscriptions",        content: "Yes. Upgrade at any time from account settings.", views: 320, date: "15 Jan 2025" },
  { id: "15", slug: "subscription-expires",      title: "What happens when my subscription expires?",               categorySlug: "subscriptions",     category: "Subscriptions",        content: "Premium benefits end. Renew to continue.", views: 280, date: "15 Jan 2025" },
  { id: "16", slug: "how-wallet-works",          title: "How does the Loemart wallet work?",                        categorySlug: "wallet",            category: "Wallet",               content: "Your wallet stores eligible funds.", views: 1400, date: "15 Jan 2025" },
  { id: "17", slug: "how-to-withdraw",           title: "How do I withdraw my earnings?",                           categorySlug: "wallet",            category: "Wallet",               content: "Go to Wallet, choose Withdraw, enter amount and bank details.", views: 1600, date: "15 Jan 2025" },
  { id: "18", slug: "delivery-fees",             title: "How are delivery fees calculated?",                         categorySlug: "delivery",          category: "Delivery",             content: "Fees depend on order value, location, and method.", views: 1900, date: "15 Jan 2025" },
  { id: "19", slug: "spin-and-win",              title: "How does Spin and Win work?",                              categorySlug: "promotions-coupons",category: "Promotions & Coupons", content: "Spin the reward wheel for coupons, discounts, and more.", views: 3200, date: "15 Jan 2025" },
  { id: "20", slug: "redeem-coupon",             title: "How do I redeem a coupon?",                                categorySlug: "promotions-coupons",category: "Promotions & Coupons", content: "Enter coupon code during checkout.", views: 2800, date: "15 Jan 2025" },
  { id: "21", slug: "referral-program",          title: "How does the referral program work?",                      categorySlug: "promotions-coupons",category: "Promotions & Coupons", content: "Share your code. Friends join, you earn rewards.", views: 2100, date: "15 Jan 2025" },
  { id: "22", slug: "report-scam",               title: "How do I report a scam or suspicious activity?",           categorySlug: "safety-security",   category: "Safety & Security",    content: "Open Help and Support, choose Report a Problem.", views: 780, date: "15 Jan 2025" },
  { id: "23", slug: "report-bug",                title: "How can I report a bug?",                                  categorySlug: "technical-issues",  category: "Technical Issues",     content: "Open Help and Support, select Report a Bug.", views: 450, date: "15 Jan 2025" },
  { id: "24", slug: "contact-loemart-support",   title: "How do I contact Loemart Support?",                        categorySlug: "technical-issues",  category: "Technical Issues",     content: "Go to Help and Support, submit a support ticket.", views: 1300, date: "15 Jan 2025" },
];

export default function HelpCategoryPage() {
  const { slug } = useParams();
  const articles = ALL_ARTICLES.filter((a) => a.categorySlug === slug);
  const categoryName = articles[0]?.category || slug.replace(/-/g, " ");

  return (
    <div className="category-page">
      <div className="category-container">
        <div className="category-header">
          <Link to="/help" className="category-back-link">
            <IconArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="category-title">{categoryName}</h1>
            <p className="category-count">
              {articles.length} {articles.length === 1 ? "article" : "articles"}
            </p>
          </div>
        </div>

        {articles.length === 0 ? (
          <div className="category-empty">
            <IconBookOpen size={48} className="category-empty-icon" />
            <h3 className="category-empty-title">No articles yet</h3>
            <p className="category-empty-desc">
              We are working on adding content for this category.
            </p>
            <Link to="/support/contact" className="category-empty-btn">
              <IconMessageCircle size={16} />
              Contact Support
            </Link>
          </div>
        ) : (
          <div className="category-articles">
            {articles.map((article) => (
              <Link
                key={article.id}
                to={`/help/article/${article.slug}`}
                className="category-article-card"
              >
                <div className="category-article-icon">
                  <IconBookOpen size={18} />
                </div>
                <div className="category-article-content">
                  <h3 className="category-article-title">{article.title}</h3>
                  <p className="category-article-excerpt">
                    {article.content.substring(0, 120)}...
                  </p>
                  <div className="category-article-meta">
                    <span className="category-article-meta-item">
                      <IconClock size={12} />
                      {article.date}
                    </span>
                    <span className="category-article-meta-item">
                      <IconEye size={12} />
                      {article.views} views
                    </span>
                  </div>
                </div>
                <IconChevronRight size={16} className="category-article-arrow" />
              </Link>
            ))}
          </div>
        )}

        <div className="category-cta">
          <p className="category-cta-text">
            Did not find what you are looking for?
          </p>
          <Link to="/support/contact" className="category-cta-btn">
            Contact Support
          </Link>
        </div>
      </div>
    </div>
  );
}