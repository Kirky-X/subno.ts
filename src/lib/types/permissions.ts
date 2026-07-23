// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

export enum Permission {
  READ = 'read',
  WRITE = 'write',
  // Can only revoke keys owned by the same user (ownership verified)
  KEY_REVOKE = 'key_revoke',
  // Admins bypass ownership checks
  ADMIN = 'admin',
}

export const PermissionGroups = {
  READ_ONLY: [Permission.READ] as const,
  STANDARD: [Permission.READ, Permission.WRITE] as const,
  KEY_MANAGER: [Permission.READ, Permission.WRITE, Permission.KEY_REVOKE] as const,
  ADMIN: [Permission.READ, Permission.WRITE, Permission.KEY_REVOKE, Permission.ADMIN] as const,
} as const;

// Higher-level permissions automatically include lower-level permissions
export const PermissionHierarchy: Record<Permission, Permission[]> = {
  [Permission.ADMIN]: [Permission.READ, Permission.WRITE, Permission.KEY_REVOKE, Permission.ADMIN],
  [Permission.KEY_REVOKE]: [Permission.READ, Permission.KEY_REVOKE],
  [Permission.WRITE]: [Permission.READ, Permission.WRITE],
  [Permission.READ]: [Permission.READ],
};

export function permissionImplies(
  userPermission: Permission,
  requiredPermission: Permission,
): boolean {
  return PermissionHierarchy[userPermission]?.includes(requiredPermission) ?? false;
}

export function hasPermission(
  userPermissions: Permission[],
  requiredPermission: Permission,
): boolean {
  return userPermissions.some(perm => permissionImplies(perm, requiredPermission));
}

export function hasAllPermissions(
  userPermissions: Permission[],
  requiredPermissions: Permission[],
): boolean {
  return requiredPermissions.every(required => hasPermission(userPermissions, required));
}

export function isAdmin(userPermissions: Permission[]): boolean {
  return userPermissions.includes(Permission.ADMIN);
}

export function isValidPermission(permission: string): permission is Permission {
  return Object.values(Permission).includes(permission as Permission);
}

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
