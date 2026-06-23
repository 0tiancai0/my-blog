import { hashPassword, comparePassword, signToken } from '../auth.js';
import { getOne, run } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

/**
 * POST /api/auth/register
 * Body: { username, password }
 */
export async function register(request, reply) {
  const { username, password } = request.body || {};

  // Validation
  if (!username || !password) {
    return reply.status(400).send({ error: '用户名和密码不能为空' });
  }
  if (typeof username !== 'string' || username.trim().length < 2 || username.trim().length > 50) {
    return reply.status(400).send({ error: '用户名需要 2-50 个字符' });
  }
  if (!/^[a-zA-Z0-9_一-鿿]+$/.test(username)) {
    return reply.status(400).send({ error: '用户名只能包含字母、数字、下划线和中文' });
  }
  if (typeof password !== 'string' || password.length < 6) {
    return reply.status(400).send({ error: '密码至少需要 6 个字符' });
  }

  const safeUsername = username.trim();

  // Check duplicate
  const existing = getOne('SELECT id FROM users WHERE username = ?', [safeUsername]);
  if (existing) {
    return reply.status(409).send({ error: '用户名已被占用' });
  }

  // Create user
  const hashed = await hashPassword(password);
  const result = run('INSERT INTO users (username, password) VALUES (?, ?)', [safeUsername, hashed]);
  const userId = result.lastInsertRowid;

  const token = signToken(userId, safeUsername);
  return reply.status(201).send({ token, user: { id: userId, username: safeUsername } });
}

/**
 * POST /api/auth/login
 * Body: { username, password }
 */
export async function login(request, reply) {
  const { username, password } = request.body || {};

  if (!username || !password) {
    return reply.status(400).send({ error: '用户名和密码不能为空' });
  }

  const user = getOne('SELECT id, username, password FROM users WHERE username = ?', [username.trim()]);
  if (!user) {
    return reply.status(401).send({ error: '用户名或密码错误' });
  }

  const valid = await comparePassword(password, user.password);
  if (!valid) {
    return reply.status(401).send({ error: '用户名或密码错误' });
  }

  const token = signToken(user.id, user.username);
  return { token, user: { id: user.id, username: user.username } };
}

/**
 * GET /api/auth/me
 * Protected: returns current user info
 */
export async function me(request) {
  return { user: request.user };
}

// Register routes on a Fastify instance
export async function registerAuthRoutes(app) {
  app.post('/api/auth/register', register);
  app.post('/api/auth/login', login);
  app.get('/api/auth/me', { preHandler: requireAuth }, me);
}
