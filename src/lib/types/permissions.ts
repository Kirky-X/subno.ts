// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

/**
 * API Key Permission Constants
 *
 * This file defines all available permissions for API keys.
 * Permissions follow the principle of least privilege.
 */

/**
 * Permission types for API keys
 */
export enum Permission {
  /**
   * Read access - can read channels, messages, and keys
   * Includes: list channels, get messages, view key info
   */
  READ = 'read',

  /**
   * Write access - can publish messages and create channels
   * Includes: publish messages, create channels
   */
  WRITE = 'write',

  /**
   * Key revocation permission - can request and confirm key revocation
   * Includes: request revocation, confirm revocation, cancel revocation
   * Note: Can only revoke keys owned by the same user (ownership verified)
   */
  KEY_REVOKE = 'key_revoke',

  /**
   * Admin permission - full administrative access
   * Includes: all permissions + manage API keys, revoke any key, system operations
   * Note: Admins bypass ownership checks
   */
  ADMIN = 'admin',
}

/**
 * Permission groups for common use cases
 */
export const PermissionGroups = {
  /**
   * Read-only access
   */
  READ_ONLY: [Permission.READ] as const,

  /**
   * Standard user access (read + write)
   */
  STANDARD: [Permission.READ, Permission.WRITE] as const,

  /**
   * User with key management capabilities
   */
  KEY_MANAGER: [Permission.READ, Permission.WRITE, Permission.KEY_REVOKE] as const,

  /**
   * Full administrative access
   */
  ADMIN: [Permission.READ, Permission.WRITE, Permission.KEY_REVOKE, Permission.ADMIN] as const,
} as const;

/**
 * Permission hierarchy for checking if one permission implies another
 * Higher-level permissions automatically include lower-level permissions
 */
export const PermissionHierarchy: Record<Permission, Permission[]> = {
  [Permission.ADMIN]: [Permission.READ, Permission.WRITE, Permission.KEY_REVOKE, Permission.ADMIN],
  [Permission.KEY_REVOKE]: [Permission.READ, Permission.KEY_REVOKE],
  [Permission.WRITE]: [Permission.READ, Permission.WRITE],
  [Permission.READ]: [Permission.READ],
};

/**
 * Check if a permission implies another permission
 * @param userPermission - The permission the user has
 * @param requiredPermission - The permission required
 * @returns True if the user permission implies the required permission
 */
export function permissionImplies(
  userPermission: Permission,
  requiredPermission: Permission,
): boolean {
  return PermissionHierarchy[userPermission]?.includes(requiredPermission) ?? false;
}

/**
 * Check if any of the user's permissions satisfy the required permission
 * @param userPermissions - Array of permissions the user has
 * @param requiredPermission - The permission required
 * @returns True if any user permission implies the required permission
 */
export function hasPermission(
  userPermissions: Permission[],
  requiredPermission: Permission,
): boolean {
  return userPermissions.some(perm => permissionImplies(perm, requiredPermission));
}

/**
 * Check if user has all required permissions
 * @param userPermissions - Array of permissions the user has
 * @param requiredPermissions - Array of permissions required
 * @returns True if user has all required permissions
 */
export function hasAllPermissions(
  userPermissions: Permission[],
  requiredPermissions: Permission[],
): boolean {
  return requiredPermissions.every(required => hasPermission(userPermissions, required));
}

/**
 * Check if user has admin permission
 * @param userPermissions - Array of permissions the user has
 * @returns True if user has admin permission
 */
export function isAdmin(userPermissions: Permission[]): boolean {
  return userPermissions.includes(Permission.ADMIN);
}

/**
 * Validate permission string
 * @param permission - Permission string to validate
 * @returns True if the permission is valid
 */
export function isValidPermission(permission: string): permission is Permission {
  return Object.values(Permission).includes(permission as Permission);
}

/**
 * Validate array of permissions
 * @param permissions - Array of permission strings to validate
 * @returns True if all permissions are valid
 */
export function validatePermissions(permissions: string[]): {
  valid: boolean;
  invalid?: string[];
} {
  const invalid = permissions.filter(p => !isValidPermission(p));

  if (invalid.length > 0) {
    return { valid: false, invalid };
  }

  return { valid: true };
}
