// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

'use client';

import { useTranslation } from '@/app/hooks/useTranslation';
import { useRef, useEffect, useState } from 'react';

export default function LanguageSwitcher() {
  const { locale, setLocale } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const [positions, setPositions] = useState({ left: 0, width: 0 });
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    const updatePositions = () => {
      const container = containerRef.current;
      if (!container) return;

      const buttons = container.querySelectorAll('.lang-btn');
      const positions: { left: number; width: number }[] = [];

      buttons.forEach((btn) => {
        const element = btn as HTMLElement;
        positions.push({
          left: element.offsetLeft,
          width: element.offsetWidth,
        });
      });

      setPositions(positions[locale === 'zh-CN' ? 0 : 1]);
    };

    updatePositions();
    window.addEventListener('resize', updatePositions);
    return () => window.removeEventListener('resize', updatePositions);
  }, [locale]);

  const handleLocaleChange = (newLocale: 'zh-CN' | 'en') => {
    if (locale === newLocale || isAnimating) return;
    setIsAnimating(true);
    setLocale(newLocale);
    setTimeout(() => setIsAnimating(false), 500);
  };

  return (
    <div className="language-switcher" ref={containerRef}>
      <div
        className="slider"
        style={{
          left: positions.left,
          width: positions.width,
        }}
      />
      <button
        className={`lang-btn ${locale === 'zh-CN' ? 'active' : ''}`}
        onClick={() => handleLocaleChange('zh-CN')}
        aria-label="Switch to Chinese"
      >
        中文
      </button>
      <button
        className={`lang-btn ${locale === 'en' ? 'active' : ''}`}
        onClick={() => handleLocaleChange('en')}
        aria-label="Switch to English"
      >
        EN
      </button>

      <style jsx global>{`
        .language-switcher {
          display: flex;
          align-items: center;
          gap: 0;
          padding: 4px;
          background: var(--glass-bg);
          border: 1px solid var(--glass-border);
          border-radius: 10px;
          position: relative;
        }

        .language-switcher .slider {
          position: absolute;
          top: 4px;
          height: calc(100% - 8px);
          background: linear-gradient(135deg, var(--primary), var(--accent));
          border-radius: 8px;
          transition: left 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55),
                      width 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55);
          box-shadow: 0 2px 8px rgba(56, 189, 248, 0.2);
          opacity: 0.85;
          z-index: 0;
          pointer-events: none;
        }

        .language-switcher .lang-btn {
          position: relative;
          background: none;
          border: none;
          color: var(--text-secondary);
          cursor: pointer;
          padding: 8px 20px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 500;
          transition: color 0.3s ease;
          z-index: 1;
          flex-shrink: 0;
        }

        .language-switcher .lang-btn:hover {
          color: var(--text-primary);
        }

        .language-switcher .lang-btn.active {
          color: white;
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
        }

        .language-switcher .lang-btn:active {
          transform: scale(0.96);
        }
      `}</style>
    </div>
  );
}
