// pages/TestProduct.jsx

import React, { useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";

const TestProduct = () => {
  const { slug } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const call = async (url) => {
    try {
      const { data } = await axios.get(url);
      console.log("RESPONSE:", data);
      setData(data);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    }
  };

  return (
    <div className="p-6">
      <h2>🔧 Test /api/product</h2>

      <p><code>slug from URL: {slug}</code></p>

      <button onClick={() => call("/api/product/debug-db")} className="mr-2">
        /debug-db
      </button>

      <button onClick={() => call("/api/product/debug-id/00e1d21b-7a9b-4a31-8ba6-bc516a073242")} className="mr-2">
        /debug-id
      </button>

      <button onClick={() => call(`/api/product/slug/${encodeURIComponent(slug)}`)}>
        /slug/:slug
      </button>

      {data && (
        <pre className="mt-4 text-xs max-h-96 overflow-auto">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
      {error && (
        <p className="text-red-600">{error}</p>
      )}
    </div>
  );
};

export default TestProduct;