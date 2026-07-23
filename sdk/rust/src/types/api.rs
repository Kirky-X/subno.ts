// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RegisterPublicKeyRequest {
    /// The public key in PEM format
    pub public_key: String,
    #[serde(rename = "algorithm")]
    pub algorithm: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RegisterPublicKeyResponse {
    pub channel_id: String,
    pub created_at: String,
    #[serde(rename = "expiresAt", skip_serializing_if = "Option::is_none")]
    pub expires_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PublicKeyInfo {
    pub channel_id: String,
    /// The public key in PEM format
    pub public_key: String,
    pub algorithm: String,
    pub created_at: String,
    #[serde(rename = "expiresAt", skip_serializing_if = "Option::is_none")]
    pub expires_at: Option<String>,
    #[serde(rename = "lastUsedAt", skip_serializing_if = "Option::is_none")]
    pub last_used_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChannelCreateRequest {
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(rename = "type")]
    pub channel_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChannelCreateResponse {
    pub id: String,
    pub name: String,
    #[serde(rename = "type")]
    pub channel_type: String,
    pub created_at: String,
    #[serde(rename = "expiresAt", skip_serializing_if = "Option::is_none")]
    pub expires_at: Option<String>,
    pub is_active: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChannelInfo {
    pub id: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(rename = "type")]
    pub channel_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub creator: Option<String>,
    pub created_at: String,
    #[serde(rename = "expiresAt", skip_serializing_if = "Option::is_none")]
    pub expires_at: Option<String>,
    pub is_active: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MessagePublishRequest {
    pub message: String,
    /// Message priority (default: Normal)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub priority: Option<u8>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sender: Option<String>,
    /// Whether to cache the message (default: true)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cache: Option<bool>,
    /// Whether the message is encrypted (default: false)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub encrypted: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub signature: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MessagePublishResponse {
    pub message_id: String,
    pub timestamp: String,
    pub channel: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MessageInfo {
    pub id: String,
    pub channel: String,
    pub message: String,
    pub encrypted: bool,
    pub created_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sender: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub priority: Option<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiKeyCreateRequest {
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub user_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub permissions: Option<Vec<String>>,
    /// When the key expires (null for no expiry)
    #[serde(rename = "expiresAt", skip_serializing_if = "Option::is_none")]
    pub expires_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiKeyCreateResponse {
    pub id: String,
    pub key_prefix: String,
    /// The full API key (only shown once)
    pub api_key: String,
    pub name: String,
    pub created_at: String,
    #[serde(rename = "expiresAt", skip_serializing_if = "Option::is_none")]
    pub expires_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiKeyInfo {
    pub id: String,
    pub key_prefix: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub user_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub permissions: Option<Vec<String>>,
    pub is_active: bool,
    pub created_at: String,
    #[serde(rename = "lastUsedAt", skip_serializing_if = "Option::is_none")]
    pub last_used_at: Option<String>,
    #[serde(rename = "expiresAt", skip_serializing_if = "Option::is_none")]
    pub expires_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubscriptionInfo {
    pub id: String,
    pub channel_id: String,
    pub started_at: String,
    pub is_active: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueueStatus {
    pub total: u64,
    pub by_priority: serde_json::Value,
    /// Queue wait time estimate (seconds)
    pub estimated_wait_seconds: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponse<T> {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<T>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<ApiErrorDetails>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiErrorDetails {
    pub code: String,
    pub message: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SseEventType {
    Message,
    Heartbeat,
    Error,
    Connected,
    Disconnected,
    Unknown(String),
}

impl std::fmt::Display for SseEventType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Message => write!(f, "message"),
            Self::Heartbeat => write!(f, "heartbeat"),
            Self::Error => write!(f, "error"),
            Self::Connected => write!(f, "connected"),
            Self::Disconnected => write!(f, "disconnected"),
            Self::Unknown(s) => write!(f, "unknown: {}", s),
        }
    }
}

#[derive(Debug, Clone)]
pub struct SseEvent {
    pub event_type: SseEventType,
    pub data: String,
    pub id: Option<String>,
    pub name: Option<String>,
}

impl SseEvent {
    pub fn new(
        event_type: SseEventType,
        data: String,
        id: Option<String>,
        name: Option<String>,
    ) -> Self {
        Self {
            event_type,
            data,
            id,
            name,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StreamEvent {
    pub event_type: String,
    pub channel_id: String,
    pub payload: serde_json::Value,
    pub timestamp: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message_id: Option<String>,
}
