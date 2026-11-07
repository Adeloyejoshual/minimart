// utils/googleShoppingXml.js

const escapeXml = (value = "") => {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
};

const cleanText = (value = "") => {
  return String(value)
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

const formatPrice = (value) => {
  const price = Number(value);

  if (!Number.isFinite(price) || price <= 0) {
    return null;
  }

  return `${price.toFixed(2)} NGN`;
};

const generateGoogleShoppingXml = (products) => {
  const items = products
    .map((product) => {
      const price = formatPrice(product.price);

      // Skip products with invalid prices or missing mandatory fields
      if (!price || !product.id || !product.title || !product.image) {
        return "";
      }

      // Handle additional images array if available
      const additionalImagesXml = Array.isArray(product.additionalImages)
        ? product.additionalImages
            .slice(0, 10) // Google accepts up to 10 additional images
            .map(
              (imgUrl) =>
                `<g:additional_image_link>${escapeXml(imgUrl)}</g:additional_image_link>`
            )
            .join("\n        ")
        : "";

      // Determine identifier status (GTIN/MPN)
      const hasIdentifier = Boolean(product.gtin || product.mpn);

      return `
      <item>
        <g:id>${escapeXml(product.id)}</g:id>
        <g:title>${escapeXml(cleanText(product.title))}</g:title>
        <g:description>${escapeXml(cleanText(product.description))}</g:description>
        <g:link>${escapeXml(product.url)}</g:link>
        <g:image_link>${escapeXml(product.image)}</g:image_link>
        ${additionalImagesXml}
        <g:availability>${escapeXml(product.availability || "in_stock")}</g:availability>
        <g:price>${escapeXml(price)}</g:price>
        <g:condition>${escapeXml(product.condition || "new")}</g:condition>
        <g:brand>${escapeXml(product.brand || "Loemart")}</g:brand>
        
        ${
          hasIdentifier
            ? `${product.gtin ? `<g:gtin>${escapeXml(product.gtin)}</g:gtin>` : ""}
               ${product.mpn ? `<g:mpn>${escapeXml(product.mpn)}</g:mpn>` : ""}`
            : `<g:identifier_exists>false</g:identifier_exists>`
        }
      </item>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
  <rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
    <channel>
      <title>Loemart Market</title>
      <link>https://www.loemart.com</link>
      <description>Shop products from verified sellers on Loemart.</description>
      ${items}
    </channel>
  </rss>`;
};

module.exports = {
  generateGoogleShoppingXml,
  formatPrice,
  cleanText,
};