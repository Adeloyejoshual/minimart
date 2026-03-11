import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

// Layout
import Layout from "./layout/Layout";

// Pages
import Home from "./pages/Home";
import ProductDetails from "./pages/ProductDetails";
import AddProduct from "./pages/AddProduct";
import Search from "./pages/Search";
import SellerProfile from "./pages/SellerProfile";
import NotFound from "./pages/NotFound";

function App() {
  return (
    <Router>
      <Layout>
        <Routes>

          {/* Homepage */}
          <Route path="/" element={<Home />} />

          {/* Product page */}
          <Route path="/product/:id" element={<ProductDetails />} />

          {/* Add product */}
          <Route path="/sell" element={<AddProduct />} />

          {/* Search */}
          <Route path="/search" element={<Search />} />

          {/* Seller profile */}
          <Route path="/seller/:id" element={<SellerProfile />} />

          {/* 404 */}
          <Route path="*" element={<NotFound />} />

        </Routes>
      </Layout>
    </Router>
  );
}

export default App;