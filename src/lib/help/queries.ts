// src/lib/help/queries.ts

import { createClient } from '@/lib/supabase/server';
import type { FaqCategory, FaqArticle, SupportTicket, SupportAnalytics } from '@/types/help';

export async function getFaqCategories(): Promise<FaqCategory[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('faq_categories')
    .select('*, article_count:faq_articles(count)')
    .eq('is_active', true)
    .order('display_order');
  return data || [];
}

export async function getFaqArticlesByCategory(slug: string): Promise<FaqArticle[]> {
  const supabase = await createClient();

  const { data: category } = await supabase
    .from('faq_categories')
    .select('id, name, slug')
    .eq('slug', slug)
    .single();

  if (!category) return [];

  const { data } = await supabase
    .from('faq_articles')
    .select('*, category:faq_categories(name, slug)')
    .eq('category_id', category.id)
    .eq('is_published', true)
    .order('display_order');

  return data || [];
}

export async function getArticleBySlug(slug: string): Promise<FaqArticle | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('faq_articles')
    .select('*, category:faq_categories(name, slug)')
    .eq('slug', slug)
    .eq('is_published', true)
    .single();
  return data;
}

export async function searchFaqArticles(query: string): Promise<FaqArticle[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('faq_articles')
    .select('*, category:faq_categories(name, slug)')
    .or(`title.ilike.%${query}%,content.ilike.%${query}%`)
    .eq('is_published', true)
    .limit(20);
  return data || [];
}

export async function getUserTickets(userId: string): Promise<SupportTicket[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('support_tickets')
    .select('*, assigned_agent:users!assigned_to(full_name, avatar_url)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  return data || [];
}

export async function getTicketDetail(ticketId: string): Promise<SupportTicket | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('support_tickets')
    .select(
      `*,
       messages:ticket_messages(
         *,
         sender:users(full_name, avatar_url),
         attachments:ticket_attachments(*)
       ),
       assigned_agent:users!assigned_to(full_name, avatar_url)`
    )
    .eq('id', ticketId)
    .order('created_at', { foreignTable: 'ticket_messages', ascending: true })
    .single();
  return data;
}

export async function getUserDisputes(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('disputes')
    .select('*')
    .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
    .order('created_at', { ascending: false });
  return data || [];
}

export async function getUserAppeals(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('appeals')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  return data || [];
}

export async function adminGetAllTickets(filters?: {
  status?: string;
  priority?: string;
  search?: string;
  page?: number;
}) {
  const supabase = await createClient();
  let query = supabase
    .from('support_tickets')
    .select(
      `*,
       user:users!user_id(full_name, email, avatar_url),
       assigned_agent:users!assigned_to(full_name, avatar_url)`,
      { count: 'exact' }
    );

  if (filters?.status) query = query.eq('status', filters.status);
  if (filters?.priority) query = query.eq('priority', filters.priority);
  if (filters?.search) {
    query = query.or(
      `ticket_number.ilike.%${filters.search}%,subject.ilike.%${filters.search}%`
    );
  }

  const page = filters?.page || 1;
  const pageSize = 20;
  query = query
    .order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  const { data, count } = await query;
  return { data: data || [], count: count || 0 };
}

export async function getSupportAnalytics(): Promise<SupportAnalytics> {
  const supabase = await createClient();

  const [total, open, resolved, closed, escalated, ratings] = await Promise.all([
    supabase.from('support_tickets').select('*', { count: 'exact', head: true }),
    supabase
      .from('support_tickets')
      .select('*', { count: 'exact', head: true })
      .in('status', ['open', 'waiting_for_customer']),
    supabase
      .from('support_tickets')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'resolved'),
    supabase
      .from('support_tickets')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'closed'),
    supabase
      .from('support_tickets')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'escalated'),
    supabase
      .from('support_tickets')
      .select('satisfaction_rating')
      .not('satisfaction_rating', 'is', null),
  ]);

  const ratingData = ratings.data || [];
  const avgRating =
    ratingData.length > 0
      ? (
          ratingData.reduce(
            (sum: number, r: { satisfaction_rating: number }) =>
              sum + r.satisfaction_rating,
            0
          ) / ratingData.length
        ).toFixed(1)
      : '0.0';

  return {
    total: total.count || 0,
    open: open.count || 0,
    resolved: resolved.count || 0,
    closed: closed.count || 0,
    escalated: escalated.count || 0,
    avgRating,
    avgResponseTime: '--',
    avgResolutionTime: '--',
  };
}