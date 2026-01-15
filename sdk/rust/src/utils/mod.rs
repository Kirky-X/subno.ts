// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

//! Utility modules for SecureNotify SDK

pub mod http;
pub mod retry;
pub mod connection;
pub mod metrics;
pub mod cache;
pub mod request_deduplicator;

pub use http::{HttpClient, HttpClientConfig};
pub use retry::{RetryConfig, with_retry, calculate_backoff};
pub use connection::{SseConnection, SseConfig, SseMessage, SseState};
pub use metrics::{MetricsCollector, MetricsContext, MetricSample, MetricStats, MetricsSummary};
pub use cache::{ResponseCache, CacheMetrics};
pub use request_deduplicator::{RequestDeduplicator, DeduplicatorStats};
