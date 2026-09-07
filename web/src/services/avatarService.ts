import { supabase } from './authService';

export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export function ownedAvatarPath(path: unknown, userID: string): path is string {
  return typeof path === 'string' && path.startsWith(userID + '/') &&
    /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.webp$/.test(path);
}
export async function signedAvatar(path: unknown, userID: string): Promise<string> {
  if (!ownedAvatarPath(path, userID)) return '';
  const { data, error } = await supabase.storage.from('avatar').createSignedUrl(path, 300);
  return error ? '' : data.signedUrl;
}
/** Decode and re-encode pixels: no SVG, EXIF, arbitrary URL, or original metadata. */
export async function prepareAvatar(file: File): Promise<Blob> {
  if (file.size > AVATAR_MAX_BYTES || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('Choose a PNG, JPEG or WebP image smaller than 2 MiB.');
  }
  const bitmap = await createImageBitmap(file);
  try {
    if (bitmap.width > 4096 || bitmap.height > 4096 || !bitmap.width || !bitmap.height) throw new Error('Image dimensions exceed 4096 pixels.');
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 256;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Image processing is unavailable.');
    const edge = Math.min(bitmap.width, bitmap.height);
    context.drawImage(bitmap, (bitmap.width-edge)/2, (bitmap.height-edge)/2, edge, edge, 0, 0, 256, 256);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => {
      if (!blob || blob.type !== 'image/webp' || blob.size > AVATAR_MAX_BYTES) reject(new Error('Image conversion failed.'));
      else resolve(blob);
    }, 'image/webp', 0.85));
  } finally { bitmap.close(); }
}
