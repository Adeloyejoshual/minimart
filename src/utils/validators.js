// /utils/validators.js

export const validateAd = ({ title, images, description, rules }) => {
  if (title.length < rules.minTitle) {
    return `Title must be at least ${rules.minTitle} characters`;
  }

  if (images.length < rules.minImages) {
    return `Add at least ${rules.minImages} photos`;
  }

  if (images.length > rules.maxImages) {
    return `Maximum ${rules.maxImages} images allowed`;
  }

  if (description.length > rules.maxDescription) {
    return `Description cannot exceed ${rules.maxDescription} characters`;
  }

  return null;
};