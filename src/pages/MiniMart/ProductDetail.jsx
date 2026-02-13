import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { getMiniMartProducts } from "../../helpers/minimart";

export default function ProductDetail() {
  const { id } = useParams();
  const [product, setProduct] = useState(null);

  useEffect(() => {
    const fetchProduct = async () => {
      const products = await getMiniMartProducts();
      const found = products.find(p => String(p.id) === id);
      setProduct(found);
    };

    fetchProduct();
  }, [id]);

  if (!product) {
    return <p style={{ padding: 20 }}>Loading...</p>;
  }

  return (
    <div className="mini-detail-container">
      <div className="mini-image-wrapper">
        <img src={product.image_url} alt={product.title} />
      </div>

      <div className="mini-info">
        <h1>{product.title}</h1>
        <h2>₦{product.price}</h2>
        <p>{product.description}</p>
      </div>

      <div className="mini-sticky-actions">
        <button className="mini-chat-btn">Chat Seller</button>
        <button className="mini-buy-btn">Make Offer</button>
      </div>
    </div>
  );
}