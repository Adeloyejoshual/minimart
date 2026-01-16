export const validateAd = ({ title, images, description, rules, brand, model, type, condition, location }) => {
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
  if (rules.requireBrand && !brand) return "Brand is required";
  if (rules.requireModel && !model) return "Model is required";
  if (rules.requireType && !type) return "Type is required";
  if (rules.requireCondition && !condition) return "Condition is required";
  if (rules.requireLocation && !location) return "Location is required";

  return null;
};