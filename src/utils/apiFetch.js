// src/utils/apiFetch.js
export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

/**
 * Fetch wrapper that:
 *  - throws a readable error when the server returns HTML instead of JSON
 *  - throws ApiError for non-2xx responses with the server's message
 */
export const apiFetch = async (url, options = {}) => {
  let res;

  try {
    res = await fetch(url, options);
  } catch (networkErr) {
    // fetch() itself threw — no connection, CORS preflight blocked, etc.
    throw new ApiError(
      "Cannot reach the server. Check your connection and try again.",
      0
    );
  }

  const contentType = res.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    // Server returned HTML — almost always an unhandled Express error,
    // a reverse-proxy 502/504, or a Render cold-start splash page.
    const preview = await res.text().then((t) => t.slice(0, 200));
    console.error("Non-JSON response:", preview);
    throw new ApiError(
      `Server error (${res.status}) — received HTML instead of JSON. The server may be starting up, try again in a moment.`,
      res.status
    );
  }

  const data = await res.json();

  if (!res.ok) {
    throw new ApiError(data.message ?? data.error ?? `HTTP ${res.status}`, res.status);
  }

  return data;
};