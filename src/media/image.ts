export interface ResizeOptions {
  /** Longest side in px. Default 1024. */
  maxSize?: number;
  /** Default 0.85. */
  quality?: number;
  /** Preferred output; falls back to JPEG if WebP encoding is unsupported. Default 'image/webp'. */
  type?: 'image/webp' | 'image/jpeg';
}

async function decode(blob: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(blob, { imageOrientation: 'from-image' });
    } catch {
      /* fall through (e.g. SVG) */
    }
  }
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Resize an image so its longest side is <= maxSize, re-encoded as WebP/JPEG. */
export async function resizeImage(file: Blob, opts: ResizeOptions = {}): Promise<Blob> {
  const { maxSize = 1024, quality = 0.85, type = 'image/webp' } = opts;
  const src = await decode(file);
  const w = 'naturalWidth' in src ? src.naturalWidth || src.width : src.width;
  const h = 'naturalHeight' in src ? src.naturalHeight || src.height : src.height;
  const scale = Math.min(1, maxSize / Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(src, 0, 0, canvas.width, canvas.height);
  if ('close' in src) src.close();

  const encode = (t: string) =>
    new Promise<Blob | null>((res) => canvas.toBlob(res, t, quality));
  let out = await encode(type);
  if (!out || out.type !== type) out = await encode('image/jpeg');
  if (!out) throw new Error('image encode failed');
  return out;
}
