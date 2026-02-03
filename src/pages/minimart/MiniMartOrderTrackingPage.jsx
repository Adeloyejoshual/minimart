import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { ApiService } from "../../services/ApiService.js";

const MiniMartOrderTrackingPage = () => {
  const { id } = useParams();
  const [order, setOrder] = useState(null);

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        const data = await ApiService.get(`/api/orders/${id}`);
        setOrder(data);
      } catch (err) {
        console.error("Failed to fetch order", err);
      }
    };

    fetchOrder();
  }, [id]);

  if (!order) return <p>Loading order...</p>;

  return (
    <div className="order-tracking-container">
      <h1>Order #{order.id}</h1>
      <p>Status: {order.status}</p>
      <p>Total: ₦{order.total?.toLocaleString()}</p>
      <p>Items:</p>
      <ul>
        {order.items.map((item) => (
          <li key={item.productId}>
            {item.title} x {item.quantity}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default MiniMartOrderTrackingPage;