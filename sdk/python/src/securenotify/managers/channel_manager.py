"""Channel Manager.

Manages channel creation and retrieval.
"""

from typing import Optional, List, Dict, Any
from datetime import datetime

from securenotify.types.api import (
    ChannelCreateRequest,
    ChannelCreateResponse,
    ChannelInfo,
    ChannelType,
)
from securenotify.utils.http import HttpClient
from securenotify.utils.retry import with_retry, RetryConfig


class ChannelManager:
    """Manages channel operations."""

    def __init__(self, http_client: HttpClient, retry_config: Optional[RetryConfig] = None):
        """Initialize channel manager.

        Args:
            http_client: HTTP client for API calls.
            retry_config: Retry configuration.
        """
        self._http = http_client
        self._retry_config = retry_config

    async def create(
        self,
        name: str,
        channel_type: ChannelType = ChannelType.ENCRYPTED,
        description: Optional[str] = None,
        ttl: Optional[int] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> ChannelCreateResponse:
        """Create a new channel.

        Args:
            name: Channel name.
            channel_type: Channel type (public, encrypted, temporary).
            description: Channel description (optional).
            ttl: Time-to-live in seconds (optional).
            metadata: Additional metadata (optional).

        Returns:
            Channel creation response with channel_id.

        Raises:
            ValueError: If name is empty.
            SecureNotifyApiError: On API error.
        """
        request = ChannelCreateRequest(
            name=name,
            channel_type=channel_type,
            description=description,
            ttl=ttl,
            metadata=metadata
        )

        async def do_create():
            return await self._http.create_channel(request)

        return await with_retry(do_create, self._retry_config)

    async def get(self, channel_id: str) -> ChannelInfo:
        """Get channel information.

        Args:
            channel_id: The channel ID.

        Returns:
            Channel information.

        Raises:
            SecureNotifyApiError: On API error.
        """
        async def do_get():
            data = await self._http.get_channel(channel_id)
            return ChannelInfo(
                id=data["id"],
                name=data["name"],
                channel_type=ChannelType(data["type"]),
                description=data.get("description"),
                creator=data.get("creator"),
                created_at=datetime.fromisoformat(data["created_at"]),
                expires_at=datetime.fromisoformat(data["expires_at"]) if data.get("expires_at") else None,
                is_active=data.get("is_active", True),
                metadata=data.get("metadata")
            )

        return await with_retry(do_get, self._retry_config)

    async def list(self) -> List[ChannelInfo]:
        """List all channels.

        Returns:
            List of channel information.

        Raises:
            SecureNotifyApiError: On API error.
        """
        async def do_list():
            data = await self._http.list_channels()
            channels = []
            for item in data.get("channels", []):
                channels.append(ChannelInfo(
                    id=item["id"],
                    name=item["name"],
                    channel_type=ChannelType(item["type"]),
                    description=item.get("description"),
                    creator=item.get("creator"),
                    created_at=datetime.fromisoformat(item["created_at"]),
                    expires_at=datetime.fromisoformat(item["expires_at"]) if item.get("expires_at") else None,
                    is_active=item.get("is_active", True),
                    metadata=item.get("metadata")
                ))
            return channels

        return await with_retry(do_list, self._retry_config)
