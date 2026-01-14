// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

//! Utility modules for SecureNotify SDK

pub mod http;
pub mod retry;
pub mod connection;

pub use http::{HttpClient, HttpClientConfig};
pub use retry::{RetryConfig, with_retry, calculate_backoff};
pub use connection::{SseConnection, SseConfig, SseMessage, SseState};
