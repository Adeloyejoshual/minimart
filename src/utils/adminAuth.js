// src/utils/adminAuth.js
export const getAdmin = () => {
  const admin = localStorage.getItem("admin");
  return admin ? JSON.parse(admin) : null;
};

export const getAdminToken = () => {
  return localStorage.getItem("admin_token");
};

export const logoutAdmin = () => {
  localStorage.removeItem("admin");
  localStorage.removeItem("admin_token");
};