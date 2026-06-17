import { getAll, getOne, run } from '../db.js';

/**
 * GET /api/comments?slug=xxx
 */
export async function getComments(request, reply) {
  const { slug } = request.query;
  if (!slug) return reply.status(400).send({ error: 'slug is required' });

  const comments = getAll(
    `SELECT id, slug, author, content, parent_id AS parentId, created_at AS createdAt
     FROM comments WHERE slug = ? ORDER BY created_at ASC`,
    [slug]
  );

  return { comments };
}

/**
 * POST /api/comments
 */
export async function createComment(request, reply) {
  const { slug, author, content, parentId } = request.body || {};

  if (!slug || !author || !content) {
    return reply.status(400).send({ error: 'slug, author, content are required' });
  }

  const safeAuthor = String(author).trim().slice(0, 50) || 'Anonymous';
  const safeContent = String(content).trim().slice(0, 5000);

  if (!safeContent) {
    return reply.status(400).send({ error: 'content cannot be empty' });
  }

  const ip = request.headers['x-forwarded-for'] || request.ip || 'unknown';
  const ipHash = simpleHash(String(ip));

  const result = run(
    `INSERT INTO comments (slug, author, content, parent_id, ip_hash) VALUES (?, ?, ?, ?, ?)`,
    [slug, safeAuthor, safeContent, parentId || null, ipHash]
  );

  const comment = getOne('SELECT * FROM comments WHERE id = ?', [result.lastInsertRowid]);
  return reply.status(201).send({ comment });
}

/**
 * DELETE /api/comments/:id
 */
export async function deleteComment(request, reply) {
  const { id } = request.params;
  const token = request.headers['x-admin-token'];
  const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'admin-secret-change-me';

  if (token !== ADMIN_TOKEN) {
    return reply.status(403).send({ error: 'forbidden' });
  }

  run('DELETE FROM comments WHERE id = ?', [id]);
  return { deleted: true };
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
