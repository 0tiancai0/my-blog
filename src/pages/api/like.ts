// 点赞 API - Upstash Redis
import type { APIRoute } from 'astro';
import { getRedis } from '../../lib/redis';

export const prerender = false;

const redis = getRedis();

export const GET: APIRoute = async ({ request }) => {
  try {
    const url = new URL(request.url);
    const slug = url.searchParams.get('slug');

    if (!slug) {
      return new Response(JSON.stringify({ error: 'slug is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Sanitize slug to prevent abuse
    const safeSlug = slug.replace(/[^a-zA-Z0-9\-_]/g, '').slice(0, 100);
    const count = await redis.get<number>(`likes:${safeSlug}`);

    return new Response(JSON.stringify({ slug: safeSlug, likes: count || 0 }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=30, s-maxage=60',
      },
    });
  } catch (error) {
    console.error('GET likes error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const slug = body?.slug;

    if (!slug) {
      return new Response(JSON.stringify({ error: 'slug is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Sanitize slug
    const safeSlug = slug.replace(/[^a-zA-Z0-9\-_]/g, '').slice(0, 100);

    // Rate limit: check IP-based deduplication
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const rateKey = `liked:${safeSlug}:${ip}`;
    const alreadyLiked = await redis.get(rateKey);

    if (alreadyLiked) {
      const currentLikes = await redis.get<number>(`likes:${safeSlug}`) || 0;
      return new Response(JSON.stringify({ error: 'already liked', likes: currentLikes }), {
        status: 429,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Increment like count
    const newCount = await redis.incr(`likes:${safeSlug}`);

    // Set rate limit (24 hours)
    await redis.set(rateKey, '1', { ex: 86400 });

    return new Response(JSON.stringify({ slug: safeSlug, likes: newCount }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('POST likes error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
