from __future__ import annotations
"""Base agent class with common functionality."""

import asyncio
from abc import ABC, abstractmethod
from typing import Any, Optional

import structlog

from stitchcv.config import settings
from stitchcv.utils.rate_limiter import RateLimiter


class BaseAgent(ABC):
    """Abstract base class for all agents in the pipeline."""

    def __init__(self, name: str):
        """Initialize the agent.

        Args:
            name: Human-readable name for logging
        """
        self.name = name
        self.logger = structlog.get_logger().bind(agent=name)
        self.rate_limiter = RateLimiter(
            max_requests=settings.requests_per_minute,
            time_window=60.0,
        )

    @abstractmethod
    async def run(self, *args: Any, **kwargs: Any) -> Any:
        """Execute the agent's main task.

        Subclasses must implement this method.
        """
        pass

    async def execute(self, *args: Any, **kwargs: Any) -> Any:
        """Execute with rate limiting and error handling."""
        await self.rate_limiter.acquire()

        try:
            self.logger.info("Starting execution")
            result = await self.run(*args, **kwargs)
            self.logger.info("Execution completed successfully")
            return result
        except Exception as e:
            self.logger.error("Execution failed", error=str(e))
            raise

    async def _safe_execute(
        self,
        coro: Any,
        default: Optional[Any] = None,
        log_error: bool = True,
    ) -> Any:
        """Execute a coroutine with error handling.

        Args:
            coro: Coroutine to execute
            default: Default value on failure
            log_error: Whether to log errors

        Returns:
            Result or default value
        """
        try:
            return await coro
        except Exception as e:
            if log_error:
                self.logger.warning("Safe execution caught error", error=str(e))
            return default
