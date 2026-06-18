// PM2 进程管理配置
module.exports = {
  apps: [{
    name: 'my-blog',
    script: 'dist/server/entry.mjs',
    cwd: '/opt/my-blog',
    env: {
      NODE_ENV: 'production',
      PORT: '4321',
      HOST: '0.0.0.0',
      // TinaCMS
      TINA_CLIENT_ID: 'b8e15a31-b61d-43c8-af69-4e8a26c166f1',
      TINA_TOKEN: '96d9c1d5aa3bcd4e015875432546aca2ab1ad1ac',
      TINA_SEARCH_TOKEN: '6de91418a446fe060839df2e21e50db649d45ddc',
      // Upstash Redis（点赞）
      UPSTASH_REDIS_REST_URL: 'https://evident-starling-119678.upstash.io',
      UPSTASH_REDIS_REST_TOKEN: 'gQAAAAAAAdN-AAIgcDE5MTRhNDlhZWRkYTY0YWNiYTgzNThmZmYxMTZiMWM1Nw',
      // Giscus（评论）
      GISCUS_REPO_ID: 'R_kgDOS7Cb6g',
      GISCUS_CATEGORY: 'Announcements',
      GISCUS_CATEGORY_ID: 'DIC_kwDOS7Cb6s4C_Lji',
      // 站点
      SITE_URL: 'http://106.14.22.212',
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
  }]
};
