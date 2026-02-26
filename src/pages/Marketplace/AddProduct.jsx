// AddProduct.jsx - CLEAN ORCHESTRATOR
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { useProductForm } from './useProductForm';
import ImageUploader from './ImageUploader';
import ProductBasicInfo from './ProductBasicInfo';
import ProductLocationSection from './ProductLocationSection';
import ProductDynamicFields from './ProductDynamicFields';
import PromotionSidebar from './PromotionSidebar';
import ProductPreviewList from './ProductPreviewList';

const AddProduct = () => {
  const { 
    formData, setFormData, images, setImages, errors, touched, loading, setLoading,
    handleInputChange, handleBlur, validateForm, initializeForm, isAuthenticated, user 
  } = useProductForm();
  
  const [products, setProducts] = useState([]);
  const [selectedFeatures, setSelectedFeatures] = useState([]);

  const computedFields = useMemo(() => ({
    visibleFields: categoryFields[formData.category] || [],
    currentFeatures: featuresByCategory[formData.category] || []
  }), [formData.category]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isAuthenticated || !validateForm()) return;

    setLoading(true);
    try {
      const token = await getAccessTokenSilently();
      const response = await fetch('/api/marketplace/products', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ ...formData, images, features: selectedFeatures })
      });

      if (response.ok) {
        setFormData(initializeForm());
        setImages([]);
        fetchProducts();
      }
    } catch (error) {
      console.error('Submit error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = useCallback(async () => {
    const token = await getAccessTokenSilently();
    const response = await fetch('/api/marketplace/products', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await response.json();
    setProducts(data.slice(0, 6));
  }, [getAccessTokenSilently]);

  const renderSelectField = useCallback((fieldName) => (
    // Render logic here
  ), [formData, errors, touched, handleInputChange, handleBlur]);

  if (!isAuthenticated) {
    return <div>Please log in to add products</div>;
  }

  return (
    <div className="add-product-container">
      <form onSubmit={handleSubmit}>
        <ProductBasicInfo 
          formData={formData}
          errors={errors}
          touched={touched}
          handleInputChange={handleInputChange}
          handleBlur={handleBlur}
          renderSelectField={renderSelectField}
        />
        
        <ProductLocationSection 
          formData={formData}
          handleInputChange={handleInputChange}
          renderSelectField={renderSelectField}
        />
        
        <ProductDynamicFields 
          formData={formData}
          computedFields={computedFields}
          renderSelectField={renderSelectField}
          selectedFeatures={selectedFeatures}
          toggleFeature={setSelectedFeatures}
        />
        
        <ImageUploader images={images} setImages={setImages} />
        
        <PromotionSidebar promotionPlans={promotionPlans} />
      </form>
      
      <ProductPreviewList products={products} />
    </div>
  );
};

export default AddProduct;