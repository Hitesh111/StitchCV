from __future__ import annotations
"""Token bucket rate limiter for controlling request rates."""

import asyncio
import time
from typing import Optional


class RateLimiter:
    """Token bucket rate limiter with async support.

    Allows a maximum number of requests within a sliding time window.
    """

    def __init__(self, max_requests: int, time_window: float):
        """Initialize the rate limiter.

        Args:
            max_requests: Maximum requests allowed in the time window
            time_window: Time window in seconds
        """
        self.max_requests = max_requests
        self.time_window = time_window
        self.tokens = max_requests
        self.last_update = time.monotonic()
        self._lock = asyncio.Lock()

    async def acquire(self, timeout: Optional[float] = None) -> bool:
        """Acquire a token, waiting if necessary.

        Args:
            timeout: Maximum time to wait for a token (None = wait forever)

        Returns:
            True if token acquired, False if timeout
        """
        start_time = time.monotonic()

        while True:
            async with self._lock:
                self._refill()

                if self.tokens >= 1:
                    self.tokens -= 1
                    return True

            # Calculate wait time
            if timeout is not None:
                elapsed = time.monotonic() - start_time
                if elapsed >= timeout:
                    return False

            # Wait a bit before retrying
            await asyncio.sleep(0.1)

    def _refill(self) -> None:
        """Refill tokens based on elapsed time."""
        now = time.monotonic()
        elapsed = now - self.last_update

        # Calculate tokens to add
        tokens_to_add = elapsed * (self.max_requests / self.time_window)
        self.tokens = min(self.max_requests, self.tokens + tokens_to_add)
        self.last_update = now

    @property
    def available_tokens(self) -> float:
        """Get the current number of available tokens."""
        self._refill()
        return self.tokens
