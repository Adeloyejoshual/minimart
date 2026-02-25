// AddProduct.jsx - CLOUDINARY DIRECT UPLOAD TEST
import { useState, useEffect } from 'react';

const AddProduct = () => {
  const [formData, setFormData] = useState({
    name: '', price: '', description: '', category: '', stock: ''
  });
  const [file, setFile] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // TEST 1: Cloudinary Direct Upload
  const testCloudinary = async () => {
    if (!file) {
      setMessage('❌ Select image first');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', '0HoyRB6wC0eba-Cbat0nhiIRoa8');

      const response = await fetch(
        'https://api.cloudinary.com/v1_1/di6zeyneq/image/upload',
        { method: 'POST', body: formData }
      );

      const result = await response.json();
      
      if (result.secure_url) {
        setMessage(`✅ CLOUDINARY WORKS! URL: ${result.secure_url}`);
        console.log('✅ Image URL:', result.secure_url);
      } else {
        setMessage('❌ Cloudinary failed: ' + JSON.stringify(result));
      }
    } catch (error) {
      setMessage('❌ Error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // TEST 2: Backend Save (no image handling)
  const testBackend = async () => {
    try {
      const response = await fetch('/api/marketplace/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Test Product',
          price: 1000,
          image: 'https://via.placeholder.com/400'
        })
      });
      
      const result = await response.json();
      setMessage('✅ Backend works! ' + JSON.stringify(result));
    } catch (error) {
      setMessage('❌ Backend failed: ' + error.message);
    }
  };

  const handleChange = (e) => {
    const { name, value, files } = e.target;
    if (name === 'image') {
      setFile(files[0]);
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  return (
    <div className="p-8 max-w-2xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold">Cloudinary Test</h1>

      {/* TEST 1: Cloudinary Direct */}
      <div className="p-6 border rounded-xl bg-blue-50">
        <h2 className="text-xl font-semibold mb-4">1. Test Cloudinary Upload</h2>
        <input 
          type="file" 
          name="image" 
          onChange={handleChange}
          accept="image/*"
          className="mb-4 p-2 border rounded"
        />
        <button
          onClick={testCloudinary}
          disabled={loading || !file}
          className="bg-blue-500 text-white px-6 py-2 rounded hover:bg-blue-600 disabled:opacity-50"
        >
          {loading ? 'Uploading...' : 'Test Cloudinary'}
        </button>
      </div>

      {/* TEST 2: Backend */}
      <div className="p-6 border rounded-xl bg-green-50">
        <h2 className="text-xl font-semibold mb-4">2. Test Backend</h2>
        <button
          onClick={testBackend}
          className="bg-green-500 text-white px-6 py-2 rounded hover:bg-green-600"
          disabled={loading}
        >
          Test Backend Save
        </button>
      </div>

      {/* RESULT */}
      {message && (
        <div className={`p-4 rounded-xl font-mono text-sm ${
          message.includes('✅') ? 'bg-green-100 text-green-800 border border-green-300' 
                               : 'bg-red-100 text-red-800 border border-red-300'
        }`}>
          {message}
        </div>
      )}
    </div>
  );
};

export default AddProduct;