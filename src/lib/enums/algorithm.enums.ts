// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

/**
 * 加密算法枚举
 */
export enum EncryptionAlgorithm {
  RSA_2048 = 'RSA-2048',
  RSA_4096 = 'RSA-4096',
  ECDSA_P256 = 'ECDSA-P256',
  ECDSA_P384 = 'ECDSA-P384',
  ED25519 = 'Ed25519',
}

/**
 * 算法强度级别
 */
export enum AlgorithmStrength {
  STANDARD = 'standard',
  HIGH = 'high',
  MAXIMUM = 'maximum',
}

/**
 * 算法强度映射
 */
export const ALGORITHM_STRENGTH: Record<EncryptionAlgorithm, AlgorithmStrength> = {
  [EncryptionAlgorithm.RSA_2048]: AlgorithmStrength.STANDARD,
  [EncryptionAlgorithm.RSA_4096]: AlgorithmStrength.HIGH,
  [EncryptionAlgorithm.ECDSA_P256]: AlgorithmStrength.STANDARD,
  [EncryptionAlgorithm.ECDSA_P384]: AlgorithmStrength.HIGH,
  [EncryptionAlgorithm.ED25519]: AlgorithmStrength.MAXIMUM,
};

/**
 * 验证算法字符串
 * @param value - 要验证的字符串值
 * @returns 如果是有效的算法返回 true
 */
export function isValidEncryptionAlgorithm(value: string): value is EncryptionAlgorithm {
  return Object.values(EncryptionAlgorithm).includes(value as EncryptionAlgorithm);
}

/**
 * 获取算法的推荐用途
 * @param algo - 加密算法
 * @returns 推荐用途说明
 */
export function getAlgorithmRecommendation(algo: EncryptionAlgorithm): string {
  const recommendations: Record<EncryptionAlgorithm, string> = {
    [EncryptionAlgorithm.RSA_2048]: '通用场景，良好的性能和安全性平衡',
    [EncryptionAlgorithm.RSA_4096]: '高安全性要求的场景',
    [EncryptionAlgorithm.ECDSA_P256]: '移动设备和资源受限环境',
    [EncryptionAlgorithm.ECDSA_P384]: '需要更高安全性的 ECC 场景',
    [EncryptionAlgorithm.ED25519]: '现代应用，最佳性能和安全性',
  };
  return recommendations[algo] || '未知算法';
}
