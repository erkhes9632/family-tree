const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';

/** 16-char random id (~82 bits). */
export function newId(length = 16): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  let out = '';
  for (const b of bytes) out += ALPHABET[b % 36];
  return out;
}

/** Unguessable token for invitation links (~190 bits, url-safe). */
export function newToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
