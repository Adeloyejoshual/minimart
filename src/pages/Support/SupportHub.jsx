// ════════════════════════════════════════════════════════════
// FILE: src/pages/Support/SupportHub.jsx
// ════════════════════════════════════════════════════════════

import "../../styles/help/support-hub.css";

import { Link, useNavigate } from "react-router-dom";
import {
  IconMessageCircle,
  IconFileText,
  IconFlag,
  IconScale,
  IconMegaphone,
  IconStar,
  IconArrowRight,
  IconArrowLeft,
  IconHelpCircle,
  IconBookOpen,
  IconClock,
} from "../../components/help/icons/HelpIcons";

const SUPPORT_OPTIONS = [
  { title: "Help Center",       description: "Browse FAQs and help articles",     icon: IconBookOpen,      href: "/help",              variant: "option-info" },
  { title: "Submit a Ticket",   description: "Get help from our support team",    icon: IconMessageCircle, href: "/support/contact",   variant: "option-primary" },
  { title: "My Tickets",        description: "Track and manage your requests",    icon: IconFileText,      href: "/support/tickets",   variant: "option-secondary" },
  { title: "Report a Problem",  description: "Report scams, fraud, or violations",icon: IconFlag,          href: "/support/report",    variant: "option-danger" },
  { title: "Open a Dispute",    description: "Resolve buyer-seller issues",       icon: IconScale,         href: "/support/disputes",  variant: "option-warning" },
  { title: "File an Appeal",    description: "Appeal account or listing decisions",icon: IconMegaphone,    href: "/support/appeals",   variant: "option-success" },
  { title: "Leave Feedback",    description: "Rate support and suggest features", icon: IconStar,          href: "/support/feedback",  variant: "option-accent" },
];

const RESPONSE_TIMES = [
  { label: "General Inquiries",   time: "Within 24 hours",       variant: "response-normal" },
  { label: "Disputes & Appeals",  time: "3 to 5 business days",  variant: "response-moderate" },
  { label: "Urgent / High Priority", time: "Within 4 hours",     variant: "response-urgent" },
];

export default function SupportHub() {
  const navigate = useNavigate();

  return (
    <div className="support-hub-page">
      <div className="support-hub-container">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="support-hub-back-btn"
          aria-label="Go back"
        >
          <IconArrowLeft size={18} />
          <span>Back</span>
        </button>

        <div className="support-hub-header">
          <div className="support-hub-icon-wrapper">
            <IconHelpCircle size={32} />
          </div>
          <h1 className="support-hub-title">Help & Support</h1>
          <p className="support-hub-subtitle">
            We are here to help. Choose an option below to get started.
          </p>
        </div>

        <div className="support-hub-grid">
          {SUPPORT_OPTIONS.map(({ title, description, icon: Icon, href, variant }) => (
            <Link key={href} to={href} className={`support-hub-card ${variant}`}>
              <div className="support-hub-card-icon">
                <Icon size={24} />
              </div>
              <div className="support-hub-card-text">
                <h3 className="support-hub-card-title">{title}</h3>
                <p className="support-hub-card-desc">{description}</p>
              </div>
              <IconArrowRight size={16} className="support-hub-card-arrow" />
            </Link>
          ))}
        </div>

        <div className="support-hub-response-section">
          <h3 className="support-hub-response-title">Typical Response Times</h3>
          <div className="support-hub-response-grid">
            {RESPONSE_TIMES.map(({ label, time, variant }) => (
              <div key={label} className={`support-hub-response-card ${variant}`}>
                <IconClock size={16} className="support-hub-response-icon" />
                <p className="support-hub-response-label">{label}</p>
                <p className="support-hub-response-time">{time}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}