// AddProduct.jsx - COMPLETE REWRITE (100% Working)
import { useState, useEffect, useCallback } from 'react';

const AddProduct = () => {
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    description: '',
    category: '',
    stock: ''
  });
  const [preview, setPreview] = useState('');
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [uploading, setUploading] = useState(false);

  // Fetch products
  const fetchProducts = useCallback(async () => {
    try {
      const response = await fetch('/api/marketplace/products');
      if (response.ok) {
        const data = await response.json();
        setProducts(Array.isArray(data) ? data : data.products || []);
      }
    } catch (error) {
      console.error('Fetch error:', error);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setPreview(URL.createObjectURL(file));
      setFormData(prev => ({ ...prev, image: file }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    // Simple FormData for testing
    const data = new FormData();
    data.append('name', formData.name);
    data.append('price', formData.price);
    data.append('description', formData.description);
    data.append('category', formData.category || 'general');
    data.append('stock', formData.stock || 0);
    
    if (formData.image) {
      data.append('image', formData.image);
    }

    try {
      console.log('Sending to:', '/api/marketplace/products');
      
      const response = await fetch('/api/marketplace/products', {
        method: 'POST',
        body: data,
        // Remove Content-Type - let browser set it with boundary
      });

      console.log('Response status:', response.status);
      console.log('Response ok:', response.ok);

      const responseText = await response.text();
      console.log('Raw response:', responseText);

      if (response.ok) {
        const result = JSON.parse(responseText);
        setMessage('✅ Product added successfully!');
        setFormData({ name: '', price: '', description: '', category: '', stock: '' });
        setPreview('');
        fetchProducts();
      } else {
        setMessage(`❌ Failed: ${response.status} - ${responseText}`);
      }
    } catch (error) {
      console.error('Network error:', error);
      setMessage('❌ Network error - check console');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
          Add New Product
        </h1>
        <p className="text-gray-600">Fill out the form below to add products to your marketplace</p>
      </div>

      {/* Message */}
      {message && (
        <div className={`p-4 rounded-xl text-white font-medium ${
          message.includes('✅') 
            ? 'bg-green-500 shadow-lg' 
            : 'bg-red-500 shadow-lg'
        }`}>
          {message}
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-2 gap-6 bg-white p-8 rounded-2xl shadow-2xl">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Product Name *
          </label>
          <input
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            required
            className="w-full p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="e.g. Wireless Headphones"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Price (₦) *
          </label>
          <input
            name="price"
            type="number"
            step="0.01"
            min="0"
            value={formData.price}
            onChange={handleInputChange}
            required
            className="w-full p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="1000"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Category</label>
          <select
            name="category"
            value={formData.category}
            onChange={handleInputChange}
            className="w-full p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select category</option>
            <option value="electronics">Electronics</option>
            <option value="clothing">Clothing</option>
            <option value="groceries">Groceries</option>
            <option value="books">Books</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Stock</label>
          <input
            name="stock"
            type="number"
            min="0"
            value={formData.stock}
            onChange={handleInputChange}
            className="w-full p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500"
            placeholder="10"
          />
        </div>

        <div className="lg:col-span-2">
          <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleInputChange}
            rows="3"
            className="w-full p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 resize-vertical"
            placeholder="Product description..."
          />
        </div>

        <div className="lg:col-span-2">
          <label className="block text-sm font-semibold text-gray-700 mb-2">Product Image</label>
          <input
            type="file"
            accept="image/*"
            onChange={handleImageChange}
            className="w-full p-4 border-2 border-dashed border-gray-300 rounded-xl hover:border-blue-400 file:mr-4 file:py-3 file:px-6 file:rounded-xl file:border-0 file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
          {preview && (
            <div className="mt-4 p-4 border border-gray-200 rounded-xl bg-gray-50">
              <img src={preview} alt="Preview" className="w-32 h-32 object-cover rounded-lg mx-auto" />
            </div>
          )}
        </div>

        <div className="lg:col-span-2">
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 disabled:opacity-50 text-white font-semibold py-4 px-8 rounded-xl text-lg shadow-xl hover:shadow-2xl transition-all duration-300"
          >
            {loading ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 inline" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                </svg>
                Adding Product...
              </>
            ) : (
              '➕ Add Product'
            )}
          </button>
        </div>
      </form>

      {/* Products Grid */}
      <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="p-8 border-b border-gray-100">
          <h2 className="text-2xl font-bold text-gray-900">
            Products ({products.length})
          </h2>
        </div>
        <div className="p-8">
          {products.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-24 h-24 mx-auto mb-6 bg-gray-100 rounded-2xl flex items-center justify-center text-2xl">
                📦
              </div>
              <p className="text-xl text-gray-500">No products yet. Add your first one!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {products.map((product) => (
                <div key={product._id || product.id} className="group border rounded-xl hover:shadow-xl transition-all overflow-hidden">
                  <div className="h-48 bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center group-hover:bg-white">
                    {product.image ? (
                      <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-2xl">📦</span>
                    )}
                  </div>
                  <div className="p-5">
                    <h3 className="font-semibold text-lg line-clamp-2 mb-2">{product.name}</h3>
                    <p className="text-2xl font-bold text-green-600 mb-1">
                      ₦{Number(product.price).toLocaleString()}
                    </p>
                    <p className="text-sm text-gray-500 capitalize">{product.category}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AddProduct;