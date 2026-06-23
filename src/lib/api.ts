// API 客户端 — 统一管理对 Fastify API 的调用

const API_BASE = import.meta.env.PUBLIC_API_URL ?? 'http://localhost:3456';

// ── Token management ──

function getToken(): string | null {
  if (typeof localStorage === 'undefined') return null;
  return localStorage.getItem('token');
}

export function setToken(token: string) {
  localStorage.setItem('token', token);
}

export function clearToken() {
  localStorage.removeItem('token');
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return res.json();
}

// ── Auth ──

export interface User {
  id: number;
  username: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export async function login(username: string, password: string): Promise<AuthResponse> {
  // Auth endpoints don't send existing token
  const url = `${API_BASE}/api/auth/login`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || '登录失败');
  }
  const data = await res.json();
  setToken(data.token);
  return data;
}

export async function register(username: string, password: string): Promise<AuthResponse> {
  const url = `${API_BASE}/api/auth/register`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || '注册失败');
  }
  const data = await res.json();
  setToken(data.token);
  return data;
}

export async function getMe(): Promise<{ user: User } | null> {
  try {
    return await request<{ user: User }>('/api/auth/me');
  } catch {
    clearToken();
    return null;
  }
}

export function isLoggedIn(): boolean {
  return !!getToken();
}

export function getStoredUser(): User | null {
  // Quick check from localStorage without API call
  const token = getToken();
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return { id: payload.sub, username: payload.username };
  } catch {
    return null;
  }
}

// ── Likes ──

export interface LikesResponse {
  slug: string;
  likes: number;
  userLiked?: boolean;
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
  userId?: number | null;
}

export interface CommentsResponse {
  comments: Comment[];
}

export async function fetchComments(slug: string): Promise<CommentsResponse> {
  return request<CommentsResponse>(`/api/comments?slug=${encodeURIComponent(slug)}`);
}

export async function postComment(slug: string, content: string, parentId?: number) {
  return request<{ comment: Comment }>('/api/comments', {
    method: 'POST',
    body: JSON.stringify({ slug, content, parentId }),
  });
}

export async function deleteComment(id: number) {
  return request<{ deleted: boolean }>(`/api/comments/${id}`, {
    method: 'DELETE',
  });
}

// ── Favorites ──

export interface FavoriteItem {
  slug: string;
  title: string;
  createdAt: string;
}

export async function fetchFavorites(): Promise<{ favorites: FavoriteItem[] }> {
  return request<{ favorites: FavoriteItem[] }>('/api/favorites');
}

export async function checkFavorite(slug: string): Promise<{ favorited: boolean }> {
  return request<{ favorited: boolean }>(`/api/favorites/check?slug=${encodeURIComponent(slug)}`);
}

export async function addFavorite(slug: string, title?: string) {
  return request<{ favorited: boolean }>('/api/favorites', {
    method: 'POST',
    body: JSON.stringify({ slug, title }),
  });
}

export async function removeFavorite(slug: string) {
  return request<{ favorited: boolean }>(`/api/favorites/${encodeURIComponent(slug)}`, {
    method: 'DELETE',
  });
}
