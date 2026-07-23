// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};
use sha2::{Sha256, Digest};
use serde::{Serialize, Deserialize};
use tokio::sync::Mutex as TokioMutex;

#[derive(Debug)]
struct PendingRequest {
    _timestamp: Instant,
    result: Option<Result<String, String>>,
}

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

pub struct RequestDeduplicator {
    pending: Arc<TokioMutex<HashMap<String, PendingRequest>>>,
    completed: Arc<TokioMutex<HashMap<String, String>>>,
    _ttl: Duration,
    max_pending: usize,
    max_completed: usize,
    stats: Arc<TokioMutex<DeduplicatorStats>>,
}

impl RequestDeduplicator {
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

    pub fn default() -> Self {
        Self::new(5.0, 1000, 10000)
    }

    fn generate_key(&self, endpoint: &str, params: &Option<serde_json::Value>) -> String {
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

        format!("req_{:x}", result)
    }

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

        if use_cache {
            let completed = self.completed.lock().await;
            if let Some(result) = completed.get(&key) {
                let mut stats = self.stats.lock().await;
                stats.hits += 1;
                stats.hit_rate = stats.hits as f64 / (stats.hits + stats.misses) as f64;
                return Ok(result.clone());
            }
        }

        {
            let mut pending = self.pending.lock().await;
            if let Some(_pending_req) = pending.get_mut(&key) {
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

        {
            let mut stats = self.stats.lock().await;
            stats.misses += 1;
        }

        {
            let mut pending = self.pending.lock().await;
            if pending.len() >= self.max_pending {
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

        {
            let mut pending = self.pending.lock().await;
            if let Some(pending_req) = pending.get_mut(&key) {
                pending_req.result = Some(result.clone());
            }
            pending.remove(&key);
        }

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

        {
            let mut stats = self.stats.lock().await;
            if result.is_err() {
                stats.errors += 1;
            }
        }

        result
    }

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

    pub async fn clear_pending(&self) -> usize {
        let mut pending = self.pending.lock().await;
        let count = pending.len();
        pending.clear();
        count
    }

    pub async fn clear_completed(&self) -> usize {
        let mut completed = self.completed.lock().await;
        let count = completed.len();
        completed.clear();
        count
    }

    pub async fn clear_all(&self) -> usize {
        self.clear_pending().await + self.clear_completed().await
    }

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

    pub async fn reset_stats(&self) {
        let mut stats = self.stats.lock().await;
        stats.hits = 0;
        stats.misses = 0;
        stats.errors = 0;
        stats.hit_rate = 0.0;
    }
}