// PM2 进程管理配置
// 启动：pm2 start ecosystem.config.js
// 前置：npm run build（生成 .next 产物）
module.exports = {
  apps: [
    {
      name: 'wenqing-web',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3000',
      instances: 1,
      autorestart: true,
      max_restarts: 10,
      env: { NODE_ENV: 'production' },
    },
    {
      name: 'wenqing-worker',
      script: 'node_modules/ts-node/dist/bin.js',
      args: '--project tsconfig.server.json src/worker/index.ts',
      instances: 1,
      autorestart: true,
      max_restarts: 10,
      env: { NODE_ENV: 'production' },
    },
  ],
}
