import { getAll, getOne, run } from '../db.js';

/**
 * GET /api/likes?slug=xxx
 */
export async function getLikes(request, reply) {
  const { slug } = request.query;
  if (!slug) return reply.status(400).send({ error: 'slug is required' });

  const row = getOne('SELECT count FROM likes WHERE slug = ?', [slug]);
  return { slug, likes: row?.count || 0 };
}

/**
 * POST /api/likes
 */
export async function addLike(request, reply) {
  const { slug } = request.body || {};
  if (!slug) return reply.status(400).send({ error: 'slug is required' });

  const safeSlug = String(slug).replace(/[^a-zA-Z0-9\-_]/g, '').slice(0, 100);

  const ip = request.headers['x-forwarded-for'] || request.ip || 'unknown';
  const ua = request.headers['user-agent'] || 'unknown';
  const fingerprint = simpleHash(`${ip}|${ua}`);

  // Check rate limit (24h window)
  const recent = getOne(
    `SELECT id FROM like_logs WHERE slug = ? AND fingerprint = ?
     AND datetime(created_at) > datetime('now', '-1 day')`,
    [safeSlug, fingerprint]
  );

  if (recent) {
    const row = getOne('SELECT count FROM likes WHERE slug = ?', [safeSlug]);
    return reply.status(429).send({ error: 'already liked', likes: row?.count || 0 });
  }

  // Upsert
  const existing = getOne('SELECT id FROM likes WHERE slug = ?', [safeSlug]);
  if (existing) {
    run('UPDATE likes SET count = count + 1 WHERE slug = ?', [safeSlug]);
  } else {
    run('INSERT INTO likes (slug, count) VALUES (?, 1)', [safeSlug]);
  }

  run('INSERT INTO like_logs (slug, fingerprint) VALUES (?, ?)', [safeSlug, fingerprint]);

  const row = getOne('SELECT count FROM likes WHERE slug = ?', [safeSlug]);
  return { slug: safeSlug, likes: row?.count || 0 };
}

function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const chr = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return String(Math.abs(hash));
}
