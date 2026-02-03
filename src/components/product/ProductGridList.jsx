import { useEffect, useState } from "react";
import ProductCardItem from "./ProductCardItem.jsx";
import { ApiService } from "../../services/ApiService.js";

const ProductGridList = () => {
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const data = await ApiService.getMiniMartProducts();
        setProducts(data);
      } catch (error) {
        setErrorMessage("Unable to load products");
      } finally {
        setLoadingProducts(false);
      }
    };

    fetchProducts();
  }, []);

  if (loadingProducts) return <p>Loading products...</p>;
  if (errorMessage) return <p>{errorMessage}</p>;

  return (
    <div className="product-grid">
      {products.length === 0 ? (
        <p>No products available yet.</p>
      ) : (
        products.map((product) => (
          <ProductCardItem key={product._id} product={product} />
        ))
      )}
    </div>
  );
};

export default ProductGridList;