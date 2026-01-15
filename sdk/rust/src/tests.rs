// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

#[cfg(test)]
mod tests {
    use crate::{SecureNotifyClient, SecureNotifyError};
    use crate::MessagePriority;
    use crate::ChannelType;
    use crate::EncryptionAlgorithm;
    use crate::ConnectionState;
    use tokio::time::Duration;

    #[tokio::test]
    async fn test_client_builder() {
        let client = SecureNotifyClient::builder()
            .base_url("https://api.example.com")
            .api_key("test-key")
            .timeout(Duration::from_secs(10))
            .max_retries(2)
            .build();

        assert!(client.is_ok());
        let client = client.unwrap();
        assert_eq!(client.base_url(), "https://api.example.com");
    }

    #[tokio::test]
    async fn test_client_builder_without_api_key() {
        let client = SecureNotifyClient::builder()
            .base_url("https://api.example.com")
            .build();

        assert!(client.is_err());
        match client {
            Err(SecureNotifyError::AuthError(msg)) => {
                assert!(msg.contains("API key"));
            }
            _ => panic!("Expected AuthError"),
        }
    }

    #[test]
    fn test_message_priority() {
        assert_eq!(MessagePriority::Critical.value(), 100);
        assert_eq!(MessagePriority::High.value(), 75);
        assert_eq!(MessagePriority::Normal.value(), 50);
        assert_eq!(MessagePriority::Low.value(), 25);
        assert_eq!(MessagePriority::Bulk.value(), 0);

        assert_eq!(MessagePriority::from_value(100), MessagePriority::Critical);
        assert_eq!(MessagePriority::from_value(75), MessagePriority::High);
        assert_eq!(MessagePriority::from_value(50), MessagePriority::Normal);
        assert_eq!(MessagePriority::from_value(25), MessagePriority::Low);
        assert_eq!(MessagePriority::from_value(0), MessagePriority::Bulk);
    }

    #[test]
    fn test_channel_type() {
        assert_eq!(ChannelType::Public.as_str(), "public");
        assert_eq!(ChannelType::Encrypted.as_str(), "encrypted");
        assert_eq!(ChannelType::Temporary.as_str(), "temporary");
    }

    #[test]
    fn test_encryption_algorithm() {
        assert_eq!(EncryptionAlgorithm::Rsa2048.as_str(), "RSA-2048");
        assert_eq!(EncryptionAlgorithm::Rsa4096.as_str(), "RSA-4096");
        assert_eq!(
            EncryptionAlgorithm::EccSecp256K1.as_str(),
            "ECC-SECP256K1"
        );
    }

    #[test]
    fn test_connection_state() {
        assert_eq!(ConnectionState::Disconnected.as_str(), "disconnected");
        assert_eq!(ConnectionState::Connecting.as_str(), "connecting");
        assert_eq!(ConnectionState::Connected.as_str(), "connected");
        assert_eq!(ConnectionState::Reconnecting.as_str(), "reconnecting");
    }

    #[test]
    fn test_error_types() {
        let api_error = SecureNotifyError::ApiError {
            code: "INVALID_KEY".to_string(),
            message: "The key is invalid".to_string(),
            status: 400,
        };
        assert!(api_error.is_api_error());
        assert_eq!(api_error.code(), "INVALID_KEY");
        assert_eq!(api_error.status(), 400);

        let network_error = SecureNotifyError::NetworkError("Connection refused".to_string());
        assert!(network_error.is_network_error());
        assert!(network_error.code().starts_with("NETWORK_ERROR"));

        let timeout_error = SecureNotifyError::TimeoutError("Request timed out".to_string());
        assert!(timeout_error.code().starts_with("TIMEOUT_ERROR"));
    }
}
