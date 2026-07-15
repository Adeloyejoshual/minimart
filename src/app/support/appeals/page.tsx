// src/app/support/appeals/page.tsx
'use client';

import '@/styles/help/appeals.css';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { submitAppeal } from '@/lib/help/actions';
import type { AppealType } from '@/types/help';
import {
  IconArrowLeft,
  IconCheckCircle,
  IconAlertTriangle,
  IconLoader,
  IconMegaphone,
  IconLock,
  IconTag,
  IconAlertCircle,
  IconHelpCircle,
} from '@/components/help/icons/HelpIcons';

const APPEAL_TYPES: {
  value: AppealType;
  label: string;
  description: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}[] = [
  {
    value: 'suspended_account',
    label: 'Suspended Account',
    description:
      'Your account has been suspended and you want to appeal the decision',
    icon: IconLock,
  },
  {
    value: 'removed_listing',
    label: 'Removed Listing',
    description:
      'A product listing was removed and you believe this was incorrect',
    icon: IconTag,
  },
  {
    value: 'rejected_listing',
    label: 'Rejected Listing',
    description: 'Your listing was rejected during review',
    icon: IconAlertCircle,
  },
  {
    value: 'enforcement_action',
    label: 'Enforcement Action',
    description:
      'A warning or enforcement action was placed on your account',
    icon: IconAlertTriangle,
  },
  {
    value: 'other',
    label: 'Other',
    description: 'Something else not covered above',
    icon: IconHelpCircle,
  },
];

export default function AppealsPage() {
  const [selectedType, setSelectedType] = useState<AppealType | ''>('');
  const [isPending, startTransition] = useTransition();
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const result = await submitAppeal(formData);
      if (result.success) {
        setSuccess(`Appeal ${result.appealNumber} submitted successfully.`);
      } else {
        setError(result.error || 'Failed to submit appeal.');
      }
    });
  };

  // ── Success ──
  if (success) {
    return (
      <div className="appeal-success-wrapper">
        <div className="appeal-success-card">
          <div className="appeal-success-icon-wrapper">
            <IconCheckCircle size={40} className="appeal-success-icon" />
          </div>
          <h2 className="appeal-success-title">Appeal Submitted</h2>
          <p className="appeal-success-text">{success}</p>
          <p className="appeal-success-hint">
            Our team will review your appeal and respond within 3 to 5 business
            days.
          </p>
          <Link href="/help" className="appeal-success-btn">
            Back to Help Center
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="appeals-page">
      <div className="appeals-container">
        {/* Header */}
        <div className="appeals-header">
          <Link href="/help" className="appeals-back-link">
            <IconArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="appeals-title">Submit an Appeal</h1>
            <p className="appeals-subtitle">
              Challenge a decision made on your account
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="appeals-form">
          <input type="hidden" name="appeal_type" value={selectedType} />

          {/* Appeal Type Selection */}
          <div className="appeals-type-section">
            <h3 className="appeals-type-title">
              What would you like to appeal?
            </h3>
            <div className="appeals-type-list">
              {APPEAL_TYPES.map(({ value, label, description, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setSelectedType(value)}
                  className={`appeals-type-card ${
                    selectedType === value ? 'appeals-type-selected' : ''
                  }`}
                >
                  <div className="appeals-type-card-icon">
                    <Icon size={22} />
                  </div>
                  <div className="appeals-type-card-text">
                    <p className="appeals-type-card-label">{label}</p>
                    <p className="appeals-type-card-desc">{description}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Form Fields */}
          {selectedType && (
            <>
              <div className="appeals-form-section">
                <div className="appeals-field">
                  <label className="appeals-label">
                    Reference ID
                    <span className="appeals-optional">
                      (listing ID, order ID, etc.)
                    </span>
                  </label>
                  <input
                    type="text"
                    name="reference_id"
                    placeholder="Optional reference number"
                    className="appeals-input"
                  />
                </div>
                <div className="appeals-field">
                  <label className="appeals-label">
                    Subject <span className="appeals-required">*</span>
                  </label>
                  <input
                    type="text"
                    name="subject"
                    required
                    placeholder="Brief summary of your appeal"
                    className="appeals-input"
                  />
                </div>
                <div className="appeals-field">
                  <label className="appeals-label">
                    Explanation <span className="appeals-required">*</span>
                  </label>
                  <textarea
                    name="description"
                    required
                    rows={6}
                    placeholder="Explain why you believe this decision was incorrect and provide any supporting information or evidence."
                    className="appeals-textarea"
                  />
                </div>
              </div>

              {error && (
                <div className="appeals-error">
                  <IconAlertTriangle size={16} />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isPending}
                className="appeals-submit-btn"
              >
                {isPending ? (
                  <IconLoader size={20} className="appeals-spinner" />
                ) : (
                  <IconMegaphone size={20} />
                )}
                {isPending ? 'Submitting...' : 'Submit Appeal'}
              </button>
            </>
          )}
        </form>
      </div>
    </div>
  );
}