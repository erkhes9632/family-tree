const enc = new TextEncoder();
const keyCache = new Map<string, Promise<CryptoKey>>();

function key(secret: string) {
  let k = keyCache.get(secret);
  if (!k) {
    k = crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
    keyCache.set(secret, k);
  }
  return k;
}

function toB64Url(buf: ArrayBuffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64Url(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function sign(secret: string, message: string): Promise<string> {
  return toB64Url(await crypto.subtle.sign('HMAC', await key(secret), enc.encode(message)));
}

/** Constant-time verification via WebCrypto. */
export async function verify(secret: string, message: string, signature: string): Promise<boolean> {
  try {
    return await crypto.subtle.verify('HMAC', await key(secret), fromB64Url(signature), enc.encode(message));
  } catch {
    return false;
  }
}
