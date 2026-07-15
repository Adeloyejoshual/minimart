// src/types/help.ts

export type TicketStatus =
  | 'open'
  | 'waiting_for_customer'
  | 'in_progress'
  | 'escalated'
  | 'resolved'
  | 'closed';

export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';

export type ReportType =
  | 'scam'
  | 'fraud'
  | 'fake_product'
  | 'fake_seller'
  | 'fake_buyer'
  | 'offensive_content'
  | 'copyright_violation'
  | 'payment_issue'
  | 'delivery_issue'
  | 'technical_bug'
  | 'other';

export type DisputeType =
  | 'wrong_item'
  | 'item_not_received'
  | 'damaged_item'
  | 'refund_request'
  | 'delivery_dispute'
  | 'other';

export type AppealType =
  | 'suspended_account'
  | 'removed_listing'
  | 'rejected_listing'
  | 'enforcement_action'
  | 'other';

export type FeedbackType =
  | 'support_rating'
  | 'feature_suggestion'
  | 'bug_report'
  | 'general';

export interface FaqCategory {
  id: string;
  name: string;
  slug: string;
  icon: string;
  description: string | null;
  display_order: number;
  is_active: boolean;
  article_count?: number | { count: number }[];
}

export interface FaqArticle {
  id: string;
  category_id: string;
  title: string;
  content: string;
  slug: string;
  tags: string[];
  is_published: boolean;
  view_count: number;
  helpful_count: number;
  not_helpful_count: number;
  category?: { name: string; slug: string };
  created_at: string;
  updated_at: string;
}

export interface SupportTicket {
  id: string;
  ticket_number: string;
  user_id: string;
  assigned_to: string | null;
  category: string;
  subject: string;
  description: string;
  priority: TicketPriority;
  status: TicketStatus;
  escalated_at: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  reopen_deadline: string | null;
  satisfaction_rating: number | null;
  satisfaction_comment: string | null;
  messages?: TicketMessage[];
  attachments?: TicketAttachment[];
  assigned_agent?: { full_name: string; avatar_url: string | null } | null;
  user?: { full_name: string; email: string; avatar_url: string | null } | null;
  created_at: string;
  updated_at: string;
}

export interface TicketMessage {
  id: string;
  ticket_id: string;
  sender_id: string;
  message: string;
  is_internal_note: boolean;
  is_system_message: boolean;
  sender?: { full_name: string; avatar_url: string | null };
  attachments?: TicketAttachment[];
  created_at: string;
}

export interface TicketAttachment {
  id: string;
  ticket_id: string | null;
  message_id: string | null;
  uploaded_by: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  created_at: string;
}

export interface Dispute {
  id: string;
  dispute_number: string;
  order_id: string;
  buyer_id: string;
  seller_id: string;
  dispute_type: DisputeType;
  subject: string;
  description: string;
  evidence_urls: string[];
  status: string;
  resolution: string | null;
  resolution_notes: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  deadline: string | null;
  messages?: DisputeMessage[];
  created_at: string;
  updated_at: string;
}

export interface DisputeMessage {
  id: string;
  dispute_id: string;
  sender_id: string;
  message: string;
  attachments: string[];
  is_internal: boolean;
  sender?: { full_name: string; avatar_url: string | null };
  created_at: string;
}

export interface Appeal {
  id: string;
  appeal_number: string;
  user_id: string;
  appeal_type: AppealType;
  subject: string;
  description: string;
  reference_id: string | null;
  evidence_urls: string[];
  status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  decision_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Report {
  id: string;
  report_number: string;
  reporter_id: string;
  report_type: ReportType;
  subject: string;
  description: string;
  reported_user_id: string | null;
  reported_listing_id: string | null;
  reported_order_id: string | null;
  evidence_urls: string[];
  status: string;
  resolution_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SupportFeedback {
  id: string;
  user_id: string | null;
  ticket_id: string | null;
  feedback_type: FeedbackType;
  rating: number | null;
  comment: string | null;
  suggestion: string | null;
  is_reviewed: boolean;
  created_at: string;
}

export interface SupportNotification {
  id: string;
  user_id: string;
  notification_type: string;
  title: string;
  message: string;
  reference_id: string | null;
  reference_type: string | null;
  is_read: boolean;
  created_at: string;
}

export interface SupportAnalytics {
  total: number;
  open: number;
  resolved: number;
  closed: number;
  escalated: number;
  avgRating: string;
  avgResponseTime: string;
  avgResolutionTime: string;
}