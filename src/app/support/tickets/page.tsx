// src/app/support/tickets/page.tsx

import '@/styles/help/tickets-page.css';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { getUserTickets } from '@/lib/help/queries';
import TicketList from '@/components/help/TicketList';

export const metadata = { title: 'My Support Tickets | Loemart' };

export default async function TicketsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const tickets = await getUserTickets(user.id);

  return <TicketList tickets={tickets} />;
}