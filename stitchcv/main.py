from __future__ import annotations

"""StitchCV - Main entry point and agent orchestration."""

import asyncio
import argparse
import sys
from pathlib import Path

import structlog

from stitchcv.config import settings
from stitchcv.models import init_db, get_session, Job, JobStatus, Application
from stitchcv.agents import (
    JobDiscoveryAgent,
    JDAnalyzerAgent,
    ResumeTailorAgent,
    CoverLetterAgent,
    ApplicationAgent,
    LoggingMemoryAgent,
)
from stitchcv.scrapers import LinkedInScraper


# Configure structured logging
structlog.configure(
    processors=[
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.dev.ConsoleRenderer(),
    ],
    context_class=dict,
    logger_factory=structlog.PrintLoggerFactory(),
    cache_logger_on_first_use=True,
)

logger = structlog.get_logger()


class StitchCVPipeline:
    """Orchestrates the job application pipeline."""

    def __init__(self):
        """Initialize all agents."""
        self.discovery_agent = JobDiscoveryAgent()
        self.analyzer_agent = JDAnalyzerAgent()
        self.tailor_agent = ResumeTailorAgent()
        self.cover_letter_agent = CoverLetterAgent()
        self.application_agent = ApplicationAgent()
        self.logging_agent = LoggingMemoryAgent()

        # Register scrapers
        self.discovery_agent.register_scraper("linkedin", LinkedInScraper())

    async def initialize(self) -> None:
        """Initialize the pipeline (database, etc.)."""
        await init_db()
        logger.info("Database initialized")

        # Load user data
        self.tailor_agent.load_master_resume()
        self.application_agent.load_profile()

    async def discover_jobs(
        self,
        source: str,
        query: str,
        location: str | None = None,
        max_jobs: int = 20,
    ) -> list[Job]:
        """Discover new jobs from a source.

        Args:
            source: Job source (e.g., 'linkedin')
            query: Search query
            location: Optional location filter
            max_jobs: Maximum jobs to fetch

        Returns:
            List of newly discovered jobs
        """
        logger.info(f"Discovering jobs: {query} on {source}")
        jobs = await self.discovery_agent.execute(
            source=source,
            query=query,
            location=location,
            max_jobs=max_jobs,
        )
        return jobs

    async def analyze_pending_jobs(self, limit: int = 10) -> int:
        """Analyze all pending jobs.

        Args:
            limit: Maximum jobs to analyze

        Returns:
            Number of jobs analyzed
        """
        jobs = await self.discovery_agent.get_pending_jobs(limit)
        logger.info(f"Analyzing {len(jobs)} pending jobs")

        for job in jobs:
            try:
                await self.analyzer_agent.execute(job)
            except Exception as e:
                logger.error(f"Failed to analyze job {job.id}: {e}")

        return len(jobs)

    async def prepare_applications(
        self,
        min_score: float = 0.5,
        limit: int = 5,
    ) -> list[Application]:
        """Prepare applications for matched jobs.

        Generates tailored resumes and cover letters.

        Args:
            min_score: Minimum match score
            limit: Maximum applications to prepare

        Returns:
            List of prepared applications
        """
        # Get matched jobs
        jobs = await self.logging_agent.search_jobs(
            status=JobStatus.MATCHED,
            min_score=min_score,
            limit=limit,
        )

        logger.info(f"Preparing {len(jobs)} applications")
        applications = []

        for job in jobs:
            try:
                # Tailor resume
                tailored = await self.tailor_agent.execute(job)

                # Generate cover letter
                await self.cover_letter_agent.execute(job, tailored)

                # Get application record
                async with get_session() as session:
                    from sqlalchemy import select

                    result = await session.execute(
                        select(Application).where(Application.job_id == job.id)
                    )
                    app = result.scalar_one_or_none()
                    if app:
                        applications.append(app)

            except Exception as e:
                logger.error(f"Failed to prepare application for {job.id}: {e}")

        return applications

    async def submit_application(
        self,
        application_id: str,
        skip_review: bool = False,
    ) -> bool:
        """Submit a prepared application.

        Args:
            application_id: Application to submit
            skip_review: Skip human review (not recommended)

        Returns:
            True if submitted successfully
        """
        from sqlalchemy import select

        async with get_session() as session:
            result = await session.execute(
                select(Application, Job).join(Job).where(Application.id == application_id)
            )
            row = result.one_or_none()

            if not row:
                logger.error(f"Application not found: {application_id}")
                return False

            application, job = row

        return await self.application_agent.execute(
            job=job,
            application=application,
            skip_review=skip_review,
        )

    async def get_stats(self) -> dict:
        """Get pipeline statistics."""
        return await self.logging_agent.execute()

    async def list_pending_reviews(self) -> list[dict]:
        """Get applications pending human review."""
        return await self.logging_agent.get_pending_reviews()

    async def approve_application(self, application_id: str) -> bool:
        """Approve an application for submission."""
        return await self.application_agent.approve_application(application_id)


