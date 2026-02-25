
import { useState, useEffect, useCallback } from 'react';

const AddProduct = () => {
  const [formData, setFormData] = useState({
    name: '', price: '', description: '', category: '', stock: ''
  });
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // Fetch products
  const fetchProducts = useCallback(async () => {
    try {
      const response = await fetch('/api/marketplace/products');
      const data = await response.json();
      setProducts(Array.isArray(data) ? data : data.products || []);
    } catch (error) {
      console.error('Fetch error:', error);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // ✅ CLOUDINARY DIRECT UPLOAD (YOUR TEST THAT WORKED!)
  const uploadToCloudinary = (imageFile) => {
    return new Promise((resolve, reject) => {
      const formData = new FormData();
      formData.append('file', imageFile);
      formData.append('upload_preset', '0HoyRB6wC0eba-Cbat0nhiIRoa8');

      fetch('https://api.cloudinary.com/v1_1/di6zeyneq/image/upload', {
        method: 'POST',
        body: formData
      })
      .then(res => res.json())
      .then(data => resolve(data.secure_url))
      .catch(reject);
    });
  };

  const handleChange = (e) => {
    const { name, value, files } = e.target;
    if (name === 'image') {
      const imageFile = files[0];
      setFile(imageFile);
      if (imageFile) setPreview(URL.createObjectURL(imageFile));
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      // STEP 1: Upload image to Cloudinary DIRECTLY (like your test)
      let imageUrl = '';
      if (file) {
        setMessage('📤 Uploading image...');
        imageUrl = await uploadToCloudinary(file);
        setMessage('✅ Image uploaded! Saving product...');
      }

      // STEP 2: Save product to backend (JSON only)
      const response = await fetch('/api/marketplace/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          price: parseFloat(formData.price),
          description: formData.description,
          category: formData.category || 'general',
          image: imageUrl || 'https://via.placeholder.com/400/eee?text=No+Image',
          stock: parseInt(formData.stock) || 0
        })
      });

      if (response.ok) {
        setMessage('🎉 Product added successfully!');
        fetchProducts();
        setFormData({ name: '', price: '', description: '', category: '', stock: '' });
        setFile(null);
        setPreview('');
      } else {
        setMessage('❌ Save failed: ' + await response.text());
      }
    } catch (error) {
      setMessage('❌ Error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-4xl font-bold text-gray-900 mb-8">Add Product</h1>
      
      {message && (
        <div className={`p-4 rounded-xl mb-6 font-medium ${
          message.includes('✅') || message.includes('🎉')
            ? 'bg-green-100 text-green-800 border border-green-300'
            : 'bg-red-100 text-red-800 border border-red-300'
        }`}>
          {message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white p-8 rounded-2xl shadow-xl space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-semibold mb-2">Name *</label>
            <input name="name" value={formData.name} onChange={handleChange} required 
                   className="w-full p-4 border rounded-xl focus:ring-2 focus:ring-blue-500" />
          </div>
          
          <div>
            <label className="block text-sm font-semibold mb-2">Price (₦) *</label>
            <input name="price" type="number" step="0.01" value={formData.price} 
                   onChange={handleChange} required 
                   className="w-full p-4 border rounded-xl focus:ring-2 focus:ring-blue-500" />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">Category</label>
            <select name="category" value={formData.category} onChange={handleChange}
                    className="w-full p-4 border rounded-xl focus:ring-2 focus:ring-blue-500">
              <option value="">Select...</option>
              <option value="electronics">Electronics</option>
              <option value="clothing">Clothing</option>
              <option value="groceries">Groceries</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">Stock</label>
            <input name="stock" type="number" min="0" value={formData.stock} 
                   onChange={handleChange} 
                   className="w-full p-4 border rounded-xl focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold mb-2">Description</label>
          <textarea name="description" value={formData.description} onChange={handleChange} rows="3"
                    className="w-full p-4 border rounded-xl focus:ring-2 focus:ring-blue-500" />
        </div>

        <div>
          <label className="block text-sm font-semibold mb-2">Image</label>
          <input type="file" name="image" accept="image/*" onChange={handleChange}
                 className="w-full p-4 border-2 border-dashed rounded-xl file:mr-4 file:py-2 file:px-4 file:rounded file:bg-blue-50" />
          {preview && (
            <img src={preview} alt="Preview" className="mt-4 w-32 h-32 object-cover rounded-xl" />
          )}
        </div>

        <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white py-4 px-8 rounded-xl text-lg font-semibold hover:bg-blue-700 disabled:opacity-50">
          {loading ? 'Adding...' : '➕ Add Product'}
        </button>
      </form>

      {/* Products List */}
      <div className="mt-12">
        <h2 className="text-2xl font-bold mb-6">Products ({products.length})</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map(product => (
            <div key={product._id} className="border rounded-xl p-6 hover:shadow-xl">
              <img src={product.image} alt={product.name} className="w-full h-48 object-cover rounded-xl mb-4" />
              <h3 className="font-bold text-xl mb-2">{product.name}</h3>
              <p className="text-2xl font-bold text-green-600 mb-2">
                ₦{Number(product.price).toLocaleString()}
              </p>
              <p className="text-sm text-gray-500">{product.category} • {product.stock} in stock</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AddProduct;