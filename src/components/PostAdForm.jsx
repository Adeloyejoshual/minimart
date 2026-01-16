// /components/PostAdForm.jsx

import React, { useState } from "react";
import { auth } from "../firebase";
import categoryRules from "../config/categoryRules";
import { validateAd } from "../utils/validators";
import { uploadImages } from "../services/uploadService";
import { createAd } from "../services/adsService";
import { useAdLimitCheck } from "../hooks/useAdLimits";

const PostAdForm = () => {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [images, setImages] = useState([]);
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [loading, setLoading] = useState(false);

  const rules = categoryRules[category] || categoryRules.Default;

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!auth.currentUser) {
      alert("Login required");
      return;
    }

    const error = validateAd({
      title,
      images,
      description,
      rules
    });

    if (error) {
      alert(error);
      return;
    }

    const limitReached = await useAdLimitCheck(
      auth.currentUser.uid,
      category
    );

    if (limitReached) {
      alert("You’ve reached the limit of free ads in this category");
      return;
    }

    try {
      setLoading(true);

      const imageUrls = await uploadImages(images);

      await createAd({
        title,
        category,
        description,
        price: Number(price),
        images: imageUrls,
        coverImage: imageUrls[0],
        ownerId: auth.currentUser.uid,
        isPromoted: false
      });

      alert("Ad posted successfully");
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <h2>Post Ad</h2>

      <input
        value={title}
        onChange={e => setTitle(e.target.value)}
        maxLength={rules.maxTitle}
        placeholder="Title"
      />
      <small>{title.length} / {rules.maxTitle}</small>

      <input
        type="file"
        multiple
        accept="image/*"
        onChange={e => setImages([...e.target.files])}
      />

      <textarea
        value={description}
        onChange={e => setDescription(e.target.value)}
        placeholder="Description"
      />

      <input
        type="number"
        placeholder="Price"
        onChange={e => setPrice(e.target.value)}
      />

      <button disabled={loading}>
        {loading ? "Posting..." : "Post Ad"}
      </button>
    </form>
  );
};

export default PostAdForm;