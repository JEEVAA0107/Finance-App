/**
 * imageCompressor.js
 * High-performance client-side image compression using HTML5 Canvas.
 * Scales down large camera/gallery photos to max 1280px and quality 0.8 JPEG (~100-200KB).
 */

export function isPdfDocument(urlOrData) {
  if (!urlOrData || typeof urlOrData !== 'string') return false;
  return urlOrData.startsWith('data:application/pdf') || 
         urlOrData.toLowerCase().endsWith('.pdf') || 
         urlOrData.toLowerCase().includes('.pdf?');
}

export function compressImageFile(file, maxDimension = 1280, quality = 0.82) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve(null);

    // If file is a PDF document, bypass canvas and read as Base64 Data URL directly
    if (file.type === 'application/pdf' || file.name?.toLowerCase().endsWith('.pdf')) {
      const maxSizeBytes = 5 * 1024 * 1024; // 5 MB
      if (file.size > maxSizeBytes) {
        return reject(new Error('PDF document must be under 5MB in size'));
      }
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Failed to read PDF document'));
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(file);
      return;
    }

    // Process image files via Canvas compression
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid or unsupported image file'));
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

export function compressDataUrl(dataUrl, maxDimension = 1280, quality = 0.8) {
  return new Promise((resolve, reject) => {
    if (!dataUrl) return resolve(null);
    const img = new Image();
    img.onerror = reject;
    img.onload = () => {
      let width = img.width;
      let height = img.height;

      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);

      const compressed = canvas.toDataURL('image/jpeg', quality);
      resolve(compressed);
    };
    img.src = dataUrl;
  });
}
