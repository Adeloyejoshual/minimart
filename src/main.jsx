import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { ProductCacheProvider } from "./context/ProductCacheContext";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ProductCacheProvider>
      <App />
    </ProductCacheProvider>
  </React.StrictMode>
);