'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

export default function Template({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    // 从 sessionStorage 获取导航方向
    const direction = sessionStorage.getItem('nav-direction');
    const directionElement = document.querySelector('.page-transition');

    if (directionElement) {
      if (direction === 'forward') {
        directionElement.classList.add('forward');
        directionElement.classList.remove('backward');
      } else {
        directionElement.classList.add('backward');
        directionElement.classList.remove('forward');
      }
    }

    // 清除方向标记
    sessionStorage.removeItem('nav-direction');
  }, [pathname]);

  return (
    <div className="page-wrapper">
      <div className="page-transition forward" data-path={pathname}>
        {children}
      </div>
      <style jsx global>{`
        .page-wrapper {
          overflow-x: hidden;
        }

        .page-transition {
          animation-duration: 0.35s;
          animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
          animation-fill-mode: both;
        }

        .page-transition.forward {
          animation-name: slideInRight;
        }

        .page-transition.backward {
          animation-name: slideInLeft;
        }

        @keyframes slideInRight {
          from {
            opacity: 0;
            transform: translateX(40px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes slideInLeft {
          from {
            opacity: 0;
            transform: translateX(-40px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>
    </div>
  );
}
