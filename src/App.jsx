import { BrowserRouter, Routes, Route } from "react-router-dom";
import HomePage from "./pages/HomePage.jsx";

// -------------------- MiniMart Pages --------------------
import ProductDetail from "./pages/minimart/ProductDetail.jsx";
import MiniMartCartPage from "./pages/minimart/MiniMartCartPage.jsx";
import MiniMartCheckoutPage from "./pages/minimart/MiniMartCheckoutPage.jsx";
import MiniMartOrderTrackingPage from "./pages/minimart/MiniMartOrderTrackingPage.jsx";

// -------------------- Marketplace Pages --------------------
import MarketplaceListingDetailsPage from "./pages/marketplace/MarketplaceListingDetailsPage.jsx";
import MarketplaceAddProductPage from "./pages/marketplace/MarketplaceAddProductPage.jsx";
import MarketplaceChatPage from "./pages/marketplace/MarketplaceChatPage.jsx";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Home */}
        <Route path="/" element={<HomePage />} />

        {/* MiniMart */}
        <Route path="/minimart/product/:id" element={<ProductDetail />} />
        <Route path="/minimart/cart" element={<MiniMartCartPage />} />
        <Route path="/minimart/checkout" element={<MiniMartCheckoutPage />} />
        <Route path="/minimart/order/:id" element={<MiniMartOrderTrackingPage />} />

        {/* Marketplace */}
        <Route path="/marketplace/listing/:id" element={<MarketplaceListingDetailsPage />} />
        <Route path="/marketplace/add-product" element={<MarketplaceAddProductPage />} />
        <Route path="/marketplace/chat" element={<MarketplaceChatPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;