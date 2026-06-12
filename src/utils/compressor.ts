/**
 * Converts a File object to its Base64 encoding.
 * If the file is an image, it downsamples and compresses it to save Firestore bandwidth.
 */
export async function processFileForUpload(file: File): Promise<{
  name: string;
  type: string;
  size: number;
  dataUrl: string;
}> {
  return new Promise((resolve, reject) => {
    // If it's not an image, read directly as Base64
    if (!file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = () => {
        resolve({
          name: file.name,
          type: file.type,
          size: file.size,
          dataUrl: reader.result as string,
        });
      };
      reader.onerror = (e) => reject(e);
      reader.readAsDataURL(file);
      return;
    }

    // It is an image -> compress it
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 600;
        const MAX_HEIGHT = 600;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          // Compress as low-quality JPEG
          const compressedDataUrl = canvas.toDataURL("image/jpeg", 0.65);
          resolve({
            name: file.name.replace(/\.[^/.]+$/, "") + ".jpg", // convert extension representation
            type: "image/jpeg",
            size: Math.round(compressedDataUrl.length * 0.75), // rough estimation
            dataUrl: compressedDataUrl,
          });
        } else {
          // fallback to original if context fails
          resolve({
            name: file.name,
            type: file.type,
            size: file.size,
            dataUrl: event.target?.result as string,
          });
        }
      };
      img.onerror = () => {
        resolve({
          name: file.name,
          type: file.type,
          size: file.size,
          dataUrl: event.target?.result as string,
        });
      };
      img.src = event.target?.result as string;
    };
    reader.onerror = (e) => reject(e);
    reader.readAsDataURL(file);
  });
}

/**
 * Downloads a Base64 data url back in the browser safely.
 */
export function downloadBase64File(dataUrl: string, filename: string) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
