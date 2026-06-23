import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const SALT_ROUNDS = 10;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const JWT_EXPIRY = '7d';

/** Hash a plaintext password */
export async function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/** Compare a plaintext password against a bcrypt hash */
export async function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}

/** Sign a JWT for the given user */
export function signToken(userId, username) {
  return jwt.sign({ sub: userId, username }, JWT_SECRET, { expiresIn: JWT_EXPIRY });
}

/** Verify and decode a JWT */
export function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}
