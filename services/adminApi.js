import axios from "axios";

const BASE_URL = "https://minimart-ivrm.onrender.com";

const adminApi = axios.create({
  baseURL: `${BASE_URL}/api/admin`,
  headers: { "Content-Type": "application/json" },
  timeout: 15_000,
});

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

adminApi.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("adminToken");
      localStorage.removeItem("token");
      if (window.location.pathname.startsWith("/admin")) {
        window.location.href = "/admin/login";
      }
    }
    return Promise.reject(err);
  }
);

export const loginAdmin = (email, password) =>
  adminApi.post("/login", { email, password });
export const getAdminMe = () => adminApi.get("/me");
export const getStats = () => adminApi.get("/stats");
export const getUsers = () => adminApi.get("/users");
export const banUser = (id) => adminApi.post(`/users/${id}/ban`);
export const unbanUser = (id) => adminApi.post(`/users/${id}/unban`);
export const getAdmins = () => adminApi.get("/admins");
export const registerAdmin = (data) => adminApi.post("/register", data);
export const banAdmin = (id) => adminApi.post(`/admins/${id}/ban`);
export const assignRole = (admin_id, role) =>
  adminApi.post("/assign-role", { admin_id, role });
export const getProducts = (status = "") =>
  adminApi.get(`/products${status ? `?status=${status}` : ""}`);
export const getPendingProducts = () => adminApi.get("/products/pending");
export const approveProduct = (id) =>
  adminApi.post(`/products/${id}/approve`);
export const rejectProduct = (id, reason) =>
  adminApi.post(`/products/${id}/reject`, { rejectionReason: reason });
export const editProduct = (id, fields) =>
  adminApi.patch(`/products/${id}`, fields);
export const setProductFlag = (id, flag, value) =>
  adminApi.post(`/products/${id}/flag`, { flag, value });
export const togglePauseProduct = (id) =>
  adminApi.post(`/products/${id}/pause`);
export const removeProduct = (id, reason) =>
  adminApi.post(`/products/${id}/remove`, { reason });
export const permanentDeleteProduct = (id) =>
  adminApi.delete(`/products/${id}/permanent`);
export const getPayments = () => adminApi.get("/payments");
export const refundPayment = (id) => adminApi.post(`/payments/${id}/refund`);
export const getOrders = () => adminApi.get("/orders");
export const cancelOrder = (id) => adminApi.post(`/orders/${id}/cancel`);
export const getLogs = () => adminApi.get("/logs");
export const getSystemConfig = () => adminApi.get("/system");
export const updateSystemConfig = (data) => adminApi.post("/system", data);
export const getPlans = () => adminApi.get("/plans");
export const togglePlan = (id) => adminApi.post(`/plans/${id}/toggle`);
export const updatePlan = (id, data) => adminApi.put(`/plans/${id}`, data);
export const getReportStats = () => adminApi.get("/reports/stats");
export const getReports = (status = "all", limit = 50, offset = 0) =>
  adminApi.get("/reports", { params: { status, limit, offset } });
export const getReport = (reportId) => adminApi.get(`/reports/${reportId}`);
export const updateReportStatus = (reportId, status) =>
  adminApi.patch(`/reports/${reportId}`, { status });
export const banReportedUser = (reportId) =>
  adminApi.post(`/reports/${reportId}/ban-seller`);
export const getRoles = () => adminApi.get("/roles");
export const createRole = (role_name, description) =>
  adminApi.post("/roles", { role_name, description });
export const getPermissions = () => adminApi.get("/permissions");
export const createPermission = (name, description) =>
  adminApi.post("/permissions", { name, description });
export const assignPermissionToRole = (role_id, permission_id) =>
  adminApi.post("/roles/assign-permission", { role_id, permission_id });
export const getRolePermissions = (roleId) =>
  adminApi.get(`/roles/${roleId}/permissions`);

export default adminApi;