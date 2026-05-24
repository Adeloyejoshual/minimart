export async function compressImage(file, { maxWidth = 1200, quality = 0.82 } = {}) {
  return new Promise((resolve, reject) => {
    const img    = new Image();
    const objUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objUrl);
      let { width, height } = img;
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width  = maxWidth;
      }
      const canvas = document.createElement("canvas");
      canvas.width  = width;
      canvas.height = height;
      canvas.getContext("2d").drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (!blob) return reject(new Error("Compression failed"));
          resolve(
            new File(
              [blob],
              file.name.replace(/\.[^.]+$/, ".webp"),
              { type: "image/webp", lastModified: Date.now() }
            )
          );
        },
        "image/webp",
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objUrl);
      reject(new Error("Load failed"));
    };
    img.src = objUrl;
  });
}

/** Generic list helpers — passed down as stable callbacks */
export const updateList = (setter, i, val) =>
  setter((p) => p.map((x, j) => (j === i ? val : x)));

export const addToList = (setter, list, max, blank = "") =>
  list.length < max && setter((p) => [...p, blank]);

export const removeFromList = (setter, i) =>
  setter((p) => (p.length <= 1 ? p : p.filter((_, j) => j !== i)));