// src/pages/ChatPage.jsx
import React, { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "react-router-dom";
import {
  collection,
  doc,
  addDoc,
  onSnapshot,
  updateDoc,
  getDoc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { db, auth } from "../firebase";
import { FaCheck, FaCheckDouble, FaPaperPlane, FaCamera, FaPhone } from "react-icons/fa";
import ImagePreviewModal from "../components/Chat/ImagePreviewModal";
import MediaViewer from "../components/Chat/MediaViewer";

export default function ChatPage() {
  const { sellerId } = useParams();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const productId = params.get("product");

  const currentUserId = auth.currentUser.uid;
  const chatId = `${currentUserId}_${productId || "general"}_${sellerId}`;

  const [friend, setFriend] = useState(null);
  const [product, setProduct] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [showPreview, setShowPreview] = useState(false);
  const [showMediaViewer, setShowMediaViewer] = useState(false);
  const [mediaIndex, setMediaIndex] = useState(0);
  const [friendTyping, setFriendTyping] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const messagesEndRef = useRef(null);
  const dropdownRef = useRef(null);

  /* ---------------- Load friend info ---------------- */
  useEffect(() => {
    if (!sellerId) return;
    const unsub = onSnapshot(doc(db, "users", sellerId), (snap) => {
      if (snap.exists()) setFriend({ id: snap.id, ...snap.data() });
    });
    return () => unsub();
  }, [sellerId]);

  /* ---------------- Load product info ---------------- */
  useEffect(() => {
    if (!productId) return;
    const loadProduct = async () => {
      const docSnap = await getDoc(doc(db, "products", productId));
      if (docSnap.exists()) setProduct({ id: docSnap.id, ...docSnap.data() });
    };
    loadProduct();
  }, [productId]);

  /* ---------------- Load messages ---------------- */
  useEffect(() => {
    const q = collection(db, "chats", chatId, "messages");
    const unsub = onSnapshot(q, (snap) => {
      const msgs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setMessages(msgs);
      scrollToBottom();
    });
    return () => unsub();
  }, [chatId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  /* ---------------- Typing indicator ---------------- */
  useEffect(() => {
    if (!chatId || !friend) return;
    const unsub = onSnapshot(doc(db, "chats", chatId, "typing", friend.id), (snap) => {
      setFriendTyping(snap.exists() ? snap.data()?.isTyping || false : false);
    });
    return () => unsub();
  }, [chatId, friend]);

  const setTypingStatus = async (typing) => {
    const ref = doc(db, "chats", chatId, "typing", currentUserId);
    await updateDoc(ref, { isTyping: typing }).catch(() => setDoc(ref, { isTyping: typing }));
  };

  /* ---------------- Send text message ---------------- */
  const sendTextMessage = async (msgText) => {
    const message = msgText || text;
    if (!message.trim()) return;
    await addDoc(collection(db, "chats", chatId, "messages"), {
      senderId: currentUserId,
      text: message,
      createdAt: serverTimestamp(),
      readBy: [currentUserId],
    });
    setText("");
    scrollToBottom();
  };

  /* ---------------- Send image message ---------------- */
  const sendImageMessage = async (file) => {
    const url = URL.createObjectURL(file);
    await addDoc(collection(db, "chats", chatId, "messages"), {
      senderId: currentUserId,
      mediaUrl: url,
      mediaType: "image",
      fileName: file.name,
      createdAt: serverTimestamp(),
      readBy: [currentUserId],
    });
  };

  const handleFiles = (e) => {
    const files = Array.from(e.target.files);
    setSelectedFiles(files);
    setShowPreview(true);
  };

  /* ---------------- Mark product as sold ---------------- */
  const markProductSold = async () => {
    if (!productId) return;
    await updateDoc(doc(db, "products", productId), { sold: true });
    alert("Product marked as sold ✅");
  };

  /* ---------------- Copy phone ---------------- */
  const copyPhone = () => {
    if (friend?.phone) {
      navigator.clipboard.writeText(friend.phone);
      window.location.href = `tel:${friend.phone}`;
    }
  };

  /* ---------------- Dropdown outside click ---------------- */
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  /* ---------------- Quick action messages ---------------- */
  const quickActions = [
    "Drop your number",
    "Is this available?",
    "Ask for location",
    "Make an offer",
    "Please call me",
    "Let's plan a meeting",
  ];

  const sendQuickMessage = (msg) => sendTextMessage(msg);

  /* ---------------- Render ---------------- */
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      {/* Header */}
      <div style={{ position: "sticky", top: 0, background: "#0D6EFD", color: "#fff", padding: 12, zIndex: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <strong>{friend?.name}</strong> {friend?.verified && <span style={{ color: "#0f0" }}>✅</span>}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {friend?.phone && (
              <button onClick={copyPhone} style={{ display: "flex", alignItems: "center", gap: 4, background: "transparent", border: "none", color: "#fff", cursor: "pointer" }}>
                <FaPhone /> {friend.phone}
              </button>
            )}
            {product && !product.sold && (
              <button onClick={markProductSold} style={{ padding: "4px 8px", background: "#198754", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 12 }}>
                Mark Sold
              </button>
            )}
            {product && (
              <div ref={dropdownRef} style={{ position: "relative" }}>
                <button onClick={() => setDropdownOpen(!dropdownOpen)} style={{ padding: "4px 8px", background: "#ffc107", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 12 }}>
                  Product Info ▼
                </button>
                {dropdownOpen && (
                  <div style={{ position: "absolute", top: "110%", right: 0, background: "#fff", color: "#000", padding: 10, borderRadius: 6, boxShadow: "0 2px 8px rgba(0,0,0,0.2)", minWidth: 220, zIndex: 30 }}>
                    <p style={{ margin: 2, fontWeight: "bold" }}>{product.name}</p>
                    <p style={{ margin: 2 }}>₦{product.price}</p>
                    <p style={{ margin: 2, fontSize: 12 }}>Posted on: {product.postedDate || "N/A"}</p>
                    {product.sold && <span style={{ fontSize: 12, color: "#dc3545" }}>SOLD</span>}
                    <p style={{ fontSize: 12, marginTop: 4 }}>❗️ Never pay in advance! Always inspect the product.</p>
                    <p style={{ fontSize: 12 }}>✅ Inform the seller you got their number on Jiji so they know where you came from</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Product preview */}
      {product && (
        <div style={{ display: "flex", alignItems: "center", padding: 10, borderBottom: "1px solid #ccc", background: "#f8f9fa" }}>
          <img src={product.imageUrl} alt={product.name} style={{ width: 60, height: 60, objectFit: "cover", borderRadius: 8, marginRight: 10 }} />
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontWeight: "bold" }}>{product.name}</p>
            <p style={{ margin: 0, fontSize: 12, color: "#555" }}>₦{product.price}</p>
            {product.sold && <span style={{ fontSize: 12, color: "#dc3545" }}>SOLD</span>}
          </div>
        </div>
      )}

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: 10, background: "#f5f5f5" }}>
        {messages.map((msg, i) => {
          const isMe = msg.senderId === currentUserId;
          const timestamp = msg.createdAt?.seconds ? new Date(msg.createdAt.seconds * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
          return (
            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: isMe ? "flex-end" : "flex-start", marginBottom: 10 }}>
              {msg.text && <div style={{ background: isMe ? "#0D6EFD" : "#e5e5ea", color: isMe ? "#fff" : "#000", padding: "8px 12px", borderRadius: 16, maxWidth: "80%", position: "relative" }}>
                {msg.text}
                <span style={{ fontSize: 10, color: "#ccc", marginLeft: 6, position: "absolute", bottom: 2, right: 6 }}>{timestamp}</span>
              </div>}
              {msg.mediaUrl && <img src={msg.mediaUrl} alt="media" onClick={() => { setMediaIndex(i); setShowMediaViewer(true); }} style={{ maxWidth: 200, borderRadius: 8, cursor: "pointer", marginTop: 2 }} />}
              {isMe && <div style={{ fontSize: 10, color: "#555" }}>{msg.readBy?.length > 1 ? <FaCheckDouble /> : <FaCheck />}</div>}
            </div>
          );
        })}
        {friendTyping && <p style={{ fontStyle: "italic", color: "#555", fontSize: 12 }}>{friend?.name || "Friend"} is typing...</p>}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick action buttons */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", padding: "6px 10px", background: "#e9ecef" }}>
        {quickActions.map((qa, idx) => (
          <button key={idx} onClick={() => sendQuickMessage(qa)} style={{ background: "#0D6EFD", color: "#fff", border: "none", borderRadius: 20, padding: "4px 12px", fontSize: 12, cursor: "pointer" }}>
            {qa}
          </button>
        ))}
      </div>

      {/* Input */}
      <div style={{ position: "sticky", bottom: 0, display: "flex", padding: 10, borderTop: "1px solid #ccc", background: "#fff", gap: 6 }}>
        <input type="file" accept="image/*" onChange={handleFiles} style={{ display: "none" }} id="imageInput" />
        <label htmlFor="imageInput" style={{ cursor: "pointer", padding: 8, background: "#0D6EFD", color: "#fff", borderRadius: 5 }}>
          <FaCamera />
        </label>
        <input value={text} onChange={(e) => { setText(e.target.value); setTypingStatus(!!e.target.value); }} placeholder="Type a message..." style={{ flex: 1, padding: 8, borderRadius: 5, border: "1px solid #ccc" }} />
        <button onClick={() => sendTextMessage()} style={{ padding: "8px 12px", background: "#0D6EFD", color: "#fff", border: "none", borderRadius: 5 }}>
          <FaPaperPlane />
        </button>
      </div>

      {/* Image preview */}
      {showPreview && selectedFiles.length > 0 && <ImagePreviewModal previews={selectedFiles.map(f => ({ file: f, previewUrl: URL.createObjectURL(f), type: "image", name: f.name }))} onClose={() => setShowPreview(false)} onSend={(files) => files.forEach(sendImageMessage)} />}
      {/* Media viewer */}
      {showMediaViewer && <MediaViewer items={messages.filter(m => m.mediaUrl)} startIndex={mediaIndex} onClose={() => setShowMediaViewer(false)} />}
    </div>
  );
}