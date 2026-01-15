// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

//! Retry utilities for SecureNotify SDK

use std::time::Duration;
use crate::{SecureNotifyError, Result};

/// Retry configuration
#[derive(Debug, Clone)]
pub struct RetryConfig {
    /// Maximum number of retry attempts
    pub max_retries: u32,
    /// Initial delay before the first retry
    pub initial_delay: Duration,
    /// Maximum delay between retries
    pub max_delay: Duration,
    /// Multiplier for exponential backoff
    pub backoff_multiplier: f64,
    /// Whether to add random jitter to delays
    pub jitter: bool,
}

impl Default for RetryConfig {
    fn default() -> Self {
        Self {
            max_retries: 3,
            initial_delay: Duration::from_secs(1),
            max_delay: Duration::from_secs(30),
            backoff_multiplier: 2.0,
            jitter: true,
        }
    }
}

impl RetryConfig {
    /// Create a new retry configuration with default values
    pub fn new() -> Self {
        Self::default()
    }

    /// Set the maximum number of retries
    pub fn with_max_retries(mut self, max_retries: u32) -> Self {
        self.max_retries = max_retries;
        self
    }

    /// Set the initial delay
    pub fn with_initial_delay(mut self, delay: Duration) -> Self {
        self.initial_delay = delay;
        self
    }

    /// Set the maximum delay
    pub fn with_max_delay(mut self, delay: Duration) -> Self {
        self.max_delay = delay;
        self
    }

    /// Set the backoff multiplier
    pub fn with_backoff_multiplier(mut self, multiplier: f64) -> Self {
        self.backoff_multiplier = multiplier;
        self
    }

    /// Enable or disable jitter
    pub fn with_jitter(mut self, jitter: bool) -> Self {
        self.jitter = jitter;
        self
    }
}

/// Execute an async operation with retry logic
pub async fn with_retry<T, F, Fut>(
    operation: F,
    config: &RetryConfig,
) -> Result<T>
where
    F: Fn(u32) -> Fut,
    Fut: std::future::Future<Output = Result<T>>,
{
    let mut last_error: Option<SecureNotifyError> = None;
    let mut delay = config.initial_delay;

    for attempt in 0..=config.max_retries {
        match operation(attempt).await {
            Ok(result) => return Ok(result),
            Err(error) => {
                if attempt < config.max_retries && is_retryable(&error) {
                    last_error = Some(error);

                    // Add jitter if enabled
                    let actual_delay = if config.jitter {
                        let jitter_range = delay.as_millis() as f64 * 0.1;
                        let jitter = rand::random::<f64>() * jitter_range;
                        delay + Duration::from_millis(jitter as u64)
                    } else {
                        delay
                    };

                    tokio::time::sleep(actual_delay).await;

                    // Exponential backoff
                    let delay_secs = (delay.as_secs_f64() * config.backoff_multiplier)
                        .min(config.max_delay.as_secs_f64());
                    delay = Duration::from_secs_f64(delay_secs);
                } else {
                    return Err(error);
                }
            }
        }
    }

    // biome-ignore lint: last_error is guaranteed to be Some here
    Err(last_error.unwrap())
}

/// Check if an error is retryable
fn is_retryable(error: &SecureNotifyError) -> bool {
    match error {
        SecureNotifyError::NetworkError(_) => true,
        SecureNotifyError::ConnectionError(_) => true,
        SecureNotifyError::TimeoutError(_) => true,
        SecureNotifyError::ApiError { status, .. } => {
            matches!(status, 429 | 500 | 502 | 503 | 504)
        }
        _ => false,
    }
}

/// Calculate the next delay with exponential backoff
pub fn calculate_backoff(
    attempt: u32,
    config: &RetryConfig,
) -> Duration {
    let delay = config.initial_delay.as_secs_f64()
        * config.backoff_multiplier.powi(attempt as i32);

    Duration::from_secs_f64(delay).min(config.max_delay)
}
