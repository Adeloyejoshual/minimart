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
} from "firebase/firestore";
import { db, auth } from "../firebase";
import { FaCheck, FaCheckDouble, FaPaperPlane, FaCamera } from "react-icons/fa";

import ImagePreviewModal from "../components/Chat/ImagePreviewModal";
import MediaViewer from "../components/Chat/MediaViewer";
import ChatProductPreview from "../components/ChatProductPreview";

export default function ChatPage() {
  const { sellerId } = useParams();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const productId = params.get("product");

  const currentUserId = auth.currentUser.uid;
  const chatId = `${currentUserId}_${productId || "general"}_${sellerId}`;

  const [friend, setFriend] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [showPreview, setShowPreview] = useState(false);
  const [showMediaViewer, setShowMediaViewer] = useState(false);
  const [mediaIndex, setMediaIndex] = useState(0);
  const [friendTyping, setFriendTyping] = useState(false);

  const messagesEndRef = useRef(null);
  const messagesWrapRef = useRef(null);

  /* ---------------- Load friend info ---------------- */
  useEffect(() => {
    if (!sellerId) return;
    const unsub = onSnapshot(doc(db, "users", sellerId), (snap) => {
      if (snap.exists()) setFriend({ id: snap.id, ...snap.data() });
    });
    return () => unsub();
  }, [sellerId]);

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
    await updateDoc(ref, { isTyping: typing }).catch(() => {
      // in case doc doesn't exist
      ref.set({ isTyping: typing });
    });
  };

  /* ---------------- Send text message ---------------- */
  const sendTextMessage = async () => {
    if (!text.trim()) return;
    await addDoc(collection(db, "chats", chatId, "messages"), {
      senderId: currentUserId,
      text,
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

  /* ---------------- Render ---------------- */
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      {/* Sticky Header */}
      <div
        style={{
          position: "sticky",
          top: 0,
          background: "#0D6EFD",
          color: "#fff",
          padding: 12,
          zIndex: 10,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <strong>{friend?.name}</strong>
          {friend?.verified && <span style={{ marginLeft: 5, color: "#0f0" }}>✅</span>}
        </div>
      </div>

      {/* Product Preview integrated */}
      {productId && <ChatProductPreview productId={productId} />}

      {/* Messages */}
      <div
        ref={messagesWrapRef}
        style={{ flex: 1, overflowY: "auto", padding: 10, background: "#f5f5f5" }}
      >
        {messages.map((msg, i) => {
          const isMe = msg.senderId === currentUserId;
          const timestamp = msg.createdAt?.seconds
            ? new Date(msg.createdAt.seconds * 1000).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })
            : "";
          return (
            <div
              key={i}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: isMe ? "flex-end" : "flex-start",
                marginBottom: 10,
              }}
            >
              {msg.text && (
                <div
                  style={{
                    background: isMe ? "#0D6EFD" : "#e5e5ea",
                    color: isMe ? "#fff" : "#000",
                    padding: "8px 12px",
                    borderRadius: 16,
                    maxWidth: "80%",
                  }}
                >
                  {msg.text}
                </div>
              )}
              {msg.mediaUrl && (
                <img
                  src={msg.mediaUrl}
                  alt="media"
                  onClick={() => {
                    setMediaIndex(i);
                    setShowMediaViewer(true);
                  }}
                  style={{ maxWidth: 200, borderRadius: 8, cursor: "pointer", marginTop: 2 }}
                />
              )}
              <span style={{ fontSize: 10, color: "#555", marginTop: 2 }}>{timestamp}</span>
              {isMe && (
                <div style={{ fontSize: 10, color: "#555" }}>
                  {msg.readBy?.length > 1 ? <FaCheckDouble /> : <FaCheck />}
                </div>
              )}
            </div>
          );
        })}
        {friendTyping && (
          <p style={{ fontStyle: "italic", color: "#555", fontSize: 12 }}>
            {friend?.name || "Friend"} is typing...
          </p>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Sticky Input */}
      <div
        style={{
          position: "sticky",
          bottom: 0,
          display: "flex",
          padding: 10,
          borderTop: "1px solid #ccc",
          background: "#fff",
          gap: 6,
        }}
      >
        <input type="file" accept="image/*" onChange={handleFiles} style={{ display: "none" }} id="imageInput" />
        <label
          htmlFor="imageInput"
          style={{ cursor: "pointer", padding: 8, background: "#0D6EFD", color: "#fff", borderRadius: 5 }}
        >
          <FaCamera />
        </label>
        <input
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setTypingStatus(!!e.target.value);
          }}
          placeholder="Type a message..."
          style={{ flex: 1, padding: 8, borderRadius: 5, border: "1px solid #ccc" }}
        />
        <button
          onClick={sendTextMessage}
          style={{ padding: "8px 12px", background: "#0D6EFD", color: "#fff", border: "none", borderRadius: 5 }}
        >
          <FaPaperPlane />
        </button>
      </div>

      {/* Image Preview */}
      {showPreview && selectedFiles.length > 0 && (
        <ImagePreviewModal
          previews={selectedFiles.map((f) => ({ file: f, previewUrl: URL.createObjectURL(f), type: "image", name: f.name }))}
          onClose={() => setShowPreview(false)}
          onSend={(files) => files.forEach(sendImageMessage)}
        />
      )}

      {/* Media Viewer */}
      {showMediaViewer && (
        <MediaViewer items={messages.filter((m) => m.mediaUrl)} startIndex={mediaIndex} onClose={() => setShowMediaViewer(false)} />
      )}
    </div>
  );
}