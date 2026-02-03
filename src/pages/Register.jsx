// src/pages/Register.jsx
import { useState } from "react";
import axios from "axios";

export default function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const res = await axios.post(
        `https://${import.meta.env.VITE_AUTH0_DOMAIN}/dbconnections/signup`,
        {
          client_id: import.meta.env.VITE_AUTH0_CLIENT_ID,
          email,
          password,
          connection: "Username-Password-Authentication",
          user_metadata: { name },
        }
      );

      setSuccess("Registration successful! You can now login.");
      setEmail("");
      setPassword("");
      setName("");
    } catch (err) {
      console.error(err.response?.data || err.message);
      setError(err.response?.data?.description || "Registration failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-12 p-6 border rounded shadow">
      <h1 className="text-2xl font-bold mb-4">Register</h1>
      {error && <p className="text-red-600 mb-2">{error}</p>}
      {success && <p className="text-green-600 mb-2">{success}</p>}

      <form onSubmit={handleRegister} className="flex flex-col gap-3">
        <input
          type="text"
          placeholder="Full Name"
          value={name}
          required
          onChange={(e) => setName(e.target.value)}
          className="border p-2 rounded"
        />
        <input
          type="email"
          placeholder="Email"
          value={email}
          required
          onChange={(e) => setEmail(e.target.value)}
          className="border p-2 rounded"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          required
          onChange={(e) => setPassword(e.target.value)}
          className="border p-2 rounded"
        />
        <button
          type="submit"
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          disabled={loading}
        >
          {loading ? "Registering..." : "Register"}
        </button>
      </form>
    </div>
  );
}