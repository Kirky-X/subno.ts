# SPDX-License-Identifier: Apache-2.0
# Copyright (c) 2026 KirkyX. All rights reserved.

from datetime import datetime
from typing import Dict, Optional, Any


def parse_datetime(data: Dict[str, Any], key: str) -> Optional[datetime]:
    """Parse an ISO format datetime, returning None if missing or empty."""
    value = data.get(key)
    return datetime.fromisoformat(value) if value else None


def parse_optional_datetime(
    data: Dict[str, Any], *keys: str
) -> Dict[str, Optional[datetime]]:
    """Parse multiple optional datetime fields (None for missing keys)."""
    return {key: parse_datetime(data, key) for key in keys}
