import { verifyToken } from '../auth.js';

/**
 * Require a valid JWT.  Returns 401 if missing or invalid.
 * On success, attaches `request.user = { userId, username }`.
 */
export async function requireAuth(request, reply) {
  const header = request.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return reply.status(401).send({ error: '请先登录' });
  }

  try {
    const payload = verifyToken(header.slice(7));
    request.user = { userId: payload.sub, username: payload.username };
  } catch {
    return reply.status(401).send({ error: '登录已过期，请重新登录' });
  }
}

/**
 * Optional auth — same as requireAuth but does not fail on missing token.
 * Attaches `request.user` when a valid token is present, otherwise `request.user = null`.
 */
export async function optionalAuth(request) {
  const header = request.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    request.user = null;
    return;
  }

  try {
    const payload = verifyToken(header.slice(7));
    request.user = { userId: payload.sub, username: payload.username };
  } catch {
    request.user = null;
  }
}
