"""Unit tests for managers."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime

from securenotify.managers.key_manager import KeyManager
from securenotify.managers.channel_manager import ChannelManager
from securenotify.managers.publish_manager import PublishManager
from securenotify.managers.apikey_manager import ApiKeyManager
from securenotify.managers.subscribe_manager import SubscribeManager

from securenotify.utils.http import HttpClient
from securenotify.utils.connection import SSEClient, ConnectionState
from securenotify.utils.retry import RetryConfig


class TestKeyManager:
    """Tests for KeyManager."""

    @pytest.fixture
    def mock_http(self):
        """Create mock HTTP client."""
        return MagicMock(spec=HttpClient)

    @pytest.fixture
    def key_manager(self, mock_http):
        """Create KeyManager instance."""
        from securenotify.utils.retry import RetryConfig
        retry_config = RetryConfig(max_retries=3, initial_delay=1.0, max_delay=30.0, backoff_multiplier=2.0)
        return KeyManager(mock_http, retry_config)

    @pytest.mark.asyncio
    async def test_register(self, key_manager, mock_http):
        """Test public key registration."""
        mock_http.register_public_key = AsyncMock(return_value=MagicMock(
            key_id="key-123",
            channel_id="channel-456"
        ))

        result = await key_manager.register(
            public_key="-----BEGIN PUBLIC KEY-----",
            algorithm="RSA-4096"
        )

        assert result.key_id == "key-123"
        mock_http.register_public_key.assert_called_once()

    @pytest.mark.asyncio
    async def test_get(self, key_manager, mock_http):
        """Test getting public key info."""
        mock_http.get_public_key = AsyncMock(return_value={
            "id": "key-123",
            "channel_id": "channel-456",
            "public_key": "-----BEGIN PUBLIC KEY-----",
            "algorithm": "RSA-4096",
            "created_at": "2024-01-01T00:00:00Z"
        })

        result = await key_manager.get("key-123")

        assert result.id == "key-123"
        assert result.algorithm == "RSA-4096"

    @pytest.mark.asyncio
    async def test_list(self, key_manager, mock_http):
        """Test listing public keys."""
        mock_http.list_public_keys = AsyncMock(return_value={
            "keys": [
                {"id": "key-1", "channel_id": "ch-1", "public_key": "pk-1",
                 "algorithm": "RSA-4096", "created_at": "2024-01-01T00:00:00Z"},
                {"id": "key-2", "channel_id": "ch-2", "public_key": "pk-2",
                 "algorithm": "RSA-2048", "created_at": "2024-01-02T00:00:00Z"}
            ]
        })

        result = await key_manager.list()

        assert len(result) == 2
        assert result[0].id == "key-1"
        assert result[1].id == "key-2"

    @pytest.mark.asyncio
    async def test_revoke(self, key_manager, mock_http):
        """Test revoking a public key."""
        mock_http.revoke_public_key = AsyncMock(return_value={"success": True})

        result = await key_manager.revoke("key-123", reason="Compromised")

        assert result["success"] is True
        mock_http.revoke_public_key.assert_called_once_with("key-123", "Compromised")


class TestChannelManager:
    """Tests for ChannelManager."""

    @pytest.fixture
    def mock_http(self):
        """Create mock HTTP client."""
        return MagicMock(spec=HttpClient)

    @pytest.fixture
    def channel_manager(self, mock_http):
        """Create ChannelManager instance."""
        from securenotify.utils.retry import RetryConfig
        retry_config = RetryConfig(max_retries=3, initial_delay=1.0, max_delay=30.0, backoff_multiplier=2.0)
        return ChannelManager(mock_http, retry_config)

    @pytest.mark.asyncio
    async def test_create(self, channel_manager, mock_http):
        """Test channel creation."""
        from securenotify.types.api import ChannelType
        mock_http.create_channel = AsyncMock(return_value=MagicMock(
            channel_id="channel-123",
            name="my-channel",
            channel_type=ChannelType.ENCRYPTED
        ))

        result = await channel_manager.create(
            name="my-channel",
            channel_type=ChannelType.ENCRYPTED
        )

        assert result.channel_id == "channel-123"
        mock_http.create_channel.assert_called_once()

    @pytest.mark.asyncio
    async def test_get(self, channel_manager, mock_http):
        """Test getting channel info."""
        mock_http.get_channel = AsyncMock(return_value={
            "id": "channel-123",
            "name": "my-channel",
            "type": "encrypted",
            "description": "Test channel",
            "creator": "user-1",
            "created_at": "2024-01-01T00:00:00Z",
            "is_active": True
        })

        result = await channel_manager.get("channel-123")

        assert result.id == "channel-123"
        assert result.name == "my-channel"
        assert result.is_active is True


class TestPublishManager:
    """Tests for PublishManager."""

    @pytest.fixture
    def mock_http(self):
        """Create mock HTTP client."""
        return MagicMock(spec=HttpClient)

    @pytest.fixture
    def publish_manager(self, mock_http):
        """Create PublishManager instance."""
        from securenotify.utils.retry import RetryConfig
        retry_config = RetryConfig(max_retries=3, initial_delay=1.0, max_delay=30.0, backoff_multiplier=2.0)
        return PublishManager(mock_http, retry_config)

    @pytest.mark.asyncio
    async def test_send(self, publish_manager, mock_http):
        """Test sending a message."""
        from securenotify.types.api import MessagePriority
        mock_http.publish_message = AsyncMock(return_value=MagicMock(
            message_id="msg-123",
            channel="channel-456"
        ))

        result = await publish_manager.send(
            channel="channel-456",
            message="Hello, World!",
            priority=MessagePriority.NORMAL
        )

        assert result.message_id == "msg-123"
        mock_http.publish_message.assert_called_once()

    @pytest.mark.asyncio
    async def test_send_critical(self, publish_manager, mock_http):
        """Test sending critical priority message."""
        mock_http.publish_message = AsyncMock(return_value=MagicMock(
            message_id="msg-123",
            channel="channel-456"
        ))

        result = await publish_manager.send_critical(
            channel="channel-456",
            message="Critical alert!"
        )

        assert result.message_id == "msg-123"

    @pytest.mark.asyncio
    async def test_get_queue_status(self, publish_manager, mock_http):
        """Test getting queue status."""
        mock_http.get_queue_status = AsyncMock(return_value={
            "channel": "channel-456",
            "pending_count": 5,
            "priority_counts": {"critical": 1, "high": 2, "normal": 2}
        })

        result = await publish_manager.get_queue_status("channel-456")

        assert result.pending_count == 5
        assert result.priority_counts["critical"] == 1


class TestApiKeyManager:
    """Tests for ApiKeyManager."""

    @pytest.fixture
    def mock_http(self):
        """Create mock HTTP client."""
        return MagicMock(spec=HttpClient)

    @pytest.fixture
    def api_key_manager(self, mock_http):
        """Create ApiKeyManager instance."""
        from securenotify.utils.retry import RetryConfig
        retry_config = RetryConfig(max_retries=3, initial_delay=1.0, max_delay=30.0, backoff_multiplier=2.0)
        return ApiKeyManager(mock_http, retry_config)

    @pytest.mark.asyncio
    async def test_create(self, api_key_manager, mock_http):
        """Test API key creation."""
        mock_http.create_api_key = AsyncMock(return_value=MagicMock(
            key_id="key-123",
            key="sk_test_...",
            key_prefix="sk_test",
            name="My Key",
            permissions=["publish", "subscribe"]
        ))

        result = await api_key_manager.create(
            name="My Key",
            permissions=["publish", "subscribe"]
        )

        assert result.key_id == "key-123"
        assert result.key_prefix == "sk_test"

    @pytest.mark.asyncio
    async def test_list(self, api_key_manager, mock_http):
        """Test listing API keys."""
        mock_http.list_api_keys = AsyncMock(return_value={
            "keys": [
                {"id": "key-1", "key_prefix": "sk_test", "name": "Key 1",
                 "permissions": ["publish"], "is_active": True,
                 "created_at": "2024-01-01T00:00:00Z"},
            ]
        })

        result = await api_key_manager.list()

        assert len(result) == 1
        assert result[0].name == "Key 1"


class TestSubscribeManager:
    """Tests for SubscribeManager."""

    @pytest.fixture
    def mock_sse(self):
        """Create mock SSE client."""
        return MagicMock(spec=SSEClient)

    @pytest.fixture
    def subscribe_manager(self, mock_sse):
        """Create SubscribeManager instance."""
        return SubscribeManager(mock_sse)

    def test_is_connected_property(self, subscribe_manager, mock_sse):
        """Test is_connected property."""
        mock_sse.is_connected = True
        assert subscribe_manager.is_connected is True

        mock_sse.is_connected = False
        assert subscribe_manager.is_connected is False

    def test_set_reconnect_config(self, subscribe_manager, mock_sse):
        """Test setting reconnect configuration."""
        subscribe_manager.set_reconnect_config(
            reconnect_delay=5.0,
            max_attempts=15
        )

        assert mock_sse.reconnect_delay == 5.0
        assert mock_sse.max_reconnect_attempts == 15

    def test_connection_state_property(self, subscribe_manager, mock_sse):
        """Test connection_state property."""
        mock_sse.state = ConnectionState.CONNECTED
        assert subscribe_manager.connection_state == ConnectionState.CONNECTED
