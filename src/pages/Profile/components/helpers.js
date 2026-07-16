// src/pages/Profile/components/helpers.js

export const naira = (n) => "₦" + Number(n || 0).toLocaleString("en-NG");

export const fmtNum = (n) => {
  const v = Number(n || 0);
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + "M";
  if (v >= 1_000) return (v / 1_000).toFixed(1) + "K";
  return v.toLocaleString();
};

export const timeAgo = (d) => {
  if (!d) return "";
  const s = Math.floor((Date.now() - new Date(d)) / 1_000);
  if (s < 60) return "just now";
  if (s < 3_600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86_400) return `${Math.floor(s / 3_600)}h ago`;
  if (s < 604_800) return `${Math.floor(s / 86_400)}d ago`;
  return new Date(d).toLocaleDateString("en-NG", {
    month: "short",
    day: "numeric",
  });
};

export const daysLeft = (dateStr) => {
  if (!dateStr) return null;
  const diff = new Date(dateStr) - new Date();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

export const PH =
  "https://placehold.co/56x56/f8f9fa/adb5bd?text=?";

export const getImg = (p) => {
  if (!p) return PH;
  return (
    p.image ||
    p.main_image ||
    p.thumbnail_url ||
    (Array.isArray(p.images) && p.images[0]
      ? typeof p.images[0] === "string"
        ? p.images[0]
        : p.images[0]?.url
      : null) ||
    PH
  );
};

export const BASE_URL =
  import.meta.env.VITE_API_BASE_URL || window.location.origin;
export const API = `${BASE_URL}/api`;

export const getToken = () =>
  localStorage.getItem("marketplace_token") ||
  localStorage.getItem("token") ||
  null;

export const authH = () => ({
  Authorization: `Bearer ${getToken()}`,
  "Content-Type": "application/json",
});

export const TIPS = [
  {
    Icon: null, // filled in Overview via Ic.Camera
    iconKey: "Camera",
    title: "Quality Photos",
    desc: "Add 3–6 high quality photos per listing",
  },
  {
    iconKey: "FileText",
    title: "Detailed Descriptions",
    desc: "Write keyword-rich descriptions",
  },
  {
    iconKey: "DollarSign",
    title: "Competitive Pricing",
    desc: "Check similar items before pricing",
  },
  {
    iconKey: "Zap",
    title: "Promote Listings",
    desc: "Boost visibility with promotions",
  },
  {
    iconKey: "MessageCircle",
    title: "Fast Responses",
    desc: "Reply to buyers within 1 hour",
  },
  {
    iconKey: "MapPin",
    title: "Add Location",
    desc: "Help nearby buyers find you",
  },
];

export const BREAKDOWN_TAB = {
  Active: "active",
  Drafts: "draft",
  Paused: "paused",
  Pending: "pending",
};