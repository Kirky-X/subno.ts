// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

//! SecureNotify Rust SDK with C FFI support via UniFFI
//!
//! This SDK provides a Rust interface to the SecureNotify API for
//! encrypted push notifications and real-time messaging.
//!
//! # Features
//!
//! - Full API coverage for keys, channels, messages, and subscriptions
//! - Async runtime support with tokio
//! - Retry logic with exponential backoff
//! - Real-time message streaming via SSE
//! - C FFI export via UniFFI for cross-language support
//!
//! # Quick Start
//!
//! ```rust,ignore
//! use securenotify_sdk::{SecureNotifyClient, MessagePriority};
//!
//! #[tokio::main]
//! async fn main() -> Result<(), Box<dyn std::error::Error>> {
//!     let client = SecureNotifyClient::builder()
//!         .base_url("https://api.securenotify.dev")
//!         .api_key("your-api-key")
//!         .build()?;
//!
//!     let response = client
//!         .register_public_key("channel-id", public_key, "RSA-4096", None)
//!         .await?;
//!
//!     Ok(())
//! }
//! ```

#[cfg(feature = "uniffi")]
use uniffi::prelude::*;

/// FFI-safe error type for SecureNotify operations
#[derive(Debug, Clone, thiserror::Error)]
pub enum SecureNotifyError {
    #[error("API error: {code} - {message}")]
    ApiError {
        code: String,
        message: String,
        status: u16,
    },
    #[error("Network error: {0}")]
    NetworkError(String),
    #[error("Connection error: {0}")]
    ConnectionError(String),
    #[error("Timeout error: {0}")]
    TimeoutError(String),
    #[error("Serialization error: {0}")]
    SerializationError(String),
    #[error("Authentication error: {0}")]
    AuthError(String),
    #[error("Unknown error: {0}")]
    Unknown(String),
}

// Note: SecureNotifyError implements Clone via derive macro
// For FFI compatibility, this is sufficient

impl SecureNotifyError {
    pub fn code(&self) -> String {
        match self {
            Self::ApiError { code, .. } => code.clone(),
            Self::NetworkError(msg) => format!("NETWORK_ERROR: {}", msg),
            Self::ConnectionError(msg) => format!("CONNECTION_ERROR: {}", msg),
            Self::TimeoutError(msg) => format!("TIMEOUT_ERROR: {}", msg),
            Self::SerializationError(msg) => format!("SERIALIZATION_ERROR: {}", msg),
            Self::AuthError(msg) => format!("AUTH_ERROR: {}", msg),
            Self::Unknown(msg) => format!("UNKNOWN_ERROR: {}", msg),
        }
    }

    pub fn message(&self) -> String {
        self.to_string()
    }

    pub fn status(&self) -> u16 {
        match self {
            Self::ApiError { status, .. } => *status,
            _ => 0,
        }
    }

    pub fn is_api_error(&self) -> bool {
        matches!(self, Self::ApiError { .. })
    }

    pub fn is_network_error(&self) -> bool {
        matches!(self, Self::NetworkError(..))
    }
}

#[cfg(feature = "uniffi")]
#[uniffi::export]
impl SecureNotifyError {
    #[uniffi::constructor]
    pub fn api_error(code: String, message: String, status: u16) -> Self {
        Self::ApiError {
            code,
            message,
            status,
        }
    }

    #[uniffi::constructor]
    pub fn network_error(message: String) -> Self {
        Self::NetworkError(message)
    }

    #[uniffi::constructor]
    pub fn connection_error(message: String) -> Self {
        Self::ConnectionError(message)
    }

    #[uniffi::constructor]
    pub fn timeout_error(message: String) -> Self {
        Self::TimeoutError(message)
    }

    #[uniffi::constructor]
    pub fn serialization_error(message: String) -> Self {
        Self::SerializationError(message)
    }

    #[uniffi::constructor]
    pub fn auth_error(message: String) -> Self {
        Self::AuthError(message)
    }
}

/// Result type alias
pub type Result<T> = std::result::Result<T, SecureNotifyError>;

/// Message priority levels
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum MessagePriority {
    Critical = 100,
    High = 75,
    Normal = 50,
    Low = 25,
    Bulk = 0,
}

impl MessagePriority {
    pub fn value(&self) -> u8 {
        *self as u8
    }

    pub fn from_value(value: u8) -> Self {
        match value {
            100 => Self::Critical,
            75 => Self::High,
            50 => Self::Normal,
            25 => Self::Low,
            _ => Self::Bulk,
        }
    }
}

