// src/utils/imageUtils.js

/**
 * Compress an image file to a max width and max size
 * @param {File} file - Original image file
 * @param {number} maxWidth - Max width in px (default 1024)
 * @param {number} maxSizeKB - Max size in KB (default 500KB)
 * @returns {Promise<File>} - Compressed image file
 */
export async function compressImage(file, maxWidth = 1024, maxSizeKB = 500) {
  if (!file) return null;

  // Load image
  const img = await new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = (err) => reject(err);
    image.src = URL.createObjectURL(file);
  });

  // Calculate new width & height
  const ratio = Math.min(1, maxWidth / img.width);
  const canvas = document.createElement("canvas");
  canvas.width = img.width * ratio;
  canvas.height = img.height * ratio;

  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  // Compress to target size
  let quality = 0.9;
  let blob = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", quality));

  while (blob.size / 1024 > maxSizeKB && quality > 0.1) {
    quality -= 0.05;
    blob = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", quality));
  }

  // Convert blob to File
  return new File([blob], file.name, { type: "image/jpeg" });
}