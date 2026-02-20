import { useAuth0 } from "@auth0/auth0-react";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function CallbackPage() {
  const { isLoading, isAuthenticated } = useAuth0();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate("/"); // redirect after successful login/signup
    }
  }, [isLoading, isAuthenticated]);

  return <p>Loading...</p>;
}