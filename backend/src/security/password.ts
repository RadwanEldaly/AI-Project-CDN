import crypto from 'crypto';

const scryptAsync = (
  password: string,
  salt: string,
  keylen: number,
  options: crypto.ScryptOptions
): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, keylen, options, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey);
    });
  });
};

/**
 * Memory-hard password hashing using Node.js crypto.scrypt
 * Cost parameters: N=16384 (cost factor), r=8 (block size), p=1 (parallelization), 64 bytes key length
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = await scryptAsync(password, salt, 64, {
    N: 16384,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024,
  });

  return `scrypt$16384$8$1$${salt}$${derivedKey.toString('hex')}`;
}

/**
 * Constant-time password verification to prevent timing attack vulnerabilities
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  try {
    const parts = storedHash.split('$');
    if (parts.length !== 6 || parts[0] !== 'scrypt') {
      return false;
    }

    const N = parseInt(parts[1], 10);
    const r = parseInt(parts[2], 10);
    const p = parseInt(parts[3], 10);
    const salt = parts[4];
    const originalHash = Buffer.from(parts[5], 'hex');

    const derivedKey = await scryptAsync(password, salt, originalHash.length, {
      N,
      r,
      p,
      maxmem: 64 * 1024 * 1024,
    });

    return crypto.timingSafeEqual(originalHash, derivedKey);
  } catch {
    return false;
  }
}
