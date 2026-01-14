"""Base manager class for SecureNotify managers."""

from typing import Any
from securenotify.utils.http import HttpClient
from securenotify.utils.retry import RetryConfig, with_retry


class BaseManager:
    """Base class for all managers with common functionality.

    Provides:
    - HTTP client access
    - Retry configuration
    - Common execution method with retry support
    """

    def __init__(self, http_client: HttpClient, retry_config: RetryConfig):
        """Initialize base manager.

        Args:
            http_client: HTTP client for API calls.
            retry_config: Retry configuration.
        """
        self._http = http_client
        self._retry_config = retry_config

    async def _execute(self, http_method: str, *args: Any, **kwargs: Any) -> Any:
        """Execute an HTTP method with retry.

        Args:
            http_method: Name of the HTTP method to call on the client.
            *args: Positional arguments to pass to the HTTP method.
            **kwargs: Keyword arguments to pass to the HTTP method.

        Returns:
            Result of the HTTP call.
        """

        async def _do():
            return await getattr(self._http, http_method)(*args, **kwargs)

        return await with_retry(_do, self._retry_config)
