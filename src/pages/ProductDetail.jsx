import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";

const API_BASE = "https://minimart-ivrm.onrender.com";

export default function ProductDetail() {
  const { slug } = useParams();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`${API_BASE}/product/${slug}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.product) {
          setProduct(data.product);
        } else {
          setError("Product not found");
        }
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load");
        setLoading(false);
      });
  }, [slug]);

  if (loading) return <div className="p-8 text-center">Loading...</div>;
  if (error) return (
    <div className="p-8 text-center">
      <h1>{error}</h1>
      <Link to="/" className="bg-blue-500 text-white px-4 py-2 rounded mt-4 inline-block">
        Back to Home
      </Link>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto p-6">
      <Link to="/" className="text-blue-500 mb-6 inline-block">&larr; Back</Link>
      
      <div className="grid md:grid-cols-2 gap-8">
        {/* Images */}
        <div>
          {product.images[0] && (
            <img 
              src={product.images[0]} 
              alt={product.title}
              className="w-full h-96 object-cover rounded-lg mb-4"
            />
          )}
          {product.images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto">
              {product.images.slice(1).map((img, i) => (
                <img key={i} src={img} alt="" className="w-20 h-20 object-cover rounded" />
              ))}
            </div>
          )}
        </div>

        {/* Details */}
        <div>
          <h1 className="text-3xl font-bold mb-4">{product.title}</h1>
          <div className="text-3xl font-bold text-green-600 mb-6">
            ₦{Number(product.price).toLocaleString()}
          </div>

          <div className="space-y-4 mb-6">
            <p><strong>Location:</strong> {product.location?.state}, {product.location?.city}</p>
            <p><strong>Views:</strong> {product.views}</p>
            {product.promotion && (
              <p className="bg-yellow-100 p-2 rounded">🔥 PROMOTED</p>
            )}
          </div>

          {Object.keys(product.attributes || {}).length > 0 && (
            <div className="grid grid-cols-2 gap-2 mb-6 p-4 bg-gray-50 rounded">
              {Object.entries(product.attributes).map(([key, value]) => (
                <div key={key}>
                  <strong>{key}:</strong> {value}
                </div>
              ))}
            </div>
          )}

          {/* Contact */}
          {product.contact && (
            <div className="bg-blue-50 p-6 rounded-lg mb-6">
              <h3 className="font-bold text-lg mb-4">Contact Seller</h3>
              <a
                href={`https://wa.me/${product.contact.whatsapp.replace(/D/g, '')}`}
                className="block w-full bg-green-500 text-white text-center py-3 px-4 rounded-lg mb-2 hover:bg-green-600"
                target="_blank"
              >
                💬 WhatsApp
              </a>
              <a href={`tel:${product.contact.phone}`} className="text-blue-600">
                📞 Call: {product.contact.phone}
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}