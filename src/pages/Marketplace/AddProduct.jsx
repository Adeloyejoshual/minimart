import React from "react";
import { Link } from "react-router-dom";

export default function AddProduct() {
  return (
    <div style={{ padding: "2rem" }}>
      <h1>Add Product (Marketplace)</h1>
      <form>
        <label>
          Name: <input type="text" placeholder="Product Name" />
        </label>
        <br /><br />
        <label>
          Price: <input type="number" placeholder="Price" />
        </label>
        <br /><br />
        <button type="submit">Add Product</button>
      </form>
      <br />
      <Link to="/">Back to Home</Link>
    </div>
  );
}