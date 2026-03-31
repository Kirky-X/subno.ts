// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

/**
 * Revocation Status Constants
 *
 * Defines all possible statuses for revocation confirmations
 */

/**
 * Revocation confirmation status
 */
export enum RevocationStatus {
  /** Confirmation code is pending verification */
  PENDING = 'pending',

  /** Confirmation code has been verified and key revoked */
  CONFIRMED = 'confirmed',

  /** Confirmation code was cancelled by user */
  CANCELLED = 'cancelled',

  /** Confirmation code has expired */
  EXPIRED = 'expired',
}

/**
 * Notification delivery status
 */
export enum DeliveryStatus {
  /** Notification was successfully sent */
  SENT = 'sent',

  /** Notification delivery failed */
  FAILED = 'failed',

  /** Notification was partially delivered */
  PARTIAL = 'partial',
}

/**
 * Revocation confirmation status type for database queries
 */
export type RevocationStatusType = RevocationStatus;

/**
 * Delivery status type for database queries
 */
export type DeliveryStatusType = DeliveryStatus;

/**
 * Validate revocation status string
 * @param status - Status string to validate
 * @returns True if the status is valid
 */
export function isValidRevocationStatus(status: string): status is RevocationStatus {
  return Object.values(RevocationStatus).includes(status as RevocationStatus);
}

/**
 * Validate delivery status string
 * @param status - Status string to validate
 * @returns True if the status is valid
 */
export function isValidDeliveryStatus(status: string): status is DeliveryStatus {
  return Object.values(DeliveryStatus).includes(status as DeliveryStatus);
}

/**
 * Get human-readable label for revocation status
 * @param status - Revocation status
 * @returns Human-readable label
 */
export function getRevocationStatusLabel(status: RevocationStatus): string {
  const labels: Record<RevocationStatus, string> = {
    [RevocationStatus.PENDING]: '待确认',
    [RevocationStatus.CONFIRMED]: '已确认',
    [RevocationStatus.CANCELLED]: '已取消',
    [RevocationStatus.EXPIRED]: '已过期',
  };
  return labels[status] || '未知';
}

/**
 * Get human-readable label for delivery status
 * @param status - Delivery status
 * @returns Human-readable label
 */
export function getDeliveryStatusLabel(status: DeliveryStatus): string {
  const labels: Record<DeliveryStatus, string> = {
    [DeliveryStatus.SENT]: '已发送',
    [DeliveryStatus.FAILED]: '失败',
    [DeliveryStatus.PARTIAL]: '部分成功',
  };
  return labels[status] || '未知';
}
