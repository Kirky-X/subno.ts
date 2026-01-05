// SPDX-License-Identifier: Apache-2.0 
// Copyright (c) 2026 Kirky X. All rights reserved. 

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 禁用 Turbopack，使用传统 webpack 构建
  // turbopack 存在一些预渲染兼容性问题

  // ==================== 图片优化 ====================
  images: {
    // 允许的图片域名
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
    // 设备尺寸优化
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    // 格式优先级
    formats: ['image/avif', 'image/webp'],
    // 最小缓存时间（1年）
    minimumCacheTTL: 31536000,
    // 禁用服务端图片优化（API项目不需要）
    unoptimized: true,
  },

  // ==================== 输出配置 ====================
  // 不需要导出静态文件（API服务）
  output: 'standalone',

  // ==================== 压缩 ====================
  // 启用 gzip 压缩
  compress: true,

  // ==================== 安全头 ====================
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // 防止点击劫持
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          // 防止 MIME 类型嗅探
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          // XSS 保护
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          // 引用来源策略
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          // 权限策略
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          // CSP - 根据实际需求调整
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://api.vercel.com wss://*.pusher.com;",
          },
        ],
      },
      // API 路由特殊头
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
        ],
      },
    ];
  },

  // ==================== 重写规则 ====================
  async rewrites() {
    return [
      {
        source: '/health',
        destination: '/api/cron/health',
      },
    ];
  },

  // ==================== TypeScript 配置 ====================
  typescript: {
    // 构建时忽略类型错误（开发环境建议开启严格模式）
    ignoreBuildErrors: false,
  },

  // ==================== 日志配置 ====================
  logging: {
    fetches: {
      fullUrl: process.env.NODE_ENV === 'development',
    },
  },

  // ==================== 实验性功能 ====================
  experimental: {
    // 优化打包大小
    optimizeCss: false,
    // 优化包导入
    optimizePackageImports: ['@vercel/postgres', 'drizzle-orm', 'ioredis'],
  },
};

export default nextConfig;
