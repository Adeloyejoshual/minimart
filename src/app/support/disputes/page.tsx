// src/app/support/disputes/page.tsx
'use client';

import '@/styles/help/dispute-center.css';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { submitDispute } from '@/lib/help/actions';
import type { DisputeType } from '@/types/help';
import {
  IconScale,
  IconCheckCircle,
  IconArrowLeft,
  IconAlertTriangle,
  IconLoader,
  IconClock,
  IconTruck,
  IconRefresh,
  IconCreditCard,
  IconShoppingCart,
  IconHelpCircle,
} from '@/components/help/icons/HelpIcons';

const DISPUTE_TYPES: {
  value: DisputeType;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}[] = [
  { value: 'wrong_item', label: 'Wrong Item Received', icon: IconShoppingCart },
  { value: 'item_not_received', label: 'Item Not Received', icon: IconTruck },
  { value: 'damaged_item', label: 'Damaged Item', icon: IconAlertTriangle },
  { value: 'refund_request', label: 'Refund Request', icon: IconCreditCard },
  { value: 'delivery_dispute', label: 'Delivery Dispute', icon: IconTruck },
  { value: 'other', label: 'Other Issue', icon: IconHelpCircle },
];

export default function DisputeCenterPage() {
  const [showForm, setShowForm] = useState(false);
  const [disputeType, setDisputeType] = useState<DisputeType | ''>('');
  const [isPending, startTransition] = useTransition();
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const result = await submitDispute(formData);
      if (result.success) {
        setSuccess(
          `Dispute ${result.disputeNumber} filed. We will review and respond within 48 hours.`
        );
      } else {
        setError(result.error || 'Failed to submit dispute.');
      }
    });
  };

  // ── Success State ──
  if (success) {
    return (
      <div className="dispute-success-wrapper">
        <div className="dispute-success-card">
          <div className="dispute-success-icon-wrapper">
            <IconCheckCircle size={40} className="dispute-success-icon" />
          </div>
          <h2 className="dispute-success-title">Dispute Filed</h2>
          <p className="dispute-success-text">{success}</p>
          <div className="dispute-success-info">
            <IconClock size={16} />
            <span>Both parties will have 14 days to resolve the dispute</span>
          </div>
          <Link href="/help" className="dispute-success-btn">
            Back to Help Center
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="dispute-center-page">
      <div className="dispute-center-container">
        {/* Header */}
        <div className="dispute-header">
          <Link href="/help" className="dispute-back-link">
            <IconArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="dispute-title">Dispute Center</h1>
            <p className="dispute-subtitle">
              Resolve buyer-seller disagreements
            </p>
          </div>
        </div>

        {!showForm ? (
          <>
            {/* Info Banner */}
            <div className="dispute-info-banner">
              <IconAlertTriangle size={20} className="dispute-info-icon" />
              <div>
                <p className="dispute-info-title">Before filing a dispute</p>
                <p className="dispute-info-text">
                  Please try to contact the seller directly first. Disputes
                  should be filed only if you cannot resolve the issue within 48
                  hours.
                </p>
              </div>
            </div>

            {/* Dispute Types Info */}
            <div className="dispute-types-section">
              <h3 className="dispute-types-title">Common Dispute Types</h3>
              <div className="dispute-types-list">
                {DISPUTE_TYPES.map(({ value, label, icon: Icon }) => (
                  <div key={value} className="dispute-type-info-item">
                    <div className="dispute-type-info-icon">
                      <Icon size={20} />
                    </div>
                    <span className="dispute-type-info-label">{label}</span>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={() => setShowForm(true)}
              className="dispute-file-btn"
            >
              <IconScale size={20} />
              File a Dispute
            </button>
          </>
        ) : (
          <form onSubmit={handleSubmit} className="dispute-form">
            {/* Dispute Type Selection */}
            <div className="dispute-form-section">
              <h3 className="dispute-form-section-title">Dispute Type</h3>
              <div className="dispute-type-grid">
                {DISPUTE_TYPES.map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setDisputeType(value)}
                    className={`dispute-type-card ${
                      disputeType === value ? 'dispute-type-selected' : ''
                    }`}
                  >
                    <div className="dispute-type-card-icon">
                      <Icon size={22} />
                    </div>
                    <p className="dispute-type-card-label">{label}</p>
                  </button>
                ))}
              </div>
              <input type="hidden" name="dispute_type" value={disputeType} />
            </div>

            {disputeType && (
              <div className="dispute-form-section">
                <div className="dispute-field">
                  <label className="dispute-label">
                    Order ID <span className="dispute-required">*</span>
                  </label>
                  <input
                    type="text"
                    name="order_id"
                    required
                    placeholder="Enter your order ID"
                    className="dispute-input"
                  />
                </div>
                <div className="dispute-field">
                  <label className="dispute-label">
                    Seller ID <span className="dispute-required">*</span>
                  </label>
                  <input
                    type="text"
                    name="seller_id"
                    required
                    placeholder="Enter seller ID"
                    className="dispute-input"
                  />
                </div>
                <div className="dispute-field">
                  <label className="dispute-label">
                    Subject <span className="dispute-required">*</span>
                  </label>
                  <input
                    type="text"
                    name="subject"
                    required
                    placeholder="Brief summary"
                    className="dispute-input"
                  />
                </div>
                <div className="dispute-field">
                  <label className="dispute-label">
                    Detailed Description{' '}
                    <span className="dispute-required">*</span>
                  </label>
                  <textarea
                    name="description"
                    required
                    rows={5}
                    placeholder="Describe the issue clearly. Include dates, amounts, and any previous communication with the seller."
                    className="dispute-textarea"
                  />
                </div>
              </div>
            )}

            {error && (
              <div className="dispute-error">
                <IconAlertTriangle size={16} />
                <span>{error}</span>
              </div>
            )}

            <div className="dispute-form-actions">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="dispute-cancel-btn"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={isPending || !disputeType}
                className="dispute-submit-btn"
              >
                {isPending ? (
                  <IconLoader size={16} className="dispute-spinner" />
                ) : (
                  <IconScale size={16} />
                )}
                {isPending ? 'Submitting...' : 'File Dispute'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}