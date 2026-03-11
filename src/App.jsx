import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Auth0Provider } from "@auth0/auth0-react";

// Pages
import MiniMartHome from "./pages/MiniMart/Home";
import AddProduct from "./pages/AddProduct";
import ProductDetail from "./pages/ProductDetail";
import Search from "./pages/Search";
import SellerProfile from "./pages/SellerProfile";

function App() {
  return (
    <Auth0Provider
      domain={process.env.REACT_APP_AUTH0_DOMAIN}
      clientId={process.env.REACT_APP_AUTH0_CLIENT_ID}
      authorizationParams={{
        redirect_uri: window.location.origin,
        audience: process.env.REACT_APP_AUTH0_AUDIENCE,
      }}
    >
      <Router>
        <Routes>
          <Route path="/" element={<MiniMartHome />} />
          <Route path="/minimart/add" element={<AddProduct />} />
          <Route path="/minimart/:id" element={<ProductDetail />} />
          <Route path="/search" element={<Search />} />
          <Route path="/seller/:id" element={<SellerProfile />} />
        </Routes>
      </Router>
    </Auth0Provider>
  );
}

export default App;