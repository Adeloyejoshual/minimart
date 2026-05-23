import express from "express";
import { pool } from "../../server.js";
import { verifyAdmin, requireSuperAdmin } from "./middleware.js";
import { cleanBigInt, safeInt } from "./helpers.js";

const router = express.Router();

/* ... paste all your market products code here ... */

export default router;