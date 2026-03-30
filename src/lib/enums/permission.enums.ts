// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

/**
 * API 密钥权限枚举
 * 定义所有可用的权限类型
 */
export enum ApiKeyPermission {
  /** 读取权限 */
  READ = 'read',
  
  /** 写入权限 */
  WRITE = 'write',
  
  /** 发布消息权限 */
  PUBLISH = 'publish',
  
  /** 订阅频道权限 */
  SUBSCRIBE = 'subscribe',
  
  /** 注册频道权限 */
  REGISTER = 'register',
  
  /** 撤销密钥权限 */
  REVOKE = 'revoke',
  
  /** 管理员权限 */
  ADMIN = 'admin',
}

/**
 * 权限组枚举
 * 预定义的权限组合
 */
export enum PermissionGroup {
  /** 只读权限 */
  READ_ONLY = 'read_only',
  
  /** 标准权限（读写） */
  STANDARD = 'standard',
  
  /** 发布者权限 */
  PUBLISHER = 'publisher',
  
  /** 完全权限 */
  FULL = 'full',
  
  /** 管理员权限 */
  ADMIN = 'admin',
}

/**
 * 预定义的权限组合
 */
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

/**
 * 验证权限字符串
 * @param value - 要验证的字符串值
 * @returns 如果是有效的权限返回 true
 */
export function isValidApiKeyPermission(value: string): value is ApiKeyPermission {
  return Object.values(ApiKeyPermission).includes(value as ApiKeyPermission);
}

/**
 * 检查用户是否拥有指定权限
 * @param userPermissions - 用户的权限列表
 * @param requiredPermission - 需要的权限
 * @returns 如果拥有权限返回 true
 */
export function hasPermission(
  userPermissions: ApiKeyPermission[],
  requiredPermission: ApiKeyPermission
): boolean {
  return userPermissions.includes(requiredPermission);
}

/**
 * 检查用户是否拥有任一权限
 * @param userPermissions - 用户的权限列表
 * @param requiredPermissions - 需要的权限列表
 * @returns 如果拥有任一权限返回 true
 */
export function hasAnyPermission(
  userPermissions: ApiKeyPermission[],
  requiredPermissions: ApiKeyPermission[]
): boolean {
  return requiredPermissions.some(perm => userPermissions.includes(perm));
}

/**
 * 检查用户是否拥有所有权限
 * @param userPermissions - 用户的权限列表
 * @param requiredPermissions - 需要的权限列表
 * @returns 如果拥有所有权限返回 true
 */
export function hasAllPermissions(
  userPermissions: ApiKeyPermission[],
  requiredPermissions: ApiKeyPermission[]
): boolean {
  return requiredPermissions.every(perm => userPermissions.includes(perm));
}

/**
 * 获取权限的显示标签
 * @param permission - 权限
 * @returns 人类可读的标签
 */
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
