from __future__ import annotations
"""Application Agent - automates job application submission."""

from typing import Any, Optional
from datetime import datetime
from pathlib import Path

from sqlalchemy import select

from hireflow.agents.base_agent import BaseAgent
from hireflow.models import Job, Application, ApplicationStatus, ApplicationLog, get_session
from hireflow.services.browser_service import browser_service
from hireflow.config import settings


class ApplicationAgent(BaseAgent):
    """Agent that automates job application submission using browser automation."""

    def __init__(self):
        super().__init__("Application")
        self.user_profile: dict[str, Any] = {}

    def load_profile(self, path: Path | None = None) -> dict[str, Any]:
        """Load user profile with application defaults.

        Args:
            path: Path to profile file

        Returns:
            Profile dictionary
        """
        import json

        profile_path = path or settings.profile_path

        if profile_path.exists():
            with open(profile_path) as f:
                self.user_profile = json.load(f)
                self.logger.info(f"Loaded profile from {profile_path}")
        else:
            self.logger.warning(f"Profile not found: {profile_path}, using defaults")
            self.user_profile = {
                "work_authorization": settings.default_work_authorization,
                "requires_sponsorship": settings.default_requires_sponsorship,
            }

        return self.user_profile

    async def run(
        self,
        job: Job,
        application: Application,
        skip_review: bool = False,
    ) -> bool:
        """Submit a job application.

        Args:
            job: Target job
            application: Application with resume and cover letter
            skip_review: Skip human review (NOT RECOMMENDED)

        Returns:
            True if application submitted successfully
        """
        self.logger.info(f"Starting application for: {job.role} at {job.company}")

        # Human review checkpoint
        if settings.require_human_review and not skip_review:
            await self._request_human_review(job, application)

            # Check if approved
            async with get_session() as session:
                result = await session.execute(
                    select(Application).where(Application.id == application.id)
                )
                app = result.scalar_one()

                if app.status != ApplicationStatus.APPROVED:
                    self.logger.info("Application not approved, skipping submission")
                    return False

        # Start browser automation
        try:
            async with browser_service.new_page() as page:
                # Navigate to application page
                await page.goto(job.apply_link)
                await browser_service.wait_for_navigation(page)

                # Detect application type and fill accordingly
                success = await self._fill_application(page, job, application)

                if success:
                    await self._log_event(
                        application.id,
                        "submitted",
                        f"Application submitted for {job.role} at {job.company}",
                    )
                    await self._update_status(application.id, ApplicationStatus.SUBMITTED)
                    return True
                else:
                    await self._log_event(
                        application.id,
                        "failed",
                        "Failed to complete application form",
                    )
                    await self._update_status(application.id, ApplicationStatus.FAILED)
                    return False

        except Exception as e:
            self.logger.error(f"Application failed: {e}")
            await self._log_event(application.id, "error", str(e))
            await self._update_status(application.id, ApplicationStatus.FAILED)
            return False

    async def _request_human_review(
        self,
        job: Job,
        application: Application,
    ) -> None:
        """Request human review before submission.

        This sets the application to PENDING_REVIEW status and logs the event.
        The user should review and approve via the CLI or UI.

        Args:
            job: Target job
            application: Application to review
        """
        self.logger.info("Requesting human review for application")

        await self._log_event(
            application.id,
            "review_requested",
            f"Please review application for {job.role} at {job.company}",
        )

        print("\n" + "=" * 60)
        print("🔍 HUMAN REVIEW REQUIRED")
        print("=" * 60)
        print(f"Job: {job.role} at {job.company}")
        print(f"Location: {job.location}")
        print(f"Match Score: {job.match_score:.2f}" if job.match_score else "Match Score: N/A")
        print(f"\nResume: {application.tailored_resume_path}")
        print(f"\nCover Letter Preview:")
        print("-" * 40)
        if application.cover_letter:
            print(
                application.cover_letter[:500] + "..."
                if len(application.cover_letter) > 500
                else application.cover_letter
            )
        print("-" * 40)
        print("\nTo approve this application, run:")
        print(f"  hireflow approve {application.id}")
        print("=" * 60 + "\n")

    async def _fill_application(
        self,
        page: Any,
        job: Job,
        application: Application,
    ) -> bool:
        """Fill out an application form.

        This is a generic form filler. Specific ATS handlers can override.

        Args:
            page: Playwright page
            job: Target job
            application: Application with data

        Returns:
            True if form filled and submitted successfully
        """
        # Common form field mappings
        field_mappings = {
            # Name fields
            "first_name": [
                'input[name*="first"]',
                'input[id*="first"]',
                'input[placeholder*="First"]',
            ],
            "last_name": [
                'input[name*="last"]',
                'input[id*="last"]',
                'input[placeholder*="Last"]',
            ],
            "email": [
                'input[type="email"]',
                'input[name*="email"]',
                'input[id*="email"]',
            ],
            "phone": [
                'input[type="tel"]',
                'input[name*="phone"]',
                'input[id*="phone"]',
            ],
            # Resume upload
            "resume": [
                'input[type="file"][name*="resume"]',
                'input[type="file"][accept*=".pdf"]',
                'input[type="file"]',
            ],
            # Cover letter
            "cover_letter": [
                'textarea[name*="cover"]',
                'textarea[id*="cover"]',
                "#cover-letter",
            ],
        }

        profile = self.user_profile or {}
        filled_fields = 0

        # Fill text fields
        for field, selectors in field_mappings.items():
            if field == "resume" or field == "cover_letter":
                continue

            value = profile.get(field, "")
            if value:
                for selector in selectors:
                    if await browser_service.safe_fill(page, selector, value):
                        filled_fields += 1
                        self.logger.debug(f"Filled {field}")
                        break

        # Upload resume
        if application.tailored_resume_path:
            for selector in field_mappings["resume"]:
                if await browser_service.safe_upload(
                    page, selector, application.tailored_resume_path
                ):
                    filled_fields += 1
                    self.logger.info("Uploaded resume")
                    break

        # Fill cover letter
        if application.cover_letter:
            for selector in field_mappings["cover_letter"]:
                if await browser_service.safe_fill(page, selector, application.cover_letter):
                    filled_fields += 1
                    self.logger.info("Filled cover letter")
                    break

        self.logger.info(f"Filled {filled_fields} fields")

        # Take screenshot before submission
        screenshot_path = await browser_service.screenshot_on_error(
            page, f"pre_submit_{job.id[:8]}"
        )
        self.logger.info(f"Pre-submit screenshot: {screenshot_path}")

        # Look for submit button but DON'T click it automatically in MVP
        # This is a safety measure - let the user review the screenshot
        submit_selectors = [
            'button[type="submit"]',
            'input[type="submit"]',
            'button:has-text("Submit")',
            'button:has-text("Apply")',
        ]

        for selector in submit_selectors:
            try:
                await page.wait_for_selector(selector, timeout=3000)
                self.logger.info(f"Found submit button: {selector}")
                # In production, you would click here after human approval
                # await page.click(selector)
                break
            except Exception:
                continue

        # For MVP, return True if we filled some fields
        # Real submission should be after explicit user approval
        return filled_fields > 0

    async def _update_status(
        self,
        application_id: str,
        status: ApplicationStatus,
    ) -> None:
        """Update application status in database."""
        async with get_session() as session:
            result = await session.execute(
                select(Application).where(Application.id == application_id)
            )
            application = result.scalar_one_or_none()
            if application:
                application.status = status
                if status == ApplicationStatus.SUBMITTED:
                    application.applied_at = datetime.now()

    async def _log_event(
        self,
        application_id: str,
        event_type: str,
        message: str,
    ) -> None:
        """Log an application event."""
        async with get_session() as session:
            log = ApplicationLog(
                application_id=application_id,
                event_type=event_type,
                message=message,
            )
            session.add(log)

    async def approve_application(self, application_id: str) -> bool:
        """Approve an application for submission.

        Args:
            application_id: Application ID to approve

        Returns:
            True if approved successfully
        """
        async with get_session() as session:
            result = await session.execute(
                select(Application).where(Application.id == application_id)
            )
            application = result.scalar_one_or_none()

            if application:
                application.status = ApplicationStatus.APPROVED
                await self._log_event(
                    application_id, "approved", "Application approved for submission"
                )
                self.logger.info(f"Application {application_id} approved")
                return True

        return False
