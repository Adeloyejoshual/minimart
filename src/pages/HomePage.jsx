// src/pages/HomePage.jsx
import React, { useState } from "react";
import axios from "axios";

export default function HomePage() {
  const [text, setText] = useState("");
  const [response, setResponse] = useState("");

  const testMiniMart = async () => {
    try {
      const res = await axios.post("/api/minimart/products", { title: text, price: 1 });
      setResponse("Success! ID: " + res.data.id);
    } catch (err) {
      console.error(err);
      setResponse("Failed to add MiniMart product");
    }
  };

  return (
    <div style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1>MiniMart Test</h1>
      <input
        type="text"
        placeholder="Product title"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <button onClick={testMiniMart}>Add MiniMart Product</button>
      <p>{response}</p>
    </div>
  );
}