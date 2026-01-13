// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

'use client';

import Link from 'next/link';
import StarField from '../components/StarField';
import { useState } from 'react';

interface Endpoint {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  title: string;
  description: string;
  params?: { name: string; type: string; required: boolean; description: string }[];
  example?: {
    request?: Record<string, unknown>;
    response?: Record<string, unknown>;
  };
}

const endpoints: Endpoint[] = [
  {
    method: 'POST',
    path: '/api/register',
    title: '注册公钥',
    description: '将用户的加密公钥注册到服务端进行托管，支持多种加密算法，自动创建加密频道。',
    params: [
      { name: 'publicKey', type: 'string', required: true, description: 'PEM 格式公钥 (最大 4KB)' },
      { name: 'algorithm', type: 'string', required: false, description: '加密算法 (RSA-2048, RSA-4096, ECC-SECP256K1)，默认 RSA-2048' },
      { name: 'expiresIn', type: 'number', required: false, description: '有效期秒数 (最大 30 天)，默认 604800' },
      { name: 'metadata', type: 'object', required: false, description: '元数据 (最大 2KB)，如 deviceName、appVersion' },
    ],
    example: {
      request: {
        publicKey: '-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...\n-----END PUBLIC KEY-----',
        algorithm: 'RSA-4096',
        expiresIn: 604800,
        metadata: { deviceName: 'My Device', appVersion: '1.0.0' },
      },
      response: {
        success: true,
        data: {
          channelId: 'enc_3b6bf5d599c844e3',
          publicKeyId: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
          algorithm: 'RSA-4096',
          expiresAt: '2026-01-20T00:00:00.000Z',
          expiresIn: 604800,
        },
      },
    },
  },
  {
    method: 'GET',
    path: '/api/register',
    title: '查询公钥信息',
    description: '查询已注册的公钥信息，支持按频道 ID 或密钥 ID 查询。',
    params: [
      { name: 'channelId', type: 'string', required: false, description: '加密频道 ID (enc_xxx)' },
      { name: 'keyId', type: 'string', required: false, description: '公钥 UUID' },
    ],
    example: {
      response: {
        success: true,
        data: {
          id: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
          channelId: 'enc_xxx',
          algorithm: 'RSA-4096',
          createdAt: '2026-01-13T00:00:00.000Z',
          expiresAt: '2026-01-20T00:00:00.000Z',
          lastUsedAt: '2026-01-14T12:00:00.000Z',
          isExpired: false,
        },
      },
    },
  },
  {
    method: 'POST',
    path: '/api/channels',
    title: '创建频道',
    description: '创建新频道，支持自定义 ID、名称、类型和元数据。',
    params: [
      { name: 'id', type: 'string', required: false, description: '频道 ID (1-64字符，仅字母数字下划线连字符)' },
      { name: 'name', type: 'string', required: false, description: '频道名称 (最大 255 字符)，默认使用 ID' },
      { name: 'type', type: 'string', required: false, description: '频道类型 (public, encrypted)，默认 public' },
      { name: 'description', type: 'string', required: false, description: '频道描述 (最大 1000 字符)' },
      { name: 'creator', type: 'string', required: false, description: '创建者标识' },
      { name: 'expiresIn', type: 'number', required: false, description: '有效期秒数 (最大 604800)，默认 86400' },
      { name: 'metadata', type: 'object', required: false, description: '元数据 (最大 4KB)' },
    ],
    example: {
      request: {
        id: 'my-channel',
        name: '我的频道',
        description: '官方公告频道',
        type: 'public',
        creator: 'user-123',
        expiresIn: 86400,
        metadata: { tags: ['important'] },
      },
      response: {
        success: true,
        data: {
          id: 'my-channel',
          name: '我的频道',
          description: '官方公告频道',
          type: 'public',
          creator: 'user-123',
          createdAt: '2026-01-13T00:00:00.000Z',
          expiresAt: '2026-01-14T00:00:00.000Z',
          isActive: true,
          metadata: { tags: ['important'] },
        },
      },
    },
  },
  {
    method: 'GET',
    path: '/api/channels',
    title: '查询频道',
    description: '查询频道列表或获取特定频道信息，支持分页和类型筛选。',
    params: [
      { name: 'id', type: 'string', required: false, description: '频道 ID (精确匹配)' },
      { name: 'type', type: 'string', required: false, description: '筛选类型：public, encrypted' },
      { name: 'limit', type: 'number', required: false, description: '返回数量 (最大 100)，默认 50' },
      { name: 'offset', type: 'number', required: false, description: '偏移量，默认 0' },
    ],
    example: {
      response: {
        success: true,
        data: [
          {
            id: 'my-channel',
            name: '我的频道',
            type: 'public',
            creator: 'user-123',
            createdAt: '2026-01-13T00:00:00.000Z',
            expiresAt: '2026-01-14T00:00:00.000Z',
            isActive: true,
            metadata: { tags: ['important'] },
          },
        ],
        pagination: {
          total: 100,
          limit: 10,
          offset: 0,
          hasMore: true,
        },
      },
    },
  },
  {
    method: 'POST',
    path: '/api/publish',
    title: '发布消息',
    description: '向指定频道发布消息，支持消息优先级、加密和自动创建频道。',
    params: [
      { name: 'channel', type: 'string', required: true, description: '频道 ID' },
      { name: 'message', type: 'string', required: true, description: '消息内容 (最大 4.5MB)' },
      { name: 'priority', type: 'string', required: false, description: '优先级 (critical, high, normal, low, bulk)，默认 normal' },
      { name: 'sender', type: 'string', required: false, description: '发送者标识' },
      { name: 'cache', type: 'boolean', required: false, description: '是否缓存消息，默认 true' },
      { name: 'encrypted', type: 'boolean', required: false, description: '是否加密消息，默认 false' },
      { name: 'autoCreate', type: 'boolean', required: false, description: '频道不存在时自动创建，默认 true' },
      { name: 'signature', type: 'string', required: false, description: '消息签名' },
    ],
    example: {
      request: {
        channel: 'my-channel',
        message: 'Hello, World!',
        priority: 'normal',
        sender: 'Server',
        cache: true,
        encrypted: false,
        autoCreate: true,
      },
      response: {
        success: true,
        data: {
          messageId: 'msg_1767521101483_xxxxxxxxxx',
          channel: 'my-channel',
          publishedAt: '2026-01-13T00:00:00.000Z',
          autoCreated: false,
        },
      },
    },
  },
  {
    method: 'GET',
    path: '/api/publish',
    title: '获取消息',
    description: '获取频道消息队列状态和历史消息。',
    params: [
      { name: 'channel', type: 'string', required: true, description: '频道 ID' },
      { name: 'count', type: 'number', required: false, description: '获取消息数量 (最大 100)，默认 10' },
    ],
    example: {
      response: {
        success: true,
        data: {
          channel: 'my-channel',
          messages: [
            {
              id: 'msg_xxx',
              message: 'Hello!',
              sender: 'User1',
              timestamp: 1234567890,
              priority: 'normal',
            },
          ],
          queueLength: 5,
        },
      },
    },
  },
  {
    method: 'GET',
    path: '/api/subscribe',
    title: '订阅频道 (SSE)',
    description: '通过 Server-Sent Events (SSE) 实时接收频道消息，支持断线重连。',
    params: [
      { name: 'channel', type: 'string', required: true, description: '要订阅的频道 ID' },
      { name: 'lastEventId', type: 'string', required: false, description: '最后接收的事件 ID，用于断线重连' },
    ],
    example: {
      response: {
        event: 'connected',
        data: JSON.stringify({
          channel: 'my-channel',
          type: 'channel',
          timestamp: 1234567890,
          message: 'Connected',
          expiresAt: '2026-01-14T00:00:00.000Z',
        }),
        id: 'event-uuid-here',
      },
    },
  },
  {
    method: 'POST',
    path: '/api/keys',
    title: '创建 API 密钥',
    description: '创建 API 访问密钥（需要 Master Admin Key）。',
    params: [
      { name: 'userId', type: 'string', required: true, description: '用户 ID' },
      { name: 'name', type: 'string', required: false, description: '密钥名称 (最大 255 字符)' },
      { name: 'permissions', type: 'array', required: false, description: '权限数组 (read, write, admin)，默认 ["read", "write"]' },
      { name: 'expiresAt', type: 'string', required: false, description: '过期时间 (ISO 8601 格式)' },
    ],
    example: {
      request: {
        userId: 'user-123',
        name: 'My App API Key',
        permissions: ['read', 'write', 'admin'],
        expiresAt: '2026-12-31T23:59:59.000Z',
      },
      response: {
        success: true,
        data: {
          id: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
          userId: 'user-123',
          name: 'My App API Key',
          permissions: ['read', 'write', 'admin'],
          apiKey: '<api-key-id>xxxxxxxxxxxxxxxxxxxxxxxx',
          createdAt: '2026-01-13T00:00:00.000Z',
          expiresAt: '2026-12-31T23:59:59.000Z',
        },
      },
    },
  },
  {
    method: 'GET',
    path: '/api/keys',
    title: '列出 API 密钥',
    description: '列出用户的 API 密钥（需要 admin 权限）。',
    params: [
      { name: 'userId', type: 'string', required: true, description: '用户 ID' },
    ],
    example: {
      response: {
        success: true,
        data: {
          keys: [
            {
              id: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
              userId: 'user-123',
              name: 'My API Key',
              permissions: ['read', 'write'],
              createdAt: '2026-01-13T00:00:00.000Z',
              expiresAt: '2026-12-31T23:59:59.000Z',
              isActive: true,
              lastUsedAt: '2026-01-14T12:00:00.000Z',
            },
          ],
        },
      },
    },
  },
  {
    method: 'GET',
    path: '/api/keys/:id',
    title: '查询密钥信息',
    description: '查询指定公钥的信息和状态。',
    params: [
      { name: 'id', type: 'string', required: true, description: '公钥 UUID 或频道 ID' },
    ],
    example: {
      response: {
        success: true,
        data: {
          id: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
          channelId: 'enc_channel_id',
          algorithm: 'RSA-4096',
          createdAt: '2026-01-13T00:00:00.000Z',
          expiresAt: '2026-01-20T00:00:00.000Z',
          lastUsedAt: '2026-01-14T12:00:00.000Z',
          metadata: { deviceName: 'My Device' },
        },
      },
    },
  },
  {
    method: 'DELETE',
    path: '/api/keys/:id',
    title: '撤销公钥',
    description: '撤销指定的公钥（需要 API 密钥认证）。',
    params: [
      { name: 'id', type: 'string', required: true, description: '公钥 UUID 或频道 ID' },
    ],
    example: {
      response: {
        success: true,
        message: 'Public key revoked successfully',
        data: {
          deletedId: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
          channelId: 'enc_channel_id',
        },
      },
    },
  },
  {
    method: 'GET',
    path: '/api/cron/cleanup-channels',
    title: '清理过期频道',
    description: '清理过期频道（需要 Cron Secret 和 IP 白名单）。',
    params: [
      { name: 'task', type: 'string', required: false, description: '任务类型 (persistent, temporary, all)，默认 all' },
    ],
    example: {
      response: {
        success: true,
        data: {
          task: 'all',
          persistentChannelsMarkedInactive: 10,
          temporaryChannelsDeleted: 5,
          errors: [],
          duration: '150ms',
          timestamp: '2026-01-13T00:00:00.000Z',
        },
      },
    },
  },
  {
    method: 'GET',
    path: '/api/cron/cleanup-keys',
    title: '清理过期密钥',
    description: '清理过期密钥、审计日志和孤立数据（需要 Cron Secret）。',
    params: [
      { name: 'task', type: 'string', required: false, description: '任务类型 (expired-keys, audit-logs, orphaned-keys, messages, all)，默认 all' },
    ],
    example: {
      response: {
        success: true,
        data: {
          task: 'all',
          results: {
            expiredKeys: { deleted: 15, errors: [] },
            auditLogs: { deleted: 100, errors: [] },
            orphanedKeys: { deleted: 8, errors: [] },
            oldMessages: { deleted: 50, errors: [] },
          },
          timestamp: '2026-01-13T00:00:00.000Z',
        },
      },
    },
  },
];

