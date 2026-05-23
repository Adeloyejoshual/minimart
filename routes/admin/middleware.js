import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "supersecret";

export const verifyAdmin = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer "))
    return res.status(401).json({ error: "Unauthorized" });

  const token = authHeader.split(" ")[1];
  try {
    req.admin = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
};

export const requireSuperAdmin = (req, res, next) => {
  if (req.admin?.role !== "super_admin")
    return res.status(403).json({ error: "Forbidden — super_admin only" });
  next();
};