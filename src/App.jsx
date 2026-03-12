import React from "react";
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import Homepage from "./pages/Homepage";
import AddProduct from "./pages/AddProduct";

function App() {
  return (
    <Router>
      <header style={{ padding: "10px", borderBottom: "1px solid #ccc" }}>
        <Link to="/" style={{ marginRight: "10px" }}>Marketplace</Link>
        <Link to="/add-product">Add Product</Link>
      </header>

      <Routes>
        <Route path="/" element={<Homepage />} />
        <Route path="/add-product" element={<AddProduct />} />
      </Routes>
    </Router>
  );
}

export default App;