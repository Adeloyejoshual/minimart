// src/pages/AddProduct.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db, auth, storage } from "../firebase";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  LinearProgress,
} from "@mui/material";

export default function AddProduct() {
  const navigate = useNavigate();
  const currentUser = auth.currentUser;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("");
  const [marketType, setMarketType] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !description || !price || !category || !marketType || !imageFile) {
      alert("Please fill all fields and select an image.");
      return;
    }

    setLoading(true);

    // Upload image to Firebase Storage
    const storageRef = ref(storage, `products/${Date.now()}_${imageFile.name}`);
    const uploadTask = uploadBytesResumable(storageRef, imageFile);

    uploadTask.on(
      "state_changed",
      (snapshot) => {
        const progress =
          (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        setUploadProgress(progress);
      },
      (error) => {
        console.error(error);
        setLoading(false);
        alert("Image upload failed.");
      },
      async () => {
        const imageUrl = await getDownloadURL(uploadTask.snapshot.ref);

        // Save product to Firestore
        await addDoc(collection(db, "products"), {
          name,
          description,
          price: parseFloat(price),
          category,
          marketType,
          imageUrl,
          ownerId: currentUser.uid,
          ownerName: currentUser.displayName || "Anonymous",
          postedAt: serverTimestamp(),
          sold: false,
        });

        setLoading(false);
        alert("Product added successfully ✅");
        navigate("/");
      }
    );
  };

  return (
    <Box maxWidth="600px" mx="auto" mt={3} p={2}>
      <Paper elevation={3} sx={{ p: 3, borderRadius: 2 }}>
        <Typography variant="h5" fontWeight="bold" mb={2}>
          Add New Product
        </Typography>

        <form onSubmit={handleSubmit}>
          <TextField
            fullWidth
            label="Product Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            margin="normal"
            required
          />
          <TextField
            fullWidth
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            multiline
            rows={3}
            margin="normal"
            required
          />
          <TextField
            fullWidth
            label="Price (₦)"
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            margin="normal"
            required
          />
          <TextField
            fullWidth
            label="Category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            margin="normal"
            required
          />
          <TextField
            fullWidth
            label="Market Type"
            value={marketType}
            onChange={(e) => setMarketType(e.target.value)}
            margin="normal"
            required
          />
          <Button
            variant="contained"
            component="label"
            sx={{ mt: 2, mb: 1 }}
          >
            Upload Image
            <input
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => setImageFile(e.target.files[0])}
            />
          </Button>
          {imageFile && (
            <Typography variant="body2">{imageFile.name}</Typography>
          )}
          {uploadProgress > 0 && (
            <LinearProgress
              variant="determinate"
              value={uploadProgress}
              sx={{ mt: 1, mb: 1 }}
            />
          )}
          <Button
            type="submit"
            variant="contained"
            color="primary"
            fullWidth
            sx={{ mt: 2 }}
            disabled={loading}
          >
            {loading ? "Adding..." : "Add Product"}
          </Button>
        </form>
      </Paper>
    </Box>
  );
}