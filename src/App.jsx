import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";

import HomePage from "./pages/HomePage.jsx";

// MiniMart
import ProductDetail from "./pages/minimart/ProductDetail.jsx";
import MiniMartCartPage from "./pages/minimart/MiniMartCartPage.jsx";
import MiniMartCheckoutPage from "./pages/minimart/MiniMartCheckoutPage.jsx";
import MiniMartOrderTrackingPage from "./pages/minimart/MiniMartOrderTrackingPage.jsx";

// Marketplace
import MarketplaceListingDetailsPage from "./pages/marketplace/MarketplaceListingDetailsPage.jsx";
import MarketplaceAddProductPage from "./pages/marketplace/MarketplaceAddProductPage.jsx";
import MarketplaceChatPage from "./pages/marketplace/MarketplaceChatPage.jsx";

// Auth
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import PrivateRoute from "./components/PrivateRoute.jsx";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Home */}
        <Route path="/" element={<HomePage />} />

        {/* Auth */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* MiniMart - some protected */}
        <Route path="/minimart/product/:id" element={<ProductDetail />} />
        <Route
          path="/minimart/cart"
          element={<PrivateRoute><MiniMartCartPage /></PrivateRoute>}
        />
        <Route
          path="/minimart/checkout"
          element={<PrivateRoute><MiniMartCheckoutPage /></PrivateRoute>}
        />
        <Route
          path="/minimart/order/:id"
          element={<PrivateRoute><MiniMartOrderTrackingPage /></PrivateRoute>}
        />

        {/* Marketplace */}
        <Route path="/marketplace/listing/:id" element={<MarketplaceListingDetailsPage />} />
        <Route path="/marketplace/add-product" element={<PrivateRoute><MarketplaceAddProductPage /></PrivateRoute>} />
        <Route path="/marketplace/chat" element={<PrivateRoute><MarketplaceChatPage /></PrivateRoute>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;