// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

export enum ApiKeyPermission {
  READ = 'read',
  WRITE = 'write',
  PUBLISH = 'publish',
  SUBSCRIBE = 'subscribe',
  REGISTER = 'register',
  REVOKE = 'revoke',
  ADMIN = 'admin',
}

export enum PermissionGroup {
  READ_ONLY = 'read_only',
  STANDARD = 'standard',
  PUBLISHER = 'publisher',
  FULL = 'full',
  ADMIN = 'admin',
}

export const PERMISSION_GROUPS: Record<PermissionGroup, ApiKeyPermission[]> = {
  [PermissionGroup.READ_ONLY]: [ApiKeyPermission.READ],
  [PermissionGroup.STANDARD]: [ApiKeyPermission.READ, ApiKeyPermission.WRITE],
  [PermissionGroup.PUBLISHER]: [
    ApiKeyPermission.READ,
    ApiKeyPermission.WRITE,
    ApiKeyPermission.PUBLISH,
    ApiKeyPermission.SUBSCRIBE,
  ],
  [PermissionGroup.FULL]: [
    ApiKeyPermission.READ,
    ApiKeyPermission.WRITE,
    ApiKeyPermission.PUBLISH,
    ApiKeyPermission.SUBSCRIBE,
    ApiKeyPermission.REGISTER,
    ApiKeyPermission.REVOKE,
  ],
  [PermissionGroup.ADMIN]: [
    ApiKeyPermission.READ,
    ApiKeyPermission.WRITE,
    ApiKeyPermission.PUBLISH,
    ApiKeyPermission.SUBSCRIBE,
    ApiKeyPermission.REGISTER,
    ApiKeyPermission.REVOKE,
    ApiKeyPermission.ADMIN,
  ],
};

export function isValidApiKeyPermission(value: string): value is ApiKeyPermission {
  return Object.values(ApiKeyPermission).includes(value as ApiKeyPermission);
}

export function hasPermission(
  userPermissions: ApiKeyPermission[],
  requiredPermission: ApiKeyPermission,
): boolean {
  return userPermissions.includes(requiredPermission);
}

export function hasAnyPermission(
  userPermissions: ApiKeyPermission[],
  requiredPermissions: ApiKeyPermission[],
): boolean {
  return requiredPermissions.some(perm => userPermissions.includes(perm));
}

export function hasAllPermissions(
  userPermissions: ApiKeyPermission[],
  requiredPermissions: ApiKeyPermission[],
): boolean {
  return requiredPermissions.every(perm => userPermissions.includes(perm));
}

export function getPermissionLabel(permission: ApiKeyPermission): string {
  const labels: Record<ApiKeyPermission, string> = {
    [ApiKeyPermission.READ]: '读取',
    [ApiKeyPermission.WRITE]: '写入',
    [ApiKeyPermission.PUBLISH]: '发布',
    [ApiKeyPermission.SUBSCRIBE]: '订阅',
    [ApiKeyPermission.REGISTER]: '注册',
    [ApiKeyPermission.REVOKE]: '撤销',
    [ApiKeyPermission.ADMIN]: '管理',
  };
  return labels[permission] || '未知';
}
