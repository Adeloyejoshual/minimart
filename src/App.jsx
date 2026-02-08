import { Routes, Route } from "react-router-dom";
import HomePage from "./pages/HomePage.jsx";
import MiniMartCheckoutPage from "./pages/minimart/MiniMartCheckoutPage.jsx";
import MarketplaceAddProductPage from "./pages/marketplace/MarketplaceAddProductPage.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />

      <Route path="/minimart/checkout" element={
        <ProtectedRoute>
          <MiniMartCheckoutPage />
        </ProtectedRoute>
      } />

      <Route path="/marketplace/add-product" element={
        <ProtectedRoute roles={["seller"]}>
          <MarketplaceAddProductPage />
        </ProtectedRoute>
      } />
    </Routes>
  );
}

export default App;