// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

'use client';

import { useTranslation } from '@/app/hooks/useTranslation';

interface Feature {
  icon: string;
  titleKey: string;
  descriptionKey: string;
  tagsKey: string;
}

const features: Feature[] = [
  {
    icon: '🔐',
    titleKey: 'features.publicKeyHosting',
    descriptionKey: 'features.publicKeyHostingDesc',
    tagsKey: 'features.publicKeyHostingTags',
  },
  {
    icon: '📡',
    titleKey: 'features.realtimePush',
    descriptionKey: 'features.realtimePushDesc',
    tagsKey: 'features.realtimePushTags',
  },
  {
    icon: '🔒',
    titleKey: 'features.e2eEncryption',
    descriptionKey: 'features.e2eEncryptionDesc',
    tagsKey: 'features.e2eEncryptionTags',
  },
  {
    icon: '📺',
    titleKey: 'features.channelManagement',
    descriptionKey: 'features.channelManagementDesc',
    tagsKey: 'features.channelManagementTags',
  },
  {
    icon: '⚡',
    titleKey: 'features.messagePriority',
    descriptionKey: 'features.messagePriorityDesc',
    tagsKey: 'features.messagePriorityTags',
  },
  {
    icon: '🛡️',
    titleKey: 'features.securityAuth',
    descriptionKey: 'features.securityAuthDesc',
    tagsKey: 'features.securityAuthTags',
  },
];

function FeatureCard({ feature, index }: { feature: Feature; index: number }) {
  const { t, tArray } = useTranslation();

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
          background: 'linear-gradient(135deg, var(--primary), var(--accent))',
          borderRadius: '20px',
          boxShadow: '0 4px 20px rgba(56, 189, 248, 0.3)',
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
        {t(feature.titleKey)}
      </h3>
      <p
        style={{
          fontSize: '14px',
          color: 'var(--text-secondary)',
          lineHeight: '1.7',
          marginBottom: '16px',
        }}
      >
        {t(feature.descriptionKey)}
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center' }}>
        {tArray(feature.tagsKey).map((tag: string, index: number) => (
          <span
            key={index}
            style={{
              fontSize: '12px',
              padding: '4px 10px',
              background: 'rgba(56, 189, 248, 0.15)',
              color: 'var(--primary-hover)',
              borderRadius: '20px',
              border: '1px solid rgba(56, 189, 248, 0.3)',
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
  const { t } = useTranslation();

  return (
    <>
      <main
        style={{
          position: 'relative',
          zIndex: 1,
          minHeight: '100vh',
          padding: '40px 0 80px',
        }}
      >
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
              color: 'var(--text-accent)',
              textShadow: '0 0 30px rgba(56, 189, 248, 0.4)',
            }}
          >
            {t('home.heroTitle')}
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
            {t('home.heroDesc')}
          </p>

          <div
            className="glass-card server-badge"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '12px',
              padding: '16px 32px',
              background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.2) 0%, rgba(6, 182, 212, 0.15) 100%)',
              boxShadow: '0 0 30px rgba(56, 189, 248, 0.25), 0 0 60px rgba(6, 182, 212, 0.15)',
            }}
          >
            <span style={{ fontSize: '20px' }}>🌐</span>
            <span style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)' }}>
              {t('home.publicServer')}
            </span>
            <span style={{ fontSize: '14px', color: 'var(--accent)', fontFamily: 'monospace' }}>
              {t('home.publicServerUrl')}
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
              {t('home.featuresTitle')}
            </h2>
            <p
              style={{
                fontSize: '16px',
                color: 'var(--text-secondary)',
              }}
            >
              {t('home.featuresSubtitle')}
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
              <FeatureCard key={feature.titleKey} feature={feature} index={index} />
            ))}
          </div>
        </section>

        {/* How It Works Section */}
        <section
          style={{
            maxWidth: '1200px',
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
              👨‍💻 {t('home.workflowTitle')}
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0', position: 'relative' }}>
              {[
                { step: 1, titleKey: 'home.step1Title', descKey: 'home.step1Desc' },
                { step: 2, titleKey: 'home.step2Title', descKey: 'home.step2Desc' },
                { step: 3, titleKey: 'home.step3Title', descKey: 'home.step3Desc' },
                { step: 4, titleKey: 'home.step4Title', descKey: 'home.step4Desc' },
              ].map((item, index) => (
                <div key={item.step} style={{ position: 'relative' }}>
                  {/* 连接线 */}
                  {index < 3 && (
                    <div
                      style={{
                        position: 'absolute',
                        left: '50%',
                        top: '100%',
                        width: '2px',
                        height: '32px',
                        background: 'linear-gradient(to bottom, var(--primary), transparent)',
                        transform: 'translateX(-50%)',
                        opacity: 0.5,
                      }}
                    />
                  )}
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      textAlign: 'center',
                      gap: '12px',
                      padding: '16px 0',
                    }}
                  >
                    <div
                      style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, var(--primary), var(--accent))',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '20px',
                        fontWeight: '700',
                        flexShrink: 0,
                        boxShadow: '0 4px 16px rgba(56, 189, 248, 0.3)',
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
                        {t(item.titleKey)}
                      </div>
                      <p
                        style={{
                          fontSize: '14px',
                          color: 'var(--text-secondary)',
                          lineHeight: '1.6',
                          maxWidth: '400px',
                        }}
                      >
                        {t(item.descKey)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <style jsx global>{`
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
          color: var(--text-secondary);
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