import { getAll, getOne, run } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

/**
 * GET /api/comments?slug=xxx
 * Public — returns comments with username (from users table or legacy author field)
 */
export async function getComments(request, reply) {
  const { slug } = request.query;
  if (!slug) return reply.status(400).send({ error: 'slug is required' });

  const comments = getAll(
    `SELECT c.id, c.slug, c.content, c.parent_id AS parentId, c.created_at AS createdAt,
            COALESCE(u.username, c.author) AS author,
            c.user_id AS userId
     FROM comments c
     LEFT JOIN users u ON c.user_id = u.id
     WHERE c.slug = ? ORDER BY c.created_at ASC`,
    [slug]
  );

  return { comments };
}

/**
 * POST /api/comments
 * Protected — user must be logged in. Username comes from JWT.
 */
export async function createComment(request, reply) {
  const { slug, content, parentId } = request.body || {};

  if (!slug || !content) {
    return reply.status(400).send({ error: 'slug and content are required' });
  }

  const safeContent = String(content).trim().slice(0, 5000);
  if (!safeContent) {
    return reply.status(400).send({ error: 'content cannot be empty' });
  }

  const ip = request.headers['x-forwarded-for'] || request.ip || 'unknown';
  const ipHash = simpleHash(String(ip));
  const userId = request.user?.userId || null;
  const author = request.user?.username || 'Anonymous';

  const result = run(
    `INSERT INTO comments (slug, author, content, parent_id, ip_hash, user_id) VALUES (?, ?, ?, ?, ?, ?)`,
    [slug, author, safeContent, parentId || null, ipHash, userId]
  );

  const comment = getOne(
    `SELECT c.id, c.slug, c.content, c.parent_id AS parentId, c.created_at AS createdAt,
            c.author, c.user_id AS userId
     FROM comments c WHERE c.id = ?`,
    [result.lastInsertRowid]
  );

  return reply.status(201).send({ comment });
}

/**
 * DELETE /api/comments/:id
 * Admin (via token) or comment author (via JWT) can delete.
 */
export async function deleteComment(request, reply) {
  const { id } = request.params;
  const token = request.headers['x-admin-token'];
  const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'admin-secret-change-me';

  // Check admin token first
  if (token === ADMIN_TOKEN) {
    run('DELETE FROM comments WHERE id = ?', [id]);
    return { deleted: true };
  }

  // Check if user is the comment author
  const comment = getOne('SELECT user_id FROM comments WHERE id = ?', [id]);
  if (!comment) {
    return reply.status(404).send({ error: 'comment not found' });
  }

  if (request.user && request.user.userId === comment.user_id) {
    run('DELETE FROM comments WHERE id = ?', [id]);
    return { deleted: true };
  }

  return reply.status(403).send({ error: '无权删除此评论' });
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
