from __future__ import annotations
"""Job Discovery Agent - discovers and stores job listings."""

from typing import Any, Optional
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from stitchcv.agents.base_agent import BaseAgent
from stitchcv.models import Job, JobStatus, get_session
from stitchcv.services.browser_service import browser_service


class JobDiscoveryAgent(BaseAgent):
    """Agent that discovers job listings from various sources."""

    def __init__(self):
        super().__init__("JobDiscovery")
        self.scrapers: dict[str, Any] = {}

    def register_scraper(self, source: str, scraper: Any) -> None:
        """Register a scraper for a job source.

        Args:
            source: Source name (e.g., 'linkedin', 'indeed')
            scraper: Scraper instance
        """
        self.scrapers[source] = scraper
        self.logger.info(f"Registered scraper for {source}")

    async def run(
        self,
        source: str,
        query: str,
        location: Optional[str] = None,
        max_jobs: int = 20,
    ) -> list[Job]:
        """Discover jobs from a specific source.

        Args:
            source: Job source to search
            query: Search query (job title, keywords)
            location: Optional location filter
            max_jobs: Maximum number of jobs to fetch

        Returns:
            List of newly discovered jobs
        """
        if source not in self.scrapers:
            self.logger.error(f"No scraper registered for {source}")
            return []

        scraper = self.scrapers[source]

        self.logger.info(
            "Starting job discovery",
            source=source,
            query=query,
            location=location,
        )

        # Fetch jobs from scraper
        raw_jobs = await scraper.search_jobs(
            query=query,
            location=location,
            max_results=max_jobs,
        )

        # Store new jobs
        new_jobs = []
        async with get_session() as session:
            for job_data in raw_jobs:
                job = await self._store_job(session, job_data, source)
                if job:
                    new_jobs.append(job)

        self.logger.info(f"Discovered {len(new_jobs)} new jobs")
        return new_jobs

    async def _store_job(
        self,
        session: Any,
        job_data: dict[str, Any],
        source: str,
    ) -> Optional[Job]:
        """Store a job in the database, handling duplicates.

        Args:
            session: Database session
            job_data: Raw job data from scraper
            source: Source name

        Returns:
            New Job instance or None if duplicate
        """
        # Compute content hash for deduplication
        content_hash = Job.compute_content_hash(
            company=job_data.get("company", ""),
            role=job_data.get("role", ""),
            job_description=job_data.get("job_description", ""),
        )

        # Check for existing job
        existing = await session.execute(
            select(Job).where(
                (Job.content_hash == content_hash)
                | (Job.apply_link == job_data.get("apply_link", ""))
            )
        )
        if existing.scalar_one_or_none():
            self.logger.debug("Duplicate job found, skipping")
            return None

        # Create new job
        job = Job(
            company=job_data.get("company", "Unknown"),
            role=job_data.get("role", "Unknown"),
            location=job_data.get("location", "Unknown"),
            job_description=job_data.get("job_description", ""),
            apply_link=job_data.get("apply_link", ""),
            source=source,
            content_hash=content_hash,
            status=JobStatus.NEW,
        )

        try:
            session.add(job)
            await session.flush()
            self.logger.info(f"Stored new job: {job.role} at {job.company}")
            return job
        except IntegrityError:
            await session.rollback()
            self.logger.debug("Job already exists (race condition)")
            return None

    async def get_pending_jobs(self, limit: int = 10) -> list[Job]:
        """Get jobs that haven't been analyzed yet.

        Args:
            limit: Maximum number of jobs to return

        Returns:
            List of unanalyzed jobs
        """
        async with get_session() as session:
            result = await session.execute(
                select(Job)
                .where(Job.status == JobStatus.NEW)
                .order_by(Job.discovered_at.desc())
                .limit(limit)
            )
            return list(result.scalars().all())

    async def discover_from_url(self, url: str, source: str = "direct") -> Optional[Job]:
        """Discover a single job from a direct URL.

        Args:
            url: Direct job posting URL
            source: Source name

        Returns:
            Job instance or None if failed
        """
        self.logger.info(f"Discovering job from URL: {url}")

        async with browser_service.new_page() as page:
            await page.goto(url)
            await browser_service.wait_for_navigation(page)

            # Extract job details from page
            job_data = await self._extract_job_from_page(page, url)

            if job_data:
                async with get_session() as session:
                    return await self._store_job(session, job_data, source)

        return None

    async def _extract_job_from_page(
        self,
        page: Any,
        url: str,
    ) -> Optional[dict[str, Any]]:
        """Extract job details from a page.

        This is a generic extractor. Specific scrapers should override.

        Args:
            page: Playwright page
            url: Job URL

        Returns:
            Extracted job data or None
        """
        try:
            # Try common selectors
            title_selectors = [
                "h1",
                "[data-testid='job-title']",
                ".job-title",
                ".posting-headline h2",
            ]
            company_selectors = [
                "[data-testid='company-name']",
                ".company-name",
                ".posting-categories .company",
            ]
            description_selectors = [
                "[data-testid='job-description']",
                ".job-description",
                ".posting-description",
                "#job-description",
            ]

            role = None
            company = None
            description = None

            for sel in title_selectors:
                try:
                    role = await page.inner_text(sel)
                    if role:
                        break
                except Exception:
                    continue

            for sel in company_selectors:
                try:
                    company = await page.inner_text(sel)
                    if company:
                        break
                except Exception:
                    continue

            for sel in description_selectors:
                try:
                    description = await page.inner_text(sel)
                    if description:
                        break
                except Exception:
                    continue

            if role and description:
                return {
                    "role": role.strip(),
                    "company": (company or "Unknown").strip(),
                    "location": "Unknown",
                    "job_description": description.strip(),
                    "apply_link": url,
                }

        except Exception as e:
            self.logger.error(f"Failed to extract job from page: {e}")

        return None
