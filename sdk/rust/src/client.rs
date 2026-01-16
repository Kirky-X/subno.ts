// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

//! Main client implementation for SecureNotify SDK

use async_trait::async_trait;
use std::sync::Arc;
use crate::managers::*;
use crate::utils::http::HttpClient;
use crate::utils::connection::SseMessage;
use crate::{Result, SecureNotifyError, MessagePriority};

/// SecureNotifyClient provides access to all SecureNotify API operations.
///
/// # Example
///
/// ```rust,ignore
/// use securenotify_sdk::{SecureNotifyClient, MessagePriority};
///
/// #[tokio::main]
/// async fn main() -> Result<(), Box<dyn std::error::Error>> {
///     let client = SecureNotifyClient::builder()
///         .base_url("https://api.securenotify.dev")
///         .api_key("your-api-key")
///         .build()?;
///
///     // Register a public key
///     let response = client.register_public_key(
///         "my-channel",
///         "-----BEGIN PUBLIC KEY-----...",
///         "RSA-4096",
///         None,
///     ).await?;
///     Ok(())
/// }
/// ```
#[derive(Clone)]
pub struct SecureNotifyClient {
    http_client: Arc<HttpClient>,
}

impl SecureNotifyClient {
    /// Create a new client with the specified base URL and API key
    pub fn new(base_url: impl Into<String>, api_key: impl Into<String>) -> Result<Self> {
        Ok(Self {
            http_client: Arc::new(HttpClient::new(&base_url.into(), &api_key.into())?),
        })
    }

    /// Create a builder for configuring the client
    pub fn builder() -> ClientBuilder {
        ClientBuilder::new()
    }

    /// Get the base URL
    pub fn base_url(&self) -> String {
        self.http_client.config().base_url.clone()
    }

    /// Get the API key (masked)
    pub fn api_key_masked(&self) -> String {
        let api_key = &self.http_client.config().api_key;
        if api_key.len() > 8 {
            format!("{}...{}", &api_key[..4], &api_key[api_key.len() - 4..])
        } else {
            "***".to_string()
        }
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
    enable_metrics: bool,
    enable_cache: bool,
    enable_deduplication: bool,
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
            enable_metrics: false,
            enable_cache: false,
            enable_deduplication: false,
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
            http_client: Arc::new(HttpClient::with_config(
                &self.base_url,
                &self.api_key,
                self.timeout,
                self.max_retries,
                self.initial_delay_ms,
                self.max_delay_ms,
                self.backoff_multiplier,
                self.enable_metrics,
                self.enable_cache,
                self.enable_deduplication,
            )?),
        })
    }
}