# CLI Commands
async def cmd_discover(args: argparse.Namespace) -> None:
    """Discover jobs command."""
    pipeline = StitchCVPipeline()
    await pipeline.initialize()

    jobs = await pipeline.discover_jobs(
        source=args.source,
        query=args.query,
        location=args.location,
        max_jobs=args.max,
    )

    print(f"\n✅ Discovered {len(jobs)} new jobs")
    for job in jobs[:5]:
        print(f"  - {job.role} at {job.company}")


async def cmd_analyze(args: argparse.Namespace) -> None:
    """Analyze pending jobs command."""
    pipeline = StitchCVPipeline()
    await pipeline.initialize()

    count = await pipeline.analyze_pending_jobs(limit=args.limit)
    print(f"\n✅ Analyzed {count} jobs")


async def cmd_prepare(args: argparse.Namespace) -> None:
    """Prepare applications command."""
    pipeline = StitchCVPipeline()
    await pipeline.initialize()

    applications = await pipeline.prepare_applications(
        min_score=args.min_score,
        limit=args.limit,
    )

    print(f"\n✅ Prepared {len(applications)} applications")
    for app in applications:
        print(f"  - Application {app.id[:8]}")


async def cmd_apply(args: argparse.Namespace) -> None:
    """Submit application command."""
    pipeline = StitchCVPipeline()
    await pipeline.initialize()

    success = await pipeline.submit_application(
        application_id=args.application_id,
        skip_review=args.skip_review,
    )

    if success:
        print(f"\n✅ Application submitted successfully")
    else:
        print(f"\n❌ Application submission failed")


async def cmd_approve(args: argparse.Namespace) -> None:
    """Approve application command."""
    pipeline = StitchCVPipeline()
    await pipeline.initialize()

    success = await pipeline.approve_application(args.application_id)

    if success:
        print(f"\n✅ Application approved")
    else:
        print(f"\n❌ Failed to approve application")


async def cmd_status(args: argparse.Namespace) -> None:
    """Show status command."""
    pipeline = StitchCVPipeline()
    await pipeline.initialize()

    stats = await pipeline.get_stats()

    print("\n📊 StitchCV Status")
    print("=" * 40)
    print("\nJobs:")
    for status, count in stats["jobs"].items():
        print(f"  {status}: {count}")

    print("\nApplications:")
    for status, count in stats["applications"].items():
        print(f"  {status}: {count}")

    print("\nRecent Activity (24h):")
    print(f"  Jobs discovered: {stats['recent']['jobs_discovered_24h']}")
    print(f"  Applications created: {stats['recent']['applications_created_24h']}")


async def cmd_pending(args: argparse.Namespace) -> None:
    """Show pending reviews command."""
    pipeline = StitchCVPipeline()
    await pipeline.initialize()

    pending = await pipeline.list_pending_reviews()

    if not pending:
        print("\n✅ No applications pending review")
        return

    print(f"\n🔍 {len(pending)} Applications Pending Review")
    print("=" * 60)

    for app in pending:
        score = app.get("match_score")
        score_str = f"{score:.2f}" if score else "N/A"
        print(f"\n{app['role']} at {app['company']}")
        print(f"  ID: {app['application_id']}")
        print(f"  Match Score: {score_str}")
        print(f"  Created: {app['created_at']}")


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(description="StitchCV - Agentic AI Job Application System")
    subparsers = parser.add_subparsers(dest="command", help="Available commands")

    # Discover command
    discover_parser = subparsers.add_parser("discover", help="Discover new jobs")
    discover_parser.add_argument("--source", default="linkedin", help="Job source")
    discover_parser.add_argument("--query", required=True, help="Search query")
    discover_parser.add_argument("--location", help="Location filter")
    discover_parser.add_argument("--max", type=int, default=20, help="Max jobs")

    # Analyze command
    analyze_parser = subparsers.add_parser("analyze", help="Analyze pending jobs")
    analyze_parser.add_argument("--limit", type=int, default=10, help="Max jobs to analyze")

    # Prepare command
    prepare_parser = subparsers.add_parser("prepare", help="Prepare applications")
    prepare_parser.add_argument("--min-score", type=float, default=0.5, help="Min match score")
    prepare_parser.add_argument("--limit", type=int, default=5, help="Max applications")

    # Apply command
    apply_parser = subparsers.add_parser("apply", help="Submit an application")
    apply_parser.add_argument("application_id", help="Application ID to submit")
    apply_parser.add_argument("--skip-review", action="store_true", help="Skip human review")

    # Approve command
    approve_parser = subparsers.add_parser("approve", help="Approve an application")
    approve_parser.add_argument("application_id", help="Application ID to approve")

    # Status command
    subparsers.add_parser("status", help="Show pipeline status")

    # Pending command
    subparsers.add_parser("pending", help="Show pending reviews")

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        sys.exit(1)

    # Map commands to async functions
    commands = {
        "discover": cmd_discover,
        "analyze": cmd_analyze,
        "prepare": cmd_prepare,
        "apply": cmd_apply,
        "approve": cmd_approve,
        "status": cmd_status,
        "pending": cmd_pending,
    }

    # Run the command
    asyncio.run(commands[args.command](args))


if __name__ == "__main__":
    main()
