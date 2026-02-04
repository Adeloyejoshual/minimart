import { useState } from "react";
import { usePopup } from "../context/PopupContext"; // optional, you may have this
import { useAuth0 } from "@auth0/auth0-react";

export default function PostAdModal() {
  const { user, getIdTokenClaims } = useAuth0();
  const { showPopup } = usePopup();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    category: "",
    city: "",
    state: "",
    price: "",
    promotionPlan: "free",
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    if (!user) {
      showPopup("Please login first!");
      return;
    }

    if (!form.title || !form.category || !form.price) {
      showPopup("Title, category, and price are required.");
      return;
    }

    setLoading(true);
    try {
      const tokenClaims = await getIdTokenClaims();
      const token = tokenClaims.__raw;

      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/marketplace/products`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ...form, userId: user.sub }),
      });

      const data = await res.json();

      if (res.ok) {
        showPopup("✅ Product posted successfully!");
        setOpen(false);
        setForm({
          title: "",
          category: "",
          city: "",
          state: "",
          price: "",
          promotionPlan: "free",
        });
      } else {
        showPopup(data.error || "Failed to post product.");
      }
    } catch (err) {
      console.error(err);
      showPopup("Something went wrong. Check console.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          padding: "10px 14px",
          borderRadius: 8,
          border: "1px solid #0d6efd",
          background: "#0d6efd",
          color: "#fff",
          cursor: "pointer",
        }}
      >
        ➕ Post an Ad
      </button>

      {open && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 9999,
          }}
        >
          <div
            style={{
              background: "#fff",
              padding: 20,
              borderRadius: 12,
              width: "90%",
              maxWidth: 400,
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <h3>Post a Product</h3>

            <input
              type="text"
              placeholder="Title"
              value={form.title}
              onChange={(e) => handleChange("title", e.target.value)}
              style={{ padding: 8, borderRadius: 6, border: "1px solid #ccc" }}
            />

            <input
              type="text"
              placeholder="City"
              value={form.city}
              onChange={(e) => handleChange("city", e.target.value)}
              style={{ padding: 8, borderRadius: 6, border: "1px solid #ccc" }}
            />

            <input
              type="text"
              placeholder="State"
              value={form.state}
              onChange={(e) => handleChange("state", e.target.value)}
              style={{ padding: 8, borderRadius: 6, border: "1px solid #ccc" }}
            />

            <input
              type="number"
              placeholder="Price"
              value={form.price}
              onChange={(e) => handleChange("price", e.target.value)}
              style={{ padding: 8, borderRadius: 6, border: "1px solid #ccc" }}
            />

            <select
              value={form.category}
              onChange={(e) => handleChange("category", e.target.value)}
              style={{ padding: 8, borderRadius: 6, border: "1px solid #ccc" }}
            >
              <option value="">Select category</option>
              <option value="Electronics">Electronics</option>
              <option value="Fashion">Fashion</option>
              <option value="Home">Home</option>
              <option value="Toys">Toys</option>
              <option value="Sports">Sports</option>
              <option value="Books">Books</option>
              <option value="Vehicles">Vehicles</option>
              <option value="Services">Services</option>
            </select>

            <select
              value={form.promotionPlan}
              onChange={(e) => handleChange("promotionPlan", e.target.value)}
              style={{ padding: 8, borderRadius: 6, border: "1px solid #ccc" }}
            >
              <option value="free">Free</option>
              <option value="paid">Paid</option>
            </select>

            <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
              <button
                onClick={() => setOpen(false)}
                style={{
                  flex: 1,
                  padding: 10,
                  borderRadius: 6,
                  border: "1px solid #ccc",
                  background: "#f8f9fa",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading}
                style={{
                  flex: 1,
                  padding: 10,
                  borderRadius: 6,
                  border: "none",
                  background: "#0d6efd",
                  color: "#fff",
                  cursor: "pointer",
                }}
              >
                {loading ? "Posting..." : "Post"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}