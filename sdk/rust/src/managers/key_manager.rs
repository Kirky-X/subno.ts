// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

//! Key manager for SecureNotify SDK

use async_trait::async_trait;
use crate::{Result, SecureNotifyError};
use crate::types::api::*;
use crate::managers::ManagerError;

/// Trait for key management operations
#[async_trait]
pub trait KeyManager {
    /// Register a new public key
    async fn register_public_key(
        &self,
        channel_id: &str,
        public_key: &str,
        algorithm: &str,
        metadata: Option<serde_json::Value>,
    ) -> Result<RegisterPublicKeyResponse>;

    /// Get public key information for a channel
    async fn get_public_key(&self, channel_id: &str) -> Result<PublicKeyInfo>;

    /// List all public keys (with optional pagination)
    async fn list_public_keys(
        &self,
        limit: Option<u32>,
        offset: Option<u32>,
    ) -> Result<Vec<PublicKeyInfo>>;

    /// Revoke a public key
    async fn revoke_public_key(&self, channel_id: &str) -> Result<()>;
}

/// Implementation of KeyManager
pub struct KeyManagerImpl {
    http_client: std::sync::Arc<crate::utils::http::HttpClient>,
}

impl KeyManagerImpl {
    /// Create a new KeyManager
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
