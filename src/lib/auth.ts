import * as jose from 'jose';
import bcrypt from 'bcryptjs';

const AUTH_SECRET = process.env.AUTH_SECRET || 'fallback-secret-at-least-32-characters';
const secretKey = new TextEncoder().encode(AUTH_SECRET);

export async function signJWT(payload: any): Promise<string> {
  return await new jose.SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secretKey);
}

export async function verifyJWT(token: string): Promise<any> {
  try {
    const { payload } = await jose.jwtVerify(token, secretKey);
    return payload;
  } catch (error) {
    return null;
  }
}

export function hashPassword(password: string): string {
  const salt = bcrypt.genSaltSync(12);
  return bcrypt.hashSync(password, salt);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function getAdminCredentials() {
  const email = process.env.APP_USER_EMAIL || 'admin@clipping.com';
  const passwordHash = process.env.APP_USER_PASSWORD_HASH || '';
  
  return { email, passwordHash };
}
