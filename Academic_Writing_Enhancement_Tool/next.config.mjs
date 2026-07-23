/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // 让这些包在服务端以 Node 原生方式加载，避免打包报错
    serverComponentsExternalPackages: ['mammoth', '@prisma/client'],
  },
}

export default nextConfig
