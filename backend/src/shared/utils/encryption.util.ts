import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY = process.env.PAYMENT_DETAILS_ENCRYPTION_KEY
  ? Buffer.from(process.env.PAYMENT_DETAILS_ENCRYPTION_KEY, 'hex')
  : Buffer.from('default-dev-key-32-bytes-long!!X', 'utf8');

// Validate key length for AES-256 (must be exactly 32 bytes)
if (process.env.PAYMENT_DETAILS_ENCRYPTION_KEY && KEY.length !== 32) {
  throw new Error(`PAYMENT_DETAILS_ENCRYPTION_KEY must be 32 bytes (64 hex chars), got ${KEY.length} bytes`);
}

export function encrypt(plaintext: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Format: iv:tag:ciphertext (all hex)
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decrypt(encryptedData: string): string {
  const [ivHex, tagHex, ciphertextHex] = encryptedData.split(':');
  if (!ivHex || !tagHex || !ciphertextHex) {
    throw new Error('Invalid encrypted data format');
  }
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const ciphertext = Buffer.from(ciphertextHex, 'hex');
  const decipher = createDecipheriv(ALGORITHM, KEY, iv);
  decipher.setAuthTag(tag);
  return decipher.update(ciphertext) + decipher.final('utf8');
}