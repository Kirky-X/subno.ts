// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

export enum RateLimitEndpointType {
  DEFAULT = 'default',
  PUBLISH = 'publish',
  REGISTER = 'register',
  SUBSCRIBE = 'subscribe',
  REVOKE = 'revoke',
}

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
