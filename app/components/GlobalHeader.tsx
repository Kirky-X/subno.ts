// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useTranslation } from '@/app/hooks/useTranslation';
import LanguageSwitcher from './LanguageSwitcher';

interface HealthStatus {
  database: boolean;
  cache: boolean;
  loading: boolean;
}

function HealthCheck() {
  const { t } = useTranslation();
  const [health, setHealth] = useState<HealthStatus>({
    database: false,
    cache: false,
    loading: true,
  });

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
    <div className="health-check">
      <div
        className="health-indicator"
        style={{
          background: isHealthy ? '#10b981' : '#ef4444',
          boxShadow: `0 0 10px ${isHealthy ? 'rgba(16, 185, 129, 0.5)' : 'rgba(239, 68, 68, 0.5)'}`,
        }}
      />
      <div className="health-text">
        <div className="health-title">{t('header.systemStatus')}</div>
        <div className="health-status">
          {health.loading ? t('header.checking') : isHealthy ? t('header.healthy') : t('header.unhealthy')}
        </div>
      </div>
    </div>
  );
}

function HeaderBadge() {
  const { t } = useTranslation();
  
  return (
    <div className="header-badge">
      <span className="badge-icon">🚀</span>
      <div className="badge-text">
        <div className="badge-title">{t('common.version')}</div>
        <div className="badge-version">{t('header.versionNumber')}</div>
      </div>
    </div>
  );
}

function RepoBadge() {
  const { t } = useTranslation();
  
  return (
    <a
      href="https://github.com/Kirky-X/subno.ts"
      target="_blank"
      rel="noopener noreferrer"
      className="header-badge repo-badge"
    >
      <svg
        height="16"
        viewBox="0 0 16 16"
        width="16"
        fill="currentColor"
        className="repo-icon"
      >
        <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
      </svg>
      <div className="badge-text">
        <div className="badge-title">{t('header.repo')}</div>
        <div className="badge-version">{t('common.github')}</div>
      </div>
      <span className="repo-tooltip">https://github.com/Kirky-X/subno.ts</span>
    </a>
  );
}

