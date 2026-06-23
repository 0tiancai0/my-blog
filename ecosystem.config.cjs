// PM2 进程管理配置
module.exports = {
  apps: [
    {
      name: 'my-blog',
      script: 'dist/server/entry.mjs',
      cwd: '/opt/my-blog',
      env: {
        NODE_ENV: 'production',
        PORT: '4321',
        HOST: '0.0.0.0',
        // TinaCMS
        TINA_CLIENT_ID: process.env.TINA_CLIENT_ID || '',
        TINA_TOKEN: process.env.TINA_TOKEN || '',
        TINA_SEARCH_TOKEN: process.env.TINA_SEARCH_TOKEN || '',
        // Upstash Redis（点赞 — Astro SSR 端已弃用，现在使用 Fastify API）
        // 保留以便向后兼容
        UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL || '',
        UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN || '',
        // JWT 密钥（用于 Fastify API 认证）
        JWT_SECRET: process.env.JWT_SECRET || 'change-me-in-production',
        // Fastify API 地址（前端通过 Nginx 代理访问，留空使用相对路径）
        PUBLIC_API_URL: '',
        // 站点 URL
        SITE_URL: process.env.SITE_URL || 'http://106.14.22.212',
      },
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: '/var/log/my-blog/error.log',
      out_file: '/var/log/my-blog/out.log',
      merge_logs: true,
    },
    {
      name: 'blog-api',
      script: 'server.js',
      cwd: '/opt/my-blog/server',
      env: {
        NODE_ENV: 'production',
        PORT: '3456',
        HOST: '0.0.0.0',
        JWT_SECRET: process.env.JWT_SECRET || 'change-me-in-production',
        ADMIN_TOKEN: process.env.ADMIN_TOKEN || 'admin-secret-change-me',
      },
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '256M',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: '/var/log/my-blog/api-error.log',
      out_file: '/var/log/my-blog/api-out.log',
      merge_logs: true,
    },
  ],
};
