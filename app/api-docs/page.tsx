// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

'use client';

import StarField from '../components/StarField';
import { useState } from 'react';
import { useTranslation } from '@/app/hooks/useTranslation';

interface Endpoint {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  titleKey: string;
  descriptionKey: string;
  params?: { name: string; type: string; required: boolean; descriptionKey: string }[];
  example?: {
    request?: Record<string, unknown>;
    response?: Record<string, unknown>;
  };
}

const endpoints: Endpoint[] = [
  {
    method: 'POST',
    path: '/api/register',
    titleKey: 'apiDocs.endpoints.register.title',
    descriptionKey: 'apiDocs.endpoints.register.desc',
    params: [
      { name: 'publicKey', type: 'string', required: true, descriptionKey: 'apiDocs.endpoints.register.params.publicKey' },
      { name: 'algorithm', type: 'string', required: false, descriptionKey: 'apiDocs.endpoints.register.params.algorithm' },
      { name: 'expiresIn', type: 'number', required: false, descriptionKey: 'apiDocs.endpoints.register.params.expiresIn' },
      { name: 'metadata', type: 'object', required: false, descriptionKey: 'apiDocs.endpoints.register.params.metadata' },
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
    titleKey: 'apiDocs.endpoints.getRegister.title',
    descriptionKey: 'apiDocs.endpoints.getRegister.desc',
    params: [
      { name: 'channelId', type: 'string', required: false, descriptionKey: 'apiDocs.endpoints.getRegister.params.channelId' },
      { name: 'keyId', type: 'string', required: false, descriptionKey: 'apiDocs.endpoints.getRegister.params.keyId' },
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
    titleKey: 'apiDocs.endpoints.createChannel.title',
    descriptionKey: 'apiDocs.endpoints.createChannel.desc',
    params: [
      { name: 'id', type: 'string', required: false, descriptionKey: 'apiDocs.endpoints.createChannel.params.id' },
      { name: 'name', type: 'string', required: false, descriptionKey: 'apiDocs.endpoints.createChannel.params.name' },
      { name: 'type', type: 'string', required: false, descriptionKey: 'apiDocs.endpoints.createChannel.params.type' },
      { name: 'description', type: 'string', required: false, descriptionKey: 'apiDocs.endpoints.createChannel.params.description' },
      { name: 'creator', type: 'string', required: false, descriptionKey: 'apiDocs.endpoints.createChannel.params.creator' },
      { name: 'expiresIn', type: 'number', required: false, descriptionKey: 'apiDocs.endpoints.createChannel.params.expiresIn' },
      { name: 'metadata', type: 'object', required: false, descriptionKey: 'apiDocs.endpoints.createChannel.params.metadata' },
    ],
    example: {
      request: {
        id: 'my-channel',
        name: 'My Channel',
        description: 'Official announcement channel',
        type: 'public',
        creator: 'user-123',
        expiresIn: 86400,
        metadata: { tags: ['important'] },
      },
      response: {
        success: true,
        data: {
          id: 'my-channel',
          name: 'My Channel',
          description: 'Official announcement channel',
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
    titleKey: 'apiDocs.endpoints.listChannels.title',
    descriptionKey: 'apiDocs.endpoints.listChannels.desc',
    params: [
      { name: 'id', type: 'string', required: false, descriptionKey: 'apiDocs.endpoints.listChannels.params.id' },
      { name: 'type', type: 'string', required: false, descriptionKey: 'apiDocs.endpoints.listChannels.params.type' },
      { name: 'limit', type: 'number', required: false, descriptionKey: 'apiDocs.endpoints.listChannels.params.limit' },
      { name: 'offset', type: 'number', required: false, descriptionKey: 'apiDocs.endpoints.listChannels.params.offset' },
    ],
    example: {
      response: {
        success: true,
        data: [
          {
            id: 'my-channel',
            name: 'My Channel',
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
    titleKey: 'apiDocs.endpoints.publish.title',
    descriptionKey: 'apiDocs.endpoints.publish.desc',
    params: [
      { name: 'channel', type: 'string', required: true, descriptionKey: 'apiDocs.endpoints.publish.params.channel' },
      { name: 'message', type: 'string', required: true, descriptionKey: 'apiDocs.endpoints.publish.params.message' },
      { name: 'priority', type: 'string', required: false, descriptionKey: 'apiDocs.endpoints.publish.params.priority' },
      { name: 'sender', type: 'string', required: false, descriptionKey: 'apiDocs.endpoints.publish.params.sender' },
      { name: 'cache', type: 'boolean', required: false, descriptionKey: 'apiDocs.endpoints.publish.params.cache' },
      { name: 'encrypted', type: 'boolean', required: false, descriptionKey: 'apiDocs.endpoints.publish.params.encrypted' },
      { name: 'autoCreate', type: 'boolean', required: false, descriptionKey: 'apiDocs.endpoints.publish.params.autoCreate' },
      { name: 'signature', type: 'string', required: false, descriptionKey: 'apiDocs.endpoints.publish.params.signature' },
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
    titleKey: 'apiDocs.endpoints.getMessages.title',
    descriptionKey: 'apiDocs.endpoints.getMessages.desc',
    params: [
      { name: 'channel', type: 'string', required: true, descriptionKey: 'apiDocs.endpoints.getMessages.params.channel' },
      { name: 'count', type: 'number', required: false, descriptionKey: 'apiDocs.endpoints.getMessages.params.count' },
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
    titleKey: 'apiDocs.endpoints.subscribe.title',
    descriptionKey: 'apiDocs.endpoints.subscribe.desc',
    params: [
      { name: 'channel', type: 'string', required: true, descriptionKey: 'apiDocs.endpoints.subscribe.params.channel' },
      { name: 'lastEventId', type: 'string', required: false, descriptionKey: 'apiDocs.endpoints.subscribe.params.lastEventId' },
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
    titleKey: 'apiDocs.endpoints.createApiKey.title',
    descriptionKey: 'apiDocs.endpoints.createApiKey.desc',
    params: [
      { name: 'userId', type: 'string', required: true, descriptionKey: 'apiDocs.endpoints.createApiKey.params.userId' },
      { name: 'name', type: 'string', required: false, descriptionKey: 'apiDocs.endpoints.createApiKey.params.name' },
      { name: 'permissions', type: 'array', required: false, descriptionKey: 'apiDocs.endpoints.createApiKey.params.permissions' },
      { name: 'expiresAt', type: 'string', required: false, descriptionKey: 'apiDocs.endpoints.createApiKey.params.expiresAt' },
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
    titleKey: 'apiDocs.endpoints.listApiKeys.title',
    descriptionKey: 'apiDocs.endpoints.listApiKeys.desc',
    params: [
      { name: 'userId', type: 'string', required: true, descriptionKey: 'apiDocs.endpoints.listApiKeys.params.userId' },
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
    titleKey: 'apiDocs.endpoints.getKeyInfo.title',
    descriptionKey: 'apiDocs.endpoints.getKeyInfo.desc',
    params: [
      { name: 'id', type: 'string', required: true, descriptionKey: 'apiDocs.endpoints.getKeyInfo.params.id' },
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
    titleKey: 'apiDocs.endpoints.revokeKey.title',
    descriptionKey: 'apiDocs.endpoints.revokeKey.desc',
    params: [
      { name: 'id', type: 'string', required: true, descriptionKey: 'apiDocs.endpoints.revokeKey.params.id' },
      { name: 'confirmationCode', type: 'string', required: false, descriptionKey: 'apiDocs.endpoints.revokeKey.params.confirmationCode' },
    ],
    example: {
      response: {
        success: true,
        message: 'Public key revoked successfully',
        data: {
          deletedId: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
          channelId: 'enc_channel_id',
          deletedAt: '2026-01-14T01:00:00.000Z',
          deletedBy: 'user-123',
        },
      },
    },
  },
  {
    method: 'POST',
    path: '/api/keys/:id/revoke',
    titleKey: 'apiDocs.endpoints.requestRevoke.title',
    descriptionKey: 'apiDocs.endpoints.requestRevoke.desc',
    params: [
      { name: 'id', type: 'string', required: true, descriptionKey: 'apiDocs.endpoints.requestRevoke.params.id' },
      { name: 'reason', type: 'string', required: true, descriptionKey: 'apiDocs.endpoints.requestRevoke.params.reason' },
      { name: 'confirmationHours', type: 'number', required: false, descriptionKey: 'apiDocs.endpoints.requestRevoke.params.confirmationHours' },
    ],
    example: {
      request: {
        reason: 'Key rotation required for security',
        confirmationHours: 24,
      },
      response: {
        success: true,
        data: {
          revocationId: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
          keyId: 'enc_channel_id',
          status: 'pending',
          expiresAt: '2026-01-15T01:00:00.000Z',
          confirmationCodeSent: true,
        },
      },
    },
  },
  {
    method: 'POST',
    path: '/api/keys/:id/revoke/cancel',
    titleKey: 'apiDocs.endpoints.cancelRevoke.title',
    descriptionKey: 'apiDocs.endpoints.cancelRevoke.desc',
    params: [
      { name: 'id', type: 'string', required: true, descriptionKey: 'apiDocs.endpoints.cancelRevoke.params.id' },
    ],
    example: {
      response: {
        success: true,
        message: 'Revocation cancelled successfully',
      },
    },
  },
  {
    method: 'GET',
    path: '/api/keys/:id/revoke/status',
    titleKey: 'apiDocs.endpoints.revokeStatus.title',
    descriptionKey: 'apiDocs.endpoints.revokeStatus.desc',
    params: [
      { name: 'id', type: 'string', required: false, descriptionKey: 'apiDocs.endpoints.revokeStatus.params.id' },
      { name: 'keyId', type: 'string', required: false, descriptionKey: 'apiDocs.endpoints.revokeStatus.params.keyId' },
    ],
    example: {
      response: {
        success: true,
        data: {
          status: 'pending',
          keyId: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
          channelId: 'enc_channel_id',
          expiresAt: '2026-01-15T01:00:00.000Z',
        },
      },
    },
  },
  {
    method: 'GET',
    path: '/api/cron/cleanup-channels',
    titleKey: 'apiDocs.endpoints.cleanupChannels.title',
    descriptionKey: 'apiDocs.endpoints.cleanupChannels.desc',
    params: [
      { name: 'task', type: 'string', required: false, descriptionKey: 'apiDocs.endpoints.cleanupChannels.params.task' },
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
    titleKey: 'apiDocs.endpoints.cleanupKeys.title',
    descriptionKey: 'apiDocs.endpoints.cleanupKeys.desc',
    params: [
      { name: 'task', type: 'string', required: false, descriptionKey: 'apiDocs.endpoints.cleanupKeys.params.task' },
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
  { value: 'CRITICAL', descKey: 'apiDocs.priorities.critical', color: '#ef4444' },
  { value: 'HIGH', descKey: 'apiDocs.priorities.high', color: '#f59e0b' },
  { value: 'NORMAL', descKey: 'apiDocs.priorities.normal', color: '#10b981' },
  { value: 'LOW', descKey: 'apiDocs.priorities.low', color: '#06b6d4' },
  { value: 'BULK', descKey: 'apiDocs.priorities.bulk', color: '#8b5cf6' },
];

const channelTypes = [
  { value: 'public', descKey: 'apiDocs.channelTypes.public', icon: '📢' },
  { value: 'encrypted', descKey: 'apiDocs.channelTypes.encrypted', icon: '🔒' },
];

const authHeaders = [
  { header: 'X-API-Key', typeKey: 'apiDocs.authHeaders.apiKey.type', descKey: 'apiDocs.authHeaders.apiKey.desc' },
  { header: 'X-Admin-Key', typeKey: 'apiDocs.authHeaders.adminKey.type', descKey: 'apiDocs.authHeaders.adminKey.desc' },
  { header: 'X-Cron-Secret', typeKey: 'apiDocs.authHeaders.cronSecret.type', descKey: 'apiDocs.authHeaders.cronSecret.desc' },
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
  const { t } = useTranslation();
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
            {t(endpoint.titleKey)}
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
            {t(endpoint.descriptionKey)}
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
                {t('apiDocs.requestParams')}
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
                      <th style={{ padding: '10px 16px', textAlign: 'left', color: 'var(--text-tertiary)', fontWeight: '500' }}>{t('apiDocs.params.name')}</th>
                      <th style={{ padding: '10px 16px', textAlign: 'left', color: 'var(--text-tertiary)', fontWeight: '500' }}>{t('apiDocs.params.type')}</th>
                      <th style={{ padding: '10px 16px', textAlign: 'left', color: 'var(--text-tertiary)', fontWeight: '500' }}>{t('apiDocs.params.required')}</th>
                      <th style={{ padding: '10px 16px', textAlign: 'left', color: 'var(--text-tertiary)', fontWeight: '500' }}>{t('apiDocs.params.description')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {endpoint.params.map((param) => (
                      <tr key={param.name} style={{ borderTop: '1px solid var(--glass-border)' }}>
                        <td style={{ padding: '10px 16px', color: 'var(--accent)', fontFamily: 'monospace' }}>{param.name}</td>
                        <td style={{ padding: '10px 16px', color: 'var(--text-secondary)' }}>{param.type}</td>
                        <td style={{ padding: '10px 16px', color: param.required ? 'var(--primary)' : 'var(--text-tertiary)' }}>
                          {param.required ? t('common.yes') : t('common.no')}
                        </td>
                        <td style={{ padding: '10px 16px', color: 'var(--text-secondary)' }}>{t(param.descriptionKey)}</td>
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
                {t('apiDocs.example')}
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
                      {t('apiDocs.request')}
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
                      {t('apiDocs.response')}
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
  const { t } = useTranslation();

  return (
    <>
      <main
        style={{
          position: 'relative',
          zIndex: 1,
          minHeight: '100vh',
          padding: '60px 0 80px',
        }}
      >
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '60px', padding: '0 24px' }}>
          <h1
            style={{
              fontSize: 'clamp(28px, 5vw, 48px)',
              fontWeight: '800',
              marginBottom: '16px',
              color: 'var(--text-accent)',
              textShadow: '0 0 30px rgba(56, 189, 248, 0.4)',
            }}
          >
            {t('apiDocs.title')}
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
            {t('apiDocs.subtitle')}
          </p>
        </div>

        {/* Quick Reference */}
        <div
          style={{
            maxWidth: '1000px',
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
              {t('apiDocs.quickReference')}
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
                  {t('apiDocs.authentication')}
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
                          background: 'rgba(56, 189, 248, 0.2)',
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
                          {t(auth.typeKey)}
                        </div>
                        <div
                          style={{
                            fontSize: '12px',
                            color: 'var(--text-tertiary)',
                          }}
                        >
                          {t(auth.descKey)}
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
                  {t('apiDocs.channelTypes')}
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
                          {t(type.descKey)}
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
                  {t('apiDocs.messagePriority')}
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
                        {t(p.descKey)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Endpoints */}
        <div
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
            🔌 {t('apiDocs.endpoints')}
          </h2>

          {endpoints.map((endpoint) => (
            <EndpointCard key={`${endpoint.method}-${endpoint.path}`} endpoint={endpoint} />
          ))}
        </div>
      </main>
    </>
  );
}
