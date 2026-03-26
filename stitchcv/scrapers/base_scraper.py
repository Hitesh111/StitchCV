from __future__ import annotations
"""Base scraper class for job sites."""

from abc import ABC, abstractmethod
from typing import Any, Optional

import structlog

from stitchcv.utils.rate_limiter import RateLimiter
from stitchcv.config import settings


class BaseScraper(ABC):
    """Abstract base class for job site scrapers."""

    def __init__(self, name: str):
        """Initialize the scraper.

        Args:
            name: Scraper name for logging
        """
        self.name = name
        self.logger = structlog.get_logger().bind(scraper=name)
        self.rate_limiter = RateLimiter(
            max_requests=settings.requests_per_minute,
            time_window=60.0,
        )

    @abstractmethod
    async def search_jobs(
        self,
        query: str,
        location: Optional[str] = None,
        max_results: int = 20,
    ) -> list[dict[str, Any]]:
        """Search for jobs.

        Args:
            query: Search query (job title, keywords)
            location: Optional location filter
            max_results: Maximum results to return

        Returns:
            List of job dictionaries with keys:
            - company: Company name
            - role: Job title
            - location: Job location
            - job_description: Full job description
            - apply_link: URL to apply
        """
        pass

    @abstractmethod
    async def get_job_details(self, job_url: str) -> Optional[dict[str, Any]]:
        """Get full details for a specific job.

        Args:
            job_url: URL to the job posting

        Returns:
            Job dictionary or None if failed
        """
        pass

    async def _wait_for_rate_limit(self) -> None:
        """Wait for rate limiter before making a request."""
        await self.rate_limiter.acquire()
