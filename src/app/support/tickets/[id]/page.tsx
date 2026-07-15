// src/app/support/tickets/[id]/page.tsx

import '@/styles/help/ticket-detail-page.css';

import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import { getTicketDetail } from '@/lib/help/queries';
import TicketDetail from '@/components/help/TicketDetail';

export default async function TicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const ticket = await getTicketDetail(id);
  if (!ticket || ticket.user_id !== user.id) notFound();

  return <TicketDetail ticket={ticket} currentUserId={user.id} />;
}