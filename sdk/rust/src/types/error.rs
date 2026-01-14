// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

//! Error types for SecureNotify SDK

use thiserror::Error;
use crate::SecureNotifyError;

/// Convert from reqwest errors
impl From<reqwest::Error> for SecureNotifyError {
    fn from(e: reqwest::Error) -> Self {
        if e.is_timeout() {
            Self::TimeoutError(e.to_string())
        } else if e.is_connectivity() {
            Self::ConnectionError(e.to_string())
        } else if e.is_status() {
            let status = e.status().unwrap_or(reqwest::StatusCode::INTERNAL_SERVER_ERROR);
            let code = status.as_u16().to_string();
            let message = e.to_string();
            Self::ApiError {
                code,
                message,
                status: status.as_u16(),
            }
        } else {
            Self::NetworkError(e.to_string())
        }
    }
}

/// Convert from serde_json errors
impl From<serde_json::Error> for SecureNotifyError {
    fn from(e: serde_json::Error) -> Self {
        Self::SerializationError(e.to_string())
    }
}

/// Convert from url parsing errors
impl From<url::ParseError> for SecureNotifyError {
    fn from(e: url::ParseError) -> Self {
        Self::ConnectionError(format!("URL parsing error: {}", e))
    }
}

/// Convert from std::io errors
impl From<std::io::Error> for SecureNotifyError {
    fn from(e: std::io::Error) -> Self {
        Self::ConnectionError(e.to_string())
    }
}

/// Convert from tokio::time::Elapsed error
impl From<tokio::time::error::Elapsed> for SecureNotifyError {
    fn from(_: tokio::time::error::Elapsed) -> Self {
        Self::TimeoutError("Request timed out".to_string())
    }
}

/// Result type for manager operations
pub type ManagerResult<T> = std::result::Result<T, ManagerError>;

/// Manager-level errors
#[derive(Debug, Error)]
pub enum ManagerError {
    #[error("Key manager error: {0}")]
    KeyManager(String),

    #[error("Channel manager error: {0}")]
    ChannelManager(String),

    #[error("Publish manager error: {0}")]
    PublishManager(String),

    #[error("Subscribe manager error: {0}")]
    SubscribeManager(String),

    #[error("API key manager error: {0}")]
    ApiKeyManager(String),
}

impl From<ManagerError> for SecureNotifyError {
    fn from(e: ManagerError) -> Self {
        match e {
            ManagerError::KeyManager(msg) => {
                Self::ApiError {
                    code: "KEY_MANAGER_ERROR".to_string(),
                    message: msg,
                    status: 500,
                }
            }
            ManagerError::ChannelManager(msg) => {
                Self::ApiError {
                    code: "CHANNEL_MANAGER_ERROR".to_string(),
                    message: msg,
                    status: 500,
                }
            }
            ManagerError::PublishManager(msg) => {
                Self::ApiError {
                    code: "PUBLISH_MANAGER_ERROR".to_string(),
                    message: msg,
                    status: 500,
                }
            }
            ManagerError::SubscribeManager(msg) => {
                Self::ApiError {
                    code: "SUBSCRIBE_MANAGER_ERROR".to_string(),
                    message: msg,
                    status: 500,
                }
            }
            ManagerError::ApiKeyManager(msg) => {
                Self::ApiError {
                    code: "API_KEY_MANAGER_ERROR".to_string(),
                    message: msg,
                    status: 500,
                }
            }
        }
    }
}

/// HTTP status codes that indicate retryable errors
pub fn is_retryable_status(status: u16) -> bool {
    matches!(
        status,
        429 | 500 | 502 | 503 | 504
    )
}

/// Check if an error is retryable
pub fn is_retryable_error(error: &SecureNotifyError) -> bool {
    match error {
        SecureNotifyError::NetworkError(_) => true,
        SecureNotifyError::ConnectionError(_) => true,
        SecureNotifyError::TimeoutError(_) => true,
        SecureNotifyError::ApiError { status, .. } => is_retryable_status(*status),
        _ => false,
    }
}
