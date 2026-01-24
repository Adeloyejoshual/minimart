import { useState } from "react";
import { useNavigate } from "react-router-dom";
import SlideMenu from "./SlideMenu";
import "./TopNav.css";

export default function TopNav() {
  const navigate = useNavigate();
  const selectedLocation = JSON.parse(localStorage.getItem("selectedLocation"));
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <div className="topnav-container">
        <div className="topnav-left" onClick={() => navigate("/minimart")}>MiniMart</div>
        <div className="topnav-center" onClick={() => navigate("/select-location")}>
          📍 {selectedLocation ? `${selectedLocation.state}, ${selectedLocation.city}` : "Select Region"}
        </div>
        <div className="topnav-right">
          <div className="topnav-search" onClick={() => navigate("/search")}>🔍 Search</div>
          <div className="topnav-menu" onClick={() => setMenuOpen(true)}>☰</div>
        </div>
      </div>

      <SlideMenu isOpen={menuOpen} onClose={() => setMenuOpen(false)} />
    </>
  );
}