export interface StarterItem {
  file: string;
  word: string;
}

const base = () => import.meta.env.BASE_URL + 'starter/';

export const starterUrl = (file: string) => base() + file;

export async function loadStarterList(): Promise<StarterItem[]> {
  const res = await fetch(base() + 'starter.json');
  if (!res.ok) throw new Error('starter.json missing');
  return res.json();
}

/** Fetch a starter SVG and rasterize it to a square PNG on white. */
export const rasterizeStarter = (file: string, size = 512) => rasterizeSvg(starterUrl(file), size);

/** Fetch an SVG (same- or cross-origin) and rasterize it to a square PNG on white. */
export async function rasterizeSvg(src: string, size = 512): Promise<Blob> {
  const res = await fetch(src);
  if (!res.ok) throw new Error(`SVG fetch failed: ${res.status}`);
  const svg = await res.blob();
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);
    const pad = size * 0.06;
    ctx.drawImage(img, pad, pad, size - pad * 2, size - pad * 2);
    const out = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'));
    return out ?? svg;
  } finally {
    URL.revokeObjectURL(url);
  }
}
