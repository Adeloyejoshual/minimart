import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "./firebase";

import Login from "./pages/Login";
import Register from "./pages/Register";
import MiniMart from "./pages/MiniMart";
import Marketplace from "./pages/Marketplace";
import Profile from "./pages/Profile";

function App() {
  const [user] = useAuthState(auth);

  return (
    <Router>
      <Routes>
        {!user ? (
          <>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="*" element={<Navigate to="/login" />} />
          </>
        ) : (
          <>
            <Route path="/" element={<Navigate to="/minimart" />} />
            <Route path="/minimart" element={<MiniMart />} />
            <Route path="/marketplace" element={<Marketplace />} />
            <Route path="/profile" element={<Profile />} />
          </>
        )}
      </Routes>
    </Router>
  );
}

export default App;