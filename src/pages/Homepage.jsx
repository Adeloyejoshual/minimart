import { useEffect, useState } from "react";

export default function Homepage() {
  const [products, setProducts] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const API_BASE = "https://minimart-ivrm.onrender.com/api";

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        const res = await fetch(`${API_BASE}/homepage`, {
          headers: {
            Accept: "application/json",
          },
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.message || "Error loading data");
        }

        setProducts(data.latest || []);
      } catch (err) {
        console.error(err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) return <p>Loading...</p>;

  if (error) return <p style={{ color: "red" }}>{error}</p>;

  return (
    <div style={{ padding: "20px" }}>
      <h1>Homepage Test</h1>

      {products.length === 0 ? (
        <p>No products found</p>
      ) : (
        products.map((p) => (
          <div
            key={p.id}
            style={{
              border: "1px solid #ccc",
              margin: "10px",
              padding: "10px",
            }}
          >
            <h3>{p.title}</h3>
            <p>₦{p.price}</p>
          </div>
        ))
      )}
    </div>
  );
}