// ════════════════════════════════════════════════════════════
// FILE: src/hooks/useUnreadCount.js
// ════════════════════════════════════════════════════════════

import { useQuery } from "@tanstack/react-query";
import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_BASE_URL || window.location.origin;
const API      = `${BASE_URL}/api`;

const getToken = () =>
  localStorage.getItem("marketplace_token") ||
  localStorage.getItem("token") ||
  null;

async function fetchUnreadCount() {
  const token = getToken();
  if (!token) return 0;

  try {
    const { data } = await axios.get(`${API}/conversations/unread-count`, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 8000,
    });
    return Number(data?.count ?? 0);
  } catch {
    return 0;
  }
}

export function useUnreadCount(options = {}) {
  return useQuery({
    queryKey:  ["unread-message-count"],
    queryFn:   fetchUnreadCount,
    staleTime: 30 * 1000,
    gcTime:    5 * 60 * 1000,
    refetchInterval: 30 * 1000,
    refetchIntervalInBackground: false,
    retry:   1,
    enabled: !!getToken(),
    ...options,
  });
}