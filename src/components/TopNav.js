import { Link } from "react-router-dom";

export default function TopNav() {
  return (
    <div style={{
      display: "flex",
      justifyContent: "space-around",
      padding: 10,
      borderBottom: "1px solid #ddd"
    }}>
      <Link to="/minimart">MiniMart</Link>
      <Link to="/marketplace">Marketplace</Link>
      <Link to="/profile">Profile</Link>
    </div>
  );
}