export const cleanBigInt = (v) => {
  const s = String(v ?? "").trim();
  return /^\d+$/.test(s) ? s : null;
};

export const safeInt = (v, fallback = 0) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
};