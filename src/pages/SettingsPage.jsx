// src/pages/SettingsPage.jsx
import { useParams, Link } from "react-router-dom";
import TopNav from "../components/TopNav";
import { settingsPages } from "../config/settingsPages";

export default function SettingsPage() {
  const { page } = useParams(); // e.g., "about", "terms", "privacy"
  const pageData = settingsPages.find(p => p.path.includes(page));

  if (!pageData) return (
    <div style={{ minHeight: "100vh", background: "#f4f6f8" }}>
      <TopNav />
      <div style={{ maxWidth: 500, margin: "50px auto", textAlign: "center" }}>
        <h2 style={{ color: "#dc3545" }}>Page Not Found</h2>
        <p style={{ color: "#6c757d", marginTop: 8 }}>
          The page you’re looking for does not exist. Go back to <Link to="/" style={{ color: "#0D6EFD" }}>Home</Link>.
        </p>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#f4f6f8", paddingBottom: 50 }}>
      <TopNav />
      <div style={{ maxWidth: 600, margin: "20px auto", padding: "0 16px" }}>
        {/* Page Header */}
        <h2 style={{
          color: "#0D6EFD",
          fontSize: 22,
          fontWeight: 600,
          marginBottom: 16
        }}>
          {pageData.title}
        </h2>

        {/* Page Content */}
        <div style={{
          background: "#fff",
          padding: 16,
          borderRadius: 12,
          boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
          lineHeight: 1.6,
          fontSize: 14,
          color: "#212529"
        }}>
          <p style={{ whiteSpace: "pre-line" }}>{pageData.content}</p>

          {/* Optional Links in Content */}
          {pageData.links && pageData.links.length > 0 && (
            <div style={{ marginTop: 12 }}>
              {pageData.links.map(link => (
                <p key={link.label} style={{ margin: "6px 0" }}>
                  <Link to={link.path} style={{ color: "#0D6EFD", fontWeight: 600 }}>
                    {link.label}
                  </Link>
                </p>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}