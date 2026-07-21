// src/utils/apiFetch.js

export class ApiError extends Error {
  /**
   * @param {string} message  - Human-readable error message
   * @param {number} status   - HTTP status code (0 = network failure)
   * @param {object|null} data - Full parsed response body from server
   */
  constructor(message, status = 0, data = null) {
    super(message);
    this.name   = "ApiError";
    this.status = status;
    this.data   = data;
  }
}

/**
 * Wraps fetch() with:
 * - Authorization header auto-injected from localStorage
 * - Readable errors for HTML responses (cold-start, nginx 502, etc.)
 * - ApiError for non-2xx with full server body stored in err.data
 * - Clean network-failure messages (offline / CORS / timeout)
 * - Request timeout support via options.timeoutMs
 */
export const apiFetch = async (url, options = {}) => {
  const { timeoutMs, ...fetchOptions } = options;

  /* ── Token ── */
  const token =
    localStorage.getItem("marketplace_token") ||
    localStorage.getItem("token");

  /* ── Merge headers — caller headers win over defaults ── */
  fetchOptions.headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...fetchOptions.headers,
  };

  /* ── Optional timeout ── */
  let controller = null;
  let timeoutId  = null;

  if (timeoutMs > 0) {
    controller = new AbortController();
    timeoutId  = setTimeout(() => controller.abort(), timeoutMs);

    if (fetchOptions.signal) {
      fetchOptions.signal.addEventListener("abort", () => controller.abort());
    }
    fetchOptions.signal = controller.signal;
  }

  /* ── Fetch ── */
  let res;
  try {
    res = await fetch(url, fetchOptions);
  } catch (err) {
    if (err.name === "AbortError") {
      throw new ApiError(
        "Request timed out — check your connection and try again.",
        0
      );
    }
    throw new ApiError(
      "Cannot reach the server. Check your connection and try again.",
      0
    );
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }

  /* ── Guard: must be JSON ── */
  const contentType = res.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    const preview = await res.text().then((t) => t.slice(0, 200)).catch(() => "");
    console.error(`[apiFetch] Non-JSON response from ${url} (${res.status}):`, preview);

    throw new ApiError(
      res.status === 502 || res.status === 503
        ? "Server is starting up — please try again in a moment."
        : res.status === 504
        ? "Request timed out on the server — please try again."
        : res.status === 401
        ? "Session expired — please log in again."
        : res.status === 413
        ? "Request too large — reduce image sizes and try again."
        : `Unexpected server response (HTTP ${res.status}). Please try again.`,
      res.status
    );
  }

  /* ── Parse body ── */
  const data = await res.json().catch(() => {
    throw new ApiError(
      "Server returned invalid data. Please try again.",
      res.status
    );
  });

  /* ── Non-2xx → throw with full body stored in err.data ── */
  if (!res.ok) {
    throw new ApiError(
      data.message ?? data.error ?? `Request failed (HTTP ${res.status})`,
      res.status,
      data   // full body — callers read err.data.reason, err.data.blocked_images etc.
    );
  }

  return data;
};