#[cfg(feature = "uniffi")]
#[uniffi::export]
impl MessagePriority {
    pub fn critical() -> Self {
        Self::Critical
    }

    pub fn high() -> Self {
        Self::High
    }

    pub fn normal() -> Self {
        Self::Normal
    }

    pub fn low() -> Self {
        Self::Low
    }

    pub fn bulk() -> Self {
        Self::Bulk
    }
}

/// Channel types
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum ChannelType {
    Public,
    Encrypted,
    Temporary,
}

impl ChannelType {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Public => "public",
            Self::Encrypted => "encrypted",
            Self::Temporary => "temporary",
        }
    }
}

#[cfg(feature = "uniffi")]
#[uniffi::export]
impl ChannelType {
    pub fn public() -> Self {
        Self::Public
    }

    pub fn encrypted() -> Self {
        Self::Encrypted
    }

    pub fn temporary() -> Self {
        Self::Temporary
    }
}

/// Encryption algorithm types
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum EncryptionAlgorithm {
    Rsa2048,
    Rsa4096,
    EccSecp256K1,
}

impl EncryptionAlgorithm {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Rsa2048 => "RSA-2048",
            Self::Rsa4096 => "RSA-4096",
            Self::EccSecp256K1 => "ECC-SECP256K1",
        }
    }
}

#[cfg(feature = "uniffi")]
#[uniffi::export]
impl EncryptionAlgorithm {
    pub fn rsa_2048() -> Self {
        Self::Rsa2048
    }

    pub fn rsa_4096() -> Self {
        Self::Rsa4096
    }

    pub fn ecc_secp256k1() -> Self {
        Self::EccSecp256K1
    }

    pub fn as_str(&self) -> String {
        match self {
            Self::Rsa2048 => "RSA-2048",
            Self::Rsa4096 => "RSA-4096",
            Self::EccSecp256K1 => "ECC-SECP256K1",
        }
        .to_string()
    }
}

/// Client connection state
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ConnectionState {
    Disconnected,
    Connecting,
    Connected,
    Reconnecting,
}

impl ConnectionState {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Disconnected => "disconnected",
            Self::Connecting => "connecting",
            Self::Connected => "connected",
            Self::Reconnecting => "reconnecting",
        }
    }
}

#[cfg(feature = "uniffi")]
#[uniffi::export]
impl ConnectionState {
    pub fn disconnected() -> Self {
        Self::Disconnected
    }

    pub fn connecting() -> Self {
        Self::Connecting
    }

    pub fn connected() -> Self {
        Self::Connected
    }

    pub fn reconnecting() -> Self {
        Self::Reconnecting
    }
}

// Import internal modules
pub mod types;
pub mod managers;
pub mod utils;
#[macro_use]
pub mod client;


// Re-export types from api module
pub use types::api::{SseEvent, SseEventType};

// Re-export ClientBuilder and SecureNotifyClient from client module
pub use client::{ClientBuilder, SecureNotifyClient};

// Re-export SseMessage from utils module
pub use utils::connection::SseMessage;


/// SecureNotify Client for Rust
///
/// This is the main client for interacting with the SecureNotify API.
/// It provides methods for key management, channel management, message publishing,
/// and real-time subscriptions.
///
/// # Example
///
/// ```rust,ignore
/// use securenotify_sdk::SecureNotifyClient;
///
/// #[tokio::main]
/// async fn main() -> Result<(), Box<dyn std::error::Error>> {
///     let client = SecureNotifyClient::builder()
///         .base_url("https://api.securenotify.dev")
///         .api_key("your-api-key")
///         .build()?;
///
///     // Register a public key
///     let response = client.register_public_key("channel-id", "-----BEGIN PUBLIC KEY-----...").await?;
///     Ok(())
/// }
/// ```

/// Create a new client (convenience function for FFI)
// #[uniffi::export]
pub fn create_client(base_url: String, api_key: String) -> Result<SecureNotifyClient> {
    SecureNotifyClient::builder()
        .base_url(base_url)
        .api_key(api_key)
        .build()
}

/// Create a client with default URL
// #[uniffi::export]
pub fn create_client_with_defaults(api_key: String) -> Result<SecureNotifyClient> {
    create_client("https://api.securenotify.dev".to_string(), api_key)
}

// uniffi::include_scaffolding!("securenotify");

#[cfg(test)]
mod tests;
