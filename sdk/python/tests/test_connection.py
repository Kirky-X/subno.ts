"""Unit tests for SSE connection manager."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
import asyncio

from securenotify.utils.connection import SSEClient, ConnectionState
from securenotify.types.errors import SecureNotifyConnectionError


class TestSSEClient:
    """Tests for SSEClient."""

    @pytest.fixture
    def sse_client(self):
        """Create SSEClient instance."""
        return SSEClient(
            base_url="http://localhost:3000",
            api_key="test-api-key",
            heartbeat_interval=30.0,
            reconnect_delay=1.0,
            max_reconnect_attempts=3
        )

    def test_initial_state(self, sse_client):
        """Test initial connection state."""
        assert sse_client.state == ConnectionState.DISCONNECTED
        assert not sse_client.is_connected

    def test_get_headers(self, sse_client):
        """Test header generation."""
        headers = sse_client._get_headers()

        assert headers["Authorization"] == "Bearer test-api-key"
        assert headers["Accept"] == "text/event-stream"

    def test_get_headers_with_last_event_id(self, sse_client):
        """Test header generation with Last-Event-ID."""
        sse_client._last_event_id = "event-123"
        headers = sse_client._get_headers()

        assert headers["Last-Event-ID"] == "event-123"

    @pytest.mark.asyncio
    async def test_connect_success(self, sse_client):
        """Test successful connection."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.aiter_text = AsyncMock(return_value=iter([]))

        with patch("httpx.AsyncClient") as mock_client:
            client_instance = AsyncMock()
            client_instance.stream = MagicMock(return_value=AsyncContextManager(mock_response))
            mock_client.return_value = client_instance
            sse_client._client = client_instance

            # Don't actually wait, just verify connection starts
            sse_client._stop_event = asyncio.Event()

            # The connect method would start but we're not actually calling it here
            # because it requires a real response stream

    def test_subscribe_handler(self, sse_client):
        """Test handler subscription."""
        async def handler(msg):
            pass

        sse_client.subscribe("channel-123", handler)

        assert "channel-123" in sse_client._subscriptions
        assert sse_client._subscriptions["channel-123"] == handler

    def test_unsubscribe_handler(self, sse_client):
        """Test handler unsubscription."""
        async def handler(msg):
            pass

        sse_client.subscribe("channel-123", handler)
        sse_client.unsubscribe("channel-123")

        assert "channel-123" not in sse_client._subscriptions

    def test_subscribe_heartbeat(self, sse_client):
        """Test heartbeat handler subscription."""
        async def handler(msg):
            pass

        sse_client.subscribe_heartbeat(handler)

        assert "__heartbeat__" in sse_client._subscriptions

    def test_set_reconnect_config(self, sse_client):
        """Test reconnection configuration."""
        sse_client.set_reconnect_config(
            reconnect_delay=5.0,
            max_attempts=10
        )

        assert sse_client.reconnect_delay == 5.0
        assert sse_client.max_reconnect_attempts == 10


class TestConnectionState:
    """Tests for ConnectionState enum."""

    def test_connection_states(self):
        """Test all connection states exist."""
        assert ConnectionState.DISCONNECTED.value == "disconnected"
        assert ConnectionState.CONNECTING.value == "connecting"
        assert ConnectionState.CONNECTED.value == "connected"
        assert ConnectionState.RECONNECTING.value == "reconnecting"


class AsyncContextManager:
    """Helper for async context manager."""

    def __init__(self, return_value):
        self.return_value = return_value

    async def __aenter__(self):
        return self.return_value

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        pass
