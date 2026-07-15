// src/app/support/report/page.tsx
'use client';

import '@/styles/help/report-center.css';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { submitReport } from '@/lib/help/actions';
import type { ReportType } from '@/types/help';
import {
  IconAlertTriangle,
  IconCheckCircle,
  IconArrowLeft,
  IconLoader,
  IconShield,
  IconFlag,
  IconCreditCard,
  IconUser,
  IconShoppingCart,
  IconTag,
  IconTruck,
  IconBug,
  IconAlertCircle,
  IconLock,
  IconScale,
  IconHelpCircle,
} from '@/components/help/icons/HelpIcons';

const REPORT_TYPES: {
  value: ReportType;
  label: string;
  description: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}[] = [
  {
    value: 'scam',
    label: 'Scam',
    description: 'Someone is trying to deceive or defraud',
    icon: IconAlertTriangle,
  },
  {
    value: 'fraud',
    label: 'Fraud',
    description: 'Fraudulent payment or financial activity',
    icon: IconCreditCard,
  },
  {
    value: 'fake_product',
    label: 'Fake Product',
    description: 'Counterfeit or misrepresented item',
    icon: IconTag,
  },
  {
    value: 'fake_seller',
    label: 'Fake Seller',
    description: 'Fraudulent seller account',
    icon: IconShoppingCart,
  },
  {
    value: 'fake_buyer',
    label: 'Fake Buyer',
    description: 'Fraudulent buyer activity',
    icon: IconUser,
  },
  {
    value: 'offensive_content',
    label: 'Offensive Content',
    description: 'Inappropriate or harmful content',
    icon: IconAlertCircle,
  },
  {
    value: 'copyright_violation',
    label: 'Copyright Violation',
    description: 'Unauthorized use of protected content',
    icon: IconLock,
  },
  {
    value: 'payment_issue',
    label: 'Payment Issue',
    description: 'Payment problem or dispute',
    icon: IconCreditCard,
  },
  {
    value: 'delivery_issue',
    label: 'Delivery Issue',
    description: 'Order delivery problem',
    icon: IconTruck,
  },
  {
    value: 'technical_bug',
    label: 'Technical Bug',
    description: 'App or website error',
    icon: IconBug,
  },
  {
    value: 'other',
    label: 'Other',
    description: 'Something else not listed above',
    icon: IconHelpCircle,
  },
];

export default function ReportCenterPage() {
  const [selectedType, setSelectedType] = useState<ReportType | ''>('');
  const [isPending, startTransition] = useTransition();
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const result = await submitReport(formData);
      if (result.success) {
        setSuccess(`Report submitted successfully. Reference: ${result.reportNumber}`);
      } else {
        setError(result.error || 'Failed to submit report.');
      }
    });
  };

  // ── Success State ──
  if (success) {
    return (
      <div className="report-success-wrapper">
        <div className="report-success-card">
          <div className="report-success-icon-wrapper">
            <IconCheckCircle size={40} className="report-success-icon" />
          </div>
          <h2 className="report-success-title">Report Submitted</h2>
          <p className="report-success-text">{success}</p>
          <p className="report-success-hint">
            Our safety team will review your report. We take all reports
            seriously and will take appropriate action.
          </p>
          <Link href="/help" className="report-success-btn">
            Back to Help Center
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="report-center-page">
      <div className="report-center-container">
        {/* Header */}
        <div className="report-header">
          <Link href="/help" className="report-back-link">
            <IconArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="report-title">Report Center</h1>
            <p className="report-subtitle">
              Help us keep Loemart safe for everyone
            </p>
          </div>
        </div>

        {/* Info Banner */}
        <div className="report-info-banner">
          <IconShield size={20} className="report-info-icon" />
          <p className="report-info-text">
            All reports are reviewed by our safety team. Your identity will be
            kept confidential. False reports may result in account action.
          </p>
        </div>

        {/* Report Type Selection */}
        <div className="report-type-section">
          <h3 className="report-type-title">What are you reporting?</h3>
          <div className="report-type-grid">
            {REPORT_TYPES.map(({ value, label, description, icon: Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => setSelectedType(value)}
                className={`report-type-card ${
                  selectedType === value ? 'report-type-selected' : ''
                }`}
              >
                <div className="report-type-icon-wrapper">
                  <Icon size={20} />
                </div>
                <div className="report-type-text">
                  <p className="report-type-label">{label}</p>
                  <p className="report-type-desc">{description}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Report Form */}
        {selectedType && (
          <form onSubmit={handleSubmit} className="report-form">
            <input type="hidden" name="report_type" value={selectedType} />

            <div className="report-form-section">
              <div className="report-field">
                <label className="report-label">
                  Subject <span className="report-required">*</span>
                </label>
                <input
                  type="text"
                  name="subject"
                  required
                  placeholder="Brief description of the issue"
                  className="report-input"
                />
              </div>

              <div className="report-field">
                <label className="report-label">
                  Description <span className="report-required">*</span>
                </label>
                <textarea
                  name="description"
                  required
                  rows={5}
                  placeholder="Provide details: username, order ID, URLs, dates, what happened..."
                  className="report-textarea"
                />
              </div>

              <div className="report-field">
                <label className="report-label">
                  Reported User ID
                  <span className="report-optional">(optional)</span>
                </label>
                <input
                  type="text"
                  name="reported_user_id"
                  placeholder="Enter username or user ID if applicable"
                  className="report-input"
                />
              </div>
            </div>

            {error && (
              <div className="report-error">
                <IconAlertTriangle size={16} />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isPending}
              className="report-submit-btn"
            >
              {isPending ? (
                <IconLoader size={20} className="report-spinner" />
              ) : (
                <IconFlag size={20} />
              )}
              {isPending ? 'Submitting...' : 'Submit Report'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}