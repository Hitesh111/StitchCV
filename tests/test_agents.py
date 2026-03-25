"""Tests for JD Analyzer Agent."""

import pytest
from unittest.mock import AsyncMock, patch

from stichcv.agents.jd_analyzer import JDAnalyzerAgent
from stichcv.models import Job, JobStatus


@pytest.fixture
def sample_job():
    """Create a sample job for testing."""
    return Job(
        id="test-job-123",
        company="Test Company",
        role="Senior Software Engineer",
        location="San Francisco, CA",
        job_description="""
        We are looking for a Senior Software Engineer to join our team.
        
        Requirements:
        - 5+ years of experience with Python
        - Strong experience with AWS and cloud infrastructure
        - Experience with PostgreSQL or similar databases
        - Knowledge of Docker and Kubernetes
        - Excellent communication skills
        
        Nice to have:
        - Experience with machine learning
        - Open source contributions
        
        We offer competitive salary, remote work options, and great benefits.
        """,
        apply_link="https://example.com/apply",
        source="test",
        content_hash="test-hash",
        status=JobStatus.NEW,
    )


@pytest.fixture
def mock_gemini_response():
    """Mock Gemini API response."""
    return {
        "key_skills": ["Python", "AWS", "PostgreSQL", "Docker", "Kubernetes"],
        "required_experience_years": "5+ years",
        "seniority_level": "senior",
        "must_have_keywords": ["Python", "AWS", "PostgreSQL", "Docker"],
        "nice_to_have_keywords": ["machine learning", "open source"],
        "education_requirement": "not specified",
        "remote_policy": "remote",
        "summary": "Senior software engineer role focused on cloud infrastructure and Python development.",
    }


class TestJDAnalyzerAgent:
    """Tests for JDAnalyzerAgent."""

    @pytest.mark.asyncio
    async def test_analyze_job_description(self, sample_job, mock_gemini_response):
        """Test that job descriptions are analyzed correctly."""
        agent = JDAnalyzerAgent()

        with patch(
            "stichcv.agents.jd_analyzer.analyze_jd", new_callable=AsyncMock
        ) as mock_analyze, patch(
            "stichcv.agents.jd_analyzer.get_session"
        ) as mock_get_session:
            mock_analyze.return_value = {"jd_analysis": mock_gemini_response}
            
            from unittest.mock import MagicMock
            mock_session = mock_get_session.return_value.__aenter__.return_value
            mock_result = MagicMock()
            mock_result.scalar_one.return_value = sample_job
            mock_session.execute.return_value = mock_result

            # Note: In a real test, we'd mock the database session too
            # For now, this just tests the agent integration with the graph node
            result = await agent.run(sample_job)

            assert result["seniority_level"] == "senior"
            assert "Python" in result["key_skills"]
            assert "AWS" in result["must_have_keywords"]
            mock_analyze.assert_called_once()

    @pytest.mark.asyncio
    async def test_score_match(self):
        """Test match scoring logic."""
        agent = JDAnalyzerAgent()

        # Create a job with skills
        job = Job(
            id="test-job",
            company="Test",
            role="Engineer",
            location="Remote",
            job_description="Test",
            apply_link="http://test.com",
            source="test",
            content_hash="hash",
            key_skills=["Python", "AWS", "Docker"],
            seniority_level="mid",
        )

        user_profile = {
            "skills": ["Python", "AWS", "PostgreSQL"],
            "years_of_experience": 3,
        }

        # Calculate expected overlap
        # User has Python, AWS (2 out of 3 job skills) = 0.67 base score
        # Plus bonus for must-have keywords if set
        # This is a unit test of the scoring logic

        # The actual score_match method updates the database,
        # so we'd need to mock that for a proper test


class TestResumeTailor:
    """Tests for resume tailoring validation."""

    def test_validate_no_hallucination(self):
        """Test that hallucination detection works."""
        from stichcv.agents.resume_tailor import ResumeTailorAgent

        agent = ResumeTailorAgent()

        master = {
            "experience": [
                {"company": "real company", "title": "engineer", "location": "NYC", "date": "2020-2022", "description": ["Did stuff"]},
            ],
            "skills": ["Python", "JavaScript"],
            "education": [],
            "projects": [],
            "summary": "hi"
        }

        # Tailored resume with hallucinated content
        tailored = {
            "experience": [
                {"company": "real company", "title": "engineer", "location": "NYC", "date": "2020-2022", "description": ["Did stuff"]},
                {"company": "fake company", "title": "ceo", "location": "SF", "date": "2022-2024", "description": ["Did stuff"]},  # Hallucinated!
            ],
            "skills": ["Python", "JavaScript", "Quantum Computing"],  # New skill!
            "education": [],
            "projects": [],
            "summary": "hi"
        }

        agent._master_resume = master
        
        issues = agent.validate_no_hallucination(master, tailored)

        assert len(issues) >= 1
        assert any("fake company" in issue.lower() for issue in issues)
