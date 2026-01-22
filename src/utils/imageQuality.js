// utils/imageQuality.js
export const checkImageQuality = (file) =>
  new Promise((resolve) => {
    const img = new Image();
    img.src = URL.createObjectURL(file);
    img.onload = () => {
      // check resolution
      const width = img.width;
      const height = img.height;
      let warnings = [];

      if (width < 800 || height < 800) warnings.push("Low resolution");

      // simple blur estimate using canvas
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);
      const data = ctx.getImageData(0, 0, width, height).data;

      let variance = 0;
      for (let i = 0; i < data.length; i += 4) {
        variance += Math.abs(data[i] - 128);
      }
      variance /= data.length / 4;
      if (variance < 30) warnings.push("Possibly blurry");

      resolve({ warnings, width, height });
      URL.revokeObjectURL(img.src);
    };
    img.onerror = () => resolve({ warnings: ["Cannot read image"] });
  });