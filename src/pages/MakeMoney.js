import { useNavigate } from "react-router-dom";
import TopNav from "../components/TopNav";

export default function MakeMoney() {
  const navigate = useNavigate();

  return (
    <>
      <TopNav />

      <div style={container}>
        <h2 style={title}>Make Money on MiniMart 💸</h2>
        <p style={subtitle}>
          Turn your unused items or business stock into real income. Thousands
          of buyers are waiting.
        </p>

        {/* How It Works */}
        <div style={section}>
          <h3 style={sectionTitle}>How Selling Works</h3>

          <div style={stepsGrid}>
            <div style={stepCard}>
              📸 <b>Take Clear Photos</b>
              <p>Good lighting and multiple angles increase buyer trust.</p>
            </div>

            <div style={stepCard}>
              📝 <b>Write Honest Details</b>
              <p>Describe condition, features, and include important info.</p>
            </div>

            <div style={stepCard}>
              💬 <b>Reply Fast</b>
              <p>Quick responses help you close deals faster.</p>
            </div>

            <div style={stepCard}>
              🚚 <b>Deliver Smoothly</b>
              <p>Happy buyers leave good reviews and return.</p>
            </div>
          </div>
        </div>

        {/* Earnings Motivation */}
        <div style={section}>
          <h3 style={sectionTitle}>What You Can Earn</h3>

          <div style={earningsGrid}>
            <div style={earningsCard}>
              <h3 style={{ margin: 0, color: "#28a745" }}>₦50,000+</h3>
              <p style={earningsText}>
                Active sellers earn this monthly by posting regularly
              </p>
            </div>

            <div style={earningsCard}>
              <h3 style={{ margin: 0, color: "#ff9800" }}>3× Faster Sales</h3>
              <p style={earningsText}>
                Promoted products sell up to 3 times faster
              </p>
            </div>

            <div style={earningsCard}>
              <h3 style={{ margin: 0, color: "#007bff" }}>Repeat Buyers</h3>
              <p style={earningsText}>
                Good service brings customers back again and again
              </p>
            </div>
          </div>
        </div>

        {/* Pro Tips */}
        <div style={section}>
          <h3 style={sectionTitle}>Pro Seller Tips</h3>
          <ul style={tipsList}>
            <li>Use real photos — avoid screenshots</li>
            <li>Price competitively to attract attention</li>
            <li>Use promotion plans for more visibility</li>
            <li>Keep your phone reachable after posting</li>
          </ul>
        </div>

        {/* CTA */}
        <button style={ctaButton} onClick={() => navigate("/add-product")}>
          Add Product Now
        </button>
      </div>
    </>
  );
}

/* ---------------- STYLES ---------------- */

const container = {
  maxWidth: 900,
  margin: "0 auto",
  padding: "20px 16px 60px",
  fontFamily: "Segoe UI, sans-serif"
};

const title = {
  fontSize: 26,
  marginBottom: 6
};

const subtitle = {
  color: "#555",
  marginBottom: 25
};

const section = {
  marginBottom: 30
};

const sectionTitle = {
  marginBottom: 15
};

const stepsGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
  gap: 15
};

const stepCard = {
  background: "#f8f9fa",
  padding: 15,
  borderRadius: 12,
  fontSize: 14,
  lineHeight: 1.5
};

const earningsGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 15
};

const earningsCard = {
  background: "linear-gradient(135deg, #ffffff, #f1f7ff)",
  padding: 18,
  borderRadius: 14,
  boxShadow: "0 6px 18px rgba(0,0,0,0.06)",
  textAlign: "center"
};

const earningsText = {
  margin: "6px 0 0",
  color: "#555",
  fontSize: 14
};

const tipsList = {
  paddingLeft: 18,
  lineHeight: 1.8,
  color: "#444",
  fontSize: 14
};

const ctaButton = {
  width: "100%",
  padding: 14,
  borderRadius: 10,
  border: "none",
  background: "#28a745",
  color: "#fff",
  fontSize: 16,
  fontWeight: "bold",
  cursor: "pointer",
  marginTop: 10
};