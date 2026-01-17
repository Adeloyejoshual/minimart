// /utils/validator.js
export const validateAd = ({ 
  title = '', 
  images = [], 
  description = '', 
  rules, 
  brand, 
  model, 
  type, 
  condition, 
  location, 
  currentUserAdCount = 0 // optional for freeAdsLimit check
}) => {
  const errors = [];

  // Title
  if (!title) {
    errors.push('Title is required');
  } else if (title.length < rules.minTitle) {
    errors.push(`Title must be at least ${rules.minTitle} characters`);
  } else if (title.length > rules.maxTitle) {
    errors.push(`Title must be no more than ${rules.maxTitle} characters`);
  }

  // Images
  if (images.length < rules.minImages) {
    errors.push(`Add at least ${rules.minImages} photo(s)`);
  }
  if (images.length > rules.maxImages) {
    errors.push(`Maximum ${rules.maxImages} images allowed`);
  }

  // Description
  if (description.length > rules.maxDescription) {
    errors.push(`Description cannot exceed ${rules.maxDescription} characters`);
  }

  // Required fields
  if (rules.requireBrand && !brand) errors.push('Brand is required');
  if (rules.requireModel && !model) errors.push('Model is required');
  if (rules.requireType && !type) errors.push('Type is required');
  if (rules.requireCondition && !condition) errors.push('Condition is required');
  if (rules.requireLocation && !location) errors.push('Location is required');

  // Free ads limit
  if (rules.freeAdsLimit != null && currentUserAdCount >= rules.freeAdsLimit) {
    errors.push(`You can only post ${rules.freeAdsLimit} free ad(s) in this category`);
  }

  return errors.length > 0 ? errors : null;
};