// Client-only: turns an uploaded File into a downscaled base64 JPEG data URL,
// so a full-resolution phone image does not bloat sessionStorage
// (which has a hard size limit) or the request payload. 1600px is plenty of
// detail for the AI to inspect the image clearly.
export function fileToCompressedDataUrl(file: File, maxDimension = 1600, quality = 0.75): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Gagal membaca file gambar."));
    reader.onload = () => {
      const img = new window.Image();
      img.onerror = () => reject(new Error("Gagal memuat gambar."));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDimension || height > maxDimension) {
          const scale = maxDimension / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas tidak didukung."));
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
