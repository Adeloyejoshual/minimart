import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import LoginPage from "./pages/auth/LoginPage";
import RegisterPage from "./pages/auth/RegisterPage";

function Home() {
  return <h2>Home</h2>;
}

export default function App() {
  return (
    <BrowserRouter>
      <nav style={{ display: "flex", gap: "20px", padding: "20px" }}>
        <Link to="/">Home</Link>
        <Link to="/login">Login</Link>
        <Link to="/register">Register</Link>
      </nav>

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Routes>
    </BrowserRouter>
  );
}