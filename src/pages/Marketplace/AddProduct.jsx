// AddProduct.jsx - Connects to YOUR existing backend API
import { useState, useEffect } from 'react';

const AddProduct = () => {
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    description: '',
    image: null,
    category: ''
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [products, setProducts] = useState([]);

  // Fetch existing products on load
  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const response = await fetch('/api/products'); // Your backend endpoint
      const data = await response.json();
      setProducts(data);
    } catch (error) {
      console.error('Failed to fetch products');
    }
  };

  const handleChange = (e) => {
    const { name, value, files } = e.target;
    if (name === 'image') {
      setFormData({ ...formData, image: files[0] });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    // Create FormData for file upload
    const productData = new FormData();
    productData.append('name', formData.name);
    productData.append('price', formData.price);
    productData.append('description', formData.description);
    productData.append('category', formData.category);
    if (formData.image) {
      productData.append('image', formData.image);
    }

    try {
      const response = await fetch('/api/products', {
        method: 'POST',
        body: productData, // Backend handles Cloudinary upload
      });

      if (response.ok) {
        setMessage('✅ Product added successfully!');
        setFormData({ name: '', price: '', description: '', image: null, category: '' });
        fetchProducts(); // Refresh list
      } else {
        setMessage('❌ Failed to add product');
      }
    } catch (error) {
      setMessage('❌ Network error - check backend');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="add-product-container p-6 max-w-2xl mx-auto">
      {message && (
        <div className={`p-4 rounded-lg mb-6 ${message.includes('✅') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 bg-white p-6 rounded-lg shadow-lg">
        <h2 className="text-2xl font-bold text-gray-800">Add Product</h2>
        
        <input type="text" name="name" placeholder="Product Name" value={formData.name} onChange={handleChange} required 
               className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500" />
        
        <input type="number" name="price" placeholder="Price (₦)" value={formData.price} onChange={handleChange} step="0.01" required 
               className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500" />
        
        <textarea name="description" placeholder="Description" value={formData.description} onChange={handleChange} rows="3" 
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500" />
        
        <select name="category" value={formData.category} onChange={handleChange} className="w-full p-3 border rounded-lg">
          <option value="">Select Category</option>
          <option value="electronics">Electronics</option>
          <option value="clothing">Clothing</option>
          <option value="groceries">Groceries</option>
        </select>

        <input type="file" name="image" accept="image/*" onChange={handleChange} 
               className="w-full p-3 border rounded-lg" />

        <button type="submit" disabled={loading} className="w-full bg-green-500 text-white py-3 px-6 rounded-lg hover:bg-green-600 disabled:opacity-50">
          {loading ? 'Adding...' : 'Add Product'}
        </button>
      </form>

      {/* Products Grid */}
      <div className="mt-8">
        <h3 className="text-xl font-semibold mb-4">Products ({products.length})</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map((product) => (
            <div key={product._id} className="border rounded-lg p-4 hover:shadow-md">
              <img src={product.image} alt={product.name} className="w-full h-48 object-cover rounded-lg mb-3" />
              <h4 className="font-semibold text-lg">{product.name}</h4>
              <p className="text-2xl font-bold text-green-600">₦{parseFloat(product.price).toLocaleString()}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AddProduct;