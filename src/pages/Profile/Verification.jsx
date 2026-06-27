import { useState, useEffect } from "react";
import axios from "axios";

const API = import.meta.env.VITE_API_BASE_URL + "/api/verification";

export default function VerifyTest() {
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const token = localStorage.getItem("marketplace_token");

  const send = async () => {
    setLoading(true); setError(null); setData(null);
    try {
      const res = await axios.post(`${API}/send-email-otp`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setData(res.data);
    } catch (e) {
      setError(e.response?.data || { message: e.message });
    } finally { setLoading(false); }
  };

  const verify = async () => {
    setLoading(true); setError(null); setData(null);
    try {
      const res = await axios.post(`${API}/verify-email-otp`, { otp }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setData(res.data);
    } catch (e) {
      setError(e.response?.data || { message: e.message });
    } finally { setLoading(false); }
  };

  useEffect(() => { if (token) send(); }, []);

  return (
    <div style={{ maxWidth: 500, margin: "60px auto", fontFamily: "system-ui", padding: 20 }}>
      <h1>OTP Debug Page</h1>
      {!token && <div style={{background:'#fee', padding:12, borderRadius:8}}>No token found. Login first.</div>}
      
      <button onClick={send} disabled={loading || !token} style={{padding:'10px 16px', marginTop:10}}>
        {loading ? 'Sending...' : 'Send New OTP'}
      </button>

      <div style={{marginTop:20}}>
        <input value={otp} onChange={e=>setOtp(e.target.value.replace(/\D/g,'').slice(0,6))}
          placeholder="Enter 6-digit code" 
          style={{padding:12, fontSize:18, letterSpacing:4, width:'100%', textAlign:'center'}} />
        <button onClick={verify} disabled={otp.length!==6 || loading} 
          style={{width:'100%', padding:12, marginTop:10, background:'#111', color:'#fff'}}>
          Verify
        </button>
      </div>

      {data && (
        <div style={{marginTop:20, background:'#e8f5e9', padding:16, borderRadius:8, border:'1px solid #4caf50'}}>
          <h3 style={{margin:'0 0 8px', color:'#2e7d32'}}>SUCCESS</h3>
          <pre style={{whiteSpace:'pre-wrap', fontSize:13, margin:0}}>{JSON.stringify(data, null, 2)}</pre>
        </div>
      )}

      {error && (
        <div style={{marginTop:20, background:'#ffebee', padding:16, borderRadius:8, border:'1px solid #e53935'}}>
          <h3 style={{margin:'0 0 8px', color:'#c62828'}}>ERROR</h3>
          <pre style={{whiteSpace:'pre-wrap', fontSize:13, margin:0, color:'#b71c1c'}}>{JSON.stringify(error, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}