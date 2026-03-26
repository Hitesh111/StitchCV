from __future__ import annotations
"""Logging & Memory Agent - tracks applications and maintains history."""

from typing import Any, Optional
from datetime import datetime, timedelta

from sqlalchemy import select, func

from stitchcv.agents.base_agent import BaseAgent
from stitchcv.models import (
    Job,
    JobStatus,
    Application,
    ApplicationStatus,
    ApplicationLog,
    ResumeVersion,
    get_session,
)


class LoggingMemoryAgent(BaseAgent):
    """Agent that tracks all applications and maintains history."""

    def __init__(self):
        super().__init__("LoggingMemory")

    async def run(self) -> dict[str, Any]:
        """Get a summary of all application activity.

        Returns:
            Summary statistics
        """
        return await self.get_stats()

    async def get_stats(self) -> dict[str, Any]:
        """Get application pipeline statistics.

        Returns:
            Dictionary with counts and statistics
        """
        async with get_session() as session:
            # Job counts by status
            job_counts = {}
            for status in JobStatus:
                result = await session.execute(
                    select(func.count(Job.id)).where(Job.status == status)
                )
                job_counts[status.value] = result.scalar() or 0

            # Application counts by status
            app_counts = {}
            for status in ApplicationStatus:
                result = await session.execute(
                    select(func.count(Application.id)).where(Application.status == status)
                )
                app_counts[status.value] = result.scalar() or 0

            # Recent activity (last 24 hours)
            yesterday = datetime.now() - timedelta(days=1)
            result = await session.execute(
                select(func.count(Job.id)).where(Job.discovered_at >= yesterday)
            )
            jobs_today = result.scalar() or 0

            result = await session.execute(
                select(func.count(Application.id)).where(Application.created_at >= yesterday)
            )
            apps_today = result.scalar() or 0

        return {
            "jobs": job_counts,
            "applications": app_counts,
            "recent": {
                "jobs_discovered_24h": jobs_today,
                "applications_created_24h": apps_today,
            },
        }

    async def get_application_history(
        self,
        application_id: str,
    ) -> list[dict[str, Any]]:
        """Get the full history of an application.

        Args:
            application_id: Application ID

        Returns:
            List of log entries
        """
        async with get_session() as session:
            result = await session.execute(
                select(ApplicationLog)
                .where(ApplicationLog.application_id == application_id)
                .order_by(ApplicationLog.timestamp.asc())
            )
            logs = result.scalars().all()

            return [
                {
                    "event_type": log.event_type,
                    "message": log.message,
                    "timestamp": log.timestamp.isoformat(),
                }
                for log in logs
            ]

    async def get_resume_versions(
        self,
        application_id: str,
    ) -> list[dict[str, Any]]:
        """Get all resume versions for an application.

        Args:
            application_id: Application ID

        Returns:
            List of resume versions with metadata
        """
        async with get_session() as session:
            result = await session.execute(
                select(ResumeVersion)
                .where(ResumeVersion.application_id == application_id)
                .order_by(ResumeVersion.created_at.asc())
            )
            versions = result.scalars().all()

            return [
                {
                    "id": v.id,
                    "created_at": v.created_at.isoformat(),
                    "content_preview": str(v.content)[:200] + "...",
                }
                for v in versions
            ]

    async def get_pending_reviews(self) -> list[dict[str, Any]]:
        """Get all applications pending human review.

        Returns:
            List of applications awaiting approval
        """
        async with get_session() as session:
            result = await session.execute(
                select(Application, Job)
                .join(Job)
                .where(Application.status == ApplicationStatus.PENDING_REVIEW)
                .order_by(Application.created_at.desc())
            )
            rows = result.all()

            return [
                {
                    "application_id": app.id,
                    "job_id": job.id,
                    "company": job.company,
                    "role": job.role,
                    "match_score": job.match_score,
                    "created_at": app.created_at.isoformat(),
                }
                for app, job in rows
            ]

    async def get_recent_applications(
        self,
        limit: int = 10,
    ) -> list[dict[str, Any]]:
        """Get most recent applications.

        Args:
            limit: Maximum number to return

        Returns:
            List of recent applications
        """
        async with get_session() as session:
            result = await session.execute(
                select(Application, Job)
                .join(Job)
                .order_by(Application.created_at.desc())
                .limit(limit)
            )
            rows = result.all()

            return [
                {
                    "application_id": app.id,
                    "company": job.company,
                    "role": job.role,
                    "status": app.status.value,
                    "created_at": app.created_at.isoformat(),
                    "applied_at": app.applied_at.isoformat() if app.applied_at else None,
                }
                for app, job in rows
            ]

    async def log_custom_event(
        self,
        application_id: str,
        event_type: str,
        message: str,
    ) -> None:
        """Log a custom event for an application.

        Args:
            application_id: Application ID
            event_type: Type of event
            message: Event message
        """
        async with get_session() as session:
            log = ApplicationLog(
                application_id=application_id,
                event_type=event_type,
                message=message,
            )
            session.add(log)

        self.logger.info(f"Logged event: {event_type} for {application_id}")

    async def search_jobs(
        self,
        query: Optional[str] = None,
        status: Optional[JobStatus] = None,
        min_score: Optional[float] = None,
        limit: int = 20,
    ) -> list[Job]:
        """Search jobs with filters.

        Args:
            query: Text search in role/company
            status: Filter by status
            min_score: Minimum match score
            limit: Maximum results

        Returns:
            List of matching jobs
        """
        async with get_session() as session:
            stmt = select(Job)

            if query:
                stmt = stmt.where(
                    (Job.role.ilike(f"%{query}%")) | (Job.company.ilike(f"%{query}%"))
                )

            if status:
                stmt = stmt.where(Job.status == status)

            if min_score is not None:
                stmt = stmt.where(Job.match_score >= min_score)

            stmt = stmt.order_by(Job.discovered_at.desc()).limit(limit)

            result = await session.execute(stmt)
            return list(result.scalars().all())
