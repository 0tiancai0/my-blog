// API 客户端 — 统一管理对阿里云 API 的调用

const API_BASE = import.meta.env.PUBLIC_API_URL || 'http://localhost:3456';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return res.json();
}

// ── Likes ──

export interface LikesResponse {
  slug: string;
  likes: number;
}

export async function fetchLikes(slug: string): Promise<LikesResponse> {
  return request<LikesResponse>(`/api/likes?slug=${encodeURIComponent(slug)}`);
}

export async function postLike(slug: string): Promise<LikesResponse> {
  return request<LikesResponse>('/api/likes', {
    method: 'POST',
    body: JSON.stringify({ slug }),
  });
}

// ── Comments ──

export interface Comment {
  id: number;
  slug: string;
  author: string;
  content: string;
  parentId: number | null;
  createdAt: string;
}

export interface CommentsResponse {
  comments: Comment[];
}

export async function fetchComments(slug: string): Promise<CommentsResponse> {
  return request<CommentsResponse>(`/api/comments?slug=${encodeURIComponent(slug)}`);
}

export async function postComment(slug: string, author: string, content: string, parentId?: number) {
  return request<{ comment: Comment }>('/api/comments', {
    method: 'POST',
    body: JSON.stringify({ slug, author, content, parentId }),
  });
}
