import { useNavigate } from "react-router-dom";
import TopNav from "../components/TopNav";
import { infoPages } from "../config/infoPages";

export default function InfoHub() {
  const navigate = useNavigate();

  return (
    <div style={{ minHeight: "100vh", background: "#f4f6f8", paddingBottom: 50 }}>
      <TopNav />

      <div style={{ maxWidth: 500, margin: "20px auto", padding: "0 12px" }}>
        <h2 style={{ color: "#0D6EFD", fontSize: 20, marginBottom: 16 }}>Settings & Info</h2>

        <div style={{ display: "grid", gap: 12 }}>
          {infoPages.map(page => (
            <div
              key={page.id}
              onClick={() => navigate(page.path)}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 12,
                padding: 14,
                background: "#fff",
                borderRadius: 12,
                cursor: "pointer",
                boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={e => e.currentTarget.style.boxShadow = "0 6px 15px rgba(0,0,0,0.12)"}
              onMouseLeave={e => e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.1)"}
            >
              {/* Icon */}
              <div style={{
                fontSize: 24,
                color: "#0D6EFD",
                width: 40,
                height: 40,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "#e0ecff",
                borderRadius: 10,
                flexShrink: 0
              }}>
                {page.icon}
              </div>

              {/* Text */}
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: 16, fontWeight: 600 }}>{page.label}</span>
                <p style={{ fontSize: 13, color: "#6c757d", margin: "4px 0 0 0" }}>{page.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}