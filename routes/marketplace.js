// routes/marketplace.js
import express from 'express';
import { POST } from '../api/marketplace.js';

const router = express.Router();

router.post('/', async (req, res) => {
  const response = await POST(req);
  const body = await response.json();
  res.status(response.status).json(body);
});

export default router;