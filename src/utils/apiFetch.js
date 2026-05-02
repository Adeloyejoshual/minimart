/**
 * apiFetch.js
 *
 * Drop-in replacement for fetch() that:
 *  1. Throws a readable ApiError when the server returns HTML instead of JSON
 *     (Render cold-start splash, Express default error page, nginx 502, etc.)
 *  2. Throws ApiError for non-2xx responses using the server's own message
 *  3. Handles total network failures (offline, CORS block) with a clean message
 */

export class ApiError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.name   = "ApiError";
    this.status = status;
  }
}

export const apiFetch = async (url, options = {}) => {
  let res;

  try {
    res = await fetch(url, options);
  } catch (networkErr) {
    throw new ApiError(
      "Cannot reach the server. Check your connection and try again.",
      0
    );
  }

  const contentType = res.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    const preview = await res.text().then((t) => t.slice(0, 200));
    console.error(`Non-JSON response from ${url}:`, preview);
    throw new ApiError(
      res.status === 502 || res.status === 503
        ? "Server is starting up — please try again in a moment."
        : `Unexpected server response (HTTP ${res.status}). Please try again.`,
      res.status
    );
  }

  const data = await res.json();

  if (!res.ok) {
    throw new ApiError(
      data.message ?? data.error ?? `Request failed (HTTP ${res.status})`,
      res.status
    );
  }

  return data;
};
