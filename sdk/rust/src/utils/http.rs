// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

//! HTTP client utilities for SecureNotify SDK

use reqwest::{Client, RequestBuilder, Response, redirect::Policy};
use std::sync::Arc;
use std::time::Duration;
use crate::{SecureNotifyError, Result};
use crate::utils::retry::{with_retry, RetryConfig};
use super::metrics::{MetricsCollector, MetricsContext};
use super::cache::ResponseCache;
use super::request_deduplicator::RequestDeduplicator;

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
    metrics_collector: Option<Arc<MetricsCollector>>,
    cache: Option<Arc<ResponseCache<String>>>,
    request_deduplicator: Option<Arc<RequestDeduplicator>>,
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
            false,
            false,
            false,
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
        enable_metrics: bool,
        enable_cache: bool,
        enable_deduplication: bool,
    ) -> Self {
        // Configure SSL/TLS with TLS 1.2 enforcement and redirect limits (CRITICAL SECURITY FIX)
        let client = Client::builder()
            .timeout(timeout)
            .redirect(Policy::limited(5)) // Limit redirects to prevent SSRF
            .use_native_tls()
            .min_tls_version(reqwest::tls::Version::TLS_1_2) // Enforce TLS 1.2
            .build()
            .expect("Failed to build HTTP client");

        let metrics_collector = if enable_metrics {
            Some(Arc::new(MetricsCollector::default()))
        } else {
            None
        };

        let cache = if enable_cache {
            Some(Arc::new(ResponseCache::default()))
        } else {
            None
        };

        let request_deduplicator = if enable_deduplication {
            Some(Arc::new(RequestDeduplicator::default()))
        } else {
            None
        };

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
            metrics_collector,
            cache,
            request_deduplicator,
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

        builder = builder.header("User-Agent", "SecureNotify-Rust/0.1.0");  // Add User-Agent header

        // Add request ID for tracing
        let request_id = uuid::Uuid::new_v4().to_string();
        builder = builder.header("X-Request-ID", request_id);

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

        // Create metrics context if metrics are enabled
        let endpoint = request.try_clone()
            .and_then(|r| r.build().ok())
            .map(|r| r.url().path().to_string())
            .unwrap_or_else(|| "unknown".to_string());

        let metrics_context = self.metrics_collector.as_ref().map(|mc| {
            MetricsContext::new(mc.as_ref(), &endpoint)
        });

        let result = with_retry(
            |_attempt| {
                let request = request.try_clone().unwrap();
                async move {
                    let response = request.send().await?;
                    self.handle_response(response).await
                }
            },
            &retry_config,
        )
        .await;

        // Mark success or failure for metrics
        if let Some(mut ctx) = metrics_context {
            if result.is_ok() {
                ctx.mark_success();
            }
            ctx.record();
        }

        result
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
        // Check cache first if enabled
        if let Some(cache) = &self.cache {
            let cache_key = format!("GET:{}", endpoint);
            if let Some(cached) = cache.get(&cache_key) {
                // Parse cached response
                return serde_json::from_str(&cached).map_err(|e| {
                    SecureNotifyError::SerializationError(format!("Failed to parse cached response: {}", e))
                });
            }
        }

        // Apply request deduplication if enabled (PERFORMANCE FIX)
        let execute_get = async {
            let request = self.request(reqwest::Method::GET, endpoint);
            let result: () = self.execute_with_retry(request).await
                .map_err(|e| format!("Request failed: {}", e))?;

            // Cache successful responses
            if let Some(cache) = &self.cache {
                if let Ok(json) = serde_json::to_string(&result) {
                    let cache_key = format!("GET:{}", endpoint);
                    cache.set(cache_key, json, None);
                }
            }

            Ok::<String, String>(serde_json::to_string(&result).map_err(|e| format!("Serialization error: {}", e))?)
        };

        if let Some(dedup) = &self.request_deduplicator {
            let dedup_key = format!("GET:{}", endpoint);
            let result = dedup.execute(
                &dedup_key,
                None,
                || execute_get,
                true
            ).await
            .map_err(|e| SecureNotifyError::NetworkError(e))?;
            let json_str = result;
            serde_json::from_str::<T>(&json_str)
                .map_err(|e| SecureNotifyError::SerializationError(format!("Failed to parse deduplicated response: {}", e)))
        } else {
            execute_get.await
                .map_err(|e| SecureNotifyError::NetworkError(e))
                .and_then(|json_str| {
                    serde_json::from_str::<T>(&json_str)
                        .map_err(|e| SecureNotifyError::SerializationError(format!("Failed to parse response: {}", e)))
                })
        }
    }

    /// Execute a POST request with a body
    pub async fn post<T: serde::de::DeserializeOwned, B: serde::Serialize + Sync>(
        &self,
        endpoint: &str,
        body: &B,
    ) -> Result<T> {
        // Apply request deduplication if enabled (PERFORMANCE FIX)
        let execute_post = async {
            let body_clone = body;
            let request = self.request(reqwest::Method::POST, endpoint).json(&body_clone);
            let result: () = self.execute_with_retry(request).await
                .map_err(|e| format!("Request failed: {}", e))?;
            Ok::<String, String>(serde_json::to_string(&result).map_err(|e| format!("Serialization error: {}", e))?)
        };

        if let Some(dedup) = &self.request_deduplicator {
            let dedup_key = format!("POST:{}", endpoint);
            let params = serde_json::to_value(body).ok();
            let result = dedup.execute(
                &dedup_key,
                params,
                || execute_post,
                false
            ).await
            .map_err(|e| SecureNotifyError::NetworkError(e))?;
            let json_str = result;
            serde_json::from_str::<T>(&json_str)
                .map_err(|e| SecureNotifyError::SerializationError(format!("Failed to parse deduplicated response: {}", e)))
        } else {
            execute_post.await
                .map_err(|e| SecureNotifyError::NetworkError(e))
                .and_then(|json_str| {
                    serde_json::from_str::<T>(&json_str)
                        .map_err(|e| SecureNotifyError::SerializationError(format!("Failed to parse response: {}", e)))
                })
        }
    }

    /// Execute a PUT request with a body
    pub async fn put<T: serde::de::DeserializeOwned, B: serde::Serialize + Sync>(
        &self,
        endpoint: &str,
        body: &B,
    ) -> Result<T> {
        // Apply request deduplication if enabled (PERFORMANCE FIX)
        let execute_put = async {
            let body_clone = body;
            let request = self.request(reqwest::Method::PUT, endpoint).json(&body_clone);
            let result: () = self.execute_with_retry(request).await
                .map_err(|e| format!("Request failed: {}", e))?;
            Ok::<String, String>(serde_json::to_string(&result).map_err(|e| format!("Serialization error: {}", e))?)
        };

        if let Some(dedup) = &self.request_deduplicator {
                let dedup_key = format!("PUT:{}", endpoint);
                let params = serde_json::to_value(body).ok();
                let result = dedup.execute(
                    &dedup_key,
                    params,
                    || execute_put,
                    false
                ).await
                .map_err(|e| SecureNotifyError::NetworkError(e))?;
                let json_str = result;
                serde_json::from_str::<T>(&json_str)
                    .map_err(|e| SecureNotifyError::SerializationError(format!("Failed to parse deduplicated response: {}", e)))
            } else {
                execute_put.await
                    .map_err(|e| SecureNotifyError::NetworkError(e))
                    .and_then(|json_str| {
                        serde_json::from_str::<T>(&json_str)
                            .map_err(|e| SecureNotifyError::SerializationError(format!("Failed to parse response: {}", e)))
                    })
            }    }

    /// Execute a DELETE request
    pub async fn delete<T: serde::de::DeserializeOwned>(&self, endpoint: &str) -> Result<T> {
        // Apply request deduplication if enabled (PERFORMANCE FIX)
        let execute_delete = async {
            let request = self.request(reqwest::Method::DELETE, endpoint);
            let result: () = self.execute_with_retry(request).await
                .map_err(|e| format!("Request failed: {}", e))?;
            Ok::<String, String>(serde_json::to_string(&result).map_err(|e| format!("Serialization error: {}", e))?)
        };

        if let Some(dedup) = &self.request_deduplicator {
            let dedup_key = format!("DELETE:{}", endpoint);
            let result = dedup.execute(
                &dedup_key,
                None,
                || execute_delete,
                false
            ).await
            .map_err(|e| SecureNotifyError::NetworkError(e))?;
            let json_str = result;
            serde_json::from_str::<T>(&json_str)
                .map_err(|e| SecureNotifyError::SerializationError(format!("Failed to parse deduplicated response: {}", e)))
        } else {
            execute_delete.await
                .map_err(|e| SecureNotifyError::NetworkError(e))
                .and_then(|json_str| {
                    serde_json::from_str::<T>(&json_str)
                        .map_err(|e| SecureNotifyError::SerializationError(format!("Failed to parse response: {}", e)))
                })
        }
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

    // Metrics management methods (PERFORMANCE FIX)

    /// Get metrics summary if metrics are enabled
    ///
    /// # Returns
    /// * `Some(summary)` - Metrics summary with total requests, success rate, etc.
    /// * `None` - Metrics are not enabled
    pub fn get_metrics_summary(&self) -> Option<super::metrics::MetricsSummary> {
        self.metrics_collector.as_ref().map(|mc| mc.get_summary())
    }

    /// Get detailed metrics for all endpoints
    ///
    /// # Returns
    /// * `Some(stats)` - HashMap of endpoint -> MetricStats
    /// * `None` - Metrics are not enabled
    pub fn get_all_metrics(&self) -> Option<std::collections::HashMap<String, super::metrics::MetricStats>> {
        self.metrics_collector.as_ref().map(|mc| mc.get_all_stats())
    }

    /// Get metrics for a specific endpoint
    ///
    /// # Returns
    /// * `Some(stats)` - Detailed metrics for the endpoint
    /// * `None` - Metrics are not enabled or no data for endpoint
    pub fn get_endpoint_metrics(&self, endpoint: &str) -> Option<super::metrics::MetricStats> {
        self.metrics_collector.as_ref().and_then(|mc| mc.get_stats(endpoint))
    }

    /// Reset all metrics
    ///
    /// This clears all collected metric data. Useful for testing or periodic resets.
    pub fn reset_metrics(&self) {
        if let Some(mc) = &self.metrics_collector {
            mc.reset();
        }
    }

    /// Check if metrics collection is enabled
    pub fn metrics_enabled(&self) -> bool {
        self.metrics_collector.is_some()
    }

    // Cache management methods (PERFORMANCE FIX)

    /// Clear all cached responses
    pub fn clear_cache(&self) {
        if let Some(cache) = &self.cache {
            cache.clear();
        }
    }

    /// Remove expired cache entries
    ///
    /// # Returns
    /// Number of entries removed
    pub fn cleanup_cache(&self) -> usize {
        self.cache.as_ref().map(|c| c.cleanup_expired()).unwrap_or(0)
    }

    /// Get cache size
    ///
    /// # Returns
    /// Number of cached entries
    pub fn get_cache_size(&self) -> usize {
        self.cache.as_ref().map(|c| c.size()).unwrap_or(0)
    }

    /// Get cache metrics
    ///
    /// # Returns
    /// Cache performance metrics or None if cache is disabled
    pub fn get_cache_metrics(&self) -> Option<super::cache::CacheMetrics> {
        self.cache.as_ref().map(|c| c.get_metrics())
    }

    /// Reset cache metrics
    pub fn reset_cache_metrics(&self) {
        if let Some(cache) = &self.cache {
            cache.reset_metrics();
        }
    }

    /// Get cache hit rate
    ///
    /// # Returns
    /// Hit rate as a float between 0.0 and 1.0, or 0.0 if cache is disabled
    pub fn get_cache_hit_rate(&self) -> f64 {
        self.cache.as_ref().map(|c| c.get_hit_rate()).unwrap_or(0.0)
    }

    /// Check if cache is enabled
    pub fn cache_enabled(&self) -> bool {
        self.cache.is_some()
    }

    // Deduplicator management methods (PERFORMANCE FIX)

    /// Clear all pending duplicate requests
    ///
    /// # Returns
    /// Number of pending requests cleared
    pub async fn clear_pending_requests(&self) -> usize {
        if let Some(dedup) = &self.request_deduplicator {
            dedup.clear_pending().await
        } else {
            0
        }
    }

    /// Clear all completed duplicate requests
    ///
    /// # Returns
    /// Number of completed requests cleared
    pub async fn clear_completed_requests(&self) -> usize {
        if let Some(dedup) = &self.request_deduplicator {
            dedup.clear_completed().await
        } else {
            0
        }
    }

    /// Clear all pending and completed duplicate requests
    ///
    /// # Returns
    /// Total number of requests cleared
    pub async fn clear_all_requests(&self) -> usize {
        if let Some(dedup) = &self.request_deduplicator {
            dedup.clear_all().await
        } else {
            0
        }
    }

    /// Remove expired entries from request deduplicator
    ///
    /// # Returns
    /// Number of entries removed
    pub async fn cleanup_expired_requests(&self) -> usize {
        if let Some(dedup) = &self.request_deduplicator {
            dedup.cleanup_expired().await
        } else {
            0
        }
    }

/// Get statistics about the request deduplicator
    ///
    /// # Returns
    /// Dictionary with statistics or empty struct if disabled
    pub async fn get_deduplicator_stats(&self) -> super::request_deduplicator::DeduplicatorStats {
        if let Some(dedup) = &self.request_deduplicator {
            dedup.get_stats().await
        } else {
            super::request_deduplicator::DeduplicatorStats {
                hits: 0,
                misses: 0,
                errors: 0,
                hit_rate: 0.0,
                pending_count: 0,
                completed_count: 0,
                ttl_seconds: 5.0,
            }
        }
    }

    /// Reset deduplicator statistics counters
    pub async fn reset_deduplicator_stats(&self) {
        if let Some(dedup) = &self.request_deduplicator {
            dedup.reset_stats().await;
        }
    }

    /// Check if request deduplication is enabled
    ///
    /// # Returns
    /// True if enabled, false otherwise
    pub fn deduplication_enabled(&self) -> bool {
        self.request_deduplicator.is_some()
    }
}
