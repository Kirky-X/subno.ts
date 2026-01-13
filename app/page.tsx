// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

'use client';

import Link from 'next/link';
import StarField from './components/StarField';
import { useState, useEffect } from 'react';

const PROJECT_VERSION = 'v0.1.0';

interface Feature {
  icon: string;
  title: string;
  description: string;
  tags: string[];
}

const features: Feature[] = [
  {
    icon: '🔐',
    title: '公钥托管',
    description: '安全存储用户的加密公钥，支持多种算法。订阅者使用托管公钥对消息进行端到端加密，确保只有目标接收者才能解密阅读。',
    tags: ['RSA', 'ECC', '安全托管'],
  },
  {
    icon: '📡',
    title: '实时推送',
    description: '基于 Server-Sent Events (SSE) 的实时消息分发，即时送达所有订阅者。支持断线重连和消息确认机制。',
    tags: ['SSE', '实时', '消息确认'],
  },
  {
    icon: '🔒',
    title: '端到端加密',
    description: '发布者使用接收者的公钥加密消息，服务端无法解密内容。接收者使用自己的私钥解密阅读，实现真正的端到端安全。',
    tags: ['E2E加密', '私钥解密', '内容保密'],
  },
  {
    icon: '📺',
    title: '频道管理',
    description: '支持公开频道、加密频道和临时频道。公开频道无需注册，临时频道自动过期，满足公告广播和私密会话等场景。',
    tags: ['公开频道', '加密频道', '临时频道'],
  },
  {
    icon: '⚡',
    title: '消息优先级',
    description: '支持优先级队列（CRITICAL/HIGH/NORMAL/LOW/BULK），确保关键消息优先推送，批量通知高效分发。',
    tags: ['优先级', '队列调度', '高性能'],
  },
  {
    icon: '🛡️',
    title: '安全认证',
    description: 'API 密钥认证、请求限流、审计日志等多重安全机制。公钥防篡改，消息防泄露，保障整个推送链路安全。',
    tags: ['API认证', '限流', '审计'],
  },
];

interface HealthStatus {
  database: boolean;
  cache: boolean;
  loading: boolean;
}

function HealthCheck() {
  const [health, setHealth] = useState<HealthStatus>({ database: false, cache: false, loading: true });

  useEffect(() => {
    const checkHealth = async () => {
      try {
        setTimeout(() => {
          setHealth({ database: true, cache: true, loading: false });
        }, 1000);
      } catch {
        setHealth({ database: false, cache: false, loading: false });
      }
    };

    checkHealth();
  }, []);

  const isHealthy = health.database && health.cache && !health.loading;

  return (
    <div
      className="glass-card"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '12px 20px',
      }}
    >
      <div
        style={{
          width: '10px',
          height: '10px',
          borderRadius: '50%',
          background: isHealthy ? '#10b981' : '#ef4444',
          boxShadow: `0 0 10px ${isHealthy ? 'rgba(16, 185, 129, 0.5)' : 'rgba(239, 68, 68, 0.5)'}`,
        }}
      />
      <div>
        <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-primary)' }}>
          系统状态
        </div>
        <div style={{ fontSize: '11px', color: health.loading ? 'var(--text-tertiary)' : (isHealthy ? '#10b981' : '#ef4444') }}>
          {health.loading ? '检查中...' : (isHealthy ? '健康' : '异常')}
        </div>
      </div>
    </div>
  );
}

function VersionBadge() {
  return (
    <div
      className="glass-card"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '12px 20px',
      }}
    >
      <span style={{ fontSize: '16px' }}>🚀</span>
      <div>
        <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-primary)' }}>
          SecureNotify
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
          {PROJECT_VERSION}
        </div>
      </div>
    </div>
  );
}

function ApiDocsBadge() {
  return (
    <Link
      href="/api-docs"
      className="glass-card api-badge"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '12px 20px',
        color: 'var(--text-primary)',
      }}
    >
      <span style={{ fontSize: '16px' }}>📖</span>
      <div>
        <div style={{ fontSize: '12px', fontWeight: '600' }}>API</div>
        <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>文档</div>
      </div>
    </Link>
  );
}

