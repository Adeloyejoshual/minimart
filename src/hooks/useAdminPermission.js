import { adminPermissions } from "../utils/adminPermissions";

export default function useAdminPermission(permission) {
  const role = localStorage.getItem("adminRole");

  if (!role) return false;
  if (adminPermissions[role]?.includes("ALL")) return true;

  return adminPermissions[role]?.includes(permission);
}