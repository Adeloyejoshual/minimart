// src/config/countries.js
export const countries = [
  { code: "NG", name: "Nigeria", phone: "+234" },
  { code: "GH", name: "Ghana", phone: "+233" },
  { code: "KE", name: "Kenya", phone: "+254" },
  { code: "ZA", name: "South Africa", phone: "+27" },
  { code: "CM", name: "Cameroon", phone: "+237" },
  { code: "TZ", name: "Tanzania", phone: "+255" },
  { code: "UG", name: "Uganda", phone: "+256" },
  { code: "ET", name: "Ethiopia", phone: "+251" },
  { code: "RW", name: "Rwanda", phone: "+250" },
  { code: "SN", name: "Senegal", phone: "+221" },
  { code: "CI", name: "Cote d'Ivoire", phone: "+225" },
  { code: "EG", name: "Egypt", phone: "+20" },
  { code: "MA", name: "Morocco", phone: "+212" },
  { code: "US", name: "United States", phone: "+1" },
  { code: "GB", name: "United Kingdom", phone: "+44" },
  { code: "CA", name: "Canada", phone: "+1" },
  { code: "DE", name: "Germany", phone: "+49" },
  { code: "FR", name: "France", phone: "+33" },
  { code: "IN", name: "India", phone: "+91" },
  { code: "CN", name: "China", phone: "+86" },
  { code: "JP", name: "Japan", phone: "+81" },
  { code: "BR", name: "Brazil", phone: "+55" },
  { code: "AE", name: "United Arab Emirates", phone: "+971" },
  { code: "AU", name: "Australia", phone: "+61" },
  { code: "SG", name: "Singapore", phone: "+65" },
];

// Helper — converts country code to flag emoji at runtime (no emoji in source)
export function getFlag(code) {
  return code
    .toUpperCase()
    .split("")
    .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join("");
}