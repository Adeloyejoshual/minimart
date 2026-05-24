import axios from "axios";

const BASE_URL = "https://minimart-ivrm.onrender.com";

const adminApi = axios.create({
  baseURL: `${BASE_URL}/api/admin`,
  headers: { "Content-Type": "application/json" },
  timeout: 15_000,
});

/* ─────────────────────────────────────────────
   Request Interceptor
───────────────────────────────────────────── */
adminApi.interceptors.request.use(
  (config) => {
    const token =
      localStorage.getItem("admin_token") ||
      localStorage.getItem("adminToken")  ||
      localStorage.getItem("token");

    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (err) => Promise.reject(err)
);

/* ─────────────────────────────────────────────
   Response Interceptor
───────────────────────────────────────────── */
adminApi.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("admin_token");
      localStorage.removeItem("adminToken");
      localStorage.removeItem("token");
      localStorage.removeItem("admin_name");

      if (window.location.pathname.startsWith("/admin")) {
        window.location.href = "/admin/login";
      }
    }
    return Promise.reject(err);
  }
);

/* ═══════════════════════════════════════════
   Auth
═══════════════════════════════════════════ */
export const loginAdmin = (email, password) =>
  adminApi.post("/login", { email, password });

export const getAdminMe = () => adminApi.get("/me");

/* ═══════════════════════════════════════════
   Dashboard Stats
═══════════════════════════════════════════ */
export const getStats = () => adminApi.get("/stats");

/* ═══════════════════════════════════════════
   Users
═══════════════════════════════════════════ */
export const getUsers  = ()   => adminApi.get("/users");
export const banUser   = (id) => adminApi.post(`/users/${id}/ban`);
export const unbanUser = (id) => adminApi.post(`/users/${id}/unban`);

/* ═══════════════════════════════════════════
   Admins
═══════════════════════════════════════════ */
export const getAdmins     = ()               => adminApi.get("/admins");
export const registerAdmin = (data)           => adminApi.post("/register", data);
export const banAdmin      = (id)             => adminApi.post(`/admins/${id}/ban`);
export const assignRole    = (admin_id, role) =>
  adminApi.post("/assign-role", { admin_id, role });

/* ═══════════════════════════════════════════
   Market Products  (market.products)
═══════════════════════════════════════════ */
export const getMarketProducts = (status = "") =>
  adminApi.get(`/market-products${status ? `?status=${status}` : ""}`);

export const getMarketProduct = (id) =>
  adminApi.get(`/market-products/${id}`);

export const approveMarketProduct = (id) =>
  adminApi.post(`/market-products/${id}/approve`);

export const rejectMarketProduct = (id, reason) =>
  adminApi.post(`/market-products/${id}/reject`, { rejectionReason: reason });

export const editMarketProduct = (id, fields) =>
  adminApi.patch(`/market-products/${id}`, fields);

export const setMarketProductFlag = (id, flag, value) =>
  adminApi.post(`/market-products/${id}/flag`, { flag, value });

export const togglePauseMarketProduct = (id) =>
  adminApi.post(`/market-products/${id}/pause`);

export const removeMarketProduct = (id, reason) =>
  adminApi.post(`/market-products/${id}/remove`, { reason });

export const permanentDeleteMarketProduct = (id) =>
  adminApi.delete(`/market-products/${id}/permanent`);


/* ═══════════════════════════════════════════
   Verification (admin)
═══════════════════════════════════════════ */
export const getVerificationStats      = ()         => adminApi.get("/verification/stats");

export const getIdentityVerifications  = (status = "pending", limit = 50, offset = 0) =>
  adminApi.get("/verification/identity", { params: { status, limit, offset } });

export const getIdentityVerification   = (id)       => adminApi.get(`/verification/identity/${id}`);
export const approveIdentity           = (id)       => adminApi.post(`/verification/identity/${id}/approve`);
export const rejectIdentity            = (id, reason) => adminApi.post(`/verification/identity/${id}/reject`, { reason });
export const resetIdentity             = (id, note)   => adminApi.post(`/verification/identity/${id}/reset`, { note });

export const getStoreVerifications     = (status = "pending", limit = 50, offset = 0) =>
  adminApi.get("/verification/store", { params: { status, limit, offset } });

export const getStoreVerification      = (id)       => adminApi.get(`/verification/store/${id}`);
export const approveStore              = (id)       => adminApi.post(`/verification/store/${id}/approve`);
export const rejectStore               = (id, reason) => adminApi.post(`/verification/store/${id}/reject`, { reason });
export const resetStore                = (id, note)   => adminApi.post(`/verification/store/${id}/reset`, { note });

export const forceVerifyEmail          = (userId)   => adminApi.post(`/verification/email/${userId}/force-verify`);
export const revokeEmailVerification   = (userId)   => adminApi.post(`/verification/email/${userId}/revoke`);
export const recalculateTrustScore     = (userId)   => adminApi.post(`/verification/trust/${userId}/recalculate`);

/* ═══════════════════════════════════════════
   Payments
═══════════════════════════════════════════ */
export const getPayments   = ()   => adminApi.get("/payments");
export const refundPayment = (id) => adminApi.post(`/payments/${id}/refund`);

/* ═══════════════════════════════════════════
   Orders
═══════════════════════════════════════════ */
export const getOrders   = ()   => adminApi.get("/orders");
export const cancelOrder = (id) => adminApi.post(`/orders/${id}/cancel`);

/* ═══════════════════════════════════════════
   Logs
═══════════════════════════════════════════ */
export const getLogs = () => adminApi.get("/logs");

/* ═══════════════════════════════════════════
   System Config
═══════════════════════════════════════════ */
export const getSystemConfig    = ()     => adminApi.get("/system");
export const updateSystemConfig = (data) => adminApi.post("/system", data);

/* ═══════════════════════════════════════════
   Plans / Promotions
═══════════════════════════════════════════ */
export const getPlans   = ()         => adminApi.get("/plans");
export const togglePlan = (id)       => adminApi.post(`/plans/${id}/toggle`);
export const updatePlan = (id, data) => adminApi.put(`/plans/${id}`, data);

/* ═══════════════════════════════════════════
   Reports
═══════════════════════════════════════════ */
export const getReportStats = () => adminApi.get("/reports/stats");

export const getReports = (status = "all", limit = 50, offset = 0) =>
  adminApi.get("/reports", { params: { status, limit, offset } });

export const getReport = (reportId) =>
  adminApi.get(`/reports/${reportId}`);

export const updateReportStatus = (reportId, status) =>
  adminApi.patch(`/reports/${reportId}`, { status });

export const banReportedUser = (reportId) =>
  adminApi.post(`/reports/${reportId}/ban-seller`);

/* ═══════════════════════════════════════════
   Roles & Permissions
═══════════════════════════════════════════ */
export const getRoles   = ()                       => adminApi.get("/roles");
export const createRole = (role_name, description) =>
  adminApi.post("/roles", { role_name, description });

export const getPermissions   = ()                  => adminApi.get("/permissions");
export const createPermission = (name, description) =>
  adminApi.post("/permissions", { name, description });

export const assignPermissionToRole = (role_id, permission_id) =>
  adminApi.post("/roles/assign-permission", { role_id, permission_id });

export const getRolePermissions = (roleId) =>
  adminApi.get(`/roles/${roleId}/permissions`);

/* ═══════════════════════════════════════════
   Default Export
═══════════════════════════════════════════ */
export default adminApi;