import { useAuth0 } from "@auth0/auth0-react";
import { useEffect } from "react";
import axios from "axios";

export default function SyncUser() {
  const { user, isAuthenticated } = useAuth0();

  useEffect(() => {
    if (isAuthenticated && user) {
      axios.post("/api/users/sync", {
        auth0Id: user.sub,
        name: user.name,
        email: user.email,
        picture: user.picture,
      });
    }
  }, [isAuthenticated, user]);

  return null;
}