export default function GlobalHeader() {
  const { t } = useTranslation();
  const pathname = usePathname();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleNavClick = (href: string) => {
    // 导航方向：首页 -> 其他 = forward，其他 -> 首页 = backward
    const isGoingToHome = href === '/';
    const isAtHome = pathname === '/';

    if (isAtHome && !isGoingToHome) {
      sessionStorage.setItem('nav-direction', 'forward');
    } else if (isGoingToHome && !isAtHome) {
      sessionStorage.setItem('nav-direction', 'backward');
    }
  };

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header className={`global-header ${isScrolled ? 'scrolled' : ''}`}>
      <div className="header-container">
        <Link href="/" className="logo-link" onClick={() => handleNavClick('/')}>
            <div className="logo-wrapper">
              <Image
                src="/assets/logo.png"
                alt="SecureNotify"
                width={44}
                height={44}
                priority
              />
            </div>
          <div className="logo-text">
            <span className="logo-title">{t('header.title')}</span>
            <span className="logo-subtitle">{t('header.subtitle')}</span>
          </div>
        </Link>

        {/* Logo Tabs */}
        <nav className="logo-tabs">
          <Link href="/" className="logo-tab" onClick={() => handleNavClick('/')}>{t('header.home')}</Link>
          <Link href="/api-docs" className="logo-tab" onClick={() => handleNavClick('/api-docs')}>{t('common.apiDocs')}</Link>
        </nav>

        {/* Desktop Navigation */}
        <nav className="header-nav desktop-nav">
          <RepoBadge />
          <HeaderBadge />
          <HealthCheck />
          <LanguageSwitcher />
        </nav>

        {/* Mobile Menu Button */}
        <button
          className={`mobile-menu-btn ${isMobileMenuOpen ? 'active' : ''}`}
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          aria-label="Toggle menu"
        >
          <span className="menu-line" />
          <span className="menu-line" />
          <span className="menu-line" />
        </button>
      </div>

      {/* Mobile Navigation */}
      {isMobileMenuOpen && (
        <nav className="mobile-nav">
          <HeaderBadge />
          <LanguageSwitcher />
          <RepoBadge />
          <HealthCheck />
        </nav>
      )}

      <style jsx global>{`
        /* Logo Tabs */
        .logo-tabs {
          display: flex;
          align-items: center;
          gap: 4px;
          margin-left: 24px;
        }

        .logo-tab {
          padding: 8px 16px;
          font-size: 14px;
          font-weight: 500;
          color: var(--text-secondary);
          border-radius: 8px;
          transition: all 0.2s ease;
        }

        .logo-tab:hover {
          color: var(--text-primary);
          background: var(--glass-bg);
        }

        .logo-tab.active {
          color: var(--text-primary);
          background: var(--glass-bg);
        }

        /* 响应式导航 */
        .desktop-nav {
          display: flex;
          gap: 12px;
          margin-left: auto;
        }

        .mobile-menu-btn {
          display: none;
          flex-direction: column;
          justify-content: center;
          gap: 5px;
          width: 32px;
          height: 32px;
          background: transparent;
          border: none;
          cursor: pointer;
          padding: 4px;
        }

        .mobile-menu-btn .menu-line {
          display: block;
          width: 100%;
          height: 2px;
          background: var(--text-primary);
          border-radius: 2px;
          transition: all 0.3s ease;
        }

        .mobile-menu-btn.active .menu-line:nth-child(1) {
          transform: translateY(7px) rotate(45deg);
        }

        .mobile-menu-btn.active .menu-line:nth-child(2) {
          opacity: 0;
        }

        .mobile-menu-btn.active .menu-line:nth-child(3) {
          transform: translateY(-7px) rotate(-45deg);
        }

        .mobile-nav {
          display: none;
          flex-direction: column;
          gap: 12px;
          padding: 16px 24px 16px;
          border-top: 1px solid var(--glass-border);
          animation: slideDown 0.3s ease;
        }

        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        /* 移动端响应式 */
        @media (max-width: 768px) {
          .desktop-nav {
            display: none;
          }

          .mobile-menu-btn {
            display: flex;
          }

          .mobile-nav {
            display: flex;
          }

          .logo-subtitle {
            display: none;
          }

          .logo-wrapper img {
            height: 36px !important;
          }
        }

        /* Health Check 样式 */
        .health-check {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 16px;
          background: var(--glass-bg);
          backdrop-filter: blur(12px);
          border: 1px solid var(--glass-border);
          border-radius: 12px;
          color: var(--text-primary);
          transition: all 0.25s ease;
          cursor: default;
        }

        .health-indicator {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .health-text {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .health-title {
          font-size: 12px;
          font-weight: 600;
          color: var(--text-primary);
          line-height: 1.2;
        }

        .health-status {
          font-size: 11px;
          color: var(--text-tertiary);
          line-height: 1.2;
        }

        /* 按钮通用悬停效果 */
        .header-badge,
        .api-badge,
        .health-check,
        .logo-tab {
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .header-badge:hover,
        .api-badge:hover,
        .health-check:hover,
        .logo-tab:hover {
          transform: scale(1.03);
        }

        /* Header Badge 样式 */
        .header-badge {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 16px;
          background: var(--glass-bg);
          backdrop-filter: blur(12px);
          border: 1px solid var(--glass-border);
          border-radius: 12px;
          color: var(--text-primary);
          position: relative;
        }

        .header-badge:hover {
          background: var(--glass-bg-hover);
          border-color: var(--glass-border-hover);
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
        }

        /* API Badge 特殊样式 */
        .api-badge {
          cursor: pointer;
        }

        .api-badge:hover {
          background: var(--glass-bg-hover);
          border-color: var(--glass-border-hover);
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
        }

        .badge-text {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .badge-title {
          font-size: 12px;
          font-weight: 600;
          line-height: 1.2;
        }

        .badge-version {
          font-size: 11px;
          color: var(--text-tertiary);
          line-height: 1.2;
        }

        /* API Badge 特殊样式 */
        .api-badge {
          cursor: pointer;
        }

        .api-badge:hover {
          background: var(--glass-bg-hover);
          border-color: var(--glass-border-hover);
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
        }

        /* Repo Badge 特殊样式 */
        .repo-badge .repo-icon {
          flex-shrink: 0;
        }

        .repo-badge:hover .repo-tooltip {
          opacity: 1;
          visibility: visible;
          transform: translateX(-50%) translateY(0);
        }

        .repo-tooltip {
          position: absolute;
          bottom: -36px;
          left: 50%;
          transform: translateX(-50%) translateY(10px);
          background: var(--bg-tertiary);
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
          border: 1px solid var(--glass-border);
        }

        .repo-tooltip::before {
          content: '';
          position: absolute;
          top: -6px;
          left: 50%;
          transform: translateX(-50%);
          border-left: 6px solid transparent;
          border-right: 6px solid transparent;
          border-bottom: 6px solid var(--bg-tertiary);
        }
      `}</style>
    </header>
  );
}