// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

//! Subscribe manager for SecureNotify SDK

use async_trait::async_trait;
use crate::{Result, SecureNotifyError, SseMessage};
use crate::types::api::*;
use crate::utils::connection::{SseConnection, SseConfig, SseState};
use tokio::sync::mpsc;

/// Trait for subscription operations
#[async_trait]
pub trait SubscribeManager {
    /// Subscribe to a channel and receive messages
    async fn subscribe(
        &self,
        channel_id: &str,
    ) -> Result<tokio::sync::mpsc::Receiver<SseMessage>>;

    /// Unsubscribe from a channel
    async fn unsubscribe(&self, channel_id: &str) -> Result<()>;

    /// Get active subscriptions
    async fn list_subscriptions(&self) -> Result<Vec<SubscriptionInfo>>;
}

/// Implementation of SubscribeManager
pub struct SubscribeManagerImpl {
    http_client: std::sync::Arc<crate::utils::http::HttpClient>,
}

impl SubscribeManagerImpl {
    /// Create a new SubscribeManager
    pub fn new(http_client: std::sync::Arc<crate::utils::http::HttpClient>) -> Self {
        Self { http_client }
    }
}

#[async_trait]
impl SubscribeManager for SubscribeManagerImpl {
    async fn subscribe(
        &self,
        channel_id: &str,
    ) -> Result<tokio::sync::mpsc::Receiver<SseMessage>> {
        let url = format!(
            "{}/api/subscribe/{}",
            self.http_client.config().base_url,
            channel_id
        );

        let config = SseConfig::new(url, self.http_client.config().api_key.clone());
        let (connection, receiver) = SseConnection::new(config);

        // Store the connection for later cleanup
        // In a real implementation, you'd want to track these connections

        Ok(receiver)
    }

    async fn unsubscribe(&self, channel_id: &str) -> Result<()> {
        let endpoint = format!("api/subscribe/{}", channel_id);
        self.http_client.delete(&endpoint).await.map_err(|e| e.into())
    }

    async fn list_subscriptions(&self) -> Result<Vec<SubscriptionInfo>> {
        let endpoint = "api/subscribe";
        self.http_client.get(endpoint).await.map_err(|e| e.into())
    }
}
