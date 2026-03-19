export const getAdmin = () => {
  const data = localStorage.getItem("admin");
  return data ? JSON.parse(data) : null;
};

export const getToken = () => {
  return localStorage.getItem("admin_token");
};

export const saveAdmin = (admin, token) => {
  localStorage.setItem("admin", JSON.stringify(admin));
  localStorage.setItem("admin_token", token);
};

export const logoutAdmin = () => {
  localStorage.removeItem("admin");
  localStorage.removeItem("admin_token");
};