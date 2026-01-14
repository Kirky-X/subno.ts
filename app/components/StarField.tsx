'use client';

import { useEffect, useRef, useCallback } from 'react';

interface Star {
  x: number;
  y: number;
  z: number;
  size: number;
  speed: number;
  brightness: number;
  baseSpeed: number;
}

export default function StarField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const starsRef = useRef<Star[]>([]);
  const lastMouseMoveRef = useRef<number>(Date.now());
  const speedMultiplierRef = useRef<number>(1);

  const initStars = useCallback((width: number, height: number, count: number = 300) => {
    const stars: Star[] = [];
    for (let i = 0; i < count; i++) {
      stars.push({
        x: Math.random() * width,
        y: Math.random() * height,
        z: Math.random() * width,
        size: Math.random() * 1.5 + 0.5,
        speed: Math.random() * 0.5 + 0.2,
        brightness: Math.random() * 0.5 + 0.5,
        baseSpeed: Math.random() * 0.5 + 0.2,
      });
    }
    return stars;
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // 检测鼠标是否静止，加速星空移动
    const timeSinceMouseMove = Date.now() - lastMouseMoveRef.current;
    if (timeSinceMouseMove > 2000) {
      // 鼠标静止超过2秒，加速到3倍
      speedMultiplierRef.current = Math.min(speedMultiplierRef.current + 0.02, 3);
    } else {
      // 鼠标移动中，恢复正常速度
      speedMultiplierRef.current = Math.max(speedMultiplierRef.current - 0.1, 1);
    }

    // 半透明清除，产生拖尾效果
    ctx.fillStyle = 'rgba(9, 9, 11, 0.2)';
    ctx.fillRect(0, 0, width, height);

    // 绘制星星
    starsRef.current.forEach((star) => {
      // 更新位置（根据速度倍率）
      star.speed = star.baseSpeed * speedMultiplierRef.current;
      star.z -= star.speed;
      if (star.z <= 0) {
        star.z = width;
        star.x = Math.random() * width;
        star.y = Math.random() * height;
      }

      // 计算投影位置
      const sx = (star.x - width / 2) * (width / star.z) + width / 2;
      const sy = (star.y - height / 2) * (width / star.z) + height / 2;
      const size = (1 - star.z / width) * star.size * 2;

      if (sx >= 0 && sx <= width && sy >= 0 && sy <= height && size > 0) {
        // 星星发光效果
        const gradient = ctx.createRadialGradient(sx, sy, 0, sx, sy, size * 2);
        gradient.addColorStop(0, `rgba(255, 255, 255, ${star.brightness})`);
        gradient.addColorStop(0.5, `rgba(200, 200, 255, ${star.brightness * 0.5})`);
        gradient.addColorStop(1, 'transparent');

        ctx.beginPath();
        ctx.arc(sx, sy, size * 2, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();

        // 中心亮点
        ctx.beginPath();
        ctx.arc(sx, sy, size * 0.3, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${star.brightness})`;
        ctx.fill();
      }
    });

    animationRef.current = requestAnimationFrame(draw);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      starsRef.current = initStars(canvas.width, canvas.height);
    };

    const handleMouseMove = () => {
      lastMouseMoveRef.current = Date.now();
      speedMultiplierRef.current = 1;
    };

    handleResize();
    animationRef.current = requestAnimationFrame(draw);

    window.addEventListener('resize', handleResize);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('touchstart', handleMouseMove);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchstart', handleMouseMove);
      cancelAnimationFrame(animationRef.current);
    };
  }, [initStars, draw]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-0 pointer-events-none"
      style={{ position: 'fixed', top: 0, left: 0 }}
    />
  );
}
