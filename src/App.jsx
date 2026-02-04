import React from "react";  
import { Routes, Route } from "react-router-dom";  

// Pages  
import HomePage from "./pages/HomePage.jsx";  
import LoginPage from "./pages/LoginPage.jsx";  
import RegisterPage from "./pages/RegisterPage.jsx";  
import AddProductPage from "./pages/marketplace/AddProduct.jsx"; // <-- added

function App() {  
  return (  
    <Routes>  
      <Route path="/" element={<HomePage />} />  
      <Route path="/login" element={<LoginPage />} />  
      <Route path="/register" element={<RegisterPage />} />  
      <Route path="/marketplace/add-product" element={<AddProductPage />} /> {/* new route */}
    </Routes>  
  );  
}  

export default App;