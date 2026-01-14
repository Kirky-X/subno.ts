// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

//! HTTP client utilities for SecureNotify SDK

use reqwest::{Client, RequestBuilder, Response};
use std::sync::Arc;
use std::time::Duration;
use crate::{SecureNotifyError, Result};
use crate::types::error::is_retryable_error;
use crate::utils::retry::{with_retry, RetryConfig};

/// HTTP client configuration
#[derive(Debug, Clone)]
pub struct HttpClientConfig {
    pub base_url: String,
    pub api_key: String,
    pub timeout: std::time::Duration,
    pub max_retries: u32,
    pub initial_delay_ms: u64,
    pub max_delay_ms: u64,
    pub backoff_multiplier: f64,
}

impl Default for HttpClientConfig {
    fn default() -> Self {
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
}

/// HTTP client wrapper for SecureNotify API
#[derive(Clone)]
pub struct HttpClient {
    client: Client,
    base_url: String,
    api_key: String,
    config: HttpClientConfig,
}

impl HttpClient {
    /// Create a new HTTP client
    pub fn new(base_url: &str, api_key: &str) -> Self {
        Self::with_config(
            base_url,
            api_key,
            std::time::Duration::from_secs(30),
            3,
            1000,
            30000,
            2.0,
        )
    }

    /// Create an HTTP client with custom configuration
    pub fn with_config(
        base_url: &str,
        api_key: &str,
        timeout: std::time::Duration,
        max_retries: u32,
        initial_delay_ms: u64,
        max_delay_ms: u64,
        backoff_multiplier: f64,
    ) -> Self {
        let client = Client::builder()
            .timeout(timeout)
            .build()
            .expect("Failed to build HTTP client");

        Self {
            client,
            base_url: base_url.to_string(),
            api_key: api_key.to_string(),
            config: HttpClientConfig {
                base_url: base_url.to_string(),
                api_key: api_key.to_string(),
                timeout,
                max_retries,
                initial_delay_ms,
                max_delay_ms,
                backoff_multiplier,
            },
        }
    }

    /// Get the configuration
    pub fn config(&self) -> &HttpClientConfig {
        &self.config
    }

    /// Build the base URL for an endpoint
    fn build_url(&self, endpoint: &str) -> String {
        let base = self.base_url.trim_end_matches('/');
        let endpoint = endpoint.trim_start_matches('/');
        format!("{}/{}", base, endpoint)
    }

    /// Create a request builder with authentication
    fn request(&self, method: reqwest::Method, endpoint: &str) -> RequestBuilder {
        let url = self.build_url(endpoint);
        let mut builder = self.client.request(method, url);

        if !self.api_key.is_empty() {
            builder = builder.header("X-API-Key", &self.api_key);
        }

        builder
    }

    /// Execute a request with retry logic
    async fn execute_with_retry<T: serde::de::DeserializeOwned>(
        &self,
        request: RequestBuilder,
    ) -> Result<T> {
        let retry_config = RetryConfig::new()
            .with_max_retries(self.config.max_retries)
            .with_initial_delay(Duration::from_millis(self.config.initial_delay_ms))
            .with_max_delay(Duration::from_millis(self.config.max_delay_ms))
            .with_backoff_multiplier(self.config.backoff_multiplier)
            .with_jitter(true);

        let request = request.try_clone().unwrap();

        with_retry(
            |_attempt| async move {
                let response = request.send().await?;
                self.handle_response(response).await
            },
            &retry_config,
        )
        .await
    }

    /// Handle the HTTP response
    async fn handle_response<T: serde::de::DeserializeOwned>(
        &self,
        response: Response,
    ) -> Result<T> {
        let status = response.status();

        if status.is_success() {
            response.json().await.map_err(|e| e.into())
        } else {
            // Try to parse error response
            let error_text = response.text().await.unwrap_or_default();
            let code = status.as_u16().to_string();

            Err(SecureNotifyError::ApiError {
                code,
                message: error_text,
                status: status.as_u16(),
            })
        }
    }

    /// Execute a GET request
    pub async fn get<T: serde::de::DeserializeOwned>(&self, endpoint: &str) -> Result<T> {
        let request = self.request(reqwest::Method::GET, endpoint);
        self.execute_with_retry(request).await
    }

    /// Execute a POST request with a body
    pub async fn post<T: serde::de::DeserializeOwned, B: serde::Serialize>(
        &self,
        endpoint: &str,
        body: &B,
    ) -> Result<T> {
        let request = self.request(reqwest::Method::POST, endpoint).json(body);
        self.execute_with_retry(request).await
    }

    /// Execute a PUT request with a body
    pub async fn put<T: serde::de::DeserializeOwned, B: serde::Serialize>(
        &self,
        endpoint: &str,
        body: &B,
    ) -> Result<T> {
        let request = self.request(reqwest::Method::PUT, endpoint).json(body);
        self.execute_with_retry(request).await
    }

    /// Execute a DELETE request
    pub async fn delete<T: serde::de::DeserializeOwned>(&self, endpoint: &str) -> Result<T> {
        let request = self.request(reqwest::Method::DELETE, endpoint);
        self.execute_with_retry(request).await
    }

    /// Execute a POST request that returns no body
    pub async fn post_empty(&self, endpoint: &str) -> Result<()> {
        let request = self.request(reqwest::Method::POST, endpoint);

        match request.send().await {
            Ok(response) => {
                if response.status().is_success() {
                    Ok(())
                } else {
                    let status = response.status();
                    let error_text = response.text().await.unwrap_or_default();
                    Err(SecureNotifyError::ApiError {
                        code: status.as_u16().to_string(),
                        message: error_text,
                        status: status.as_u16(),
                    })
                }
            }
            Err(e) => Err(e.into()),
        }
    }
}
