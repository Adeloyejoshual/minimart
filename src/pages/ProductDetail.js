import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { doc, getDoc, collection, addDoc, query, orderBy, onSnapshot } from "firebase/firestore";
import { db, auth } from "../firebase";

export default function ProductDetail() {
  const { productId } = useParams();
  const [product, setProduct] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");

  useEffect(() => {
    const loadProduct = async () => {
      const snap = await getDoc(doc(db, "products", productId));
      if (snap.exists()) setProduct(snap.data());
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
    const unsub = onSnapshot(q, snap => {
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
      timestamp: new Date(),
      productId
    });
    setNewMessage("");
  };

  if (!product) return <p>Loading...</p>;

  return (
    <div>
      <img src={product.imageUrl} width="300" />
      <h2>{product.name}</h2>
      <p>₦{product.price}</p>
      <p>{product.description}</p>
      {product.marketType === "minimart" && <button>Buy Now</button>}
      
      <h3>Chat with seller</h3>
      <div style={{ border: "1px solid #ccc", padding: 10, height: 200, overflowY: "scroll" }}>
        {messages.map(m => (
          <p key={m.id}><b>{m.senderId === auth.currentUser.uid ? "You" : "Seller"}:</b> {m.text}</p>
        ))}
      </div>
      <input value={newMessage} onChange={e => setNewMessage(e.target.value)} placeholder="Type message..." />
      <button onClick={sendMessage}>Send</button>
    </div>
  );
}