// src/app/admin/support/page.tsx

import '@/styles/help/admin-dashboard.css';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { adminGetAllTickets, getSupportAnalytics } from '@/lib/help/queries';
import AdminTicketList from '@/components/help/admin/AdminTicketList';

export const metadata = { title: 'Support Dashboard | Loemart Admin' };

export default async function AdminSupportPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    priority?: string;
    search?: string;
    page?: string;
  }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const params = await searchParams;

  const [{ data: tickets, count }, analytics] = await Promise.all([
    adminGetAllTickets({
      status: params.status,
      priority: params.priority,
      search: params.search,
      page: params.page ? parseInt(params.page) : 1,
    }),
    getSupportAnalytics(),
  ]);

  return (
    <AdminTicketList
      tickets={tickets}
      total={count}
      analytics={analytics}
      currentUserId={user.id}
    />
  );
}