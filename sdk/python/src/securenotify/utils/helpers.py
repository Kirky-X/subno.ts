"""Helper utilities for the SecureNotify Python SDK."""

from datetime import datetime
from typing import Dict, Optional, Any


def parse_datetime(data: Dict[str, Any], key: str) -> Optional[datetime]:
    """Safely parse an ISO format datetime from a dictionary.

    Args:
        data: Dictionary containing the datetime value.
        key: Key to look up in the dictionary.

    Returns:
        Parsed datetime, or None if the value is missing or empty.
    """
    value = data.get(key)
    return datetime.fromisoformat(value) if value else None


def parse_optional_datetime(
    data: Dict[str, Any], *keys: str
) -> Dict[str, Optional[datetime]]:
    """Parse multiple optional datetime fields.

    Args:
        data: Dictionary containing datetime values.
        keys: Keys to look up and parse.

    Returns:
        Dictionary with parsed datetime values (None for missing keys).
    """
    return {key: parse_datetime(data, key) for key in keys}
