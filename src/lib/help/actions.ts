// src/lib/help/actions.ts
'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { generateNumber } from './utils';
import type { TicketPriority, ReportType, DisputeType, AppealType } from '@/types/help';

// ─── Submit Support Ticket ───────────────────────────────────────────────────
export async function submitSupportTicket(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: 'Authentication required. Please sign in.' };

  const category = formData.get('category') as string;
  const subject = formData.get('subject') as string;
  const description = formData.get('description') as string;
  const priority = (formData.get('priority') as TicketPriority) || 'medium';

  if (!category || !subject || !description) {
    return { error: 'Please fill in all required fields.' };
  }

  const ticketNumber = generateNumber('TKT');

  const { data: ticket, error } = await supabase
    .from('support_tickets')
    .insert({
      ticket_number: ticketNumber,
      user_id: user.id,
      category,
      subject,
      description,
      priority,
    })
    .select()
    .single();

  if (error) return { error: error.message };

  await Promise.all([
    supabase.from('ticket_activity_logs').insert({
      ticket_id: ticket.id,
      performed_by: user.id,
      action: 'ticket_created',
      description: `Ticket ${ticketNumber} created with ${priority} priority`,
    }),
    supabase.from('ticket_messages').insert({
      ticket_id: ticket.id,
      sender_id: user.id,
      message: description,
      is_system_message: false,
    }),
    supabase.from('support_notifications').insert({
      user_id: user.id,
      notification_type: 'ticket_created',
      title: 'Support Ticket Created',
      message: `Your ticket ${ticketNumber} has been submitted successfully. Our team will respond shortly.`,
      reference_id: ticket.id,
      reference_type: 'ticket',
    }),
  ]);

  revalidatePath('/support/tickets');
  return { success: true, ticketNumber, ticketId: ticket.id };
}

// ─── Reply to Ticket ─────────────────────────────────────────────────────────
export async function replyToTicket(
  ticketId: string,
  message: string,
  attachmentUrls: string[] = []
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: 'Authentication required.' };
  if (!message.trim()) return { error: 'Message cannot be empty.' };

  const { data: msg, error } = await supabase
    .from('ticket_messages')
    .insert({
      ticket_id: ticketId,
      sender_id: user.id,
      message: message.trim(),
    })
    .select()
    .single();

  if (error) return { error: error.message };

  if (attachmentUrls.length > 0) {
    await supabase.from('ticket_attachments').insert(
      attachmentUrls.map((url) => ({
        ticket_id: ticketId,
        message_id: msg.id,
        uploaded_by: user.id,
        file_name: url.split('/').pop() || 'attachment',
        file_url: url,
        file_type: 'document',
        file_size: 0,
      }))
    );
  }

  await supabase
    .from('support_tickets')
    .update({ status: 'open', updated_at: new Date().toISOString() })
    .eq('id', ticketId)
    .eq('status', 'waiting_for_customer');

  await supabase.from('ticket_activity_logs').insert({
    ticket_id: ticketId,
    performed_by: user.id,
    action: 'message_sent',
    description: 'User replied to ticket',
  });

  revalidatePath(`/support/tickets/${ticketId}`);
  return { success: true };
}

// ─── Close Ticket ────────────────────────────────────────────────────────────
export async function closeTicket(ticketId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: 'Authentication required.' };

  const reopenDeadline = new Date();
  reopenDeadline.setDate(reopenDeadline.getDate() + 7);

  const { error } = await supabase
    .from('support_tickets')
    .update({
      status: 'closed',
      closed_at: new Date().toISOString(),
      reopen_deadline: reopenDeadline.toISOString(),
    })
    .eq('id', ticketId)
    .eq('user_id', user.id);

  if (error) return { error: error.message };

  await supabase.from('ticket_activity_logs').insert({
    ticket_id: ticketId,
    performed_by: user.id,
    action: 'ticket_closed',
    old_value: 'open',
    new_value: 'closed',
    description: 'Ticket closed by user',
  });

  revalidatePath(`/support/tickets/${ticketId}`);
  revalidatePath('/support/tickets');
  return { success: true };
}

