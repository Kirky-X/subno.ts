// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

/**
 * Date and time formatting utilities
 */

/**
 * Format a date to ISO string without milliseconds
 */
export function formatISODate(date: Date = new Date()): string {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/**
 * Format a date to human-readable string
 * Example: "2026-03-31 14:30:00 UTC"
 */
export function formatHumanReadableDate(date: Date = new Date()): string {
  return date.toISOString().replace('T', ' ').replace('Z', ' UTC');
}

/**
 * Get relative time description
 * Example: "5 minutes ago", "in 2 hours"
 */
export function getRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffSeconds = Math.floor(Math.abs(diffMs) / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  const isPast = diffMs < 0;

  if (diffSeconds < 60) {
    return isPast ? `${diffSeconds}秒前` : `${diffSeconds}秒后`;
  } else if (diffMinutes < 60) {
    return isPast ? `${diffMinutes}分钟前` : `${diffMinutes}分钟后`;
  } else if (diffHours < 24) {
    return isPast ? `${diffHours}小时前` : `${diffHours}小时后`;
  } else {
    return isPast ? `${diffDays}天前` : `${diffDays}天后`;
  }
}

/**
 * Check if a date is in the past
 */
export function isPast(date: Date): boolean {
  return date.getTime() < Date.now();
}

/**
 * Check if a date is in the future
 */
export function isFuture(date: Date): boolean {
  return date.getTime() > Date.now();
}

/**
 * Check if a date is within a certain range from now
 */
export function isWithinRange(date: Date, rangeMs: number): boolean {
  const diff = Math.abs(date.getTime() - Date.now());
  return diff <= rangeMs;
}

/**
 * Add seconds to a date
 */
export function addSeconds(date: Date, seconds: number): Date {
  return new Date(date.getTime() + seconds * 1000);
}

/**
 * Add minutes to a date
 */
export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

/**
 * Add hours to a date
 */
export function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

/**
 * Add days to a date
 */
export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

/**
 * Get start of day (midnight)
 */
export function startOfDay(date: Date = new Date()): Date {
  const newDate = new Date(date);
  newDate.setHours(0, 0, 0, 0);
  return newDate;
}

/**
 * Get end of day (23:59:59.999)
 */
export function endOfDay(date: Date = new Date()): Date {
  const newDate = new Date(date);
  newDate.setHours(23, 59, 59, 999);
  return newDate;
}

/**
 * Parse ISO date string safely
 */
export function parseISODate(isoString: string): Date | null {
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) {
      return null;
    }
    return date;
  } catch {
    return null;
  }
}

/**
 * Calculate time difference between two dates
 */
export interface TimeDifference {
  years: number;
  months: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  milliseconds: number;
}

export function getTimeDifference(from: Date, to: Date = new Date()): TimeDifference {
  const diff = to.getTime() - from.getTime();
  
  const milliseconds = Math.abs(diff % 1000);
  const seconds = Math.floor(Math.abs(diff) / 1000) % 60;
  const minutes = Math.floor(Math.abs(diff) / (1000 * 60)) % 60;
  const hours = Math.floor(Math.abs(diff) / (1000 * 60 * 60)) % 24;
  const days = Math.floor(Math.abs(diff) / (1000 * 60 * 60 * 24));
  
  // Approximate calculations for months and years
  const approximateMonths = Math.floor(days / 30);
  const approximateYears = Math.floor(approximateMonths / 12);
  
  return {
    years: approximateYears,
    months: approximateMonths % 12,
    days: days % 30,
    hours,
    minutes,
    seconds,
    milliseconds,
  };
}

/**
 * Sleep utility for async operations
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  
  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };
    
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle function
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): T {
  let inThrottle: boolean;
  
  return function(this: any, ...args: Parameters<T>) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  } as T;
}
