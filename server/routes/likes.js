import { getAll, getOne, run } from '../db.js';
import { optionalAuth } from '../middleware/auth.js';

/**
 * GET /api/likes?slug=xxx
 * Public — returns like count + whether current user has liked
 */
export async function getLikes(request, reply) {
  const { slug } = request.query;
  if (!slug) return reply.status(400).send({ error: 'slug is required' });

  const row = getOne('SELECT count FROM likes WHERE slug = ?', [slug]);
  const likes = row?.count || 0;

  // Check if current user has liked (only if logged in)
  let userLiked = false;
  if (request.user) {
    const liked = getOne(
      'SELECT id FROM like_logs WHERE slug = ? AND user_id = ? AND datetime(created_at) > datetime(\'now\', \'-1 day\')',
      [slug, request.user.userId]
    );
    userLiked = !!liked;
  }

  return { slug, likes, userLiked };
}

/**
 * POST /api/likes
 * Optional auth — logged-in users use user_id, guests use IP fingerprint
 */
export async function addLike(request, reply) {
  const { slug } = request.body || {};
  if (!slug) return reply.status(400).send({ error: 'slug is required' });

  const safeSlug = String(slug).replace(/[^a-zA-Z0-9\-_]/g, '').slice(0, 100);

  // Dedup: by user_id (logged in) or fingerprint (guest)
  if (request.user) {
    const recent = getOne(
      `SELECT id FROM like_logs WHERE slug = ? AND user_id = ?
       AND datetime(created_at) > datetime('now', '-1 day')`,
      [safeSlug, request.user.userId]
    );

    if (recent) {
      const row = getOne('SELECT count FROM likes WHERE slug = ?', [safeSlug]);
      return reply.status(429).send({ error: 'already liked', likes: row?.count || 0 });
    }

    // Upsert likes count
    const existing = getOne('SELECT id FROM likes WHERE slug = ?', [safeSlug]);
    if (existing) {
      run('UPDATE likes SET count = count + 1 WHERE slug = ?', [safeSlug]);
    } else {
      run('INSERT INTO likes (slug, count) VALUES (?, 1)', [safeSlug]);
    }

    run('INSERT INTO like_logs (slug, fingerprint, user_id) VALUES (?, ?, ?)',
      [safeSlug, '', request.user.userId]);

    const row = getOne('SELECT count FROM likes WHERE slug = ?', [safeSlug]);
    return { slug: safeSlug, likes: row?.count || 0 };
  }

  // ── Guest mode (backward compatible) ──
  const ip = request.headers['x-forwarded-for'] || request.ip || 'unknown';
  const ua = request.headers['user-agent'] || 'unknown';
  const fingerprint = simpleHash(`${ip}|${ua}`);

  const recent = getOne(
    `SELECT id FROM like_logs WHERE slug = ? AND fingerprint = ?
     AND datetime(created_at) > datetime('now', '-1 day')`,
    [safeSlug, fingerprint]
  );

  if (recent) {
    const row = getOne('SELECT count FROM likes WHERE slug = ?', [safeSlug]);
    return reply.status(429).send({ error: 'already liked', likes: row?.count || 0 });
  }

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
