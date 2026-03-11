import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import MiniMartHome from "./pages/MiniMart/Home.jsx";
import AddMiniMartProduct from "./pages/MiniMart/AddMiniMartProduct.jsx";
import ProductDetail from "./pages/MiniMart/ProductDetail.jsx";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<MiniMartHome />} />
        <Route path="/minimart/add" element={<AddMiniMartProduct />} />
        <Route path="/minimart/:id" element={<ProductDetail />} />
      </Routes>
    </Router>
  );
}
