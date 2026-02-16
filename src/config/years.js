// src/config/years.js
export const years = Array.from({ length: 30 }, (_, i) => new Date().getFullYear() - i);