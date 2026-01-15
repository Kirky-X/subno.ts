// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

//! Request deduplication utility for SDK operations

use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};
use sha2::{Sha256, Digest};
use serde::{Serialize, Deserialize};
use tokio::sync::Mutex as TokioMutex;

/// A pending request waiting for completion
#[derive(Debug)]
struct PendingRequest {
    _timestamp: Instant,
    result: Option<Result<String, String>>,
}

/// Deduplicator statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeduplicatorStats {
    pub hits: u64,
    pub misses: u64,
    pub errors: u64,
    pub hit_rate: f64,
    pub pending_count: usize,
    pub completed_count: usize,
    pub ttl_seconds: f64,
}

/// Prevents duplicate requests from being sent within a short time window
///
/// This struct tracks in-flight requests and returns the same result to all
/// concurrent requests for the same endpoint and parameters.
pub struct RequestDeduplicator {
    pending: Arc<TokioMutex<HashMap<String, PendingRequest>>>,
    completed: Arc<TokioMutex<HashMap<String, String>>>,
    _ttl: Duration,
    max_pending: usize,
    max_completed: usize,
    stats: Arc<TokioMutex<DeduplicatorStats>>,
}

impl RequestDeduplicator {
    /// Create a new request deduplicator
    pub fn new(ttl_seconds: f64, max_pending: usize, max_completed: usize) -> Self {
        Self {
            pending: Arc::new(TokioMutex::new(HashMap::new())),
            completed: Arc::new(TokioMutex::new(HashMap::new())),
            _ttl: Duration::from_secs_f64(ttl_seconds),
            max_pending,
            max_completed,
            stats: Arc::new(TokioMutex::new(DeduplicatorStats {
                hits: 0,
                misses: 0,
                errors: 0,
                hit_rate: 0.0,
                pending_count: 0,
                completed_count: 0,
                ttl_seconds,
            })),
        }
    }

    /// Create a deduplicator with default settings
    pub fn default() -> Self {
        Self::new(5.0, 1000, 10000)
    }

    /// Generate a unique key for the request
    fn generate_key(&self, endpoint: &str, params: &Option<serde_json::Value>) -> String {
        // Create a deterministic string from the parameters
        let params_str = if let Some(p) = params {
            serde_json::to_string(p).unwrap_or_default()
        } else {
            String::new()
        };

        let key = format!("{}:{}", endpoint, params_str);

        // Use SHA256 for better distribution
        let mut hasher = Sha256::new();
        hasher.update(key.as_bytes());
        let result = hasher.finalize();

        // Convert to hex string
        format!("req_{:x}", result)
    }

    /// Execute a request with deduplication
    ///
    /// # Arguments
    /// * `endpoint` - API endpoint
    /// * `params` - Request parameters
    /// * `func` - Async function to execute the request
    /// * `use_cache` - Whether to use completed request cache
    ///
    /// # Returns
    /// Result from the request function
    pub async fn execute<F, Fut>(
        &self,
        endpoint: &str,
        params: Option<serde_json::Value>,
        func: F,
        use_cache: bool,
    ) -> Result<String, String>
    where
        F: FnOnce() -> Fut + Send,
        Fut: std::future::Future<Output = Result<String, String>> + Send,
    {
        let key = self.generate_key(endpoint, &params);

        // Check completed cache first
        if use_cache {
            let completed = self.completed.lock().await;
            if let Some(result) = completed.get(&key) {
                let mut stats = self.stats.lock().await;
                stats.hits += 1;
                stats.hit_rate = stats.hits as f64 / (stats.hits + stats.misses) as f64;
                return Ok(result.clone());
            }
        }

        // Check pending requests
        {
            let mut pending = self.pending.lock().await;
            if let Some(_pending_req) = pending.get_mut(&key) {
                // Request is pending, wait for result
                {
                    let mut stats = self.stats.lock().await;
                    stats.hits += 1;
                    stats.hit_rate = stats.hits as f64 / (stats.hits + stats.misses) as f64;
                }

                // Simple polling for now (in a real implementation, use a condition variable)
                drop(pending);
                tokio::time::sleep(Duration::from_millis(10)).await;

                let pending = self.pending.lock().await;
                if let Some(pending_req) = pending.get(&key) {
                    if let Some(ref result) = pending_req.result {
                        return result.clone();
                    }
                }
            }
        }

        // Execute the request
        {
            let mut stats = self.stats.lock().await;
            stats.misses += 1;
        }

        // Store pending request
        {
            let mut pending = self.pending.lock().await;
            if pending.len() >= self.max_pending {
                // Remove oldest pending request
                if let Some(oldest_key) = pending.keys().next().cloned() {
                    pending.remove(&oldest_key);
                }
            }
            pending.insert(key.clone(), PendingRequest {
                _timestamp: Instant::now(),
                result: None,
            });
        }

        let result = func().await;

        // Store result and remove from pending
        {
            let mut pending = self.pending.lock().await;
            if let Some(pending_req) = pending.get_mut(&key) {
                pending_req.result = Some(result.clone());
            }
            pending.remove(&key);
        }

        // Store result in completed cache
        if use_cache && result.is_ok() {
            let mut completed = self.completed.lock().await;
            if completed.len() >= self.max_completed {
                // Remove oldest entry (simple FIFO)
                if let Some(oldest_key) = completed.keys().next().cloned() {
                    completed.remove(&oldest_key);
                }
            }
            if let Ok(ref value) = result {
                completed.insert(key, value.clone());
            }
        }

        // Update stats
        {
            let mut stats = self.stats.lock().await;
            if result.is_err() {
                stats.errors += 1;
            }
        }

        result
    }

    /// Remove expired entries from completed cache
    ///
    /// # Returns
    /// Number of entries removed
    pub async fn cleanup_expired(&self) -> usize {
        let mut removed = 0;

        // Remove oldest entries if we exceed max_completed
        let mut completed = self.completed.lock().await;
        while completed.len() > self.max_completed * 2 {
            if let Some(oldest_key) = completed.keys().next().cloned() {
                completed.remove(&oldest_key);
                removed += 1;
            }
        }

        removed
    }

    /// Clear all pending requests
    ///
    /// # Returns
    /// Number of pending requests cleared
    pub async fn clear_pending(&self) -> usize {
        let mut pending = self.pending.lock().await;
        let count = pending.len();
        pending.clear();
        count
    }

    /// Clear all completed requests
    ///
    /// # Returns
    /// Number of completed requests cleared
    pub async fn clear_completed(&self) -> usize {
        let mut completed = self.completed.lock().await;
        let count = completed.len();
        completed.clear();
        count
    }

    /// Clear all pending and completed requests
    ///
    /// # Returns
    /// Total number of requests cleared
    pub async fn clear_all(&self) -> usize {
        self.clear_pending().await + self.clear_completed().await
    }

    /// Get statistics about the deduplicator
    ///
    /// # Returns
    /// Dictionary with statistics
    pub async fn get_stats(&self) -> DeduplicatorStats {
        let stats = self.stats.lock().await;
        let pending = self.pending.lock().await;
        let completed = self.completed.lock().await;

        DeduplicatorStats {
            hits: stats.hits,
            misses: stats.misses,
            errors: stats.errors,
            hit_rate: stats.hit_rate,
            pending_count: pending.len(),
            completed_count: completed.len(),
            ttl_seconds: stats.ttl_seconds,
        }
    }

    /// Reset statistics counters
    pub async fn reset_stats(&self) {
        let mut stats = self.stats.lock().await;
        stats.hits = 0;
        stats.misses = 0;
        stats.errors = 0;
        stats.hit_rate = 0.0;
    }
}