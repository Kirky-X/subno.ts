"""SecureNotify Python SDK.

Encrypted push notification service client.

Example:
    ```python
    import asyncio
    from securenotify import SecureNotifyClient

    async def main():
        async with SecureNotifyClient(
            base_url="http://localhost:3000",
            api_key="your-api-key"
        ) as client:
            # Register a public key
            await client.keys.register(
                public_key="-----BEGIN PUBLIC KEY-----...",
                algorithm="RSA-4096"
            )

    asyncio.run(main())
    ```
"""

from securenotify.client import SecureNotifyClient
from securenotify.types.errors import (
    SecureNotifyError,
    SecureNotifyApiError,
    SecureNotifyConnectionError,
    SecureNotifyTimeoutError,
    SecureNotifyAuthenticationError,
)

__all__ = [
    "SecureNotifyClient",
    "SecureNotifyError",
    "SecureNotifyApiError",
    "SecureNotifyConnectionError",
    "SecureNotifyTimeoutError",
    "SecureNotifyAuthenticationError",
]

__version__ = "0.2.0"
