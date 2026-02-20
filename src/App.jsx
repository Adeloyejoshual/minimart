// src/App.jsx
import React, { Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";

// Lazy-loaded pages
const HomePage = React.lazy(() => import("./pages/HomePage.jsx"));
const LoginPage = React.lazy(() => import("./pages/LoginPage.jsx"));
const RegisterPage = React.lazy(() => import("./pages/RegisterPage.jsx"));

// Private route wrapper
function PrivateRoute({ children }) {
  const { isAuthenticated, loginWithRedirect, isLoading } = useAuth0();

  if (isLoading) return <p>Loading...</p>;
  if (!isAuthenticated) {
    loginWithRedirect(); // redirect to Auth0 login
    return <p>Redirecting to login...</p>;
  }

  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<p>Loading...</p>}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          {/* Example of a private route */}
          <Route
            path="/dashboard"
            element={
              <PrivateRoute>
                <div>Dashboard Page - Protected</div>
              </PrivateRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}