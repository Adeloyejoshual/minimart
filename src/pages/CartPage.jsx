import { useEffect, useState } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db, auth } from "../firebase";

export default function CartPage() {
  const [cartItems, setCartItems] = useState([]);

  useEffect(() => {
    if (!auth.currentUser) return;
    const uid = auth.currentUser.uid;

    const cartRef = collection(db, "carts");
    const q = query(cartRef, where("userId", "==", uid));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setCartItems(items);
    });

    return () => unsubscribe();
  }, []);

  return (
    <div style={{ padding: 16 }}>
      <h2>🛒 Your Cart</h2>
      {cartItems.length === 0 ? (
        <p>Your cart is empty.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {cartItems.map(item => (
            <li key={item.id} style={{
              padding: 10,
              marginBottom: 8,
              border: "1px solid #ddd",
              borderRadius: 8,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center"
            }}>
              <div>
                <strong>{item.name}</strong>
                <div>Price: ₦{item.price}</div>
                <div>Quantity: {item.quantity || 1}</div>
              </div>
              <div>🛒</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}