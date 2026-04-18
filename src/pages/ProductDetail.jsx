import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";

export default function ProductDetail({ user }) {
  const { slug } = useParams();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    const fetchProduct = async () => {
      try {
        setLoading(true);
        setError("");

        const res = await fetch(
          `${import.meta.env.VITE_API_URL || ""}/api/products/slug/${slug}`,
          { signal: controller.signal }
        );

        if (!res.ok) {
          throw new Error("Product not found");
        }

        const data = await res.json();
        setProduct(data);
      } catch (err) {
        if (err.name !== "AbortError") {
          setError(err.message || "Failed to load product");
        }
      } finally {
        setLoading(false);
      }
    };

    if (slug) fetchProduct();

    return () => controller.abort();
  }, [slug]);

  if (loading) return <p>Loading...</p>;
  if (error) return <p>{error}</p>;
  if (!product) return <p>Product not found</p>;

  return (
    <div className="product-detail">
      <div>
        <Link to="/">Back</Link>
      </div>

      <h1>{product.title}</h1>
      <p>{product.price}</p>

      {product.images?.length > 0 && (
        <div className="product-images">
          {product.images.map((img, index) => (
            <img
              key={index}
              src={img.url}
              alt={product.title}
              style={{ width: "100%", maxWidth: "500px", marginBottom: "12px" }}
            />
          ))}
        </div>
      )}

      <p>{product.description}</p>

      <div>
        <strong>Category:</strong> {product.category_id}
      </div>

      <div>
        <strong>Location:</strong>{" "}
        {product.location?.city}, {product.location?.state}
      </div>

      {product.attributes && Object.keys(product.attributes).length > 0 && (
        <div>
          <h3>Attributes</h3>
          <pre>{JSON.stringify(product.attributes, null, 2)}</pre>
        </div>
      )}

      {product.delivery && (
        <div>
          <h3>Delivery</h3>
          <p>
            {product.delivery.available ? "Available" : "Not available"}
          </p>
          <p>
            {product.delivery.duration?.from} - {product.delivery.duration?.to} days
          </p>
          {product.delivery.note && <p>{product.delivery.note}</p>}
        </div>
      )}

      {user && (
        <div>
          <p>Signed in as {user.email}</p>
        </div>
      )}
    </div>
  );
}