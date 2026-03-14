import React, { useState, useEffect, useRef } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { io } from "socket.io-client";
import axios from "axios";

const API = "https://minimart-ivrm.onrender.com/api";

export default function Chat({ user }) {
  const { id: productId } = useParams(); // Product ID
  const [searchParams] = useSearchParams();
  const receiverId = searchParams.get("receiver"); // Seller or buyer

  const [messages, setMessages] = useState([]);
  const [newMsg, setNewMsg] = useState("");
  const [product, setProduct] = useState(null);
  const [receiverName, setReceiverName] = useState("");

  const messagesEndRef = useRef(null);

  const socket = useRef(null);

  // Scroll to bottom when new message arrives
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    // Initialize Socket.io
    socket.current = io("https://minimart-ivrm.onrender.com"); // replace with backend URL

    // Join room for this product and users
    socket.current.emit("joinRoom", { senderId: user.id, receiverId, productId });

    // Listen for incoming messages
    socket.current.on("receiveMessage", (msg) => {
      setMessages((prev) => [...prev, msg]);
    });

    return () => {
      socket.current.disconnect();
    };
  }, [user.id, receiverId, productId]);

  // Fetch product details and receiver info
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [prodRes, userRes] = await Promise.all([
          axios.get(`${API}/products/${productId}`),
          axios.get(`${API.replace("/marketplace", "/users")}/${receiverId}`)
        ]);
        setProduct(prodRes.data);
        setReceiverName(userRes.data.name);
      } catch (err) {
        console.error(err);
      }
    };
    fetchData();
  }, [productId, receiverId]);

  // Fetch existing messages
  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const res = await axios.get(`${API.replace("/marketplace", "/messages")}`, {
          params: { senderId: user.id, receiverId, productId }
        });
        setMessages(res.data);
        scrollToBottom();
      } catch (err) {
        console.error(err);
      }
    };
    fetchMessages();
  }, [user.id, receiverId, productId]);

  const sendMessage = () => {
    if (!newMsg) return;
    const msgObj = {
      sender_id: user.id,
      receiver_id: receiverId,
      product_id: productId,
      message: newMsg,
      created_at: new Date(),
    };
    socket.current.emit("sendMessage", msgObj);
    setMessages((prev) => [...prev, msgObj]);
    setNewMsg("");
    scrollToBottom();
  };

  if (!product) return <p>Loading chat...</p>;

  return (
    <div style={{ maxWidth: 600, margin: "auto", padding: 20 }}>
      <h2>Chat about: {product.title}</h2>
      <h3>With: {receiverName}</h3>

      <div
        style={{
          border: "1px solid #ccc",
          height: 400,
          overflowY: "scroll",
          padding: 10,
          marginBottom: 10,
        }}
      >
        {messages.map((m, idx) => (
          <p
            key={idx}
            style={{ textAlign: m.sender_id === user.id ? "right" : "left" }}
          >
            <strong>{m.sender_id === user.id ? "You" : receiverName}:</strong>{" "}
            {m.message}
          </p>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div style={{ display: "flex" }}>
        <input
          value={newMsg}
          onChange={(e) => setNewMsg(e.target.value)}
          style={{ flex: 1, padding: 8 }}
          placeholder="Type a message..."
        />
        <button
          onClick={sendMessage}
          style={{ marginLeft: 10, padding: "8px 12px" }}
        >
          Send
        </button>
      </div>
    </div>
  );
}