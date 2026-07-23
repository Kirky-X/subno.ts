// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

export enum ChannelType {
  PUBLIC = 'public',
  ENCRYPTED = 'encrypted',
  TEMPORARY = 'temporary',
}

export enum ChannelStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
  CLOSED = 'closed',
}

export function isValidChannelType(value: string): value is ChannelType {
  return Object.values(ChannelType).includes(value as ChannelType);
}

export function isValidChannelStatus(value: string): value is ChannelStatus {
  return Object.values(ChannelStatus).includes(value as ChannelStatus);
}

export function getChannelTypeLabel(type: ChannelType): string {
  const labels: Record<ChannelType, string> = {
    [ChannelType.PUBLIC]: '公开',
    [ChannelType.ENCRYPTED]: '加密',
    [ChannelType.TEMPORARY]: '临时',
  };
  return labels[type] || '未知';
}

export function getChannelStatusLabel(status: ChannelStatus): string {
  const labels: Record<ChannelStatus, string> = {
    [ChannelStatus.ACTIVE]: '活跃',
    [ChannelStatus.INACTIVE]: '非活跃',
    [ChannelStatus.SUSPENDED]: '已暂停',
    [ChannelStatus.CLOSED]: '已关闭',
  };
  return labels[status] || '未知';
}
