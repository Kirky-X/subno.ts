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
from securenotify.utils.helpers import parse_datetime
from .base import BaseManager


class ChannelManager(BaseManager):
    """Manages channel operations."""

    async def create(
        self,
        name: str,
        channel_type: ChannelType = ChannelType.ENCRYPTED,
        description: Optional[str] = None,
        ttl: Optional[int] = None,
        metadata: Optional[Dict[str, Any]] = None,
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
            metadata=metadata,
        )
        return await self._execute("create_channel", request)

    async def get(self, channel_id: str) -> ChannelInfo:
        """Get channel information.

        Args:
            channel_id: The channel ID.

        Returns:
            Channel information.

        Raises:
            SecureNotifyApiError: On API error.
        """
        data = await self._execute("get_channel", channel_id)
        return ChannelInfo(
            id=data["id"],
            name=data["name"],
            channel_type=ChannelType(data["type"]),
            description=data.get("description"),
            creator=data.get("creator"),
            created_at=parse_datetime(data, "created_at"),
            expires_at=parse_datetime(data, "expires_at"),
            is_active=data.get("is_active", True),
            metadata=data.get("metadata"),
        )

    async def list(self) -> List[ChannelInfo]:
        """List all channels.

        Returns:
            List of channel information.

        Raises:
            SecureNotifyApiError: On API error.
        """
        data = await self._execute("list_channels")
        channels = []
        for item in data.get("channels", []):
            channels.append(
                ChannelInfo(
                    id=item["id"],
                    name=item["name"],
                    channel_type=ChannelType(item["type"]),
                    description=item.get("description"),
                    creator=item.get("creator"),
                    created_at=parse_datetime(item, "created_at"),
                    expires_at=parse_datetime(item, "expires_at"),
                    is_active=item.get("is_active", True),
                    metadata=item.get("metadata"),
                )
            )
        return channels
