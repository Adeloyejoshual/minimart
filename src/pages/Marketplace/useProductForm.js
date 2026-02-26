// hooks/useProductForm.js
import { useState, useCallback, useEffect, useRef } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { categoryFields, categoryRules, brands, models, locationsByState } from '../config';

export const useProductForm = () => {
  const { user, isAuthenticated, getAccessTokenSilently } = useAuth0();
  const [formData, setFormData] = useState({});
  const [images, setImages] = useState([]);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [message, setMessage] = useState({ text: '', type: 'info' });
  const prevCategoryRef = useRef('');

  const initializeForm = useCallback(() => ({
    title: '',
    price: '',
    category: '',
    state: '',
    city: '',
    phone_number: user?.phone_number || '',
    poster_name: user?.name || '',
    images: [],
    features: []
  }), [user]);

  // Real-time validation
  const validateField = useCallback((field, value) => {
    const rules = {
      title: value.length < 3 ? 'Title must be 3+ chars' : null,
      price: parseFloat(value) <= 0 ? 'Price > 0 required' : null,
      category: !value ? 'Category required' : null
    };
    return rules[field];
  }, []);

  const handleInputChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    if (touched[name]) {
      const error = validateField(name, value);
      setErrors(prev => ({ ...prev, [name]: error }));
    }
  }, [touched, validateField]);

  const handleBlur = useCallback((e) => {
    const { name, value } = e.target;
    setTouched(prev => ({ ...prev, [name]: true }));
    const error = validateField(name, value);
    setErrors(prev => ({ ...prev, [name]: error }));
  }, [validateField]);

  const validateForm = useCallback(() => {
    const newErrors = {};
    const required = ['title', 'price', 'category'];
    
    required.forEach(field => {
      if (!formData[field]) newErrors[field] = `${field} required`;
    });
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  const autosaveDraft = useCallback(() => {
    localStorage.setItem('productDraft', JSON.stringify({ ...formData, images: [] }));
  }, [formData]);

  return {
    formData,
    setFormData,
    images,
    setImages,
    errors,
    touched,
    loading,
    setLoading,
    uploadProgress,
    setUploadProgress,
    message,
    setMessage,
    handleInputChange,
    handleBlur,
    validateForm,
    initializeForm,
    autosaveDraft,
    prevCategoryRef,
    isAuthenticated,
    user,
    getAccessTokenSilently
  };
};