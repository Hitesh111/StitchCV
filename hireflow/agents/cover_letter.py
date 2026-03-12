from __future__ import annotations
"""Cover Letter Agent - generates personalized cover letters."""

from typing import Any

from sqlalchemy import select

from hireflow.agents.base_agent import BaseAgent
from hireflow.models import Job, Application, get_session
from hireflow.services.gemini_client import GeminiClient


class CoverLetterAgent(BaseAgent):
    """Agent that generates personalized cover letters using Gemini Pro."""

    def __init__(self):
        super().__init__("CoverLetter")
        self.gemini = GeminiClient()

    async def run(
        self,
        job: Job,
        tailored_resume: dict[str, Any],
        jd_analysis: dict[str, Any] | None = None,
    ) -> str:
        """Generate a cover letter for a job application.

        Args:
            job: Target job
            tailored_resume: The tailored resume for this job
            jd_analysis: Pre-computed JD analysis (optional)

        Returns:
            Generated cover letter text
        """
        self.logger.info(f"Generating cover letter for: {job.role} at {job.company}")

        # Get JD analysis if not provided
        if jd_analysis is None:
            jd_analysis = {
                "key_skills": job.key_skills or [],
                "required_experience_years": job.required_experience or "",
                "seniority_level": job.seniority_level or "",
                "must_have_keywords": job.must_have_keywords or [],
            }

        # Generate cover letter
        cover_letter = await self.gemini.generate_cover_letter(
            resume=tailored_resume,
            jd_analysis=jd_analysis,
            company=job.company,
            role=job.role,
        )

        # Validate length
        word_count = len(cover_letter.split())
        if word_count < 100 or word_count > 300:
            self.logger.warning(f"Cover letter word count: {word_count} (expected 150-250)")

        # Save to application
        await self._save_cover_letter(job.id, cover_letter)

        self.logger.info(f"Generated cover letter ({word_count} words)")
        return cover_letter

    async def _save_cover_letter(self, job_id: str, cover_letter: str) -> None:
        """Save cover letter to the application record.

        Args:
            job_id: Job ID
            cover_letter: Generated cover letter
        """
        async with get_session() as session:
            result = await session.execute(select(Application).where(Application.job_id == job_id))
            application = result.scalar_one_or_none()

            if application:
                application.cover_letter = cover_letter
            else:
                self.logger.warning(f"No application found for job {job_id}")

    async def regenerate(
        self,
        job: Job,
        tailored_resume: dict[str, Any],
        feedback: str,
    ) -> str:
        """Regenerate a cover letter with feedback.

        Args:
            job: Target job
            tailored_resume: The tailored resume
            feedback: User feedback for improvements

        Returns:
            Regenerated cover letter text
        """
        self.logger.info(f"Regenerating cover letter with feedback")

        jd_analysis = {
            "key_skills": job.key_skills or [],
            "must_have_keywords": job.must_have_keywords or [],
        }

        system_instruction = """You are an expert cover letter writer.
Write concise, personalized, professional cover letters.
Avoid generic fluff and clichés. Be specific and genuine.

USER FEEDBACK TO INCORPORATE:
{feedback}
""".format(feedback=feedback)

        prompt = f"""Write a REVISED cover letter for this job application.

CANDIDATE BACKGROUND:
{tailored_resume.get("summary", "")}

COMPANY: {job.company}
ROLE: {job.role}

REQUIREMENTS:
1. Length: 150-250 words
2. Professional but personable tone
3. Incorporate the user's feedback
4. Specific to this company and role

Return only the cover letter text."""

        cover_letter = await self.gemini.generate(
            prompt,
            system_instruction=system_instruction,
            temperature=0.7,
        )

        await self._save_cover_letter(job.id, cover_letter)
        return cover_letter
