# SPDX-License-Identifier: Apache-2.0
# Copyright (c) 2026 KirkyX. All rights reserved.

from typing import Any, Optional
from securenotify.utils.http import HttpClient
from securenotify.utils.retry import RetryConfig, with_retry, DEFAULT_RETRY_CONFIG


class BaseManager:
    def __init__(
        self, http_client: HttpClient, retry_config: Optional[RetryConfig] = None
    ):
        self._http = http_client
        self._retry_config = (
            retry_config if retry_config is not None else DEFAULT_RETRY_CONFIG
        )

    async def _execute(self, http_method: str, *args: Any, **kwargs: Any) -> Any:
        async def _do():
            return await getattr(self._http, http_method)(*args, **kwargs)

        return await with_retry(_do, self._retry_config)
