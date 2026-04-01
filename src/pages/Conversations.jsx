import { useLocation } from "react-router-dom";
import { useEffect } from "react";

export default function Conversations({ user }) {
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const sellerId = params.get("userId");

    if (sellerId) {
      // 👉 create or open conversation
      console.log("Start chat with:", sellerId);

      // Call backend:
      // POST /api/conversations/start
    }
  }, [location.search]);

  return <div>Chat UI here</div>;
}