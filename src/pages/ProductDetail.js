import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { doc, getDoc, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp } from "firebase/firestore";
import { db, auth } from "../firebase";
import TopNav from "../components/TopNav";

// Replace this with your payment function later
const payForMiniMartProduct = async (product) => {
  alert(`Payment started for ${product.name} - ₦${product.price}`);
  // Integrate Paystack / Flutterwave here for real payment
};

export default function ProductDetail() {
  const { productId } = useParams();
  const [product, setProduct] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");

  useEffect(() => {
    const loadProduct = async () => {
      const snap = await getDoc(doc(db, "products", productId));
      if (snap.exists()) setProduct({ id: snap.id, ...snap.data() });
    };
    loadProduct();
  }, [productId]);

  useEffect(() => {
    if (!auth.currentUser || !product) return;
    const chatId = `${productId}_${auth.currentUser.uid}`;
    const q = query(
      collection(db, "chats", chatId, "messages"),
      orderBy("timestamp", "asc")
    );
    const unsub = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [product]);

  const sendMessage = async () => {
    if (!newMessage.trim()) return;
    const chatId = `${productId}_${auth.currentUser.uid}`;
    await addDoc(collection(db, "chats", chatId, "messages"), {
      senderId: auth.currentUser.uid,
      text: newMessage,
      timestamp: serverTimestamp(),
      productId,
    });
    setNewMessage("");
  };

  if (!product) return <p>Loading...</p>;

  return (
    <div style={{ padding: 20 }}>
      <TopNav />

      <h2>{product.name}</h2>
      <img src={product.imageUrl} width="300" />
      <p><b>Price:</b> ₦{product.price}</p>
      <p><b>Description:</b> {product.description}</p>
      <p><b>Seller:</b> {product.ownerId}</p>
      {product.marketType === "minimart" && (
        <button onClick={() => payForMiniMartProduct(product)}>Buy Now</button>
      )}

      <h3>Chat with Seller</h3>
      <div style={{
        border: "1px solid #ccc",
        padding: 10,
        height: 250,
        overflowY: "scroll",
        marginBottom: 10
      }}>
        {messages.map(m => (
          <p key={m.id}>
            <b>{m.senderId === auth.currentUser.uid ? "You" : "Seller"}:</b> {m.text}
          </p>
        ))}
      </div>
      <input
        value={newMessage}
        onChange={e => setNewMessage(e.target.value)}
        placeholder="Type your message..."
        style={{ width: "80%", marginRight: 10 }}
      />
      <button onClick={sendMessage}>Send</button>
    </div>
  );
}