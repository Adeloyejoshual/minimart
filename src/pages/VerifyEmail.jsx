import { useEffect } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";

export default function VerifyEmail() {

  const { token } = useParams();

  useEffect(() => {

    axios.get(`/api/auth/verify/${token}`)
      .then(() => alert("Email verified"))
      .catch(() => alert("Verification failed"));

  }, []);

  return <h2>Verifying your email...</h2>;
}