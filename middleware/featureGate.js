// Reusable guard — attach to any route that needs verified user
const requireEmailVerified = async (req, res, next) => {
  const { pool } = require("../db");

  try {
    const { rows } = await pool.query(
      "SELECT email_verified, status FROM users WHERE id = $1",
      [req.user.id]
    );

    const user = rows[0];

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (user.status === "flagged") {
      return res.status(403).json({
        error: "Your account has been flagged. Contact support.",
      });
    }

    if (!user.email_verified) {
      return res.status(403).json({
        error          : "Email verification required",
        action         : "verify_email",
        redirect       : "/verification",
      });
    }

    next();
  } catch (err) {
    res.status(500).json({ error: "Authorization check failed" });
  }
};

// Usage on any protected route:
// router.post("/products", authMiddleware, requireEmailVerified, handler)
// router.post("/chat",     authMiddleware, requireEmailVerified, handler)

module.exports = { requireEmailVerified };