// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

/**
 * 速率限制端点类型枚举
 */
export enum RateLimitEndpointType {
  /** 默认类型 */
  DEFAULT = 'default',

  /** 发布端点 */
  PUBLISH = 'publish',

  /** 注册端点 */
  REGISTER = 'register',

  /** 订阅端点 */
  SUBSCRIBE = 'subscribe',

  /** 撤销端点 */
  REVOKE = 'revoke',
}

/**
 * 获取端点类型的显示标签
 * @param type - 端点类型
 * @returns 人类可读的标签
 */
export function getRateLimitEndpointLabel(type: RateLimitEndpointType): string {
  const labels: Record<RateLimitEndpointType, string> = {
    [RateLimitEndpointType.DEFAULT]: '默认',
    [RateLimitEndpointType.PUBLISH]: '发布',
    [RateLimitEndpointType.REGISTER]: '注册',
    [RateLimitEndpointType.SUBSCRIBE]: '订阅',
    [RateLimitEndpointType.REVOKE]: '撤销',
  };
  return labels[type] || '未知';
}
