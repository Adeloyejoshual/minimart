import { useAuth0 } from "@auth0/auth0-react";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function CallbackPage() {
  const { isLoading, isAuthenticated, error } = useAuth0();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading) {
      if (isAuthenticated) {
        navigate("/");
      } else {
        navigate("/"); // fallback if something failed
      }
    }
  }, [isLoading, isAuthenticated]);

  if (error) {
    return <p>Error: {error.message}</p>;
  }

  return <p>Loading authentication...</p>;
}