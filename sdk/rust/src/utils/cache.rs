// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

//! Response cache for SDK operations

use std::collections::HashMap;
use std::sync::{Arc, RwLock};
use std::time::{Duration, Instant};

/// Cache entry with expiration
#[derive(Debug, Clone)]
struct CacheEntry<T> {
    value: T,
    expires_at: Instant,
}

/// Cache metrics
#[derive(Debug, Clone, Default)]
pub struct CacheMetrics {
    pub hits: u64,
    pub misses: u64,
    pub entries: u64,
    pub cleanup_count: u64,
}

/// Response cache with TTL support
pub struct ResponseCache<T> {
    cache: Arc<RwLock<HashMap<String, CacheEntry<T>>>>,
    default_ttl: Duration,
    max_entries: usize,
    metrics: Arc<RwLock<CacheMetrics>>,
}

impl<T: Clone> ResponseCache<T> {
    /// Create a new response cache
    pub fn new(default_ttl: Duration, max_entries: usize) -> Self {
        Self {
            cache: Arc::new(RwLock::new(HashMap::new())),
            default_ttl,
            max_entries,
            metrics: Arc::new(RwLock::new(CacheMetrics::default())),
        }
    }

    /// Create a response cache with default settings (60s TTL, 1000 max entries)
    pub fn default() -> Self {
        Self::new(Duration::from_secs(60), 1000)
    }

    /// Get a value from the cache
    /// Returns cloned value for safety (avoids lifetime issues with locked data)
    pub fn get(&self, key: &str) -> Option<T> {
        let cache = self.cache.read().unwrap();

        if let Some(entry) = cache.get(key) {
            if entry.expires_at > Instant::now() {
                let mut metrics = self.metrics.write().unwrap();
                metrics.hits += 1;
                // Clone only the value we need to return
                return Some(entry.value.clone());
            } else {
                // Entry expired - need to acquire write lock to remove
                drop(cache); // Release read lock before acquiring write lock
                let mut cache = self.cache.write().unwrap();
                cache.remove(key);
                let mut metrics = self.metrics.write().unwrap();
                metrics.entries = cache.len() as u64;
                metrics.misses += 1;
                return None;
            }
        }

        let mut metrics = self.metrics.write().unwrap();
        metrics.misses += 1;
        None
    }

    /// Set a value in the cache with custom TTL
    pub fn set(&self, key: String, value: T, ttl: Option<Duration>) {
        let mut cache = self.cache.write().unwrap();
        let mut metrics = self.metrics.write().unwrap();

        // Check if we need to make room
        if cache.len() >= self.max_entries && !cache.contains_key(&key) {
            // Remove oldest entries (simple strategy: remove first 10%)
            let keys_to_remove: Vec<String> = cache.keys().take(self.max_entries / 10).cloned().collect();
            for k in keys_to_remove {
                cache.remove(&k);
            }
        }

        let expires_at = Instant::now() + ttl.unwrap_or(self.default_ttl);
        cache.insert(key, CacheEntry { value, expires_at });
        metrics.entries = cache.len() as u64;
    }

    /// Delete a value from the cache
    pub fn delete(&self, key: &str) {
        let mut cache = self.cache.write().unwrap();
        let mut metrics = self.metrics.write().unwrap();
        cache.remove(key);
        metrics.entries = cache.len() as u64;
    }

    /// Clear all entries from the cache
    pub fn clear(&self) {
        let mut cache = self.cache.write().unwrap();
        let mut metrics = self.metrics.write().unwrap();
        cache.clear();
        metrics.entries = 0;
    }

    /// Remove expired entries
    pub fn cleanup_expired(&self) -> usize {
        let mut cache = self.cache.write().unwrap();
        let mut metrics = self.metrics.write().unwrap();

        let now = Instant::now();
        let mut removed = 0;

        cache.retain(|_, entry| {
            if entry.expires_at > now {
                true
            } else {
                removed += 1;
                false
            }
        });

        metrics.entries = cache.len() as u64;
        metrics.cleanup_count += 1;
        removed
    }

    /// Get the current cache size
    pub fn size(&self) -> usize {
        let cache = self.cache.read().unwrap();
        cache.len()
    }

    /// Get cache metrics
    pub fn get_metrics(&self) -> CacheMetrics {
        let metrics = self.metrics.read().unwrap();
        metrics.clone()
    }

    /// Reset cache metrics
    pub fn reset_metrics(&self) {
        let mut metrics = self.metrics.write().unwrap();
        *metrics = CacheMetrics::default();
    }

    /// Get cache hit rate
    pub fn get_hit_rate(&self) -> f64 {
        let metrics = self.metrics.read().unwrap();
        let total = metrics.hits + metrics.misses;
        if total == 0 {
            0.0
        } else {
            metrics.hits as f64 / total as f64
        }
    }
}