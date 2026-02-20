import { useAuth0 } from "@auth0/auth0-react";
import { useEffect } from "react";

export default function LoginPage() {
  const { loginWithRedirect } = useAuth0();

  useEffect(() => {
    loginWithRedirect({ screen_hint: "login" });
  }, []);

  return <p>Redirecting to login...</p>;
}