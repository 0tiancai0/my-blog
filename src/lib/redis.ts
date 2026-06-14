import { Redis } from '@upstash/redis';

// Create a singleton Redis client
let redis: Redis | null = null;

export function getRedis(): Redis {
  if (!redis) {
    const url = import.meta.env.UPSTASH_REDIS_REST_URL;
    const token = import.meta.env.UPSTASH_REDIS_REST_TOKEN;

    if (!url || !token) {
      console.warn(
        '⚠️  Upstash Redis 未配置。点赞功能将使用本地模式。\n' +
        '    请设置 UPSTASH_REDIS_REST_URL 和 UPSTASH_REDIS_REST_TOKEN 环境变量。\n' +
        '    注册免费账号: https://console.upstash.com'
      );
      // Return a mock for development without breaking
      redis = createMockRedis();
    } else {
      redis = new Redis({ url, token });
    }
  }
  return redis;
}

/** Mock Redis for local development when env vars are not set */
function createMockRedis(): Redis {
  const store = new Map<string, number>();
  return {
    get: async (key: string) => store.get(key) || 0,
    set: async (key: string, value: number) => { store.set(key, value); return 'OK'; },
    incr: async (key: string) => {
      const val = (store.get(key) || 0) + 1;
      store.set(key, val);
      return val;
    },
  } as unknown as Redis;
}
