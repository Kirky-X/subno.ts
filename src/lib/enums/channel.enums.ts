// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

/**
 * 频道类型枚举
 * 定义所有可能的频道类型
 */
export enum ChannelType {
  /** 公开频道 - 任何人都可以订阅 */
  PUBLIC = 'public',

  /** 加密频道 - 需要解密密钥 */
  ENCRYPTED = 'encrypted',

  /** 临时频道 - 自动过期清理 */
  TEMPORARY = 'temporary',
}

/**
 * 频道状态枚举
 * 定义频道的生命周期状态
 */
export enum ChannelStatus {
  /** 活跃状态 */
  ACTIVE = 'active',

  /** 非活跃状态 */
  INACTIVE = 'inactive',

  /** 已暂停 */
  SUSPENDED = 'suspended',

  /** 已关闭 */
  CLOSED = 'closed',
}

/**
 * 验证频道类型字符串
 * @param value - 要验证的字符串值
 * @returns 如果是有效的频道类型返回 true
 */
export function isValidChannelType(value: string): value is ChannelType {
  return Object.values(ChannelType).includes(value as ChannelType);
}

/**
 * 验证频道状态字符串
 * @param value - 要验证的字符串值
 * @returns 如果是有效的频道状态返回 true
 */
export function isValidChannelStatus(value: string): value is ChannelStatus {
  return Object.values(ChannelStatus).includes(value as ChannelStatus);
}

/**
 * 获取频道类型的显示标签
 * @param type - 频道类型
 * @returns 人类可读的标签
 */
export function getChannelTypeLabel(type: ChannelType): string {
  const labels: Record<ChannelType, string> = {
    [ChannelType.PUBLIC]: '公开',
    [ChannelType.ENCRYPTED]: '加密',
    [ChannelType.TEMPORARY]: '临时',
  };
  return labels[type] || '未知';
}

/**
 * 获取频道状态的显示标签
 * @param status - 频道状态
 * @returns 人类可读的标签
 */
export function getChannelStatusLabel(status: ChannelStatus): string {
  const labels: Record<ChannelStatus, string> = {
    [ChannelStatus.ACTIVE]: '活跃',
    [ChannelStatus.INACTIVE]: '非活跃',
    [ChannelStatus.SUSPENDED]: '已暂停',
    [ChannelStatus.CLOSED]: '已关闭',
  };
  return labels[status] || '未知';
}
