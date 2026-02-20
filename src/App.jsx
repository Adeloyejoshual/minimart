import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import HomePage from "./pages/HomePage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import RegisterPage from "./pages/RegisterPage.jsx";

// -------- PrivateRoute Component --------
import { useAuth0 } from "@auth0/auth0-react";

function PrivateRoute({ children }) {
  const { isAuthenticated, isLoading, loginWithRedirect } = useAuth0();

  if (isLoading) return <p>Loading authentication...</p>;

  if (!isAuthenticated) {
    loginWithRedirect({ authorizationParams: { prompt: "login" } });
    return null;
  }

  return children;
}

// -------- App Component --------
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Example protected page */}
        <Route
          path="/protected"
          element={
            <PrivateRoute>
              <h2>Protected Page (only logged-in users)</h2>
            </PrivateRoute>
          }
        />

        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}