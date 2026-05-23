/* ─────────────────────────────────────────────
   src/services/adminApi.js

   Default export  → configured Axios instance
   (used as: adminApi.get(...) / adminApi.post(...) etc.)

   Named exports   → convenience wrappers for every
   admin endpoint across the whole app
───────────────────────────────────────────── */
import axios from "axios";

/* ── Base URL ────────────────────────────────────────────────────────── */
const BASE_URL =
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_BACKEND_URL ||
  "http://localhost:5000";

/* ── Axios instance ──────────────────────────────────────────────────── */
const adminApi = axios.create({
  baseURL : `${BASE_URL}/api/admin`,
  headers : { "Content-Type": "application/json" },
  timeout : 15_000,
});

/* ── Attach JWT automatically on every request ───────────────────────── */
adminApi.interceptors.request.use(
  (config) => {
    const token =
      localStorage.getItem("adminToken") ||
      localStorage.getItem("token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (err) => Promise.reject(err)
);

/* ── Global response error handler ──────────────────────────────────── */
adminApi.interceptors.response.use(
  (res) => res,
  (err) => {
    /* Token expired / invalid → clear storage and redirect to login */
    if (err.response?.status === 401) {
      localStorage.removeItem("adminToken");
      localStorage.removeItem("token");
      /* Only redirect if we are inside an admin route */
      if (window.location.pathname.startsWith("/admin")) {
        window.location.href = "/admin/login";
      }
    }
    return Promise.reject(err);
  }
);

/* ═══════════════════════════════════════════════════════════════════════
   Named helpers — mirrors every backend route in adminRoutes.js
   All return the raw Axios promise so callers can do:
     const { data } = await someHelper(...)
═══════════════════════════════════════════════════════════════════════ */

/* ── Auth ────────────────────────────────────────────────────────────── */
export const loginAdmin = (email, password) =>
  adminApi.post("/login", { email, password });

export const getAdminMe = () => adminApi.get("/me");

/* ── Dashboard stats ─────────────────────────────────────────────────── */
export const getStats = () => adminApi.get("/stats");

/* ── Users ───────────────────────────────────────────────────────────── */
export const getUsers  = ()   => adminApi.get("/users");
export const banUser   = (id) => adminApi.post(`/users/${id}/ban`);
export const unbanUser = (id) => adminApi.post(`/users/${id}/unban`);

/* ── Admins ──────────────────────────────────────────────────────────── */
export const getAdmins     = ()           => adminApi.get("/admins");
export const registerAdmin = (data)       => adminApi.post("/register", data);
export const banAdmin      = (id)         => adminApi.post(`/admins/${id}/ban`);
export const assignRole    = (admin_id, role) =>
  adminApi.post("/assign-role", { admin_id, role });

/* ── Products — list & moderation ────────────────────────────────────── */

/**
 * Fetch products, optionally filtered by status.
 * MarketProducts calls:
 *   adminApi.get(`/products${tab ? `?status=${tab}` : ""}`)
 * directly, so this named helper is a convenience alias only.
 *
 * @param {string} [status]  – e.g. "pending_review" | "active" | ""
 */
export const getProducts = (status = "") =>
  adminApi.get(`/products${status ? `?status=${status}` : ""}`);

export const getPendingProducts = () => adminApi.get("/products/pending");

/** POST /products/:id/approve */
export const approveProduct = (id) =>
  adminApi.post(`/products/${id}/approve`);

/**
 * POST /products/:id/reject
 * @param {string|number} id
 * @param {string}        reason
 */
export const rejectProduct = (id, reason) =>
  adminApi.post(`/products/${id}/reject`, { rejectionReason: reason });

/**
 * PATCH /products/:id
 * Send only the fields you want to change.
 * Used for: title, description, admin_notes, status, flags, price …
 *
 * @param {string|number} id
 * @param {object}        fields
 */
export const editProduct = (id, fields) =>
  adminApi.patch(`/products/${id}`, fields);

/**
 * POST /products/:id/flag
 * Toggle a boolean flag (is_featured, is_trending, is_sponsored, is_hidden).
 *
 * @param {string|number} id
 * @param {string}        flag   – one of the four allowed flag names
 * @param {boolean}       value
 */
export const setProductFlag = (id, flag, value) =>
  adminApi.post(`/products/${id}/flag`, { flag, value });

/** POST /products/:id/pause — toggles pause / resume */
export const togglePauseProduct = (id) =>
  adminApi.post(`/products/${id}/pause`);

/**
 * POST /products/:id/remove
 * Soft-delete with mandatory reason string.
 *
 * @param {string|number} id
 * @param {string}        reason
 */
export const removeProduct = (id, reason) =>
  adminApi.post(`/products/${id}/remove`, { reason });

/**
 * DELETE /products/:id/permanent
 * Hard-delete — super_admin only.
 * Destroys Cloudinary images + DB row (CASCADE).
 *
 * @param {string|number} id
 */
export const permanentDeleteProduct = (id) =>
  adminApi.delete(`/products/${id}/permanent`);

/* ── Payments ────────────────────────────────────────────────────────── */
export const getPayments   = ()   => adminApi.get("/payments");
export const refundPayment = (id) => adminApi.post(`/payments/${id}/refund`);

/* ── Orders ──────────────────────────────────────────────────────────── */
export const getOrders   = ()   => adminApi.get("/orders");
export const cancelOrder = (id) => adminApi.post(`/orders/${id}/cancel`);

/* ── Activity logs ───────────────────────────────────────────────────── */
export const getLogs = () => adminApi.get("/logs");

/* ── System config ───────────────────────────────────────────────────── */
export const getSystemConfig = () => adminApi.get("/system");

/**
 * @param {{ maintenance: boolean, allowPosting: boolean, allowPayments: boolean }} data
 */
export const updateSystemConfig = (data) => adminApi.post("/system", data);

/* ── Promotion plans ─────────────────────────────────────────────────── */
export const getPlans   = ()        => adminApi.get("/plans");
export const togglePlan = (id)      => adminApi.post(`/plans/${id}/toggle`);

/**
 * @param {string|number} id
 * @param {object}        data  – full plan object
 */
export const updatePlan = (id, data) => adminApi.put(`/plans/${id}`, data);

/* ── Reports ─────────────────────────────────────────────────────────── */
export const getReportStats = () => adminApi.get("/reports/stats");

/**
 * @param {string} [status]  – "all" | "pending" | "reviewing" | "resolved" | "dismissed"
 * @param {number} [limit]
 * @param {number} [offset]
 */
export const getReports = (status = "all", limit = 50, offset = 0) =>
  adminApi.get("/reports", { params: { status, limit, offset } });

export const getReport = (reportId) =>
  adminApi.get(`/reports/${reportId}`);

/**
 * @param {string|number} reportId
 * @param {string}        status   – pending | reviewing | resolved | dismissed
 */
export const updateReportStatus = (reportId, status) =>
  adminApi.patch(`/reports/${reportId}`, { status });

/** Resolve report AND ban the reported user in one call */
export const banReportedUser = (reportId) =>
  adminApi.post(`/reports/${reportId}/ban-seller`);

/* ── Roles & Permissions ─────────────────────────────────────────────── */
export const getRoles   = () => adminApi.get("/roles");
export const createRole = (role_name, description) =>
  adminApi.post("/roles", { role_name, description });

export const getPermissions   = ()                    => adminApi.get("/permissions");
export const createPermission = (name, description)   =>
  adminApi.post("/permissions", { name, description });

export const assignPermissionToRole = (role_id, permission_id) =>
  adminApi.post("/roles/assign-permission", { role_id, permission_id });

export const getRolePermissions = (roleId) =>
  adminApi.get(`/roles/${roleId}/permissions`);

/* ── Default export — the raw Axios instance ─────────────────────────── */
export default adminApi;