// routes/cart/cart.validators.js

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUUID(value) {
  return typeof value === "string" && UUID_REGEX.test(value);
}

function validateProductId(productId) {
  if (!productId) return "product_id is required";
  if (!isUUID(productId)) return "product_id must be a valid UUID";
  return null;
}

function validateVariantId(variantId) {
  if (variantId === undefined || variantId === null) return null;
  if (!isUUID(variantId)) return "variant_id must be a valid UUID";
  return null;
}

function validateQty(qty) {
  if (qty === undefined || qty === null) return "qty is required";
  if (!Number.isInteger(qty)) return "qty must be an integer";
  if (qty < 1) return "qty must be at least 1";
  if (qty > 99) return "qty cannot exceed 99";
  return null;
}

function validateItemId(itemId) {
  if (!itemId) return "itemId param is required";
  if (!isUUID(itemId)) return "itemId must be a valid UUID";
  return null;
}

function validateAddItem(body) {
  const issues = [];

  const productErr = validateProductId(body.product_id);
  if (productErr) issues.push({ field: "product_id", message: productErr });

  const variantErr = validateVariantId(body.variant_id);
  if (variantErr) issues.push({ field: "variant_id", message: variantErr });

  const qtyErr = validateQty(body.qty);
  if (qtyErr) issues.push({ field: "qty", message: qtyErr });

  return issues;
}

function validateUpdateQty(body, params) {
  const issues = [];

  const itemErr = validateItemId(params.itemId);
  if (itemErr) issues.push({ field: "itemId", message: itemErr });

  const qtyErr = validateQty(body.qty);
  if (qtyErr) issues.push({ field: "qty", message: qtyErr });

  return issues;
}

function validateRemoveItem(params) {
  const issues = [];

  const itemErr = validateItemId(params.itemId);
  if (itemErr) issues.push({ field: "itemId", message: itemErr });

  return issues;
}

export {
  validateAddItem,
  validateUpdateQty,
  validateRemoveItem,
  isUUID,
};