// Macro to implement all manager traits for SecureNotifyClient
macro_rules! implement_managers {
    ($client:ident) => {
        #[async_trait]
        impl KeyManager for $client {
            async fn register_public_key(
                &self,
                channel_id: &str,
                public_key: &str,
                algorithm: &str,
                metadata: Option<serde_json::Value>,
            ) -> Result<crate::types::api::RegisterPublicKeyResponse> {
                KeyManagerImpl::new(self.http_client.clone())
                    .register_public_key(channel_id, public_key, algorithm, metadata)
                    .await
            }

            async fn get_public_key(&self, channel_id: &str) -> Result<crate::types::api::PublicKeyInfo> {
                KeyManagerImpl::new(self.http_client.clone())
                    .get_public_key(channel_id)
                    .await
            }

            async fn list_public_keys(
                &self,
                limit: Option<u32>,
                offset: Option<u32>,
            ) -> Result<Vec<crate::types::api::PublicKeyInfo>> {
                KeyManagerImpl::new(self.http_client.clone())
                    .list_public_keys(limit, offset)
                    .await
            }

            async fn revoke_public_key(&self, channel_id: &str) -> Result<()> {
                KeyManagerImpl::new(self.http_client.clone())
                    .revoke_public_key(channel_id)
                    .await
            }
        }

        #[async_trait]
        impl ChannelManager for $client {
            async fn create_channel(
                &self,
                name: &str,
                channel_type: &str,
                description: Option<&str>,
                metadata: Option<serde_json::Value>,
            ) -> Result<crate::types::api::ChannelCreateResponse> {
                ChannelManagerImpl::new(self.http_client.clone())
                    .create_channel(name, channel_type, description, metadata)
                    .await
            }

            async fn get_channel(&self, channel_id: &str) -> Result<crate::types::api::ChannelInfo> {
                ChannelManagerImpl::new(self.http_client.clone())
                    .get_channel(channel_id)
                    .await
            }

            async fn list_channels(
                &self,
                channel_type: Option<&str>,
                limit: Option<u32>,
                offset: Option<u32>,
            ) -> Result<Vec<crate::types::api::ChannelInfo>> {
                ChannelManagerImpl::new(self.http_client.clone())
                    .list_channels(channel_type, limit, offset)
                    .await
            }

            async fn delete_channel(&self, channel_id: &str) -> Result<()> {
                ChannelManagerImpl::new(self.http_client.clone())
                    .delete_channel(channel_id)
                    .await
            }
        }

        #[async_trait]
        impl PublishManager for $client {
            async fn publish_message(
                &self,
                channel: &str,
                message: &str,
                priority: Option<MessagePriority>,
                sender: Option<&str>,
                cache: Option<bool>,
                encrypted: Option<bool>,
                signature: Option<&str>,
            ) -> Result<crate::types::api::MessagePublishResponse> {
                PublishManagerImpl::new(self.http_client.clone())
                    .publish_message(channel, message, priority, sender, cache, encrypted, signature)
                    .await
            }

            async fn get_queue_status(&self, channel: &str) -> Result<crate::types::api::QueueStatus> {
                PublishManagerImpl::new(self.http_client.clone())
                    .get_queue_status(channel)
                    .await
            }

            async fn get_message(&self, channel: &str, message_id: &str) -> Result<crate::types::api::MessageInfo> {
                PublishManagerImpl::new(self.http_client.clone())
                    .get_message(channel, message_id)
                    .await
            }
        }

        #[async_trait]
        impl SubscribeManager for $client {
            async fn subscribe(
                &self,
                channel_id: &str,
            ) -> Result<tokio::sync::mpsc::Receiver<SseMessage>> {
                SubscribeManagerImpl::new(self.http_client.clone())
                    .subscribe(channel_id)
                    .await
            }

            async fn unsubscribe(&self, channel_id: &str) -> Result<()> {
                SubscribeManagerImpl::new(self.http_client.clone())
                    .unsubscribe(channel_id)
                    .await
            }

            async fn list_subscriptions(&self) -> Result<Vec<crate::types::api::SubscriptionInfo>> {
                SubscribeManagerImpl::new(self.http_client.clone())
                    .list_subscriptions()
                    .await
            }
        }

        #[async_trait]
        impl ApiKeyManager for $client {
            async fn create_api_key(
                &self,
                name: &str,
                user_id: Option<&str>,
                permissions: Option<Vec<&str>>,
                expires_at: Option<&str>,
            ) -> Result<crate::types::api::ApiKeyCreateResponse> {
                ApiKeyManagerImpl::new(self.http_client.clone())
                    .create_api_key(name, user_id, permissions, expires_at)
                    .await
            }

            async fn get_api_key(&self, key_id: &str) -> Result<crate::types::api::ApiKeyInfo> {
                ApiKeyManagerImpl::new(self.http_client.clone())
                    .get_api_key(key_id)
                    .await
            }

            async fn list_api_keys(
                &self,
                limit: Option<u32>,
                offset: Option<u32>,
            ) -> Result<Vec<crate::types::api::ApiKeyInfo>> {
                ApiKeyManagerImpl::new(self.http_client.clone())
                    .list_api_keys(limit, offset)
                    .await
            }

            async fn revoke_api_key(&self, key_id: &str) -> Result<()> {
                ApiKeyManagerImpl::new(self.http_client.clone())
                    .revoke_api_key(key_id)
                    .await
            }
        }
    };
}

implement_managers!(SecureNotifyClient);
