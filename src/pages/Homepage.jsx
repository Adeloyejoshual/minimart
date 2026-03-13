import React, { useState } from "react";
import axios from "axios";

export default function Homepage() {

  const [mode, setMode] = useState("login");

  const [name,setName] = useState("");
  const [email,setEmail] = useState("");
  const [password,setPassword] = useState("");
  const [code,setCode] = useState("");

  const register = async () => {

    try{

      const res = await axios.post("/api/users/register",{
        name,
        email,
        password
      });

      alert(res.data.message);

      setMode("verify");

    }catch(err){

      alert(err.response?.data?.message || "Registration failed");

    }

  };

  const login = async () => {

    try{

      const res = await axios.post("/api/users/login",{
        email,
        password
      });

      localStorage.setItem("token",res.data.token);

      alert("Login successful");

    }catch(err){

      alert(err.response?.data?.message || "Login failed");

    }

  };

  const verify = async () => {

    try{

      const res = await axios.post("/api/users/verify-email",{
        email,
        code
      });

      alert(res.data.message);

      setMode("login");

    }catch{

      alert("Verification failed");

    }

  };

  return (

    <div style={{maxWidth:"400px",margin:"40px auto"}}>

      <h1>MiniMart</h1>

      {mode === "login" && (

        <>
          <h2>Login</h2>

          <input
            placeholder="Email"
            onChange={(e)=>setEmail(e.target.value)}
          />

          <input
            placeholder="Password"
            type="password"
            onChange={(e)=>setPassword(e.target.value)}
          />

          <button onClick={login}>
            Login
          </button>

          <p>
            No account?
            <button onClick={()=>setMode("register")}>
              Register
            </button>
          </p>
        </>

      )}

      {mode === "register" && (

        <>
          <h2>Register</h2>

          <input
            placeholder="Name"
            onChange={(e)=>setName(e.target.value)}
          />

          <input
            placeholder="Email"
            onChange={(e)=>setEmail(e.target.value)}
          />

          <input
            placeholder="Password"
            type="password"
            onChange={(e)=>setPassword(e.target.value)}
          />

          <button onClick={register}>
            Register
          </button>

          <p>
            Already have account?
            <button onClick={()=>setMode("login")}>
              Login
            </button>
          </p>
        </>

      )}

      {mode === "verify" && (

        <>
          <h2>Email Verification</h2>

          <input
            placeholder="Verification Code"
            onChange={(e)=>setCode(e.target.value)}
          />

          <button onClick={verify}>
            Verify Email
          </button>

        </>

      )}

    </div>

  );
}