// ─── Reopen Ticket ───────────────────────────────────────────────────────────
export async function reopenTicket(ticketId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: 'Authentication required.' };

  const { data: ticket } = await supabase
    .from('support_tickets')
    .select('reopen_deadline, status')
    .eq('id', ticketId)
    .eq('user_id', user.id)
    .single();

  if (!ticket) return { error: 'Ticket not found.' };
  if (ticket.status !== 'closed') return { error: 'Ticket is not closed.' };
  if (ticket.reopen_deadline && new Date(ticket.reopen_deadline) < new Date()) {
    return { error: 'The reopen window has expired. Please create a new ticket.' };
  }

  const { error } = await supabase
    .from('support_tickets')
    .update({
      status: 'open',
      closed_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', ticketId);

  if (error) return { error: error.message };

  await supabase.from('ticket_activity_logs').insert({
    ticket_id: ticketId,
    performed_by: user.id,
    action: 'ticket_reopened',
    old_value: 'closed',
    new_value: 'open',
    description: 'Ticket reopened by user',
  });

  revalidatePath(`/support/tickets/${ticketId}`);
  revalidatePath('/support/tickets');
  return { success: true };
}

// ─── Submit Report ───────────────────────────────────────────────────────────
export async function submitReport(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: 'Authentication required.' };

  const reportType = formData.get('report_type') as ReportType;
  const subject = formData.get('subject') as string;
  const description = formData.get('description') as string;

  if (!reportType || !subject || !description) {
    return { error: 'Please fill in all required fields.' };
  }

  const reportNumber = generateNumber('RPT');
  const reportedUserId = formData.get('reported_user_id') as string;

  const { error } = await supabase.from('reports').insert({
    report_number: reportNumber,
    reporter_id: user.id,
    report_type: reportType,
    subject,
    description,
    reported_user_id: reportedUserId || null,
  });

  if (error) return { error: error.message };

  await supabase.from('support_notifications').insert({
    user_id: user.id,
    notification_type: 'report_submitted',
    title: 'Report Submitted',
    message: `Your report ${reportNumber} has been submitted. Our safety team will review it.`,
    reference_type: 'report',
  });

  return { success: true, reportNumber };
}

// ─── Submit Dispute ──────────────────────────────────────────────────────────
export async function submitDispute(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: 'Authentication required.' };

  const disputeType = formData.get('dispute_type') as DisputeType;
  const orderId = formData.get('order_id') as string;
  const sellerId = formData.get('seller_id') as string;
  const subject = formData.get('subject') as string;
  const description = formData.get('description') as string;

  if (!disputeType || !orderId || !sellerId || !subject || !description) {
    return { error: 'Please fill in all required fields.' };
  }

  const disputeNumber = generateNumber('DSP');
  const deadline = new Date();
  deadline.setDate(deadline.getDate() + 14);

  const { data: dispute, error } = await supabase
    .from('disputes')
    .insert({
      dispute_number: disputeNumber,
      order_id: orderId,
      buyer_id: user.id,
      seller_id: sellerId,
      dispute_type: disputeType,
      subject,
      description,
      deadline: deadline.toISOString(),
    })
    .select()
    .single();

  if (error) return { error: error.message };

  await Promise.all([
    supabase.from('support_notifications').insert({
      user_id: user.id,
      notification_type: 'dispute_created',
      title: 'Dispute Filed',
      message: `Your dispute ${disputeNumber} has been filed. Both parties have 14 days to resolve.`,
      reference_id: dispute.id,
      reference_type: 'dispute',
    }),
    supabase.from('support_notifications').insert({
      user_id: sellerId,
      notification_type: 'dispute_received',
      title: 'Dispute Filed Against You',
      message: `A dispute ${disputeNumber} has been filed regarding order ${orderId}. Please respond within 14 days.`,
      reference_id: dispute.id,
      reference_type: 'dispute',
    }),
  ]);

  return { success: true, disputeNumber, disputeId: dispute.id };
}

// ─── Submit Appeal ───────────────────────────────────────────────────────────
export async function submitAppeal(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: 'Authentication required.' };

  const appealType = formData.get('appeal_type') as AppealType;
  const subject = formData.get('subject') as string;
  const description = formData.get('description') as string;
  const referenceId = formData.get('reference_id') as string;

  if (!appealType || !subject || !description) {
    return { error: 'Please fill in all required fields.' };
  }

  const appealNumber = generateNumber('APL');

  const { error } = await supabase.from('appeals').insert({
    appeal_number: appealNumber,
    user_id: user.id,
    appeal_type: appealType,
    subject,
    description,
    reference_id: referenceId || null,
  });

  if (error) return { error: error.message };

  return { success: true, appealNumber };
}

// ─── Submit Feedback ─────────────────────────────────────────────────────────
export async function submitFeedback(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: 'Authentication required.' };

  const feedbackType = formData.get('feedback_type') as string;
  const ratingStr = formData.get('rating') as string;
  const comment = formData.get('comment') as string;
  const suggestion = formData.get('suggestion') as string;
  const ticketId = formData.get('ticket_id') as string;

  const { error } = await supabase.from('support_feedback').insert({
    user_id: user.id,
    ticket_id: ticketId || null,
    feedback_type: feedbackType,
    rating: ratingStr ? parseInt(ratingStr) : null,
    comment: comment || null,
    suggestion: suggestion || null,
  });

  if (error) return { error: error.message };

  return { success: true };
}

