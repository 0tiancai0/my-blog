// Vercel Serverless API — 点赞系统（使用 Upstash Redis）
import { Redis } from '@upstash/redis';

// 延迟初始化 Redis 客户端，避免 cold-start 时 env 未就绪
let _redis: Redis | null = null;
function getRedis(): Redis {
  if (!_redis) {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) {
      throw new Error('UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set');
    }
    _redis = new Redis({ url, token });
  }
  return _redis;
}

// 简单的浏览器指纹 hash（IP + UA）
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const chr = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return String(Math.abs(hash));
}

interface LikesResponse {
  slug: string;
  likes: number;
}

/**
 * GET /api/likes?slug=xxx
 * 获取某篇文章的点赞数
 */
export async function GET({ request, url }: { request: Request; url: URL }) {
  const slug = url.searchParams.get('slug');
  if (!slug) {
    return new Response(JSON.stringify({ error: 'slug is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const safeSlug = slug.replace(/[^a-zA-Z0-9\-_]/g, '').slice(0, 100);

  try {
    const redis = getRedis();
    const count = (await redis.get<number>(`likes:${safeSlug}`)) || 0;
    return new Response(JSON.stringify({ slug: safeSlug, likes: count } satisfies LikesResponse), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=30' },
    });
  } catch (err) {
    console.error('Likes GET error:', err);
    return new Response(JSON.stringify({ slug: safeSlug, likes: 0 } satisfies LikesResponse), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * POST /api/likes
 * 给文章点赞（24 小时内同一浏览器只能点一次）
 */
export async function POST({ request }: { request: Request }) {
  let body: { slug?: string };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'invalid json' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { slug } = body;
  if (!slug) {
    return new Response(JSON.stringify({ error: 'slug is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const safeSlug = String(slug).replace(/[^a-zA-Z0-9\-_]/g, '').slice(0, 100);

  // 生成浏览器指纹
  const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
  const ua = request.headers.get('user-agent') || 'unknown';
  const fingerprint = simpleHash(`${ip}|${ua}`);

  try {
    const redis = getRedis();

    // 检查 24h 内是否已点赞
    const likedKey = `liked:${safeSlug}:${fingerprint}`;
    const alreadyLiked = await redis.get(likedKey);
    if (alreadyLiked) {
      const count = (await redis.get<number>(`likes:${safeSlug}`)) || 0;
      return new Response(JSON.stringify({ error: 'already liked', likes: count }), {
        status: 429,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 原子递增点赞数 + 标记已点赞
    const newCount = await redis.incr(`likes:${safeSlug}`);
    await redis.set(likedKey, '1', { ex: 60 * 60 * 24 }); // 24h 过期

    return new Response(JSON.stringify({ slug: safeSlug, likes: newCount } satisfies LikesResponse), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Likes POST error:', err);
    // 降级：返回当前点赞数，不阻止点赞 UI
    return new Response(
      JSON.stringify({ slug: safeSlug, likes: 1, error: 'storage unavailable' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
