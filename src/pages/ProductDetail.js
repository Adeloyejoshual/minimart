// src/pages/ProductDetail.jsx
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db, auth } from "../firebase";
import { Box, Typography, Button, Paper, Avatar } from "@mui/material";

export default function ProductDetail() {
  const { productId } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const currentUser = auth.currentUser;

  useEffect(() => {
    const loadProduct = async () => {
      const docRef = doc(db, "products", productId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setProduct({ id: docSnap.id, ...docSnap.data() });
      } else {
        alert("Product not found");
        navigate("/");
      }
    };
    loadProduct();
  }, [productId, navigate]);

  if (!product) return <Typography>Loading product...</Typography>;

  const handleStartChat = () => {
    if (currentUser.uid === product.ownerId) return;
    navigate(
      `/chat/${product.ownerId}?product=${productId}&productName=${encodeURIComponent(
        product.name
      )}`
    );
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return "N/A";
    const date = new Date(timestamp.seconds * 1000);
    return date.toLocaleString([], {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <Box maxWidth="600px" mx="auto" mt={3} p={2}>
      {/* Product Image */}
      <Paper elevation={3} sx={{ p: 2, mb: 2, borderRadius: 2 }}>
        <Avatar
          src={product.imageUrl}
          variant="rounded"
          sx={{ width: "100%", height: 300, mb: 2 }}
        />
        <Typography variant="h5" fontWeight="bold">
          {product.name} {product.sold && "(SOLD)"}
        </Typography>
        <Typography variant="h6" color="primary" sx={{ mt: 1 }}>
          ₦{product.price}
        </Typography>
        <Typography variant="body1" sx={{ mt: 1 }}>
          {product.description}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Category: <b>{product.category}</b> | Market: <b>{product.marketType}</b>
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
          Posted: {formatDate(product.postedAt)}
        </Typography>
      </Paper>

      {/* Start Chat Button */}
      {currentUser.uid !== product.ownerId && (
        <Button
          variant="contained"
          color="primary"
          fullWidth
          onClick={handleStartChat}
          sx={{ py: 1.5, mb: 2 }}
        >
          💬 Start Chat
        </Button>
      )}

      {/* Seller Info */}
      <Paper elevation={1} sx={{ p: 2, borderRadius: 2 }}>
        <Typography variant="subtitle1" fontWeight="bold">
          Seller Info
        </Typography>
        <Typography variant="body2">
          Name: {product.ownerName}
        </Typography>
        {product.sold && (
          <Typography variant="body2" color="error">
            This product has been sold.
          </Typography>
        )}
      </Paper>
    </Box>
  );
}