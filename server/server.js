import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { initDB } from './db.js';
import { getComments, createComment, deleteComment } from './routes/comments.js';
import { getLikes, addLike } from './routes/likes.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerFavoriteRoutes } from './routes/favorites.js';
import { requireAuth, optionalAuth } from './middleware/auth.js';

const PORT = process.env.PORT || 3456;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'admin-secret-change-me';

// Init database before starting server
console.log(' Initializing database...');
await initDB();

const app = Fastify({ logger: true });

// ── Plugins ──
await app.register(cors, {
  origin: [
    'http://localhost:4321',
    'http://localhost:4322',
    'https://my-blog.vercel.app',
    process.env.FRONTEND_URL,
  ].filter(Boolean),
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
});

await app.register(rateLimit, {
  max: 100,
  timeWindow: '1 minute',
});

// ── Health check ──
app.get('/api/health', async () => ({ status: 'ok', time: new Date().toISOString() }));

// ── Auth routes ──
await registerAuthRoutes(app);

// ── Favorites ──
await registerFavoriteRoutes(app);

// ── Comments (GET: public, POST: login required, DELETE: owner or admin) ──
app.get('/api/comments', { preHandler: optionalAuth }, getComments);
app.post('/api/comments', { preHandler: requireAuth }, createComment);
app.delete('/api/comments/:id', { preHandler: optionalAuth }, deleteComment);

// ── Likes (GET: public, POST: optional auth) ──
app.get('/api/likes', { preHandler: optionalAuth }, getLikes);
app.post('/api/likes', { preHandler: optionalAuth }, addLike);

// ── Start ──
try {
  await app.listen({ port: PORT, host: '0.0.0.0' });
  console.log(`\n🚀 Blog API running at http://localhost:${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/api/health`);
  console.log(`   Auth:   http://localhost:${PORT}/api/auth/login`);
  console.log(`   Admin token: ${ADMIN_TOKEN === 'admin-secret-change-me' ? '⚠️  USING DEFAULT (change ADMIN_TOKEN env var)' : '✅ Configured'}\n`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
