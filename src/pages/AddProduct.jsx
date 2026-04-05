import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import imageCompression from 'browser-image-compression';
import { Upload, X, Image as ImageIcon, MapPin, Truck, Phone, Mail } from 'lucide-react';

// Your config imports
import { brands, colors, categoryFields, conditions, featuresByCategory, models, ramOptions, sims, storageOptions, years, engines, fuelTypes, locationsByState, fieldOptions } from '../config'; // Adjust path

const AddProduct = ({ user }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    price: '',
    category_id: '',
    attributes: {},
    location_state: '',
    location_city: '',
    delivery: { duration: '', fee: '' },
    contact: { email: user?.email || '', phone: '' },
    state: 'draft',
    images: [],
    // Add other fields as needed
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [categories, setCategories] = useState([]);
  const [dynamicFields, setDynamicFields] = useState({});
  const [imageModal, setImageModal] = useState(null);
  const draftKey = 'product_draft_' + user?.id;
  const saveTimeoutRef = useRef(null);

  // Load categories from API
  useEffect(() => {
    fetch('/api/marketplace/categories')
      .then(res => res.json())
      .then(setCategories)
      .catch(console.error);
  }, []);

  // Load draft from localStorage
  useEffect(() => {
    const draft = localStorage.getItem(draftKey);
    if (draft) {
      setFormData(JSON.parse(draft));
    }
  }, [draftKey]);

  // Auto-save draft
  const saveDraft = useCallback(() => {
    localStorage.setItem(draftKey, JSON.stringify(formData));
  }, [formData, draftKey]);

  useEffect(() => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(saveDraft, 10000);
    return () => clearTimeout(saveTimeoutRef.current);
  }, [formData, saveDraft]);

  // Update dynamic fields based on category
  useEffect(() => {
    const cat = categories.find(c => c.id === formData.category_id);
    if (cat) {
      setDynamicFields(categoryFields[cat.name] || {});
    }
  }, [formData.category_id, categories, categoryFields]);

  // Validation
  const validateField = (name, value) => {
    if (!value && name !== 'description') return 'Required';
    if (name === 'price' && (isNaN(value) || value <= 0)) return 'Invalid price';
    if (name === 'contact.email' && !/S+@S+.S+/.test(value)) return 'Invalid email';
    return '';
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setErrors(prev => ({ ...prev, [name]: validateField(name, value) }));
  };

  const handleObjectChange = (path, value) => {
    const keys = path.split('.');
    setFormData(prev => {
      const newData = { ...prev };
      let obj = newData;
      for (let i = 0; i < keys.length - 1; i++) obj = obj[keys[i]] = { ...obj[keys[i]] };
      obj[keys[keys.length - 1]] = value;
      return newData;
    });
  };

  // Image handling
  const maxImages = 6;
  const onDrop = useCallback(async (acceptedFiles) => {
    const newImages = await Promise.all(
      acceptedFiles.slice(0, maxImages - formData.images.length).map(async (file) => {
        if (file.size > 5 * 1024 * 1024) return null; // 5MB limit
        const options = { maxSizeMB: 1, maxWidthOrHeight: 1920 };
        const compressed = await imageCompression(file, options);
        return {
          file: compressed,
          preview: URL.createObjectURL(compressed),
          url: '', // Backend will fill
        };
      }).filter(Boolean)
    );
    setFormData(prev => ({ ...prev, images: [...prev.images, ...newImages] }));
  }, [formData.images]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': [] },
    multiple: true,
    maxFiles: maxImages,
  });

  // Drag & Drop for images reorder [web:11]
  const moveImage = (dragIndex, hoverIndex) => {
    setFormData(prev => {
      const images = [...prev.images];
      const [dragged] = images.splice(dragIndex, 1);
      images.splice(hoverIndex, 0, dragged);
      return { ...prev, images };
    });
  };

  const ImageItem = ({ image, index }) => {
    const ref = useRef(null);
    const [{ isDragging }, drag] = useDrag({
      type: 'image',
      item: { index },
      collect: (monitor) => ({ isDragging: !!monitor.isDragging() }),
    });
    const [, drop] = useDrop({
      accept: 'image',
      hover: (item) => {
        if (item.index === index) return;
        moveImage(item.index, index);
        item.index = index;
      },
    });

    const removeImage = () => {
      URL.revokeObjectURL(image.preview);
      setFormData(prev => ({ ...prev, images: prev.images.filter((_, i) => i !== index) }));
    };

    return (
      <div ref={drag(drop(ref))} className={`relative p-2 bg-gray-100 rounded-lg cursor-move ${isDragging ? 'opacity-50' : ''}`}>
        <img src={image.preview} alt="Preview" className="w-20 h-20 object-cover rounded" onClick={() => setImageModal(index)} />
        <button onClick={removeImage} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1">
          <X size={16} />
        </button>
      </div>
    );
  };

  // Submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    const newErrors = {};
    Object.keys(formData).forEach(key => {
      if (key !== 'images' && key !== 'attributes') {
        newErrors[key] = validateField(key, formData[key]);
      }
    });
    if (formData.images.length === 0) newErrors.images = 'At least one image required';
    setErrors(newErrors);

    if (Object.values(newErrors).some(err => err)) return;

    setLoading(true);
    const data = new FormData();
    Object.keys(formData).forEach(key => {
      if (key === 'images') {
        formData.images.forEach((img, i) => {
          data.append(`images[${i}]`, img.file);
        });
      } else if (typeof formData[key] === 'object') {
        data.append(key, JSON.stringify(formData[key]));
      } else {
        data.append(key, formData[key]);
      }
    });
    data.append('user_id', user.id);
    data.append('seller_id', user.id);

    try {
      const res = await fetch('/api/marketplace/products', {
        method: 'POST',
        body: data,
      });
      if (res.ok) {
        setSuccess('Product created successfully!');
        localStorage.removeItem(draftKey);
        setFormData({ /* reset */ });
      } else {
        throw new Error('Submission failed');
      }
    } catch (err) {
      setErrors({ submit: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="max-w-2xl mx-auto p-4 sm:p-6 bg-white rounded-xl shadow-lg">
        <h1 className="text-2xl font-bold mb-6 text-center">Add New Product</h1>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Fields */}
          <div>
            <label className="block text-sm font-medium mb-2 flex items-center"><span>Title</span></label>
            <input name="title" value={formData.title} onChange={handleChange} className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500" />
            {errors.title && <p className="text-red-500 text-sm mt-1">{errors.title}</p>}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Price ($)</label>
              <input name="price" type="number" step="0.01" value={formData.price} onChange={handleChange} className="w-full p-3 border rounded-lg" />
              {errors.price && <p className="text-red-500 text-sm">{errors.price}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Category</label>
              <select name="category_id" value={formData.category_id} onChange={handleChange} className="w-full p-3 border rounded-lg">
                <option value="">Select Category</option>
                {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
              </select>
            </div>
          </div>

          <textarea name="description" placeholder="Description" value={formData.description} onChange={handleChange} rows={4} className="w-full p-3 border rounded-lg" />

          {/* Dynamic Fields */}
          {Object.entries(dynamicFields).map(([field, options]) => (
            <div key={field}>
              <label className="block text-sm font-medium mb-2">{field}</label>
              <select name={`attributes.${field}`} value={formData.attributes[field] || ''} onChange={(e) => handleObjectChange(`attributes.${field}`, e.target.value)} className="w-full p-3 border rounded-lg">
                <option value="">{field}...</option>
                {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </div>
          ))}

          {/* Location */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2 flex items-center"><MapPin size={16} className="mr-1" /> State</label>
              <select name="location_state" value={formData.location_state} onChange={handleChange} className="w-full p-3 border rounded-lg">
                <option value="">Select State</option>
                {Object.keys(locationsByState).map(state => <option key={state} value={state}>{state}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">City</label>
              <input name="location_city" value={formData.location_city} onChange={handleChange} className="w-full p-3 border rounded-lg" list={`cities-${formData.location_state}`} />
              {formData.location_state && (
                <datalist id={`cities-${formData.location_state}`}>
                  {locationsByState[formData.location_state]?.map(city => <option key={city} value={city} />)}
                </datalist>
              )}
            </div>
          </div>

          {/* Delivery */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2 flex items-center"><Truck size={16} className="mr-1" /> Duration (days)</label>
              <input name="delivery.duration" type="number" value={formData.delivery.duration} onChange={(e) => handleObjectChange('delivery.duration', e.target.value)} className="w-full p-3 border rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Fee ($)</label>
              <input name="delivery.fee" type="number" step="0.01" value={formData.delivery.fee} onChange={(e) => handleObjectChange('delivery.fee', e.target.value)} className="w-full p-3 border rounded-lg" />
            </div>
          </div>

          {/* Contact */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2 flex items-center"><Mail size={16} className="mr-1" /> Email</label>
              <input name="contact.email" value={formData.contact.email} onChange={(e) => handleObjectChange('contact.email', e.target.value)} className="w-full p-3 border rounded-lg" />
              {errors['contact.email'] && <p className="text-red-500 text-sm">{errors['contact.email']}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 flex items-center"><Phone size={16} className="mr-1" /> Phone</label>
              <input name="contact.phone" value={formData.contact.phone} onChange={(e) => handleObjectChange('contact.phone', e.target.value)} className="w-full p-3 border rounded-lg" />
            </div>
          </div>

          {/* Images */}
          <div>
            <label className="block text-sm font-medium mb-4 flex items-center">
              <ImageIcon size={16} className="mr-1" /> Images (Max 6)
            </label>
            <div {...getRootProps()} className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}`}>
              <input {...getInputProps()} />
              <p>{isDragActive ? 'Drop images here...' : 'Drag & drop or click to upload images'}</p>
            </div>
            {formData.images.length > 0 && (
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {formData.images.map((image, index) => <ImageItem key={index} image={image} index={index} />)}
              </div>
            )}
            {errors.images && <p className="text-red-500 text-sm mt-2">{errors.images}</p>}
            {formData.images.length >= maxImages && <p className="text-orange-500 text-sm">Max 6 images reached.</p>}
          </div>

          {success && <div className="p-4 bg-green-100 border border-green-400 text-green-700 rounded-lg">{success}</div>}
          {errors.submit && <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">{errors.submit}</div>}

          <div className="flex flex-col sm:flex-row gap-4 pt-4">
            <button type="submit" disabled={loading} className="flex-1 bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50">
              {loading ? 'Publishing...' : 'Publish Product'}
            </button>
            <button type="button" onClick={saveDraft} className="flex-1 bg-gray-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-gray-700">
              Save Draft
            </button>
          </div>
        </form>
      </div>

      {/* Image Modal */}
      {imageModal !== null && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setImageModal(null)}>
          <img src={formData.images[imageModal]?.preview} alt="Full" className="max-w-full max-h-full object-contain" />
        </div>
      )}
    </DndProvider>
  );
};

export default AddProduct;