"""Unit tests for HTTP client."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from securenotify.utils.http import HttpClient
from securenotify.types.api import (
    RegisterPublicKeyRequest,
    ChannelCreateRequest,
    MessagePublishRequest,
    ChannelType,
    MessagePriority,
)
from securenotify.types.errors import (
    SecureNotifyApiError,
    SecureNotifyConnectionError,
    SecureNotifyTimeoutError,
    ErrorCode,
)


class TestHttpClient:
    """Tests for HttpClient."""

    @pytest.fixture
    def mock_client(self):
        """Create a mock HTTP client."""
        with patch("httpx.AsyncClient") as mock:
            client_instance = AsyncMock()
            mock.return_value = client_instance
            yield client_instance

    @pytest.fixture
    def http_client(self, mock_client):
        """Create HttpClient instance with mocked client."""
        client = HttpClient(
            base_url="http://localhost:3000",
            api_key="test-api-key"
        )
        client._client = mock_client
        return client

    @pytest.mark.asyncio
    async def test_register_public_key(self, http_client, mock_client):
        """Test public key registration."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "key_id": "key-123",
            "channel_id": "channel-456",
            "created_at": "2024-01-01T00:00:00Z",
            "expires_at": "2024-01-08T00:00:00Z"
        }
        mock_client.request = AsyncMock(return_value=mock_response)

        request = RegisterPublicKeyRequest(
            public_key="-----BEGIN PUBLIC KEY-----",
            algorithm="RSA-4096",
            expires_in=604800
        )

        response = await http_client.register_public_key(request)

        assert response.key_id == "key-123"
        assert response.channel_id == "channel-456"

    @pytest.mark.asyncio
    async def test_create_channel(self, http_client, mock_client):
        """Test channel creation."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "channel_id": "channel-123",
            "name": "my-channel",
            "type": "encrypted",
            "created_at": "2024-01-01T00:00:00Z",
            "expires_at": None
        }
        mock_client.request = AsyncMock(return_value=mock_response)

        request = ChannelCreateRequest(
            name="my-channel",
            channel_type=ChannelType.ENCRYPTED
        )

        response = await http_client.create_channel(request)

        assert response.channel_id == "channel-123"
        assert response.name == "my-channel"
        assert response.channel_type == ChannelType.ENCRYPTED

    @pytest.mark.asyncio
    async def test_publish_message(self, http_client, mock_client):
        """Test message publishing."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "message_id": "msg-123",
            "channel": "channel-456",
            "timestamp": "2024-01-01T00:00:00Z",
            "auto_created": False
        }
        mock_client.request = AsyncMock(return_value=mock_response)

        request = MessagePublishRequest(
            channel="channel-456",
            message="Hello, World!",
            priority=MessagePriority.HIGH
        )

        response = await http_client.publish_message(request)

        assert response.message_id == "msg-123"
        assert response.channel == "channel-456"

    @pytest.mark.asyncio
    async def test_api_error_raises_exception(self, http_client, mock_client):
        """Test that API errors raise exceptions."""
        mock_response = MagicMock()
        mock_response.status_code = 400
        mock_response.json.return_value = {
            "error_code": 3001,
            "message": "Invalid request"
        }
        mock_response.headers = {}
        mock_client.request = AsyncMock(return_value=mock_response)

        with pytest.raises(SecureNotifyApiError) as exc_info:
            await http_client._request("POST", "/api/test", data={})

        assert exc_info.value.error_code == ErrorCode.REQUEST_INVALID

    @pytest.mark.asyncio
    async def test_timeout_raises_exception(self, http_client, mock_client):
        """Test that timeout raises TimeoutError."""
        import httpx
        mock_client.request = AsyncMock(side_effect=httpx.TimeoutException("Timeout"))

        with pytest.raises(SecureNotifyTimeoutError):
            await http_client._request("GET", "/api/test")

    @pytest.mark.asyncio
    async def test_connection_error_raises_exception(self, http_client, mock_client):
        """Test that connection errors raise exception."""
        import httpx
        mock_client.request = AsyncMock(
            side_effect=httpx.ConnectError("Connection refused")
        )

        with pytest.raises(SecureNotifyConnectionError):
            await http_client._request("GET", "/api/test")

    @pytest.mark.asyncio
    async def test_headers_contain_auth(self, http_client, mock_client):
        """Test that request headers contain authentication."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {}
        mock_client.request = AsyncMock(return_value=mock_response)

        await http_client._request("GET", "/api/test")

        mock_client.request.assert_called_once()
        call_kwargs = mock_client.request.call_args
        headers = call_kwargs.kwargs["headers"]

        assert headers["Authorization"] == "Bearer test-api-key"
        assert headers["Content-Type"] == "application/json"

    @pytest.mark.asyncio
    async def test_close_client(self, http_client, mock_client):
        """Test client close."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {}
        mock_client.request = AsyncMock(return_value=mock_response)
        mock_client.is_closed = False
        mock_client.aclose = AsyncMock()

        # Make a request first
        await http_client._request("GET", "/api/test")

        # Close the client
        await http_client.close()

        mock_client.aclose.assert_called_once()
        assert http_client._client is None

    @pytest.mark.asyncio
    async def test_context_manager(self, http_client, mock_client):
        """Test async context manager."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {}
        mock_client.request = AsyncMock(return_value=mock_response)
        mock_client.is_closed = False
        mock_client.aclose = AsyncMock()

        async with http_client as client:
            result = await client._request("GET", "/api/test")
            assert result == {}

        mock_client.aclose.assert_called_once()


class TestHttpClientProperties:
    """Tests for HttpClient properties."""

    def test_base_url_rstrip(self):
        """Test that base URL trailing slash is removed."""
        client = HttpClient(
            base_url="http://localhost:3000/",
            api_key="test"
        )
        assert client.base_url == "http://localhost:3000"

    def test_default_timeout(self):
        """Test default timeout value."""
        client = HttpClient(
            base_url="http://localhost:3000",
            api_key="test"
        )
        assert client.timeout == 30.0

    def test_custom_timeout(self):
        """Test custom timeout value."""
        client = HttpClient(
            base_url="http://localhost:3000",
            api_key="test",
            timeout=60.0
        )
        assert client.timeout == 60.0
