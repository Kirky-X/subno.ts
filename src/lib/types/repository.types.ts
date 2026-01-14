// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import { SQL, type Table } from 'drizzle-orm';

// ============================================================================
// Repository Types
// ============================================================================

/**
 * Base entity interface for all entities with timestamps
 */
export interface TimestampedEntity {
  id: string;
  createdAt: Date;
  updatedAt?: Date | null;
}

/**
 * Entity with soft delete support
 */
export interface SoftDeleteEntity extends TimestampedEntity {
  isDeleted: boolean;
  revokedAt: Date | null;
  revokedBy: string | null;
  revocationReason: string | null;
}

/**
 * Options for paginated queries
 */
export interface PaginatedQueryOptions {
  limit?: number;
  offset?: number;
}

/**
 * Options for findAll queries
 */
export interface FindAllOptions<T> extends PaginatedQueryOptions {
  includeDeleted?: boolean;
  orderBy?: keyof T;
  orderDirection?: 'asc' | 'desc';
}

/**
 * Result of a repository operation
 */
export interface RepositoryResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// ============================================================================
// Repository Configuration Types
// ============================================================================

/**
 * Configuration for soft delete behavior
 */
export interface SoftDeleteConfig {
  /** Fields to set when soft deleting */
  setOnDelete?: Record<string, unknown>;
  /** Fields to reset when restoring */
  setOnRestore?: Record<string, unknown>;
}

/**
 * Repository table configuration
 * Note: ColumnsOf is not available in this drizzle-orm version
 */
export interface RepositoryTableConfig<TTable extends Table, TEntity> {
  table: TTable;
  entityType: new () => TEntity;
  softDelete?: SoftDeleteConfig;
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if an entity is soft deleted
 */
export function isSoftDeleted(entity: { isDeleted?: boolean }): entity is { isDeleted: true } {
  return entity.isDeleted === true;
}

/**
 * Check if an entity is not expired
 */
export function isNotExpired(entity: { expiresAt?: Date | null }): boolean {
  if (!entity.expiresAt) return true;
  return new Date() < entity.expiresAt;
}

/**
 * Check if an entity is active (not deleted and not inactive)
 */
export function isActive(entity: { isActive?: boolean; isDeleted?: boolean }): boolean {
  return entity.isActive !== false && entity.isDeleted !== true;
}

/**
 * Check if a value is a valid UUID
 */
export function isValidUUID(value: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
}

// ============================================================================
// Date Utilities
// ============================================================================

/**
 * Create a date cutoff for cleanup operations
 */
export function createCutoffDate(daysAgo: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date;
}

/**
 * Get days until a date expires
 */
export function getDaysUntilExpiry(expiresAt: Date | null): number | null {
  if (!expiresAt) return null;
  const now = new Date();
  const diff = expiresAt.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

/**
 * Check if a date has expired
 */
export function hasExpired(expiresAt: Date | null): boolean {
  if (!expiresAt) return false;
  return new Date() > expiresAt;
}

// ============================================================================
// Query Builder Utilities
// ============================================================================

/**
 * Build conditions array for queries
 * Note: Returns Promise for dynamic import compatibility
 */
export async function buildConditions(...conditions: (SQL | undefined)[]): Promise<SQL | undefined> {
  const validConditions = conditions.filter((c): c is SQL => c !== undefined);
  if (validConditions.length === 0) return undefined;
  if (validConditions.length === 1) return validConditions[0];
  
  // Dynamic import to avoid circular dependency
  const { and } = await import('drizzle-orm');
  return and(...validConditions);
}

/**
 * Paginate query results
 */
export interface PaginationResult<T> {
  data: T[];
  hasMore: boolean;
  total?: number;
  nextOffset?: number;
}

/**
 * Create pagination metadata from query options
 */
export function getPaginationMeta(options: PaginatedQueryOptions, actualCount: number): PaginationResult<unknown> {
  const { limit = 50, offset = 0 } = options;
  const hasMore = actualCount >= limit;
  return {
    data: [],
    hasMore,
    total: actualCount,
    nextOffset: hasMore ? offset + limit : undefined,
  };
}
