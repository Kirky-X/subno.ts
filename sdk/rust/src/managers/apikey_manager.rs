// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

//! API Key manager for SecureNotify SDK

use async_trait::async_trait;
use crate::{Result, SecureNotifyError};
use crate::types::api::*;

/// Trait for API key management operations
#[async_trait]
pub trait ApiKeyManager {
    /// Create a new API key
    async fn create_api_key(
        &self,
        name: &str,
        user_id: Option<&str>,
        permissions: Option<Vec<&str>>,
        expires_at: Option<&str>,
    ) -> Result<ApiKeyCreateResponse>;

    /// Get API key information
    async fn get_api_key(&self, key_id: &str) -> Result<ApiKeyInfo>;

    /// List all API keys
    async fn list_api_keys(
        &self,
        limit: Option<u32>,
        offset: Option<u32>,
    ) -> Result<Vec<ApiKeyInfo>>;

    /// Revoke an API key
    async fn revoke_api_key(&self, key_id: &str) -> Result<()>;
}

/// Implementation of ApiKeyManager
pub struct ApiKeyManagerImpl {
    http_client: std::sync::Arc<crate::utils::http::HttpClient>,
}

impl ApiKeyManagerImpl {
    /// Create a new ApiKeyManager
    pub fn new(http_client: std::sync::Arc<crate::utils::http::HttpClient>) -> Self {
        Self { http_client }
    }
}

#[async_trait]
impl ApiKeyManager for ApiKeyManagerImpl {
    async fn create_api_key(
        &self,
        name: &str,
        user_id: Option<&str>,
        permissions: Option<Vec<&str>>,
        expires_at: Option<&str>,
    ) -> Result<ApiKeyCreateResponse> {
        let request = ApiKeyCreateRequest {
            name: name.to_string(),
            user_id: user_id.map(|s| s.to_string()),
            permissions: permissions.map(|mut perms| perms.drain(..).map(|s| s.to_string()).collect()),
            expires_at: expires_at.map(|s| s.to_string()),
        };

        self.http_client.post("api/keys", &request).await.map_err(|e| e.into())
    }

    async fn get_api_key(&self, key_id: &str) -> Result<ApiKeyInfo> {
        let endpoint = format!("api/keys/{}", key_id);
        self.http_client.get(&endpoint).await.map_err(|e| e.into())
    }

    async fn list_api_keys(
        &self,
        limit: Option<u32>,
        offset: Option<u32>,
    ) -> Result<Vec<ApiKeyInfo>> {
        let mut endpoint = "api/keys".to_string();
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

    async fn revoke_api_key(&self, key_id: &str) -> Result<()> {
        let endpoint = format!("api/keys/{}/revoke", key_id);
        self.http_client.post_empty(&endpoint).await
    }
}
