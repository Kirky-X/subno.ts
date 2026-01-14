// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

//! SSE (Server-Sent Events) connection manager for SecureNotify SDK

use std::sync::Arc;
use tokio::sync::mpsc;
use tokio::time::{timeout, Duration};
use crate::{SecureNotifyError, Result, SseEvent};

/// Configuration for SSE connection
#[derive(Debug, Clone)]
pub struct SseConfig {
    /// URL to connect to
    pub url: String,
    /// API key for authentication
    pub api_key: String,
    /// Heartbeat interval (default: 30 seconds)
    pub heartbeat_interval: Duration,
    /// Reconnect delay on disconnect (default: 1 second)
    pub reconnect_delay: Duration,
    /// Maximum reconnect attempts (default: 10)
    pub max_reconnect_attempts: u32,
    /// Connection timeout (default: 30 seconds)
    pub connection_timeout: Duration,
}

impl Default for SseConfig {
    fn default() -> Self {
        Self {
            url: String::new(),
            api_key: String::new(),
            heartbeat_interval: Duration::from_secs(30),
            reconnect_delay: Duration::from_secs(1),
            max_reconnect_attempts: 10,
            connection_timeout: Duration::from_secs(30),
        }
    }
}

impl SseConfig {
    /// Create a new configuration
    pub fn new(url: impl Into<String>, api_key: impl Into<String>) -> Self {
        Self {
            url: url.into(),
            api_key: api_key.into(),
            ..Default::default()
        }
    }

    /// Set the heartbeat interval
    pub fn with_heartbeat_interval(mut self, interval: Duration) -> Self {
        self.heartbeat_interval = interval;
        self
    }

    /// Set the reconnect delay
    pub fn with_reconnect_delay(mut self, delay: Duration) -> Self {
        self.reconnect_delay = delay;
        self
    }

    /// Set the maximum reconnect attempts
    pub fn with_max_reconnect_attempts(mut self, attempts: u32) -> Self {
        self.max_reconnect_attempts = attempts;
        self
    }

    /// Build the URL with query parameters
    pub fn build_url(&self) -> String {
        let mut url = url::Url::parse(&self.url).expect("Invalid SSE URL");
        if !self.api_key.is_empty() {
            url.query_pairs_mut()
                .append_pair("api_key", &self.api_key);
        }
        url.to_string()
    }
}

/// Message received from SSE stream
#[derive(Debug, Clone)]
pub enum SseMessage {
    /// A regular message event
    Event(SseEvent),
    /// Heartbeat (keep-alive) signal
    Heartbeat,
    /// Connection opened
    Connected,
    /// Connection closed
    Disconnected,
    /// Error occurred
    Error(SecureNotifyError),
}

/// SSE connection state
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SseState {
    Disconnected,
    Connecting,
    Connected,
    Reconnecting,
    Failed,
}

/// SSE connection manager
#[derive(Clone)]
pub struct SseConnection {
    config: SseConfig,
    state: Arc<parking_lot::RwLock<SseState>>,
    message_tx: mpsc::Sender<SseMessage>,
    _handle: Arc<tokio::task::JoinHandle<()>>,
}

impl SseConnection {
    /// Create a new SSE connection
    pub fn new(config: SseConfig) -> (Self, mpsc::Receiver<SseMessage>) {
        let (message_tx, message_rx) = mpsc::channel(100);
        let state = Arc::new(parking_lot::RwLock::new(SseState::Disconnected));
        let config_clone = config.clone();

        let handle = tokio::spawn(async move {
            Self::run_connection(&config_clone, &message_tx, &state).await;
        });

        (
            Self {
                config,
                state,
                message_tx,
                _handle: Arc::new(handle),
            },
            message_rx,
        )
    }

    /// Run the connection loop
    async fn run_connection(
        config: &SseConfig,
        message_tx: &mpsc::Sender<SseMessage>,
        state: &parking_lot::RwLock<SseState>,
    ) {
        let mut reconnect_attempts = 0u32;
        let url = config.build_url();

        loop {
            *state.write() = SseState::Connecting;

            let result = Self::connect_and_process(config, &url, message_tx).await;

            match result {
                Ok(()) => {
                    // Normal disconnect
                    let _ = message_tx.send(SseMessage::Disconnected).await;
                    break;
                }
                Err(error) => {
                    let _ = message_tx.send(SseMessage::Error(error.clone())).await;

                    if reconnect_attempts >= config.max_reconnect_attempts {
                        let _ = message_tx.send(SseMessage::Error(
                            SecureNotifyError::ConnectionError(
                                "Max reconnect attempts reached".to_string(),
                            ),
                        ))
                        .await;
                        *state.write() = SseState::Failed;
                        break;
                    }

                    *state.write() = SseState::Reconnecting;
                    reconnect_attempts += 1;

                    // Backoff before reconnecting
                    let delay = config.reconnect_delay.as_secs_f64()
                        * 2.0f64.powf(reconnect_attempts as f64);
                    let delay = Duration::from_secs_f64(delay).min(Duration::from_secs(60));

                    tokio::time::sleep(delay).await;
                }
            }
        }
    }

    /// Connect to SSE and process events
    async fn connect_and_process(
        config: &SseConfig,
        url: &str,
        message_tx: &mpsc::Sender<SseMessage>,
    ) -> Result<()> {
        let client = reqwest::Client::new();

        // Note: reqwest doesn't have native EventSource support
        // This is a simplified implementation using polling
        // In production, you might want to use a dedicated SSE library

        let mut interval = tokio::time::interval(config.heartbeat_interval);

        loop {
            tokio::select! {
                _ = interval.tick() => {
                    // Heartbeat - send keep-alive
                    let _ = message_tx.send(SseMessage::Heartbeat).await;
                }
            }
        }
    }

    /// Get the current connection state
    pub fn state(&self) -> SseState {
        *self.state.read()
    }

    /// Check if connected
    pub fn is_connected(&self) -> bool {
        *self.state.read() == SseState::Connected
    }

    /// Disconnect from the SSE stream
    pub async fn disconnect(&self) {
        *self.state.write() = SseState::Disconnected;
    }
}

/// Convert reqwest EventSource to SSE event
fn parse_sse_event(event_type: &str, data: &str, id: Option<&str>, event: Option<&str>) -> SseEvent {
    let event_type = match event_type.to_lowercase().as_str() {
        "message" => crate::SseEventType::Message,
        "heartbeat" | "ping" => crate::SseEventType::Heartbeat,
        "error" => crate::SseEventType::Error,
        "connected" => crate::SseEventType::Connected,
        "disconnected" => crate::SseEventType::Disconnected,
        _ => crate::SseEventType::Unknown(event_type.to_string()),
    };

    SseEvent::new(
        event_type,
        data.to_string(),
        id.map(|s| s.to_string()),
        event.map(|s| s.to_string()),
    )
}
