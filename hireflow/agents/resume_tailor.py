from __future__ import annotations
"""Resume Tailor Agent - tailors resumes for specific jobs."""

import json
from pathlib import Path
from typing import Any
from datetime import datetime

from sqlalchemy import select

from hireflow.agents.base_agent import BaseAgent
from hireflow.models import Job, Application, ResumeVersion, ApplicationStatus, JobStatus, get_session
from hireflow.config import settings
from hireflow.workflows.resume_tailor_graph import run_resume_tailor_graph
from hireflow.models.vector_db import store_resume_in_vector_db
import uuid


class ResumeTailorAgent(BaseAgent):
    """Agent that tailors resumes using Gemini Pro."""

    def __init__(self):
        super().__init__("ResumeTailor")
        self._master_resume: dict[str, Any] | None = None

    def load_master_resume(self, path: Path | None = None) -> dict[str, Any]:
        """Load the master resume from file.

        Args:
            path: Path to resume file (defaults to settings)

        Returns:
            Master resume dictionary
        """
        resume_path = path or settings.master_resume_path

        if not resume_path.exists():
            raise FileNotFoundError(f"Master resume not found: {resume_path}")

        with open(resume_path) as f:
            self._master_resume = json.load(f)
            self.logger.info(f"Loaded master resume from {resume_path}")
            return self._master_resume

    @property
    def master_resume(self) -> dict[str, Any]:
        """Get or load the master resume."""
        if self._master_resume is None:
            self.load_master_resume()
        return self._master_resume

    async def run(
        self,
        job: Job,
        jd_analysis: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Tailor a resume for a specific job.

        Args:
            job: Target job
            jd_analysis: Pre-computed JD analysis (optional)

        Returns:
            Tailored resume dictionary
        """
        self.logger.info(f"Tailoring resume for: {job.role} at {job.company}")

        # Get JD analysis if not provided
        if jd_analysis is None:
            jd_analysis = {
                "key_skills": job.key_skills or [],
                "required_experience_years": job.required_experience or "",
                "seniority_level": job.seniority_level or "",
                "must_have_keywords": job.must_have_keywords or [],
                "nice_to_have_keywords": job.nice_to_have_keywords or [],
            }

        # Tailor the resume using LangGraph
        resume_id = str(uuid.uuid4())
        try:
            await store_resume_in_vector_db(self.master_resume, resume_id)
        except Exception as e:
            self.logger.warning(f"Vector DB storage failed: {e}")
            
        tailored = await run_resume_tailor_graph(job.job_description, resume_id)

        # Save the tailored resume
        await self._save_tailored_resume(job, tailored)

        self.logger.info("Resume tailored successfully")
        return tailored

    async def _save_tailored_resume(
        self,
        job: Job,
        tailored_resume: dict[str, Any],
    ) -> str:
        """Save a tailored resume to file and database.

        Args:
            job: Target job
            tailored_resume: Tailored resume content

        Returns:
            Path to saved file
        """
        # Ensure directory exists
        settings.tailored_resumes_dir.mkdir(parents=True, exist_ok=True)

        # Generate filename
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        safe_company = "".join(c for c in job.company if c.isalnum())[:20]
        safe_role = "".join(c for c in job.role if c.isalnum())[:20]
        filename = f"{safe_company}_{safe_role}_{timestamp}.json"
        filepath = settings.tailored_resumes_dir / filename

        # Save to file
        with open(filepath, "w") as f:
            json.dump(tailored_resume, f, indent=2)

        # Create or update application record
        async with get_session() as session:
            # Check for existing application
            result = await session.execute(select(Application).where(Application.job_id == job.id))
            application = result.scalar_one_or_none()

            if application is None:
                application = Application(
                    job_id=job.id,
                    tailored_resume_path=str(filepath),
                    status=ApplicationStatus.PENDING_REVIEW,
                )
                session.add(application)
            else:
                application.tailored_resume_path = str(filepath)

            await session.flush()

            # Save resume version
            resume_version = ResumeVersion(
                application_id=application.id,
                content=tailored_resume,
            )
            session.add(resume_version)

        self.logger.info(f"Saved tailored resume to {filepath}")
        return str(filepath)

    def validate_no_hallucination(
        self,
        master: dict[str, Any],
        tailored: dict[str, Any],
    ) -> list[str]:
        """Check for potential hallucinations in tailored resume.

        Compares tailored resume against master to detect new content.

        Args:
            master: Original master resume
            tailored: Tailored resume to validate

        Returns:
            List of potential issues found
        """
        issues = []

        # Check experience entries
        master_experiences = set()
        for exp in master.get("experience", []):
            master_experiences.add(exp.get("company", "").lower())
            master_experiences.add(exp.get("title", "").lower())

        for exp in tailored.get("experience", []):
            company = exp.get("company", "").lower()
            title = exp.get("title", "").lower()

            if company and company not in master_experiences:
                issues.append(f"Unknown company in tailored resume: {company}")
            if title and title not in master_experiences:
                # Titles can be rephrased, so just warn
                self.logger.debug(f"Title might be rephrased: {title}")

        # Check skills
        master_skills = set(s.lower() for s in master.get("skills", []))
        tailored_skills = set(s.lower() for s in tailored.get("skills", []))
        new_skills = tailored_skills - master_skills

        if new_skills:
            issues.append(f"New skills not in master: {new_skills}")

        if issues:
            self.logger.warning(f"Potential hallucination detected: {issues}")

        return issues
