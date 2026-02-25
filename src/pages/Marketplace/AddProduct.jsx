// AddProduct.jsx - MINIMAL WORKING VERSION
import { useState } from 'react';
import { useAuth0 } from '@auth0/auth0-react';

const API_BASE_URL = 'https://minimart-ivrm.onrender.com/api/marketplace';

export default function AddProductTest() {
  const { user, getAccessTokenSilently } = useAuth0();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');

  const testSubmit = async () => {
    setLoading(true);
    try {
      const token = await getAccessTokenSilently();
      const response = await fetch(`${API_BASE_URL}/products`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title: 'Test iPhone 15',
          price: 50000,
          category: 'phones',
          phone_number: '08012345678',
          state: 'Lagos',
          sellerId: user?.sub
        })
      });

      const data = await response.json();
      setResult(JSON.stringify(data, null, 2));
    } catch (error) {
      setResult('ERROR: ' + error.message);
    }
    setLoading(false);
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto' }}>
      <h1>🧪 AddProduct Test</h1>
      <button 
        onClick={testSubmit} 
        disabled={loading}
        style={{
          padding: '1rem 2rem',
          background: '#10b981',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          fontSize: '16px'
        }}
      >
        {loading ? 'Testing...' : 'TEST SUBMIT'}
      </button>
      
      {result && (
        <pre style={{ 
          marginTop: '2rem', 
          padding: '1rem', 
          background: '#f3f4f6', 
          borderRadius: '8px',
          whiteSpace: 'pre-wrap'
        }}>
          {result}
        </pre>
      )}
    </div>
  );
}