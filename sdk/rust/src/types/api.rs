// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

//! API type definitions for SecureNotify SDK

use serde::{Deserialize, Serialize};
use time::OffsetDateTime;
use crate::{MessagePriority, ChannelType, EncryptionAlgorithm};

/// Request to register a public key
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RegisterPublicKeyRequest {
    /// The public key in PEM format
    pub public_key: String,
    /// The encryption algorithm used
    #[serde(rename = "algorithm")]
    pub algorithm: String,
    /// Optional metadata
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<serde_json::Value>,
}

/// Response from registering a public key
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RegisterPublicKeyResponse {
    /// The channel ID associated with the key
    pub channel_id: String,
    /// When the key was created
    pub created_at: String,
    /// When the key expires (null if no expiry)
    #[serde(rename = "expiresAt", skip_serializing_if = "Option::is_none")]
    pub expires_at: Option<String>,
}

/// Information about a public key
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PublicKeyInfo {
    /// The channel ID
    pub channel_id: String,
    /// The public key in PEM format
    pub public_key: String,
    /// The encryption algorithm
    pub algorithm: String,
    /// When the key was created
    pub created_at: String,
    /// When the key expires
    #[serde(rename = "expiresAt", skip_serializing_if = "Option::is_none")]
    pub expires_at: Option<String>,
    /// When the key was last used
    #[serde(rename = "lastUsedAt", skip_serializing_if = "Option::is_none")]
    pub last_used_at: Option<String>,
    /// Optional metadata
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<serde_json::Value>,
}

/// Request to create a channel
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChannelCreateRequest {
    /// The channel name
    pub name: String,
    /// Optional channel description
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    /// The channel type
    #[serde(rename = "type")]
    pub channel_type: String,
    /// Optional metadata
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<serde_json::Value>,
}

/// Response from creating a channel
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChannelCreateResponse {
    /// The channel ID
    pub id: String,
    /// The channel name
    pub name: String,
    /// The channel type
    #[serde(rename = "type")]
    pub channel_type: String,
    /// When the channel was created
    pub created_at: String,
    /// When the channel expires
    #[serde(rename = "expiresAt", skip_serializing_if = "Option::is_none")]
    pub expires_at: Option<String>,
    /// Whether the channel is active
    pub is_active: bool,
}

/// Information about a channel
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChannelInfo {
    /// The channel ID
    pub id: String,
    /// The channel name
    pub name: String,
    /// Optional description
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    /// The channel type
    #[serde(rename = "type")]
    pub channel_type: String,
    /// The channel creator
    #[serde(skip_serializing_if = "Option::is_none")]
    pub creator: Option<String>,
    /// When the channel was created
    pub created_at: String,
    /// When the channel expires
    #[serde(rename = "expiresAt", skip_serializing_if = "Option::is_none")]
    pub expires_at: Option<String>,
    /// Whether the channel is active
    pub is_active: bool,
    /// Optional metadata
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<serde_json::Value>,
}

/// Request to publish a message
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MessagePublishRequest {
    /// The message content
    pub message: String,
    /// Message priority (default: Normal)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub priority: Option<u8>,
    /// Optional sender identifier
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sender: Option<String>,
    /// Whether to cache the message (default: true)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cache: Option<bool>,
    /// Whether the message is encrypted (default: false)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub encrypted: Option<bool>,
    /// Optional signature for the message
    #[serde(skip_serializing_if = "Option::is_none")]
    pub signature: Option<String>,
}

/// Response from publishing a message
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MessagePublishResponse {
    /// The unique message ID
    pub message_id: String,
    /// When the message was created
    pub timestamp: String,
    /// The channel ID
    pub channel: String,
}

/// Information about a message
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MessageInfo {
    /// The message ID
    pub id: String,
    /// The channel ID
    pub channel: String,
    /// The message content
    pub message: String,
    /// Whether the message is encrypted
    pub encrypted: bool,
    /// When the message was created
    pub created_at: String,
    /// Optional sender
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sender: Option<String>,
    /// Message priority
    #[serde(skip_serializing_if = "Option::is_none")]
    pub priority: Option<u8>,
}

/// Request to create an API key
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiKeyCreateRequest {
    /// Name for the API key
    pub name: String,
    /// Optional user ID
    #[serde(skip_serializing_if = "Option::is_none")]
    pub user_id: Option<String>,
    /// Permissions for the key
    #[serde(skip_serializing_if = "Option::is_none")]
    pub permissions: Option<Vec<String>>,
    /// When the key expires (null for no expiry)
    #[serde(rename = "expiresAt", skip_serializing_if = "Option::is_none")]
    pub expires_at: Option<String>,
}

/// Response from creating an API key
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiKeyCreateResponse {
    /// The API key ID
    pub id: String,
    /// The API key prefix (for identification)
    pub key_prefix: String,
    /// The full API key (only shown once)
    pub api_key: String,
    /// The key name
    pub name: String,
    /// When the key was created
    pub created_at: String,
    /// When the key expires
    #[serde(rename = "expiresAt", skip_serializing_if = "Option::is_none")]
    pub expires_at: Option<String>,
}

/// Information about an API key
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiKeyInfo {
    /// The key ID
    pub id: String,
    /// The key prefix
    pub key_prefix: String,
    /// The key name
    pub name: String,
    /// The user ID (if set)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub user_id: Option<String>,
    /// Permissions
    #[serde(skip_serializing_if = "Option::is_none")]
    pub permissions: Option<Vec<String>>,
    /// Whether the key is active
    pub is_active: bool,
    /// When the key was created
    pub created_at: String,
    /// When the key was last used
    #[serde(rename = "lastUsedAt", skip_serializing_if = "Option::is_none")]
    pub last_used_at: Option<String>,
    /// When the key expires
    #[serde(rename = "expiresAt", skip_serializing_if = "Option::is_none")]
    pub expires_at: Option<String>,
}

/// Subscription information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubscriptionInfo {
    /// The subscription ID
    pub id: String,
    /// The channel ID being subscribed to
    pub channel_id: String,
    /// When the subscription started
    pub started_at: String,
    /// Whether the subscription is active
    pub is_active: bool,
}

/// Message queue status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueueStatus {
    /// Total messages in the queue
    pub total: u64,
    /// Messages by priority
    pub by_priority: serde_json::Value,
    /// Queue wait time estimate (seconds)
    pub estimated_wait_seconds: u64,
}

/// Generic API response wrapper
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponse<T> {
    /// Whether the operation was successful
    pub success: bool,
    /// Response data
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<T>,
    /// Error information (if not successful)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<ApiErrorDetails>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiErrorDetails {
    pub code: String,
    pub message: String,
}

/// SSE event types
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

/// SSE event
#[derive(Debug, Clone)]
pub struct SseEvent {
    /// Event type
    pub event_type: SseEventType,
    /// Event data
    pub data: String,
    /// Event ID (if provided)
    pub id: Option<String>,
    /// Event name (if provided)
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

/// Stream event for real-time message delivery
#[derive(Debug, Clone)]
pub struct StreamEvent {
    /// The type of event
    pub event_type: String,
    /// The channel ID
    pub channel_id: String,
    /// The message payload
    pub payload: serde_json::Value,
    /// When the event occurred
    pub timestamp: String,
    /// The message ID (for message events)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message_id: Option<String>,
}