// ─── Mark Article Helpful ────────────────────────────────────────────────────
export async function markArticleHelpful(articleId: string, helpful: boolean) {
  const supabase = await createClient();

  const { data: article } = await supabase
    .from('faq_articles')
    .select('helpful_count, not_helpful_count')
    .eq('id', articleId)
    .single();

  if (!article) return { error: 'Article not found.' };

  const update = helpful
    ? { helpful_count: (article.helpful_count || 0) + 1 }
    : { not_helpful_count: (article.not_helpful_count || 0) + 1 };

  await supabase.from('faq_articles').update(update).eq('id', articleId);

  return { success: true };
}

// ─── Admin: Update Ticket Status ─────────────────────────────────────────────
export async function adminUpdateTicketStatus(
  ticketId: string,
  status: string,
  agentId: string
) {
  const supabase = await createClient();

  const { data: oldTicket } = await supabase
    .from('support_tickets')
    .select('status, user_id, ticket_number')
    .eq('id', ticketId)
    .single();

  if (!oldTicket) return { error: 'Ticket not found.' };

  const updates: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };

  if (status === 'resolved') updates.resolved_at = new Date().toISOString();
  if (status === 'closed') {
    updates.closed_at = new Date().toISOString();
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + 7);
    updates.reopen_deadline = deadline.toISOString();
  }
  if (status === 'escalated') updates.escalated_at = new Date().toISOString();

  const { error } = await supabase
    .from('support_tickets')
    .update(updates)
    .eq('id', ticketId);

  if (error) return { error: error.message };

  await Promise.all([
    supabase.from('ticket_activity_logs').insert({
      ticket_id: ticketId,
      performed_by: agentId,
      action: 'status_changed',
      old_value: oldTicket.status,
      new_value: status,
      description: `Status changed from ${oldTicket.status} to ${status}`,
    }),
    supabase.from('support_notifications').insert({
      user_id: oldTicket.user_id,
      notification_type: 'ticket_status_changed',
      title: 'Ticket Updated',
      message: `Your ticket ${oldTicket.ticket_number} status has been updated to ${status.replace(/_/g, ' ')}.`,
      reference_id: ticketId,
      reference_type: 'ticket',
    }),
  ]);

  revalidatePath(`/admin/support/tickets/${ticketId}`);
  revalidatePath('/admin/support');
  return { success: true };
}

// ─── Admin: Assign Ticket ────────────────────────────────────────────────────
export async function adminAssignTicket(ticketId: string, agentId: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from('support_tickets')
    .update({
      assigned_to: agentId,
      status: 'in_progress',
      updated_at: new Date().toISOString(),
    })
    .eq('id', ticketId);

  if (error) return { error: error.message };

  await supabase.from('ticket_activity_logs').insert({
    ticket_id: ticketId,
    performed_by: agentId,
    action: 'ticket_assigned',
    new_value: agentId,
    description: 'Ticket assigned to agent',
  });

  revalidatePath(`/admin/support/tickets/${ticketId}`);
  return { success: true };
}

// ─── Admin: Reply to Ticket ──────────────────────────────────────────────────
export async function adminReplyToTicket(
  ticketId: string,
  message: string,
  isInternal: boolean = false
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: 'Authentication required.' };
  if (!message.trim()) return { error: 'Message cannot be empty.' };

  const { error } = await supabase.from('ticket_messages').insert({
    ticket_id: ticketId,
    sender_id: user.id,
    message: message.trim(),
    is_internal_note: isInternal,
  });

  if (error) return { error: error.message };

  if (!isInternal) {
    await supabase
      .from('support_tickets')
      .update({
        status: 'waiting_for_customer',
        updated_at: new Date().toISOString(),
      })
      .eq('id', ticketId);

    const { data: ticket } = await supabase
      .from('support_tickets')
      .select('user_id, ticket_number')
      .eq('id', ticketId)
      .single();

    if (ticket) {
      await supabase.from('support_notifications').insert({
        user_id: ticket.user_id,
        notification_type: 'ticket_reply',
        title: 'New Reply on Your Ticket',
        message: `Support has replied to your ticket ${ticket.ticket_number}. Please review and respond.`,
        reference_id: ticketId,
        reference_type: 'ticket',
      });
    }
  }

  revalidatePath(`/admin/support/tickets/${ticketId}`);
  return { success: true };
}