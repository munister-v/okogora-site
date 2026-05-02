const REPO_OWNER = 'munister-v';
const REPO_NAME = 'okogora';
const MAX_WIDTH = 1200;
const MAX_SIZE_MB = 5;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export interface UploadResult {
  filename: string;
  url: string;
}

// Compress image via Canvas → JPEG blob
async function compressImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > MAX_WIDTH) {
        height = Math.round((height * MAX_WIDTH) / width);
        width = MAX_WIDTH;
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        blob => blob ? resolve(blob) : reject(new Error('Canvas compression failed')),
        'image/jpeg',
        0.82
      );
    };
    img.onerror = () => reject(new Error('Cannot load image'));
    img.src = url;
  });
}

// Fetch image from URL and return as File
export async function fetchImageFromUrl(imageUrl: string): Promise<File> {
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error('Не вдалося завантажити зображення за URL');
  const blob = await res.blob();
  if (!ALLOWED_TYPES.includes(blob.type)) throw new Error('Непідтримуваний формат');
  const name = imageUrl.split('/').pop()?.split('?')[0] || 'image.jpg';
  return new File([blob], name, { type: blob.type });
}

// Validate file before upload
export function validateFile(file: File): string | null {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return `Формат не підтримується. Дозволено: JPG, PNG, WebP, GIF`;
  }
  if (file.size > MAX_SIZE_MB * 1024 * 1024) {
    return `Файл надто великий (макс. ${MAX_SIZE_MB} МБ)`;
  }
  return null;
}

// Upload file to GitHub images/ folder
export async function uploadToGitHub(file: File, token: string): Promise<UploadResult> {
  const error = validateFile(file);
  if (error) throw new Error(error);

  // Compress if it's not a gif
  const blob = file.type === 'image/gif' ? file : await compressImage(file);

  // Generate unique filename
  const ext = 'jpg';
  const timestamp = Date.now();
  const safeName = file.name.replace(/\.[^.]+$/, '').replace(/[^a-z0-9_-]/gi, '_').slice(0, 40);
  const filename = `${safeName}_${timestamp}.${ext}`;
  const path = `images/${filename}`;

  // Convert blob to base64
  const arrayBuffer = await blob.arrayBuffer();
  const uint8 = new Uint8Array(arrayBuffer);
  let binary = '';
  uint8.forEach(b => binary += String.fromCharCode(b));
  const base64 = btoa(binary);

  // Upload via GitHub API
  const res = await fetch(
    `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: `upload: ${filename}`,
        content: base64,
      }),
    }
  );

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || 'Помилка завантаження на GitHub');
  }

  return {
    filename,
    url: `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/${path}`,
  };
}
