// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

export enum RevocationStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired',
}

export enum DeliveryStatus {
  SENT = 'sent',
  FAILED = 'failed',
  PARTIAL = 'partial',
}

export type RevocationStatusType = RevocationStatus;

export type DeliveryStatusType = DeliveryStatus;

export function isValidRevocationStatus(status: string): status is RevocationStatus {
  return Object.values(RevocationStatus).includes(status as RevocationStatus);
}

export function isValidDeliveryStatus(status: string): status is DeliveryStatus {
  return Object.values(DeliveryStatus).includes(status as DeliveryStatus);
}

export function getRevocationStatusLabel(status: RevocationStatus): string {
  const labels: Record<RevocationStatus, string> = {
    [RevocationStatus.PENDING]: '待确认',
    [RevocationStatus.CONFIRMED]: '已确认',
    [RevocationStatus.CANCELLED]: '已取消',
    [RevocationStatus.EXPIRED]: '已过期',
  };
  return labels[status] || '未知';
}

export function getDeliveryStatusLabel(status: DeliveryStatus): string {
  const labels: Record<DeliveryStatus, string> = {
    [DeliveryStatus.SENT]: '已发送',
    [DeliveryStatus.FAILED]: '失败',
    [DeliveryStatus.PARTIAL]: '部分成功',
  };
  return labels[status] || '未知';
}
