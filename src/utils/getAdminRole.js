import axios from "axios";

/**
 * Checks if a user is an admin and returns their role
 * @param {string} email - user's email
 * @returns {Promise<string|null>} - "SuperAdmin", "Moderator", "FinanceAdmin" or null
 */
export async function getAdminRole(email) {
  try {
    const res = await axios.get(`/api/admin/role?email=${encodeURIComponent(email)}`);
    return res.data.role || null;
  } catch (err) {
    console.error("Failed to get admin role:", err);
    return null;
  }
}