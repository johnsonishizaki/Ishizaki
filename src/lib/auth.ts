/**
 * Private Single-User Authentication Engine for Ishizaki
 * Guarantees zero plaintext password storage via Web Crypto API (PBKDF2/SHA-256).
 */

const AUTH_KEY = 'ishizaki_auth_hash';
const SALT_KEY = 'ishizaki_auth_salt';
const SESSION_KEY = 'ishizaki_session_token';

// Default initial hash for setup
const DEFAULT_PASSWORD = 'ishizaki_student';

export async function hashPassword(password: string, salt: string): Promise<string> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );

  const derivedKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: enc.encode(salt),
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );

  const exported = await crypto.subtle.exportKey('raw', derivedKey);
  const hashArray = Array.from(new Uint8Array(exported));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function isSessionActive(): boolean {
  if (typeof window === 'undefined') return false;
  return sessionStorage.getItem(SESSION_KEY) === 'ACTIVE_VALID_STUDENT_SESSION';
}

export function terminateSession(): void {
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem(SESSION_KEY);
  }
}

export async function verifyAndLogin(passwordInput: string): Promise<boolean> {
  let storedSalt = localStorage.getItem(SALT_KEY);
  let storedHash = localStorage.getItem(AUTH_KEY);

  // Initialize on first setup
  if (!storedSalt || !storedHash) {
    storedSalt = crypto.randomUUID();
    storedHash = await hashPassword(DEFAULT_PASSWORD, storedSalt);
    localStorage.setItem(SALT_KEY, storedSalt);
    localStorage.setItem(AUTH_KEY, storedHash);
  }

  const computedHash = await hashPassword(passwordInput, storedSalt);
  if (computedHash === storedHash) {
    sessionStorage.setItem(SESSION_KEY, 'ACTIVE_VALID_STUDENT_SESSION');
    return true;
  }
  return false;
}

export async function updatePassword(newPassword: string): Promise<void> {
  const newSalt = crypto.randomUUID();
  const newHash = await hashPassword(newPassword, newSalt);
  localStorage.setItem(SALT_KEY, newSalt);
  localStorage.setItem(AUTH_KEY, newHash);
  sessionStorage.setItem(SESSION_KEY, 'ACTIVE_VALID_STUDENT_SESSION');
}
