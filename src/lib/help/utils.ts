// src/lib/help/utils.ts

export function generateNumber(prefix: string): string {
  const timestamp = Date.now().toString().slice(-8);
  const random = Math.floor(Math.random() * 9000 + 1000);
  return `${prefix}-${timestamp}-${random}`;
}

export function formatTicketStatus(status: string): string {
  return status
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function getStatusColor(status: string): string {
  const map: Record<string, string> = {
    open: 'blue',
    waiting_for_customer: 'yellow',
    in_progress: 'purple',
    escalated: 'red',
    resolved: 'green',
    closed: 'gray',
  };
  return map[status] || 'gray';
}

export function getPriorityWeight(priority: string): number {
  const weights: Record<string, number> = { urgent: 4, high: 3, medium: 2, low: 1 };
  return weights[priority] || 0;
}

export function timeAgo(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function isReopenAllowed(ticket: {
  status: string;
  reopen_deadline: string | null;
}): boolean {
  if (ticket.status !== 'closed') return false;
  if (!ticket.reopen_deadline) return false;
  return new Date(ticket.reopen_deadline) > new Date();
}

export function validateFileUpload(file: File): {
  valid: boolean;
  error?: string;
} {
  const MAX_SIZE = 10 * 1024 * 1024;
  const ALLOWED_TYPES = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ];

  if (file.size > MAX_SIZE) {
    return { valid: false, error: `File "${file.name}" exceeds 10MB limit.` };
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { valid: false, error: `File type "${file.type}" is not supported.` };
  }
  return { valid: true };
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength).trim() + '...';
}

export function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, '');
}

export function getArticleCount(
  count: number | { count: number }[] | undefined
): number {
  if (count === undefined) return 0;
  if (typeof count === 'number') return count;
  if (Array.isArray(count) && count.length > 0) return count[0].count;
  return 0;
}