const priorities = [
  { value: 'CRITICAL', desc: '关键消息，立即送达 (100)', color: '#ef4444' },
  { value: 'HIGH', desc: '高优先级消息 (75)', color: '#f59e0b' },
  { value: 'NORMAL', desc: '普通消息 (50，默认)', color: '#10b981' },
  { value: 'LOW', desc: '低优先级消息 (25)', color: '#06b6d4' },
  { value: 'BULK', desc: '批量消息，最低优先级 (0)', color: '#8b5cf6' },
];

const channelTypes = [
  { value: 'public', desc: '公开频道 (pub_)，无需公钥即可订阅', icon: '📢' },
  { value: 'encrypted', desc: '加密频道 (enc_)，需要注册公钥', icon: '🔒' },
];

const authHeaders = [
  { header: 'X-API-Key', type: 'API 密钥', desc: '日常 API 调用，根据权限访问' },
  { header: 'X-Admin-Key', type: 'Master Key', desc: '管理员操作（创建密钥、管理权限）' },
  { header: 'X-Cron-Secret', type: 'Cron Secret', desc: '定时任务触发' },
];

function MethodBadge({ method }: { method: string }) {
  const colors: Record<string, string> = {
    GET: '#10b981',
    POST: '#6366f1',
    PUT: '#f59e0b',
    DELETE: '#ef4444',
  };
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '4px 12px',
        borderRadius: '6px',
        fontSize: '12px',
        fontWeight: '700',
        background: colors[method] || '#6b7280',
        color: '#fff',
        marginRight: '12px',
        minWidth: '60px',
        textAlign: 'center',
      }}
    >
      {method}
    </span>
  );
}

