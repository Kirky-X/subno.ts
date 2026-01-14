// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

//! Channel manager for SecureNotify SDK

use async_trait::async_trait;
use crate::{Result, SecureNotifyError};
use crate::types::api::*;

/// Trait for channel management operations
#[async_trait]
pub trait ChannelManager {
    /// Create a new channel
    async fn create_channel(
        &self,
        name: &str,
        channel_type: &str,
        description: Option<&str>,
        metadata: Option<serde_json::Value>,
    ) -> Result<ChannelCreateResponse>;

    /// Get channel information
    async fn get_channel(&self, channel_id: &str) -> Result<ChannelInfo>;

    /// List all channels
    async fn list_channels(
        &self,
        channel_type: Option<&str>,
        limit: Option<u32>,
        offset: Option<u32>,
    ) -> Result<Vec<ChannelInfo>>;

    /// Delete/deactivate a channel
    async fn delete_channel(&self, channel_id: &str) -> Result<()>;
}

/// Implementation of ChannelManager
pub struct ChannelManagerImpl {
    http_client: std::sync::Arc<crate::utils::http::HttpClient>,
}

impl ChannelManagerImpl {
    /// Create a new ChannelManager
    pub fn new(http_client: std::sync::Arc<crate::utils::http::HttpClient>) -> Self {
        Self { http_client }
    }
}

#[async_trait]
impl ChannelManager for ChannelManagerImpl {
    async fn create_channel(
        &self,
        name: &str,
        channel_type: &str,
        description: Option<&str>,
        metadata: Option<serde_json::Value>,
    ) -> Result<ChannelCreateResponse> {
        let request = ChannelCreateRequest {
            name: name.to_string(),
            channel_type: channel_type.to_string(),
            description: description.map(|s| s.to_string()),
            metadata,
        };

        self.http_client.post("api/channels", &request).await.map_err(|e| e.into())
    }

    async fn get_channel(&self, channel_id: &str) -> Result<ChannelInfo> {
        let endpoint = format!("api/channels/{}", channel_id);
        self.http_client.get(&endpoint).await.map_err(|e| e.into())
    }

    async fn list_channels(
        &self,
        channel_type: Option<&str>,
        limit: Option<u32>,
        offset: Option<u32>,
    ) -> Result<Vec<ChannelInfo>> {
        let mut endpoint = "api/channels".to_string();
        let mut params = Vec::new();

        if let Some(channel_type) = channel_type {
            params.push(format!("type={}", channel_type));
        }
        if let Some(limit) = limit {
            params.push(format!("limit={}", limit));
        }
        if let Some(offset) = offset {
            params.push(format!("offset={}", offset));
        }

        if !params.is_empty() {
            endpoint.push('?');
            endpoint.push_str(&params.join("&"));
        }

        self.http_client.get(&endpoint).await.map_err(|e| e.into())
    }

    async fn delete_channel(&self, channel_id: &str) -> Result<()> {
        let endpoint = format!("api/channels/{}", channel_id);
        self.http_client.delete(&endpoint).await
    }
}
