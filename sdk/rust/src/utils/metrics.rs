// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

//! Performance metrics collector for SDK operations.

use std::collections::HashMap;
use std::sync::{Arc, RwLock};
use std::time::Instant;

/// A single metric sample
#[derive(Debug, Clone)]
pub struct MetricSample {
    pub timestamp: Instant,
    pub duration_ms: f64,
    pub success: bool,
    pub endpoint: String,
}

/// Statistics for a metric
#[derive(Debug, Clone)]
pub struct MetricStats {
    pub count: u64,
    pub success_count: u64,
    pub failure_count: u64,
    pub min_duration_ms: f64,
    pub max_duration_ms: f64,
    pub avg_duration_ms: f64,
    pub p50_duration_ms: f64,
    pub p95_duration_ms: f64,
    pub p99_duration_ms: f64,
}

impl MetricStats {
    pub fn new() -> Self {
        Self {
            count: 0,
            success_count: 0,
            failure_count: 0,
            min_duration_ms: f64::MAX,
            max_duration_ms: 0.0,
            avg_duration_ms: 0.0,
            p50_duration_ms: 0.0,
            p95_duration_ms: 0.0,
            p99_duration_ms: f64::MAX,
        }
    }

    pub fn success_rate(&self) -> f64 {
        if self.count == 0 {
            0.0
        } else {
            self.success_count as f64 / self.count as f64
        }
    }

    pub fn add_sample(&mut self, sample: &MetricSample) {
        self.count += 1;
        self.success_count += if sample.success { 1 } else { 0 };
        self.failure_count += if sample.success { 0 } else { 1 };

        if sample.duration_ms < self.min_duration_ms {
            self.min_duration_ms = sample.duration_ms;
        }
        if sample.duration_ms > self.max_duration_ms {
            self.max_duration_ms = sample.duration_ms;
        }

        self.avg_duration_ms = (self.avg_duration_ms * (self.count - 1) as f64 + sample.duration_ms) / self.count as f64;
    }

    pub fn calculate_percentiles(&mut self, samples: &[MetricSample]) {
        if samples.is_empty() {
            return;
        }

        let mut durations: Vec<f64> = samples.iter().map(|s| s.duration_ms).collect();
        durations.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));

        let n = durations.len();
        self.p50_duration_ms = durations[n / 2];
        self.p95_duration_ms = durations[(n * 95) / 100];
        self.p99_duration_ms = durations[(n * 99) / 100];
    }
}

impl Default for MetricStats {
    fn default() -> Self {
        Self::new()
    }
}

/// Metrics summary
#[derive(Debug, Clone)]
pub struct MetricsSummary {
    pub total_requests: u64,
    pub total_success: u64,
    pub total_failures: u64,
    pub success_rate: f64,
    pub endpoint_count: usize,
}

/// Performance metrics collector
pub struct MetricsCollector {
    max_samples: usize,
    samples: Arc<RwLock<HashMap<String, Vec<MetricSample>>>>,
}

impl MetricsCollector {
    /// Create a new metrics collector
    pub fn new(max_samples: usize) -> Self {
        Self {
            max_samples,
            samples: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Create a metrics collector with default max samples (1000)
    pub fn default() -> Self {
        Self::new(1000)
    }

    /// Record a metric sample
    pub fn record(&self, endpoint: &str, duration_ms: f64, success: bool) {
        let sample = MetricSample {
            timestamp: Instant::now(),
            duration_ms,
            success,
            endpoint: endpoint.to_string(),
        };

        let mut samples = self.samples.write().unwrap();
        let entry = samples.entry(endpoint.to_string()).or_insert_with(Vec::new);
        entry.push(sample);

        // Trim to max samples
        while entry.len() > self.max_samples {
            entry.remove(0);
        }
    }

    /// Get statistics for an endpoint
    pub fn get_stats(&self, endpoint: &str) -> Option<MetricStats> {
        let samples = self.samples.read().unwrap();
        let entry = samples.get(endpoint)?;

        if entry.is_empty() {
            return None;
        }

        let mut stats = MetricStats::new();
        for sample in entry {
            stats.add_sample(sample);
        }
        stats.calculate_percentiles(entry);
        Some(stats)
    }

    /// Get statistics for all endpoints
    pub fn get_all_stats(&self) -> HashMap<String, MetricStats> {
        let samples = self.samples.read().unwrap();
        let mut result = HashMap::new();

        for (endpoint, sample_list) in samples.iter() {
            if !sample_list.is_empty() {
                let mut stats = MetricStats::new();
                for sample in sample_list {
                    stats.add_sample(sample);
                }
                stats.calculate_percentiles(sample_list);
                result.insert(endpoint.clone(), stats);
            }
        }

        result
    }

    /// Get a summary of all metrics
    pub fn get_summary(&self) -> MetricsSummary {
        let all_stats = self.get_all_stats();
        let mut total_requests = 0u64;
        let mut total_success = 0u64;
        let mut total_failures = 0u64;

        for stats in all_stats.values() {
            total_requests += stats.count;
            total_success += stats.success_count;
            total_failures += stats.failure_count;
        }

        MetricsSummary {
            total_requests,
            total_success,
            total_failures,
            success_rate: if total_requests > 0 {
                total_success as f64 / total_requests as f64
            } else {
                0.0
            },
            endpoint_count: all_stats.len(),
        }
    }

    /// Reset all metrics
    pub fn reset(&self) {
        let mut samples = self.samples.write().unwrap();
        samples.clear();
    }
}

/// Context manager for measuring operation duration
pub struct MetricsContext<'a> {
    collector: &'a MetricsCollector,
    endpoint: String,
    start_time: Instant,
    success: bool,
}

impl<'a> MetricsContext<'a> {
    /// Create a new metrics context
    pub fn new(collector: &'a MetricsCollector, endpoint: &str) -> Self {
        Self {
            collector,
            endpoint: endpoint.to_string(),
            start_time: Instant::now(),
            success: false,
        }
    }

    /// Mark the operation as successful
    pub fn mark_success(&mut self) {
        self.success = true;
    }

    /// Record the metric
    pub fn record(self) {
        let duration_ms = self.start_time.elapsed().as_secs_f64() * 1000.0;
        self.collector.record(&self.endpoint, duration_ms, self.success);
    }
}

impl<'a> Drop for MetricsContext<'a> {
    fn drop(&mut self) {
        let duration_ms = self.start_time.elapsed().as_secs_f64() * 1000.0;
        self.collector.record(&self.endpoint, duration_ms, self.success);
    }
}