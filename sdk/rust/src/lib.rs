// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

use std::sync::Arc;
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

// Make error Clone + Copy for FFI compatibility
impl Clone for SecureNotifyError {
    fn clone(&self) -> Self {
        match self {
            Self::ApiError {
                code,
                message,
                status,
            } => Self::ApiError {
                code: code.clone(),
                message: message.clone(),
                status: *status,
            },
            Self::NetworkError(msg) => Self::NetworkError(msg.clone()),
            Self::ConnectionError(msg) => Self::ConnectionError(msg.clone()),
            Self::TimeoutError(msg) => Self::TimeoutError(msg.clone()),
            Self::SerializationError(msg) => Self::SerializationError(msg.clone()),
            Self::AuthError(msg) => Self::AuthError(msg.clone()),
            Self::Unknown(msg) => Self::Unknown(msg.clone()),
        }
    }
}

impl Copy for SecureNotifyError {}

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

/// Channel types
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum ChannelType {
    Public,
    Encrypted,
    Temporary,
}

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

    pub fn as_str(&self) -> String {
        match self {
            Self::Public => "public",
            Self::Encrypted => "encrypted",
            Self::Temporary => "temporary",
        }
        .to_string()
    }
}

/// Encryption algorithm types
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum EncryptionAlgorithm {
    Rsa2048,
    Rsa4096,
    EccSecp256K1,
}

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

    pub fn as_str(&self) -> String {
        match self {
            Self::Disconnected => "disconnected",
            Self::Connecting => "connecting",
            Self::Connected => "connected",
            Self::Reconnecting => "reconnecting",
        }
        .to_string()
    }
}

// Import internal modules
pub mod types;
pub mod managers;
pub mod utils;

use types::api::*;
use managers::*;
use utils::http::HttpClient;

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
#[derive(Clone)]
pub struct SecureNotifyClient {
    base_url: String,
    api_key: String,
    http_client: Arc<HttpClient>,
}

#[uniffi::export]
impl SecureNotifyClient {
    /// Create a new client with the specified base URL and API key
    #[uniffi::constructor]
    pub fn new(base_url: String, api_key: String) -> Self {
        Self {
            base_url,
            api_key,
            http_client: Arc::new(HttpClient::new(&base_url, &api_key)),
        }
    }

    /// Get the base URL
    pub fn base_url(&self) -> String {
        self.base_url.clone()
    }

    /// Get the connection state (always returns disconnected for basic client)
    pub fn connection_state(&self) -> ConnectionState {
        ConnectionState::Disconnected
    }
}

impl SecureNotifyClient {
    /// Create a builder for configuring the client
    pub fn builder() -> ClientBuilder {
        ClientBuilder::new()
    }
}

/// Builder for SecureNotifyClient
#[derive(Debug, Clone)]
pub struct ClientBuilder {
    base_url: String,
    api_key: String,
    timeout: std::time::Duration,
    max_retries: u32,
    initial_delay_ms: u64,
    max_delay_ms: u64,
    backoff_multiplier: f64,
}

impl Default for ClientBuilder {
    fn default() -> Self {
        Self::new()
    }
}

impl ClientBuilder {
    /// Create a new builder with default settings
    pub fn new() -> Self {
        Self {
            base_url: "https://api.securenotify.dev".to_string(),
            api_key: String::new(),
            timeout: std::time::Duration::from_secs(30),
            max_retries: 3,
            initial_delay_ms: 1000,
            max_delay_ms: 30000,
            backoff_multiplier: 2.0,
        }
    }

    /// Set the base URL
    pub fn base_url(mut self, base_url: impl Into<String>) -> Self {
        self.base_url = base_url.into();
        self
    }

    /// Set the API key
    pub fn api_key(mut self, api_key: impl Into<String>) -> Self {
        self.api_key = api_key.into();
        self
    }

    /// Set the request timeout
    pub fn timeout(mut self, timeout: std::time::Duration) -> Self {
        self.timeout = timeout;
        self
    }

    /// Set the maximum number of retries
    pub fn max_retries(mut self, max_retries: u32) -> Self {
        self.max_retries = max_retries;
        self
    }

    /// Set the initial delay for retries (in milliseconds)
    pub fn initial_delay_ms(mut self, delay_ms: u64) -> Self {
        self.initial_delay_ms = delay_ms;
        self
    }

    /// Set the maximum delay for retries (in milliseconds)
    pub fn max_delay_ms(mut self, delay_ms: u64) -> Self {
        self.max_delay_ms = delay_ms;
        self
    }

    /// Set the backoff multiplier
    pub fn backoff_multiplier(mut self, multiplier: f64) -> Self {
        self.backoff_multiplier = multiplier;
        self
    }

    /// Build the client
    pub fn build(self) -> Result<SecureNotifyClient> {
        if self.api_key.is_empty() {
            return Err(SecureNotifyError::AuthError(
                "API key is required".to_string(),
            ));
        }

        Ok(SecureNotifyClient {
            base_url: self.base_url,
            api_key: self.api_key,
            http_client: Arc::new(HttpClient::with_config(
                &self.base_url,
                &self.api_key,
                self.timeout,
                self.max_retries,
                self.initial_delay_ms,
                self.max_delay_ms,
                self.backoff_multiplier,
            )),
        })
    }
}

// Implement manager traits for SecureNotifyClient
implement_managers!(SecureNotifyClient);

/// Create a new client (convenience function for FFI)
#[uniffi::export]
pub fn create_client(base_url: String, api_key: String) -> Result<SecureNotifyClient> {
    SecureNotifyClient::builder()
        .base_url(base_url)
        .api_key(api_key)
        .build()
}

/// Create a client with default URL
#[uniffi::export]
pub fn create_client_with_defaults(api_key: String) -> Result<SecureNotifyClient> {
    create_client("https://api.securenotify.dev".to_string(), api_key)
}

uniffi::include_scaffolding!("securenotify");
