// src/pages/TestPage.jsx

import { useState } from "react";

const API = "/api/verification";

export default function TestPage() {
  const [token, setToken] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);

  const request = async (endpoint, options = {}) => {
    setLoading(true);

    const start = performance.now();

    try {
      const response = await fetch(API + endpoint, {
        ...options,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(options.headers || {}),
        },
      });

      const end = performance.now();

      let body;

      try {
        body = await response.json();
      } catch {
        body = { message: "Response is not JSON" };
      }

      const data = {
        endpoint,
        method: options.method || "GET",
        status: response.status,
        ok: response.ok,
        duration: `${Math.round(end - start)} ms`,
        body,
        time: new Date().toLocaleTimeString(),
      };

      setResult(data);
      setHistory((h) => [data, ...h].slice(0, 10));
    } catch (err) {
      const data = {
        endpoint,
        method: options.method || "GET",
        status: "NETWORK",
        ok: false,
        duration: "-",
        body: {
          message: err.message,
        },
        time: new Date().toLocaleTimeString(),
      };

      setResult(data);
      setHistory((h) => [data, ...h].slice(0, 10));
    }

    setLoading(false);
  };

  const sendOtp = () =>
    request("/send-email-otp", {
      method: "POST",
    });

  const verifyOtp = () =>
    request("/verify-email-otp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ otp }),
    });

  const getStatus = () =>
    request("/status");

  const copyError = () => {
    if (!result) return;

    navigator.clipboard.writeText(
      JSON.stringify(result.body, null, 2)
    );

    alert("Copied");
  };

  return (
    <div
      style={{
        background: "#0f172a",
        color: "#fff",
        minHeight: "100vh",
        padding: 30,
        fontFamily: "Arial",
      }}
    >
      <h1>Verification API Tester</h1>

      <p>
        Endpoint:
        <br />
        <b>{API}</b>
      </p>

      <input
        placeholder="JWT Token"
        value={token}
        onChange={(e) => setToken(e.target.value)}
        style={{
          width: "100%",
          padding: 12,
          marginBottom: 15,
        }}
      />

      <input
        placeholder="OTP"
        value={otp}
        onChange={(e) => setOtp(e.target.value)}
        style={{
          width: "100%",
          padding: 12,
          marginBottom: 20,
        }}
      />

      <div
        style={{
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <button onClick={getStatus}>
          Status
        </button>

        <button onClick={sendOtp}>
          Send OTP
        </button>

        <button onClick={verifyOtp}>
          Verify OTP
        </button>

        <button
          onClick={() => {
            setHistory([]);
            setResult(null);
          }}
        >
          Clear
        </button>
      </div>

      {loading && (
        <h3 style={{ color: "orange" }}>
          Loading...
        </h3>
      )}

      {result && (
        <div
          style={{
            marginTop: 25,
            background: "#1e293b",
            padding: 20,
            borderRadius: 10,
          }}
        >
          <h2>Latest Response</h2>

          <p>
            <b>Time:</b> {result.time}
          </p>

          <p>
            <b>Method:</b> {result.method}
          </p>

          <p>
            <b>Endpoint:</b> {result.endpoint}
          </p>

          <p>
            <b>Status:</b>{" "}
            <span
              style={{
                color: result.ok ? "#4ade80" : "#ef4444",
              }}
            >
              {result.status}
            </span>
          </p>

          <p>
            <b>Duration:</b> {result.duration}
          </p>

          {!result.ok && (
            <div
              style={{
                background: "#450a0a",
                padding: 15,
                borderRadius: 8,
                marginTop: 15,
              }}
            >
              <h3>Backend Error</h3>

              <pre
                style={{
                  whiteSpace: "pre-wrap",
                  color: "#fca5a5",
                }}
              >
{JSON.stringify(result.body, null, 2)}
              </pre>

              <button onClick={copyError}>
                Copy Error
              </button>
            </div>
          )}

          <h3>Response JSON</h3>

          <pre
            style={{
              background: "#020617",
              padding: 15,
              overflow: "auto",
            }}
          >
{JSON.stringify(result.body, null, 2)}
          </pre>
        </div>
      )}

      <div
        style={{
          marginTop: 30,
        }}
      >
        <h2>History</h2>

        <table
          width="100%"
          cellPadding="10"
          style={{
            borderCollapse: "collapse",
          }}
        >
          <thead>
            <tr>
              <th align="left">Time</th>
              <th align="left">Endpoint</th>
              <th align="left">Status</th>
              <th align="left">Duration</th>
            </tr>
          </thead>

          <tbody>
            {history.map((item, index) => (
              <tr key={index}>
                <td>{item.time}</td>
                <td>{item.endpoint}</td>
                <td>{item.status}</td>
                <td>{item.duration}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}