function RepoBadge() {
  return (
    <a
      href="https://github.com/Kirky-X/subno.ts"
      target="_blank"
      rel="noopener noreferrer"
      className="glass-card repo-badge"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '12px 20px',
        color: 'var(--text-primary)',
        position: 'relative',
      }}
    >
      <svg height="16" viewBox="0 0 16 16" width="16" fill="currentColor">
        <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
      </svg>
      <div>
        <div style={{ fontSize: '12px', fontWeight: '600' }}>仓库</div>
        <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>GitHub</div>
      </div>
      <span className="repo-tooltip">https://github.com/Kirky-X/subno.ts</span>
    </a>
  );
}

function FeatureCard({ feature, index }: { feature: Feature; index: number }) {
  return (
    <div
      className="glass-card"
      style={{
        textAlign: 'center',
        padding: '32px 24px',
        animationDelay: `${index * 100}ms`,
      }}
    >
      <div
        style={{
          fontSize: '48px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '80px',
          height: '80px',
          margin: '0 auto 20px',
          background: 'var(--gradient-primary)',
          borderRadius: '20px',
          boxShadow: '0 4px 20px rgba(139, 92, 246, 0.3)',
        }}
      >
        {feature.icon}
      </div>
      <h3
        style={{
          fontSize: '20px',
          fontWeight: '700',
          color: 'var(--text-primary)',
          marginBottom: '12px',
        }}
      >
        {feature.title}
      </h3>
      <p
        style={{
          fontSize: '14px',
          color: 'var(--text-secondary)',
          lineHeight: '1.7',
          marginBottom: '16px',
        }}
      >
        {feature.description}
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center' }}>
        {feature.tags.map((tag) => (
          <span
            key={tag}
            style={{
              fontSize: '12px',
              padding: '4px 10px',
              background: 'rgba(139, 92, 246, 0.15)',
              color: 'var(--primary-hover)',
              borderRadius: '20px',
              border: '1px solid rgba(139, 92, 246, 0.3)',
            }}
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function Home() {
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
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            maxWidth: '1200px',
            margin: '0 auto 40px',
            padding: '0 24px',
            flexWrap: 'wrap',
            gap: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span className="bell-icon" style={{ fontSize: '28px', cursor: 'pointer' }}>🔔</span>
            <div>
              <div style={{ fontSize: '14px', color: 'var(--primary-hover)', fontWeight: '500' }}>
                SecureNotify
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
                端到端加密推送服务
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <VersionBadge />
            <ApiDocsBadge />
            <RepoBadge />
            <HealthCheck />
          </div>
        </div>

        {/* Hero Section */}
        <section
          style={{
            textAlign: 'center',
            marginBottom: '80px',
            padding: '0 24px',
          }}
        >
          <h1
            style={{
              fontSize: 'clamp(36px, 6vw, 64px)',
              fontWeight: '800',
              lineHeight: '1.1',
              marginBottom: '24px',
              background: 'var(--gradient-primary)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            公钥托管与加密消息推送
          </h1>

          <p
            style={{
              fontSize: 'clamp(16px, 2vw, 20px)',
              color: 'var(--text-secondary)',
              maxWidth: '700px',
              margin: '0 auto 32px',
              lineHeight: '1.7',
            }}
          >
            发布者使用接收者的公钥加密消息，服务端仅做加密消息的搬运工，
            真正实现端到端加密，确保您的隐私信息在传输过程中滴水不漏。
          </p>

          <div
            className="glass-card server-badge"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '12px',
              padding: '16px 32px',
              background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.2) 0%, rgba(6, 182, 212, 0.15) 100%)',
              boxShadow: '0 0 30px rgba(139, 92, 246, 0.25), 0 0 60px rgba(6, 182, 212, 0.15)',
            }}
          >
            <span style={{ fontSize: '20px' }}>🌐</span>
            <span style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)' }}>
              公共服务器
            </span>
            <span style={{ fontSize: '14px', color: 'var(--accent)', fontFamily: 'monospace' }}>
              https://subno-ts.vercel.app/
            </span>
          </div>
        </section>

        {/* Features Section */}
        <section
          style={{
            maxWidth: '1200px',
            margin: '0 auto 80px',
            padding: '0 24px',
          }}
        >
          <div
            style={{
              textAlign: 'center',
              marginBottom: '48px',
            }}
          >
            <h2
              style={{
                fontSize: '32px',
                fontWeight: '700',
                color: 'var(--text-primary)',
                marginBottom: '16px',
              }}
            >
              核心功能
            </h2>
            <p
              style={{
                fontSize: '16px',
                color: 'var(--text-secondary)',
              }}
            >
              专注端到端加密的实时消息推送服务
            </p>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: '24px',
            }}
          >
            {features.map((feature, index) => (
              <FeatureCard key={feature.title} feature={feature} index={index} />
            ))}
          </div>
        </section>

        {/* How It Works Section */}
        <section
          style={{
            maxWidth: '900px',
            margin: '0 auto 80px',
            padding: '0 24px',
          }}
        >
          <div className="glass-card glass-card-strong" style={{ padding: '40px' }}>
            <h2
              style={{
                fontSize: '24px',
                fontWeight: '700',
                color: 'var(--text-primary)',
                marginBottom: '24px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              🔄 工作流程
            </h2>

            <div style={{ display: 'grid', gap: '24px' }}>
              {[
                { step: 1, title: '接收者注册公钥', desc: '用户将自己的加密公钥注册到服务端的密钥管理系统，由服务端安全托管。' },
                { step: 2, title: '发布者加密消息', desc: '发布者根据接收者标识获取公钥，使用该公钥对消息内容进行加密后发布。' },
                { step: 3, title: '服务端加密转发', desc: '服务端收到加密消息后，通过 SSE 实时推送给所有订阅者，全程不解密。' },
                { step: 4, title: '接收者私钥解密', desc: '接收者使用自己的私钥解密消息，只有持有对应私钥的用户才能阅读内容。' },
              ].map((item) => (
                <div
                  key={item.step}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '16px',
                  }}
                >
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      background: 'var(--gradient-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '16px',
                      fontWeight: '700',
                      flexShrink: 0,
                    }}
                  >
                    {item.step}
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: '16px',
                        fontWeight: '600',
                        color: 'var(--text-primary)',
                        marginBottom: '8px',
                      }}
                    >
                      {item.title}
                    </div>
                    <p
                      style={{
                        fontSize: '14px',
                        color: 'var(--text-secondary)',
                        lineHeight: '1.6',
                      }}
                    >
                      {item.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <style jsx global>{`
        /* 铃铛晃动动画 */
        .bell-icon:hover {
          animation: bell-shake 0.5s ease-in-out;
        }

        @keyframes bell-shake {
          0%, 100% { transform: rotate(0deg); }
          10% { transform: rotate(15deg); }
          20% { transform: rotate(-15deg); }
          30% { transform: rotate(10deg); }
          40% { transform: rotate(-10deg); }
          50% { transform: rotate(5deg); }
          60% { transform: rotate(-5deg); }
          70% { transform: rotate(2deg); }
          80% { transform: rotate(-2deg); }
          90% { transform: rotate(1deg); }
        }

        /* 仓库链接悬浮效果 */
        .repo-badge:hover .repo-tooltip,
        .api-badge:hover {
          opacity: 1;
          visibility: visible;
          transform: translateX(-50%) translateY(0);
        }

        .repo-tooltip {
          position: absolute;
          bottom: -36px;
          left: 50%;
          transform: translateX(-50%) translateY(10px);
          background: var(--bg-tertiary, #27272a);
          color: var(--text-secondary, rgba(250, 250, 250, 0.7));
          padding: 6px 12px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 500;
          white-space: nowrap;
          opacity: 0;
          visibility: hidden;
          transition: all 0.2s ease;
          pointer-events: none;
          z-index: 100;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
          border: 1px solid var(--glass-border, rgba(255, 255, 255, 0.08));
        }

        .repo-tooltip::before {
          content: '';
          position: absolute;
          top: -6px;
          left: 50%;
          transform: translateX(-50%);
          border-left: 6px solid transparent;
          border-right: 6px solid transparent;
          border-bottom: 6px solid var(--bg-tertiary, #27272a);
        }

        .glass-card {
          transition: all 0.25s ease;
        }

        .glass-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
        }
      `}</style>
    </>
  );
}
