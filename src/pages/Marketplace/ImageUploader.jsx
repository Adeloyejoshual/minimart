// components/ImageUploader.jsx
import React, { useCallback, useRef } from 'react';
import { useAuth0 } from '@auth0/auth0-react';

const ImageUploader = ({ images, setImages, maxImages = 10 }) => {
  const { getAccessTokenSilently } = useAuth0();
  const fileInputRef = useRef(null);

  const uploadToCloudinary = useCallback(async (file) => {
    const token = await getAccessTokenSilently();
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', 'marketplace_prod');

    const response = await fetch('https://api.cloudinary.com/v1_1/YOUR_CLOUD_NAME/image/upload', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData
    });

    const data = await response.json();
    return data.secure_url;
  }, [getAuth0]);

  const handleImageChange = useCallback(async (files) => {
    const newImages = Array.from(files)
      .filter(file => file.size <= 10 * 1024 * 1024)
      .slice(0, maxImages - images.length)
      .map(file => ({ file, preview: URL.createObjectURL(file) }));

    const urls = await Promise.all(newImages.map(({ file }) => uploadToCloudinary(file)));
    
    setImages(prev => [...prev, ...urls.map(url => ({ url, preview: url }))]);
  }, [images.length, uploadToCloudinary]);

  const removeImage = useCallback((index) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  }, []);

  return (
    <div className="image-uploader">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*"
        onChange={(e) => handleImageChange(e.target.files)}
        className="hidden"
      />
      <div className="upload-area" onClick={() => fileInputRef.current?.click()}>
        📸 Upload Images ({images.length}/{maxImages})
      </div>
      <div className="image-previews">
        {images.map((img, index) => (
          <div key={index} className="image-preview">
            <img src={img.preview} alt="Preview" />
            <button onClick={() => removeImage(index)}>×</button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ImageUploader;