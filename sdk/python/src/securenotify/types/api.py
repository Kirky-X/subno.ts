"""API Type Definitions.

Defines dataclasses for all API request/response types.
"""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, Dict, Any, List
from enum import Enum


class MessagePriority(Enum):
    """Message priority levels."""

    CRITICAL = 100
    HIGH = 75
    NORMAL = 50
    LOW = 25
    BULK = 0


class ChannelType(Enum):
    """Channel types."""

    PUBLIC = "public"
    ENCRYPTED = "encrypted"
    TEMPORARY = "temporary"


@dataclass
class RegisterPublicKeyRequest:
    """Request for registering a public key."""

    public_key: str
    algorithm: str
    expires_in: Optional[int] = None
    metadata: Optional[Dict[str, Any]] = None

    def __post_init__(self):
        """Validate request parameters."""
        if not self.public_key:
            raise ValueError("public_key is required")
        if not self.algorithm:
            raise ValueError("algorithm is required")


@dataclass
class PublicKeyInfo:
    """Public key information."""

    id: str
    channel_id: str
    public_key: str
    algorithm: str
    created_at: datetime
    expires_at: Optional[datetime] = None
    last_used_at: Optional[datetime] = None
    metadata: Optional[Dict[str, Any]] = None


@dataclass
class RegisterPublicKeyResponse:
    """Response from registering a public key."""

    key_id: str
    channel_id: str
    created_at: datetime
    expires_at: Optional[datetime] = None


@dataclass
class ChannelCreateRequest:
    """Request for creating a channel."""

    name: str
    channel_type: ChannelType = ChannelType.ENCRYPTED
    description: Optional[str] = None
    ttl: Optional[int] = None
    metadata: Optional[Dict[str, Any]] = None

    def __post_init__(self):
        """Validate request parameters."""
        if not self.name:
            raise ValueError("name is required")


@dataclass
class ChannelInfo:
    """Channel information."""

    id: str
    name: str
    channel_type: ChannelType
    description: Optional[str]
    creator: Optional[str]
    created_at: datetime
    expires_at: Optional[datetime] = None
    is_active: bool = True
    metadata: Optional[Dict[str, Any]] = None


@dataclass
class ChannelCreateResponse:
    """Response from creating a channel."""

    channel_id: str
    name: str
    channel_type: ChannelType
    created_at: datetime
    expires_at: Optional[datetime] = None


@dataclass
class MessagePublishRequest:
    """Request for publishing a message."""

    channel: str
    message: str
    priority: MessagePriority = MessagePriority.NORMAL
    sender: Optional[str] = None
    encrypted: bool = True
    signature: Optional[str] = None
    cache: bool = True

    def __post_init__(self):
        """Validate request parameters."""
        if not self.channel:
            raise ValueError("channel is required")
        if not self.message:
            raise ValueError("message is required")


@dataclass
class MessageInfo:
    """Message information."""

    id: str
    channel: str
    message: str
    encrypted: bool
    created_at: datetime
    sender: Optional[str] = None
    priority: Optional[MessagePriority] = None


@dataclass
class MessagePublishResponse:
    """Response from publishing a message."""

    message_id: str
    channel: str
    timestamp: datetime
    auto_created: bool = False


@dataclass
class QueueStatusInfo:
    """Message queue status information."""

    channel: str
    pending_count: int
    priority_counts: Dict[str, int]


@dataclass
class ApiKeyCreateRequest:
    """Request for creating an API key."""

    name: str
    permissions: List[str]
    expires_in: Optional[int] = None

    def __post_init__(self):
        """Validate request parameters."""
        if not self.name:
            raise ValueError("name is required")
        if not self.permissions:
            raise ValueError("permissions is required")


@dataclass
class ApiKeyInfo:
    """API key information."""

    id: str
    key_prefix: str
    name: str
    permissions: List[str]
    is_active: bool
    created_at: datetime
    last_used_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None


@dataclass
class ApiKeyCreateResponse:
    """Response from creating an API key."""

    key_id: str
    key: str
    key_prefix: str
    name: str
    permissions: List[str]
    created_at: datetime
    expires_at: Optional[datetime] = None


@dataclass
class SubscriptionInfo:
    """Subscription information."""

    channel: str
    is_active: bool
    subscribed_at: datetime
    last_message_at: Optional[datetime] = None


@dataclass
class SubscribeRequest:
    """Request for subscribing to a channel."""

    channel: str
    handler: str  # Callback URL or handler identifier

    def __post_init__(self):
        """Validate request parameters."""
        if not self.channel:
            raise ValueError("channel is required")
