// src/utils/apiFetch.js

export class ApiError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.name   = "ApiError";
    this.status = status;
  }
}

/**
 * Wraps fetch() with:
 * - Readable errors for HTML responses (cold-start, nginx 502, etc.)
 * - ApiError for non-2xx using the server's own message field
 * - Clean network-failure messages (offline / CORS)
 * - Request timeout support via options.timeoutMs
 */
export const apiFetch = async (url, options = {}) => {
  const { timeoutMs, ...fetchOptions } = options;

  /* ── Optional timeout ── */
  let controller = null;
  let timeoutId  = null;

  if (timeoutMs > 0) {
    controller = new AbortController();
    timeoutId  = setTimeout(() => controller.abort(), timeoutMs);

    // Merge with any caller-supplied signal
    if (fetchOptions.signal) {
      const callerSignal = fetchOptions.signal;
      callerSignal.addEventListener("abort", () => controller.abort());
    }
    fetchOptions.signal = controller.signal;
  }

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

  /* ── Expect JSON ── */
  const contentType = res.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    const preview = await res.text().then((t) => t.slice(0, 200)).catch(() => "");
    console.error(`[apiFetch] Non-JSON from ${url} (${res.status}):`, preview);

    throw new ApiError(
      res.status === 502 || res.status === 503
        ? "Server is starting up — please try again in a moment."
        : res.status === 401
        ? "Session expired — please log in again."
        : `Unexpected server response (HTTP ${res.status}). Please try again.`,
      res.status
    );
  }

  const data = await res.json().catch(() => {
    throw new ApiError("Server returned invalid data. Please try again.", res.status);
  });

  if (!res.ok) {
    throw new ApiError(
      data.message ?? data.error ?? `Request failed (HTTP ${res.status})`,
      res.status
    );
  }

  return data;
};