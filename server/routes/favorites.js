import { getAll, getOne, run } from '../db.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';

/**
 * GET /api/favorites
 * Protected — returns all favorites for the current user
 */
export async function listFavorites(request, reply) {
  const favorites = getAll(
    'SELECT slug, title, created_at AS createdAt FROM favorites WHERE user_id = ? ORDER BY created_at DESC',
    [request.user.userId]
  );
  return { favorites };
}

/**
 * GET /api/favorites/check?slug=xxx
 * Optional auth — returns whether the slug is favorited by the current user
 */
export async function checkFavorite(request, reply) {
  const { slug } = request.query;
  if (!slug) return reply.status(400).send({ error: 'slug is required' });

  if (!request.user) return { favorited: false };

  const row = getOne(
    'SELECT id FROM favorites WHERE user_id = ? AND slug = ?',
    [request.user.userId, slug]
  );

  return { favorited: !!row };
}

/**
 * POST /api/favorites
 * Protected — add a favorite
 */
export async function addFavorite(request, reply) {
  const { slug, title } = request.body || {};
  if (!slug) return reply.status(400).send({ error: 'slug is required' });

  // Check duplicate
  const existing = getOne(
    'SELECT id FROM favorites WHERE user_id = ? AND slug = ?',
    [request.user.userId, slug]
  );
  if (existing) {
    return reply.status(409).send({ error: 'already favorited', favorited: true });
  }

  run(
    'INSERT INTO favorites (user_id, slug, title) VALUES (?, ?, ?)',
    [request.user.userId, slug, title || '']
  );

  return { favorited: true };
}

/**
 * DELETE /api/favorites/:slug
 * Protected — remove a favorite
 */
export async function removeFavorite(request, reply) {
  const { slug } = request.params;

  run(
    'DELETE FROM favorites WHERE user_id = ? AND slug = ?',
    [request.user.userId, slug]
  );

  return { favorited: false };
}

export async function registerFavoriteRoutes(app) {
  app.get('/api/favorites', { preHandler: requireAuth }, listFavorites);
  app.get('/api/favorites/check', { preHandler: optionalAuth }, checkFavorite);
  app.post('/api/favorites', { preHandler: requireAuth }, addFavorite);
  app.delete('/api/favorites/:slug', { preHandler: requireAuth }, removeFavorite);
}
