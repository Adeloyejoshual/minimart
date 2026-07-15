// src/app/support/feedback/page.tsx
'use client';

import '@/styles/help/feedback.css';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { submitFeedback } from '@/lib/help/actions';
import {
  IconStar,
  IconStarFilled,
  IconArrowLeft,
  IconSend,
  IconCheckCircle,
  IconLoader,
  IconMessageSquare,
  IconLightbulb,
  IconBug,
} from '@/components/help/icons/HelpIcons';

const FEEDBACK_TYPES: {
  value: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}[] = [
  {
    value: 'support_rating',
    label: 'Rate Support',
    description: 'Rate your support experience',
    icon: IconStar,
  },
  {
    value: 'feature_suggestion',
    label: 'Suggest Feature',
    description: 'Suggest a new feature',
    icon: IconLightbulb,
  },
  {
    value: 'bug_report',
    label: 'Report Bug',
    description: 'Report an app or website bug',
    icon: IconBug,
  },
  {
    value: 'general',
    label: 'General Feedback',
    description: 'Share general feedback',
    icon: IconMessageSquare,
  },
];

const RATING_LABELS = ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'];

export default function FeedbackPage() {
  const [feedbackType, setFeedbackType] = useState('support_rating');
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [isPending, startTransition] = useTransition();
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.set('feedback_type', feedbackType);
    if (rating > 0) formData.set('rating', rating.toString());

    startTransition(async () => {
      const result = await submitFeedback(formData);
      if (result.success) setSuccess(true);
      else setError(result.error || 'Failed to submit feedback.');
    });
  };

  // ── Success ──
  if (success) {
    return (
      <div className="feedback-success-wrapper">
        <div className="feedback-success-card">
          <div className="feedback-success-icon-wrapper">
            <IconCheckCircle size={40} className="feedback-success-icon" />
          </div>
          <h2 className="feedback-success-title">Thank You</h2>
          <p className="feedback-success-text">
            Your feedback helps us improve Loemart for everyone.
          </p>
          <Link href="/help" className="feedback-success-btn">
            Back to Help Center
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="feedback-page">
      <div className="feedback-container">
        {/* Header */}
        <div className="feedback-header">
          <Link href="/help" className="feedback-back-link">
            <IconArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="feedback-title">Share Feedback</h1>
            <p className="feedback-subtitle">Help us improve Loemart</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="feedback-form">
          {/* Feedback Type */}
          <div className="feedback-type-section">
            <h3 className="feedback-type-title">Feedback Type</h3>
            <div className="feedback-type-grid">
              {FEEDBACK_TYPES.map(
                ({ value, label, description, icon: Icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setFeedbackType(value)}
                    className={`feedback-type-card ${
                      feedbackType === value ? 'feedback-type-selected' : ''
                    }`}
                  >
                    <Icon
                      size={22}
                      className="feedback-type-card-icon"
                    />
                    <p className="feedback-type-card-label">{label}</p>
                    <p className="feedback-type-card-desc">{description}</p>
                  </button>
                )
              )}
            </div>
          </div>

          {/* Star Rating */}
          {feedbackType === 'support_rating' && (
            <div className="feedback-rating-section">
              <h3 className="feedback-rating-title">Rate Your Experience</h3>
              <p className="feedback-rating-subtitle">
                How satisfied are you with our support?
              </p>

              <div className="feedback-stars">
                {[1, 2, 3, 4, 5].map((star) => {
                  const isActive = star <= (hoverRating || rating);
                  return (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(0)}
                      className={`feedback-star-btn ${
                        isActive ? 'feedback-star-active' : ''
                      }`}
                      aria-label={`Rate ${star} stars`}
                    >
                      {isActive ? (
                        <IconStarFilled size={40} />
                      ) : (
                        <IconStar size={40} />
                      )}
                    </button>
                  );
                })}
              </div>

              {rating > 0 && (
                <p className="feedback-rating-label">
                  {RATING_LABELS[rating]}
                </p>
              )}
            </div>
          )}

          {/* Comment / Suggestion */}
          <div className="feedback-comment-section">
            <div className="feedback-field">
              <label className="feedback-label">
                {feedbackType === 'feature_suggestion'
                  ? 'Describe the feature'
                  : feedbackType === 'bug_report'
                  ? 'Describe the bug'
                  : 'Comments'}
              </label>

              {feedbackType === 'feature_suggestion' ? (
                <textarea
                  name="suggestion"
                  required
                  rows={5}
                  placeholder="What feature would you like to see? How would it help you?"
                  className="feedback-textarea"
                />
              ) : (
                <textarea
                  name="comment"
                  rows={5}
                  placeholder={
                    feedbackType === 'bug_report'
                      ? 'What happened? Steps to reproduce the issue, device, browser...'
                      : 'Share your thoughts...'
                  }
                  className="feedback-textarea"
                />
              )}
            </div>
          </div>

          {error && (
            <div className="feedback-error">
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="feedback-submit-btn"
          >
            {isPending ? (
              <IconLoader size={20} className="feedback-spinner" />
            ) : (
              <IconSend size={20} />
            )}
            {isPending ? 'Submitting...' : 'Submit Feedback'}
          </button>
        </form>
      </div>
    </div>
  );
}