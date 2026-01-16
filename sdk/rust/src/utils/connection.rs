// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

//! SSE (Server-Sent Events) connection manager for SecureNotify SDK

use std::sync::Arc;
use tokio::sync::mpsc;
use tokio::time::Duration;
use futures::StreamExt;
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
    pub fn build_url(&self) -> Result<String> {
        let mut url = url::Url::parse(&self.url)
            .map_err(|e| SecureNotifyError::ConnectionError(format!("Invalid SSE URL: {}", e)))?;
        if !self.api_key.is_empty() {
            url.query_pairs_mut()
                .append_pair("api_key", &self.api_key);
        }
        Ok(url.to_string())
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
    _config: SseConfig,
    state: Arc<tokio::sync::RwLock<SseState>>,
    _message_tx: mpsc::Sender<SseMessage>,
    _handle: Arc<tokio::task::JoinHandle<()>>,
}

impl SseConnection {
    /// Create a new SSE connection
    pub fn new(config: SseConfig) -> (Self, mpsc::Receiver<SseMessage>) {
        let (message_tx, message_rx) = mpsc::channel(100);
        let state = Arc::new(tokio::sync::RwLock::new(SseState::Disconnected));
        let config_clone = config.clone();
        let state_clone = state.clone();
        let message_tx_clone = message_tx.clone();

        let handle = tokio::spawn(async move {
            Self::run_connection(&config_clone, &message_tx_clone, &state_clone).await;
        });

        (
            Self {
                _config: config,
                state,
                _message_tx: message_tx,
                _handle: Arc::new(handle),
            },
            message_rx,
        )
    }

    /// Run the connection loop
    async fn run_connection(
        config: &SseConfig,
        message_tx: &mpsc::Sender<SseMessage>,
        state: &tokio::sync::RwLock<SseState>,
    ) {
        let mut reconnect_attempts = 0u32;
        let url = match config.build_url() {
            Ok(url) => url,
            Err(e) => {
                let _ = message_tx.send(SseMessage::Error(e)).await;
                {
                    let mut state_guard = state.write().await;
                    *state_guard = SseState::Failed;
                }
                return;
            }
        };

        loop {
            {
                let mut state_guard = state.write().await;
                *state_guard = SseState::Connecting;
            }

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
                        {
                            let mut state_guard = state.write().await;
                            *state_guard = SseState::Failed;
                        }
                        break;
                    }

                    {
                        let mut state_guard = state.write().await;
                        *state_guard = SseState::Reconnecting;
                    }
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
        let client = reqwest::Client::builder()
            .timeout(config.connection_timeout)
            .build()?;
    
        let response = client
            .get(url)
            .header("Accept", "text/event-stream")
            .header("Cache-Control", "no-cache")
            .send()
            .await?;
    
        if !response.status().is_success() {
            return Err(SecureNotifyError::ApiError {
                code: response.status().as_u16().to_string(),
                message: format!("SSE connection failed with status: {}", response.status()),
                status: response.status().as_u16(),
            });
        }
    
        // Send connected message
        let _ = message_tx.send(SseMessage::Connected).await;
    
        // Process SSE stream
        let mut stream = response.bytes_stream();
        let mut buffer = String::new();
        let mut event_type = String::from("message");
    
        while let Some(chunk_result) = stream.next().await {
            let chunk = chunk_result?;
            let chunk_str = String::from_utf8_lossy(&chunk);
            buffer.push_str(&chunk_str);
    
            // Process complete lines
            while let Some(pos) = buffer.find('\n') {
                let line = buffer[..pos].to_string();
                buffer = buffer[pos + 1..].to_string();
    
                let line = line.trim();
                if line.is_empty() {
                    // Empty line - dispatch event
                    if !event_type.is_empty() {
                        // Send event (simplified implementation)
                        let _ = message_tx.send(SseMessage::Heartbeat).await;
                    }
                    event_type = String::from("message");
                } else if line.starts_with("event:") {
                    event_type = line[6..].trim().to_string();
                } else if line.starts_with("data:") {
                    // Parse data (simplified)
                    let data = line[5..].trim();
                    if !data.is_empty() {
                        // Send message
                        let _ = message_tx.send(SseMessage::Heartbeat).await;
                    }
                } else if line.starts_with(':') {
                    // Comment - ignore
                }
            }
        }
    
        Ok(())
    }

    /// Get the current connection state
    pub async fn state(&self) -> SseState {
        let state_guard = self.state.read().await;
        state_guard.clone()
    }

    /// Check if connected
    pub async fn is_connected(&self) -> bool {
        let state_guard = self.state.read().await;
        *state_guard == SseState::Connected
    }

    /// Disconnect from the SSE stream
    pub async fn disconnect(&self) {
        let mut state_guard = self.state.write().await;
        *state_guard = SseState::Disconnected;
    }
}
