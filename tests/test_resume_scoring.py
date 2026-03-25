import json

import pytest

from stichcv.workflows.resume_tailor_graph import _compute_resume_scores, score_resumes


def test_compute_resume_scores_rewards_keyword_and_structure_matches():
    job_description = """
    We need a backend engineer with Node.js, MongoDB, Google Cloud, Redis, RabbitMQ,
    microservices, distributed systems, CI/CD, and performance monitoring experience.
    Requires 4+ years of experience.
    """
    jd_analysis = {
        "must_have_keywords": [
            "Node.js",
            "MongoDB",
            "Google Cloud",
            "Redis",
            "RabbitMQ",
            "microservices",
            "distributed systems",
            "CI/CD",
            "performance monitoring",
        ],
        "key_skills": ["Node.js", "MongoDB", "Google Cloud"],
    }
    resume = {
        "personal_info": {"name": "Hitesh", "email": "h@example.com", "phone": "123"},
        "summary": "Backend engineer with 5 years of experience building microservices on Node.js and Google Cloud.",
        "skills": ["Node.js", "MongoDB", "Google Cloud", "Redis", "RabbitMQ", "CI/CD"],
        "experience": [
            {
                "company": "Acme",
                "title": "Senior Backend Engineer",
                "date": "2020-2025",
                "location": "Gurgaon",
                "description": [
                    "Built microservices and distributed systems in Node.js.",
                    "Added performance monitoring and Redis-backed messaging with RabbitMQ.",
                ],
            }
        ],
        "education": [{"institution": "UIET", "degree": "B.Tech", "date": "2015-2019"}],
    }

    scores = _compute_resume_scores(resume, job_description, jd_analysis)

    assert scores["jd_match"] >= 75
    assert scores["skills_coverage"] >= 75
    assert scores["experience_relevance"] >= 75
    assert scores["ats_formatting"] >= 80


def test_compute_resume_scores_penalizes_missing_requirements():
    job_description = "Need Node.js, MongoDB, Google Cloud, Redis and 4+ years experience."
    jd_analysis = {"must_have_keywords": ["Node.js", "MongoDB", "Google Cloud", "Redis"]}
    resume = {
        "personal_info": {"name": "Candidate"},
        "summary": "Python backend engineer.",
        "skills": ["Python", "FastAPI"],
        "experience": [
            {
                "company": "Acme",
                "title": "Engineer",
                "date": "2024-2025",
                "description": ["Built internal APIs."],
            }
        ],
    }

    scores = _compute_resume_scores(resume, job_description, jd_analysis)

    assert scores["jd_match"] < 40
    assert scores["skills_coverage"] < 40
    assert scores["experience_relevance"] < 60


@pytest.mark.asyncio
async def test_score_resumes_compares_input_and_output_deterministically():
    state = {
        "job_description": "Need Node.js, MongoDB, Google Cloud and Redis with 4+ years experience.",
        "jd_analysis": {"must_have_keywords": ["Node.js", "MongoDB", "Google Cloud", "Redis"]},
        "master_resume_json": {
            "personal_info": {"name": "Candidate"},
            "summary": "Backend engineer with Python.",
            "skills": ["Python"],
            "experience": [{"company": "Acme", "title": "Engineer", "date": "2024-2025", "description": ["Built APIs"]}],
        },
        "tailored_resume": json.dumps(
            {
                "personal_info": {"name": "Candidate", "email": "h@example.com", "phone": "123"},
                "summary": "Node.js backend engineer with Google Cloud and Redis experience.",
                "skills": ["Node.js", "MongoDB", "Google Cloud", "Redis"],
                "experience": [
                    {
                        "company": "Acme",
                        "title": "Senior Backend Engineer",
                        "date": "2020-2025",
                        "description": [
                            "Built Node.js microservices with MongoDB and Redis.",
                            "Managed deployments on Google Cloud.",
                        ],
                    }
                ],
                "education": [{"institution": "UIET", "degree": "B.Tech", "date": "2015-2019"}],
            }
        ),
    }

    result = await score_resumes(state)

    assert result["output_scores"]["jd_match"] > result["input_scores"]["jd_match"]
    assert result["output_scores"]["skills_coverage"] > result["input_scores"]["skills_coverage"]
