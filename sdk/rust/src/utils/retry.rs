// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

use std::time::Duration;
use rand::Rng;
use rand::rngs::OsRng;
use crate::{SecureNotifyError, Result};

#[derive(Debug, Clone)]
pub struct RetryConfig {
    pub max_retries: u32,
    pub initial_delay: Duration,
    pub max_delay: Duration,
    pub backoff_multiplier: f64,
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
    pub fn new() -> Self {
        Self::default()
    }

    pub fn with_max_retries(mut self, max_retries: u32) -> Self {
        self.max_retries = max_retries;
        self
    }

    pub fn with_initial_delay(mut self, delay: Duration) -> Self {
        self.initial_delay = delay;
        self
    }

    pub fn with_max_delay(mut self, delay: Duration) -> Self {
        self.max_delay = delay;
        self
    }

    pub fn with_backoff_multiplier(mut self, multiplier: f64) -> Self {
        self.backoff_multiplier = multiplier;
        self
    }

    pub fn with_jitter(mut self, jitter: bool) -> Self {
        self.jitter = jitter;
        self
    }
}

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

                    let actual_delay = if config.jitter {
                        let jitter_range = delay.as_millis() as f64 * 0.1;
                        // Use OsRng for cryptographically secure random jitter
                        let jitter = OsRng.gen_range(-jitter_range..jitter_range);
                        delay + Duration::from_millis(jitter.abs() as u64)
                    } else {
                        delay
                    };

                    tokio::time::sleep(actual_delay).await;

                    let delay_secs = (delay.as_secs_f64() * config.backoff_multiplier)
                        .min(config.max_delay.as_secs_f64());
                    delay = Duration::from_secs_f64(delay_secs);
                } else {
                    return Err(error);
                }
            }
        }
    }

    // biome-ignore lint: last_error is guaranteed to be Some here if we reach this point
    Err(last_error.unwrap_or_else(|| {
        SecureNotifyError::ConnectionError("Retry exhausted without error".to_string())
    }))
}

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

pub fn calculate_backoff(
    attempt: u32,
    config: &RetryConfig,
) -> Duration {
    let delay = config.initial_delay.as_secs_f64()
        * config.backoff_multiplier.powi(attempt as i32);

    Duration::from_secs_f64(delay).min(config.max_delay)
}
