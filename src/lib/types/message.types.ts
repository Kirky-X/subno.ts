// SPDX-License-Identifier: Apache-2.0 
// Copyright (c) 2026 KirkyX. All rights reserved. 

export enum MessagePriority {
  CRITICAL = 100,
  HIGH = 75,
  NORMAL = 50,
  LOW = 25,
  BULK = 0,
}

export interface PublishMessageOptions {
  channel: string;
  message: string;
  priority?: MessagePriority;
  sender?: string;
  cache?: boolean;
  encrypted?: boolean;
  // 是否自动创建临时 channel (默认 true)
  autoCreate?: boolean;
}

export interface Message {
  id: string;
  channel: string;
  message: string;
  priority: number;
  sender?: string;
  timestamp: number;
  encrypted: boolean;
}

export interface PublishResult {
  messageId: string;
  timestamp: number;
  channel: string;
  // channel 是否是自动创建的临时 channel
  autoCreated?: boolean;
}

export interface MessageStats {
  total: number;
  cached: number;
}
