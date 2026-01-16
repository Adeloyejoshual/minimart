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
import {
  Box,
  Typography,
  Button,
  Paper,
  Chip,
  TextField,
  Avatar,
  Divider,
} from "@mui/material";

export default function ChatPage() {
  const { sellerId } = useParams();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const productId = params.get("product");
  const productName = params.get("productName");

  const currentUserId = auth.currentUser.uid;
  const chatId = `${currentUserId}_${productId || "general"}_${sellerId}`;

  const [friend, setFriend] = useState(null);
  const [product, setProduct] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [friendTyping, setFriendTyping] = useState(false);

  const messagesEndRef = useRef(null);

  const quickActions = [
    "Drop your number",
    "Is this available?",
    "Ask for location",
    "Make an offer",
    "Please call me",
    "Let's plan a meeting",
  ];

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

  const setTypingStatus = async (typing) => {
    const ref = doc(db, "chats", chatId, "typing", currentUserId);
    await updateDoc(ref, { isTyping: typing }).catch(() => {
      setDoc(ref, { isTyping: typing });
    });
  };

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

  const sendQuickMessage = (msg) => {
    setText(msg);
    sendTextMessage();
  };

  const markProductSold = async () => {
    if (!productId) return;
    await updateDoc(doc(db, "products", productId), { sold: true });
    alert("Product marked as sold ✅");
  };

  return (
    <Box display="flex" flexDirection="column" height="100vh">
      {/* Sticky Header */}
      <Box
        position="sticky"
        top={0}
        bgcolor="primary.main"
        color="#fff"
        p={2}
        zIndex={10}
      >
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">
            {friend?.name} {friend?.verified && "✅"}
          </Typography>
          {product && !product.sold && (
            <Button
              variant="contained"
              color="success"
              size="small"
              onClick={markProductSold}
            >
              Mark Sold
            </Button>
          )}
        </Box>

        {/* Product Preview */}
        {product && (
          <Paper
            elevation={2}
            sx={{
              mt: 1,
              display: "flex",
              alignItems: "center",
              p: 1,
              gap: 1,
              borderRadius: 2,
            }}
          >
            <Avatar
              src={product.imageUrl}
              variant="rounded"
              sx={{ width: 50, height: 50 }}
            />
            <Box>
              <Typography fontWeight="bold">{productName}</Typography>
              <Typography fontSize={12} color="text.secondary">
                ₦{product?.price} {product?.sold && "- SOLD"}
              </Typography>
            </Box>
          </Paper>
        )}
      </Box>

      {/* Messages */}
      <Box
        flex={1}
        overflow="auto"
        p={2}
        bgcolor="#f5f5f5"
        display="flex"
        flexDirection="column"
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
            <Box
              key={i}
              display="flex"
              flexDirection="column"
              alignItems={isMe ? "flex-end" : "flex-start"}
              mb={1}
            >
              <Paper
                sx={{
                  p: 1,
                  bgcolor: isMe ? "primary.main" : "#e5e5ea",
                  color: isMe ? "#fff" : "#000",
                  borderRadius: 2,
                  maxWidth: "70%",
                  wordBreak: "break-word",
                }}
              >
                {msg.text}
              </Paper>
              <Typography fontSize={10} color="text.secondary">
                {timestamp}
              </Typography>
            </Box>
          );
        })}
        {friendTyping && (
          <Typography fontSize={12} fontStyle="italic" color="text.secondary">
            {friend?.name || "Friend"} is typing...
          </Typography>
        )}
        <div ref={messagesEndRef} />
      </Box>

      {/* Quick Action Buttons */}
      <Box
        display="flex"
        flexWrap="wrap"
        gap={1}
        p={1}
        bgcolor="#e9ecef"
      >
        {quickActions.map((qa, idx) => (
          <Chip
            key={idx}
            label={qa}
            onClick={() => sendQuickMessage(qa)}
            color="primary"
            clickable
            size="small"
          />
        ))}
      </Box>

      {/* Sticky Input */}
      <Box
        display="flex"
        gap={1}
        p={1}
        position="sticky"
        bottom={0}
        bgcolor="#fff"
        borderTop="1px solid #ccc"
      >
        <TextField
          fullWidth
          variant="outlined"
          size="small"
          placeholder="Type a message..."
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setTypingStatus(!!e.target.value);
          }}
        />
        <Button variant="contained" onClick={sendTextMessage}>
          📨
        </Button>
      </Box>
    </Box>
  );
}