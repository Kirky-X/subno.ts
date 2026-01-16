"""Unit tests for main client."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
import asyncio

from securenotify.client import SecureNotifyClient, SyncSecureNotifyClient
from securenotify.utils.http import HttpClient
from securenotify.utils.connection import SSEClient
from securenotify.utils.retry import RetryConfig


class TestSecureNotifyClient:
    """Tests for SecureNotifyClient."""

    @pytest.fixture
    def client(self):
        """Create client instance."""
        return SecureNotifyClient(
            base_url="https://localhost:3000", api_key="test-api-key"
        )

    def test_initialization(self, client):
        """Test client initialization."""
        assert client.base_url == "https://localhost:3000"
        assert client.api_key == "test-api-key"
        assert client.timeout == 30.0
        assert client._closed is False

    def test_custom_initialization(self, client):
        """Test client initialization with custom values."""
        retry_config = RetryConfig(max_retries=5)

        client = SecureNotifyClient(
            base_url="https://api.example.com",
            api_key="my-api-key",
            timeout=60.0,
            verify=False,
            retry_config=retry_config,
            heartbeat_interval=60.0,
            sse_timeout=120.0,
        )

        assert client.base_url == "https://api.example.com"
        assert client.timeout == 60.0
        assert client.verify is False
        assert client.heartbeat_interval == 60.0
        assert client.sse_timeout == 120.0

    def test_get_http_client(self, client):
        """Test HTTP client lazy initialization."""
        http_client1 = client._get_http_client()
        http_client2 = client._get_http_client()

        assert http_client1 is http_client2

    def test_get_sse_client(self, client):
        """Test SSE client lazy initialization."""
        sse_client1 = client._get_sse_client()
        sse_client2 = client._get_sse_client()

        assert sse_client1 is sse_client2

    def test_get_key_manager(self, client):
        """Test key manager lazy initialization."""
        manager1 = client._get_key_manager()
        manager2 = client._get_key_manager()

        assert manager1 is manager2

    def test_get_channel_manager(self, client):
        """Test channel manager lazy initialization."""
        manager1 = client._get_channel_manager()
        manager2 = client._get_channel_manager()

        assert manager1 is manager2

    def test_get_publish_manager(self, client):
        """Test publish manager lazy initialization."""
        manager1 = client._get_publish_manager()
        manager2 = client._get_publish_manager()

        assert manager1 is manager2

    def test_get_subscribe_manager(self, client):
        """Test subscribe manager lazy initialization."""
        manager1 = client._get_subscribe_manager()
        manager2 = client._get_subscribe_manager()

        assert manager1 is manager2

    def test_get_apikey_manager(self, client):
        """Test API key manager lazy initialization."""
        manager1 = client._get_apikey_manager()
        manager2 = client._get_apikey_manager()

        assert manager1 is manager2

    def test_manager_properties(self, client):
        """Test manager property access."""
        assert client.keys is client._get_key_manager()
        assert client.channels is client._get_channel_manager()
        assert client.publish is client._get_publish_manager()
        assert client.subscribe is client._get_subscribe_manager()
        assert client.apikeys is client._get_apikey_manager()

    @pytest.mark.asyncio
    async def test_aclose_already_closed(self, client):
        """Test aclose when already closed."""
        client._closed = True

        # Should not raise
        await client.aclose()

    @pytest.mark.asyncio
    async def test_aclose_closes_clients(self, client):
        """Test that aclose closes all clients."""
        mock_http = AsyncMock()
        mock_sse = AsyncMock()

        client._http_client = mock_http
        client._sse_client = mock_sse

        await client.aclose()

        mock_sse.disconnect.assert_called_once()
        mock_http.close.assert_called_once()
        assert client._closed is True

    @pytest.mark.asyncio
    async def test_context_manager(self, client):
        """Test async context manager."""
        mock_http = AsyncMock()
        mock_sse = AsyncMock()

        client._http_client = mock_http
        client._sse_client = mock_sse

        async with client as c:
            assert c is client

        mock_sse.disconnect.assert_called_once()
        mock_http.close.assert_called_once()


class TestSyncSecureNotifyClient:
    """Tests for SyncSecureNotifyClient."""

    @pytest.fixture
    def sync_client(self):
        """Create sync client instance."""
        return SyncSecureNotifyClient(
            base_url="https://localhost:3000", api_key="test-api-key"
        )

    def test_initialization(self, sync_client):
        """Test sync client initialization."""
        assert sync_client._async_client.base_url == "https://localhost:3000"
        assert sync_client._async_client.api_key == "test-api-key"

    def test_close(self, sync_client):
        """Test sync close."""
        mock_http = AsyncMock()
        sync_client._async_client._http_client = mock_http

        sync_client.close()

        mock_http.close.assert_called_once()

    def test_context_manager(self, sync_client):
        """Test sync context manager."""
        mock_http = AsyncMock()
        sync_client._async_client._http_client = mock_http

        with sync_client:
            pass

        mock_http.close.assert_called_once()
