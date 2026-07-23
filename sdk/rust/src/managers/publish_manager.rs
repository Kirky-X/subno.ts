// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

use async_trait::async_trait;
use crate::{Result, MessagePriority};
use crate::types::api::*;

#[async_trait]
pub trait PublishManager {
    async fn publish_message(
        &self,
        channel: &str,
        message: &str,
        priority: Option<MessagePriority>,
        sender: Option<&str>,
        cache: Option<bool>,
        encrypted: Option<bool>,
        signature: Option<&str>,
    ) -> Result<MessagePublishResponse>;

    async fn get_queue_status(&self, channel: &str) -> Result<QueueStatus>;

    async fn get_message(&self, channel: &str, message_id: &str) -> Result<MessageInfo>;
}

pub struct PublishManagerImpl {
    http_client: std::sync::Arc<crate::utils::http::HttpClient>,
}

impl PublishManagerImpl {
    pub fn new(http_client: std::sync::Arc<crate::utils::http::HttpClient>) -> Self {
        Self { http_client }
    }
}

#[async_trait]
impl PublishManager for PublishManagerImpl {
    async fn publish_message(
        &self,
        channel: &str,
        message: &str,
        priority: Option<MessagePriority>,
        sender: Option<&str>,
        cache: Option<bool>,
        encrypted: Option<bool>,
        signature: Option<&str>,
    ) -> Result<MessagePublishResponse> {
        let request = MessagePublishRequest {
            message: message.to_string(),
            priority: priority.map(|p| p as u8),
            sender: sender.map(|s| s.to_string()),
            cache,
            encrypted,
            signature: signature.map(|s| s.to_string()),
        };

        let endpoint = format!("api/publish/{}", channel);
        self.http_client.post(&endpoint, &request).await.map_err(|e| e.into())
    }

    async fn get_queue_status(&self, channel: &str) -> Result<QueueStatus> {
        let endpoint = format!("api/publish/{}?status=true", channel);
        self.http_client.get(&endpoint).await.map_err(|e| e.into())
    }

    async fn get_message(&self, channel: &str, message_id: &str) -> Result<MessageInfo> {
        let endpoint = format!("api/publish/{}/{}", channel, message_id);
        self.http_client.get(&endpoint).await.map_err(|e| e.into())
    }
}
