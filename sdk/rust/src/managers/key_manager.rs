// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

use async_trait::async_trait;
use crate::Result;
use crate::types::api::*;

#[async_trait]
pub trait KeyManager {
    async fn register_public_key(
        &self,
        channel_id: &str,
        public_key: &str,
        algorithm: &str,
        metadata: Option<serde_json::Value>,
    ) -> Result<RegisterPublicKeyResponse>;

    async fn get_public_key(&self, channel_id: &str) -> Result<PublicKeyInfo>;

    async fn list_public_keys(
        &self,
        limit: Option<u32>,
        offset: Option<u32>,
    ) -> Result<Vec<PublicKeyInfo>>;

    async fn revoke_public_key(&self, channel_id: &str) -> Result<()>;
}

pub struct KeyManagerImpl {
    http_client: std::sync::Arc<crate::utils::http::HttpClient>,
}

impl KeyManagerImpl {
    pub fn new(http_client: std::sync::Arc<crate::utils::http::HttpClient>) -> Self {
        Self { http_client }
    }
}

#[async_trait]
impl KeyManager for KeyManagerImpl {
    async fn register_public_key(
        &self,
        channel_id: &str,
        public_key: &str,
        algorithm: &str,
        metadata: Option<serde_json::Value>,
    ) -> Result<RegisterPublicKeyResponse> {
        let request = RegisterPublicKeyRequest {
            public_key: public_key.to_string(),
            algorithm: algorithm.to_string(),
            metadata,
        };

        let endpoint = format!("api/register/{}", channel_id);
        self.http_client.post(&endpoint, &request).await.map_err(|e| e.into())
    }

    async fn get_public_key(&self, channel_id: &str) -> Result<PublicKeyInfo> {
        let endpoint = format!("api/register/{}", channel_id);
        self.http_client.get(&endpoint).await.map_err(|e| e.into())
    }

    async fn list_public_keys(
        &self,
        limit: Option<u32>,
        offset: Option<u32>,
    ) -> Result<Vec<PublicKeyInfo>> {
        let mut endpoint = "api/register".to_string();
        let mut params = Vec::new();

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

    async fn revoke_public_key(&self, channel_id: &str) -> Result<()> {
        let endpoint = format!("api/keys/{}/revoke", channel_id);
        self.http_client.post_empty(&endpoint).await
    }
}
