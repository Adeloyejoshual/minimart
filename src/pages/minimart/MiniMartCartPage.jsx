import { useEffect, useState } from "react";
import { ApiService } from "../../services/ApiService.js";
import { useNavigate } from "react-router-dom";

const MiniMartCartPage = () => {
  const [cartItems, setCartItems] = useState([]);
  const [loadingCart, setLoadingCart] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchCart = async () => {
      try {
        const userId = localStorage.getItem("userId"); // or get from Auth0
        const data = await ApiService.post("/api/cart/fetch", { userId });
        setCartItems(data.items || []);
      } catch (error) {
        console.error("Failed to fetch cart", error);
      } finally {
        setLoadingCart(false);
      }
    };

    fetchCart();
  }, []);

  const handleCheckout = () => {
    navigate("/minimart/checkout");
  };

  if (loadingCart) return <p>Loading cart...</p>;

  if (!cartItems.length) return <p>Your cart is empty</p>;

  return (
    <div className="cart-container">
      <h1>Your Cart</h1>
      <ul>
        {cartItems.map((item) => (
          <li key={item.productId}>
            {item.title} - ₦{item.price?.toLocaleString()} x {item.quantity}
          </li>
        ))}
      </ul>
      <button onClick={handleCheckout}>Proceed to Checkout</button>
    </div>
  );
};

export default MiniMartCartPage;