function EndpointCard({ endpoint }: { endpoint: Endpoint }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="glass-card" style={{ marginBottom: '16px', overflow: 'hidden' }}>
      <div
        onClick={() => setIsOpen(!isOpen)}
        style={{
          padding: '20px 24px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          userSelect: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
          <MethodBadge method={endpoint.method} />
          <code
            style={{
              fontSize: '14px',
              color: 'var(--text-primary)',
              fontFamily: 'JetBrains Mono, monospace',
            }}
          >
            {endpoint.path}
          </code>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span
            style={{
              fontSize: '14px',
              color: 'var(--text-secondary)',
              fontWeight: '500',
            }}
          >
            {endpoint.title}
          </span>
          <span
            style={{
              transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s ease',
              fontSize: '16px',
              color: 'var(--text-tertiary)',
            }}
          >
            ▼
          </span>
        </div>
      </div>

      {isOpen && (
        <div
          style={{
            padding: '0 24px 24px',
            borderTop: '1px solid var(--glass-border)',
          }}
        >
          <p
            style={{
              fontSize: '14px',
              color: 'var(--text-secondary)',
              margin: '20px 0',
              lineHeight: '1.6',
            }}
          >
            {endpoint.description}
          </p>

          {endpoint.params && endpoint.params.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <h4
                style={{
                  fontSize: '14px',
                  fontWeight: '600',
                  color: 'var(--text-primary)',
                  marginBottom: '12px',
                }}
              >
                请求参数
              </h4>
              <div
                style={{
                  background: 'rgba(0,0,0,0.2)',
                  borderRadius: '8px',
                  overflow: 'hidden',
                }}
              >
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: '13px',
                  }}
                >
                  <thead>
                    <tr style={{ background: 'rgba(255,255,255,0.05)' }}>
                      <th style={{ padding: '10px 16px', textAlign: 'left', color: 'var(--text-tertiary)', fontWeight: '500' }}>参数</th>
                      <th style={{ padding: '10px 16px', textAlign: 'left', color: 'var(--text-tertiary)', fontWeight: '500' }}>类型</th>
                      <th style={{ padding: '10px 16px', textAlign: 'left', color: 'var(--text-tertiary)', fontWeight: '500' }}>必填</th>
                      <th style={{ padding: '10px 16px', textAlign: 'left', color: 'var(--text-tertiary)', fontWeight: '500' }}>描述</th>
                    </tr>
                  </thead>
                  <tbody>
                    {endpoint.params.map((param) => (
                      <tr key={param.name} style={{ borderTop: '1px solid var(--glass-border)' }}>
                        <td style={{ padding: '10px 16px', color: 'var(--accent)', fontFamily: 'monospace' }}>{param.name}</td>
                        <td style={{ padding: '10px 16px', color: 'var(--text-secondary)' }}>{param.type}</td>
                        <td style={{ padding: '10px 16px', color: param.required ? 'var(--error)' : 'var(--text-tertiary)' }}>
                          {param.required ? '是' : '否'}
                        </td>
                        <td style={{ padding: '10px 16px', color: 'var(--text-secondary)' }}>{param.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {endpoint.example && (
            <div>
              <h4
                style={{
                  fontSize: '14px',
                  fontWeight: '600',
                  color: 'var(--text-primary)',
                  marginBottom: '12px',
                }}
              >
                示例
              </h4>
              <div style={{ display: 'grid', gap: '12px' }}>
                {endpoint.example.request && (
                  <div>
                    <div
                      style={{
                        fontSize: '12px',
                        color: 'var(--text-tertiary)',
                        marginBottom: '8px',
                      }}
                    >
                      请求
                    </div>
                    <pre
                      style={{
                        background: 'rgba(0,0,0,0.4)',
                        padding: '16px',
                        borderRadius: '8px',
                        overflow: 'auto',
                        fontSize: '13px',
                        lineHeight: '1.5',
                      }}
                    >
                      <code style={{ color: 'var(--text-secondary)' }}>
                        {JSON.stringify(endpoint.example.request, null, 2)}
                      </code>
                    </pre>
                  </div>
                )}
                {endpoint.example.response && (
                  <div>
                    <div
                      style={{
                        fontSize: '12px',
                        color: 'var(--text-tertiary)',
                        marginBottom: '8px',
                      }}
                    >
                      响应
                    </div>
                    <pre
                      style={{
                        background: 'rgba(0,0,0,0.4)',
                        padding: '16px',
                        borderRadius: '8px',
                        overflow: 'auto',
                        fontSize: '13px',
                        lineHeight: '1.5',
                      }}
                    >
                      <code style={{ color: 'var(--text-secondary)' }}>
                        {JSON.stringify(endpoint.example.response, null, 2)}
                      </code>
                    </pre>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ApiDocs() {
  return (
    <>
      <StarField />
      <main
        style={{
          position: 'relative',
          zIndex: 1,
          minHeight: '100vh',
          padding: '60px 0 80px',
        }}
      >
        {/* Header */}
        <section
          style={{
            textAlign: 'center',
            marginBottom: '60px',
            padding: '0 24px',
          }}
        >
          <Link
            href="/"
            className="glass-card"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              marginBottom: '24px',
              fontSize: '14px',
              color: 'var(--text-secondary)',
            }}
          >
            ← 返回首页
          </Link>

          <h1
            style={{
              fontSize: 'clamp(28px, 5vw, 48px)',
              fontWeight: '800',
              marginBottom: '16px',
              background: 'var(--gradient-primary)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            API 文档
          </h1>
          <p
            style={{
              fontSize: '16px',
              color: 'var(--text-secondary)',
              maxWidth: '600px',
              margin: '0 auto',
              lineHeight: '1.6',
            }}
          >
            了解如何使用 SecureNotify API 实现端到端加密消息推送
          </p>
        </section>

        {/* Quick Reference */}
        <section
          style={{
            maxWidth: '1200px',
            margin: '0 auto 60px',
            padding: '0 24px',
          }}
        >
          <div className="glass-card" style={{ padding: '32px' }}>
            <h2
              style={{
                fontSize: '18px',
                fontWeight: '700',
                color: 'var(--text-primary)',
                marginBottom: '24px',
              }}
            >
              📋 快速参考
            </h2>

            <div style={{ display: 'grid', gap: '32px' }}>
              {/* Authentication Headers */}
              <div>
                <h3
                  style={{
                    fontSize: '14px',
                    fontWeight: '600',
                    color: 'var(--text-secondary)',
                    marginBottom: '16px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  认证方式
                </h3>
                <div style={{ display: 'grid', gap: '12px' }}>
                  {authHeaders.map((auth) => (
                    <div
                      key={auth.header}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '12px 16px',
                        background: 'rgba(0,0,0,0.2)',
                        borderRadius: '8px',
                      }}
                    >
                      <code
                        style={{
                          fontSize: '12px',
                          padding: '4px 8px',
                          background: 'rgba(139, 92, 246, 0.2)',
                          borderRadius: '4px',
                          color: 'var(--primary-hover)',
                          minWidth: '140px',
                        }}
                      >
                        {auth.header}
                      </code>
                      <div>
                        <div
                          style={{
                            fontSize: '14px',
                            fontWeight: '600',
                            color: 'var(--text-primary)',
                          }}
                        >
                          {auth.type}
                        </div>
                        <div
                          style={{
                            fontSize: '12px',
                            color: 'var(--text-tertiary)',
                          }}
                        >
                          {auth.desc}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Channel Types */}
              <div>
                <h3
                  style={{
                    fontSize: '14px',
                    fontWeight: '600',
                    color: 'var(--text-secondary)',
                    marginBottom: '16px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  频道类型
                </h3>
                <div style={{ display: 'grid', gap: '12px' }}>
                  {channelTypes.map((type) => (
                    <div
                      key={type.value}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '12px 16px',
                        background: 'rgba(0,0,0,0.2)',
                        borderRadius: '8px',
                      }}
                    >
                      <span style={{ fontSize: '20px' }}>{type.icon}</span>
                      <div>
                        <div
                          style={{
                            fontSize: '14px',
                            fontWeight: '600',
                            color: 'var(--text-primary)',
                          }}
                        >
                          {type.value}
                        </div>
                        <div
                          style={{
                            fontSize: '12px',
                            color: 'var(--text-tertiary)',
                          }}
                        >
                          {type.desc}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Priorities */}
              <div>
                <h3
                  style={{
                    fontSize: '14px',
                    fontWeight: '600',
                    color: 'var(--text-secondary)',
                    marginBottom: '16px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  消息优先级
                </h3>
                <div style={{ display: 'grid', gap: '8px' }}>
                  {priorities.map((p) => (
                    <div
                      key={p.value}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '10px 16px',
                        background: 'rgba(0,0,0,0.2)',
                        borderRadius: '8px',
                        borderLeft: `3px solid ${p.color}`,
                      }}
                    >
                      <code
                        style={{
                          fontSize: '12px',
                          fontWeight: '600',
                          color: p.color,
                          minWidth: '80px',
                        }}
                      >
                        {p.value}
                      </code>
                      <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                        {p.desc}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Endpoints */}
        <section
          style={{
            maxWidth: '1000px',
            margin: '0 auto',
            padding: '0 24px',
          }}
        >
          <h2
            style={{
              fontSize: '24px',
              fontWeight: '700',
              color: 'var(--text-primary)',
              marginBottom: '24px',
            }}
          >
            🔌 API 端点
          </h2>

          {endpoints.map((endpoint) => (
            <EndpointCard key={`${endpoint.method}-${endpoint.path}`} endpoint={endpoint} />
          ))}
        </section>
      </main>
    </>
  );
}
