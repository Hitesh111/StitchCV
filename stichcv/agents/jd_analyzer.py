from __future__ import annotations
"""JD Analyzer Agent - analyzes job descriptions using Gemini Pro."""

from typing import Any, Optional

from sqlalchemy import select

from stichcv.agents.base_agent import BaseAgent
from stichcv.models import Job, JobStatus, get_session
from stichcv.workflows.resume_tailor_graph import analyze_jd


class JDAnalyzerAgent(BaseAgent):
    """Agent that analyzes job descriptions using Gemini Pro."""

    def __init__(self):
        super().__init__("JDAnalyzer")

    async def run(self, job: Job) -> dict[str, Any]:
        """Analyze a job description.

        Args:
            job: Job to analyze

        Returns:
            Analysis results dictionary
        """
        self.logger.info(f"Analyzing job: {job.role} at {job.company}")

        # Get analysis from LangGraph node
        state_input = {"job_description": job.job_description}
        result = await analyze_jd(state_input)
        analysis = result.get("jd_analysis", {})

        # Update job with analysis results
        async with get_session() as session:
            # Re-fetch job in this session
            result = await session.execute(select(Job).where(Job.id == job.id))
            db_job = result.scalar_one()

            db_job.key_skills = analysis.get("key_skills", [])
            db_job.required_experience = analysis.get("required_experience_years", "")
            db_job.seniority_level = analysis.get("seniority_level", "")
            db_job.must_have_keywords = analysis.get("must_have_keywords", [])
            db_job.nice_to_have_keywords = analysis.get("nice_to_have_keywords", [])
            db_job.status = JobStatus.ANALYZED

        self.logger.info(
            "Analysis complete",
            key_skills=len(analysis.get("key_skills", [])),
            seniority=analysis.get("seniority_level"),
        )

        return analysis

    async def analyze_batch(self, jobs: list[Job]) -> list[dict[str, Any]]:
        """Analyze a batch of jobs.

        Args:
            jobs: List of jobs to analyze

        Returns:
            List of analysis results
        """
        results = []
        for job in jobs:
            try:
                analysis = await self.execute(job)
                results.append({"job_id": job.id, "analysis": analysis})
            except Exception as e:
                self.logger.error(f"Failed to analyze job {job.id}: {e}")
                results.append({"job_id": job.id, "error": str(e)})
        return results

    async def score_match(
        self,
        job: Job,
        user_profile: dict[str, Any],
    ) -> float:
        """Score how well a job matches the user's profile.

        Args:
            job: Analyzed job
            user_profile: User's skills and preferences

        Returns:
            Match score from 0.0 to 1.0
        """
        if not job.key_skills:
            return 0.0

        user_skills = set(s.lower() for s in user_profile.get("skills", []))
        job_skills = set(s.lower() for s in job.key_skills)

        # Basic overlap scoring
        if not job_skills:
            return 0.0

        overlap = len(user_skills & job_skills)
        score = overlap / len(job_skills)

        # Bonus for must-have keywords
        if job.must_have_keywords:
            must_have = set(k.lower() for k in job.must_have_keywords)
            must_have_overlap = len(user_skills & must_have)
            if must_have:
                score += 0.2 * (must_have_overlap / len(must_have))

        # Experience level matching
        user_years = user_profile.get("years_of_experience", 0)
        if job.seniority_level:
            seniority_map = {
                "junior": (0, 2),
                "mid": (2, 5),
                "senior": (5, 10),
                "lead": (7, 15),
                "principal": (10, 20),
            }
            if job.seniority_level.lower() in seniority_map:
                min_years, max_years = seniority_map[job.seniority_level.lower()]
                if min_years <= user_years <= max_years:
                    score += 0.1

        # Clamp to 0-1 range
        score = min(1.0, max(0.0, score))

        # Update job with score
        async with get_session() as session:
            result = await session.execute(select(Job).where(Job.id == job.id))
            db_job = result.scalar_one()
            db_job.match_score = score
            if score >= 0.5:
                db_job.status = JobStatus.MATCHED

        self.logger.info(f"Match score for {job.role}: {score:.2f}")
        return score
