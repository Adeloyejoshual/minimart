import { Link } from "react-router-dom";

const ProductCardItem = ({ product }) => {
  return (
    <div className="product-card">
      <Link to={`/minimart/product/${product._id}`}>
        <img src={product.images?.[0]} alt={product.title} />
        <h3>{product.title}</h3>
        <p>₦{product.price?.toLocaleString()}</p>
        <span>{product.location}</span>
      </Link>
    </div>
  );
};

export default ProductCardItem;