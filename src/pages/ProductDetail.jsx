import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";

export default function ProductDetail({ user }) {
  const { key } = useParams();  // Matches your :key route
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`https://minimart-ivrm.onrender.com/product/${key}`)
      .then(res => res.json())
      .then(data => {
        console.log("Product data:", data);  // Debug
        if (data.success && data.product) {
          setProduct(data.product);
        } else {
          setError(data.error || "Product not found");
        }
        setLoading(false);
      })
      .catch(err => {
        console.error("Fetch error:", err);
        setError("Failed to load product");
        setLoading(false);
      });
  }, [key]);

  if (loading) return <div className="p-8 text-center">Loading...</div>;
  if (error || !product) return (
    <div className="p-8 text-center">
      <h1 className="text-2xl mb-4">{error}</h1>
      <Link to="/" className="bg-blue-500 text-white px-6 py-2 rounded hover:bg-blue-600">
        Back to Home
      </Link>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto p-6 bg-gray-50 min-h-screen">
      <Link to="/" className="text-blue-600 hover:underline mb-8 block">&larr; Back</Link>
      
      <div className="bg-white rounded-lg shadow-lg p-8">
        <div className="grid md:grid-cols-2 gap-8">
          {/* Images */}
          <div>
            {product.images?.[0] && (
              <img src={product.images[0]} alt={product.title} className="w-full h-96 object-cover rounded-lg" />
            )}
          </div>

          {/* Info */}
          <div>
            <h1 className="text-3xl font-bold mb-4">{product.title}</h1>
            <div className="text-4xl font-bold text-green-600 mb-6">
              ₦{Number(product.price).toLocaleString()}
            </div>
            
            <div className="grid grid-cols-2 gap-4 mb-8 p-4 bg-gray-50 rounded">
              <div>Location: {product.location_state}, {product.location_city}</div>
              <div>Views: {product.views}</div>
            </div>

            {product.contact && (
              <a href={`https://wa.me/${product.contact.whatsapp}`} 
                 className="w-full bg-green-500 text-white text-center py-4 px-6 rounded-lg font-bold block mb-4 hover:bg-green-600"
                 target="_blank">
                💬 Chat on WhatsApp
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}