from __future__ import annotations

"""Gemini Pro API client wrapper with rate limiting and retry logic."""

import json
import asyncio
from typing import Any, Optional

from google import genai
from google.genai import types
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
)

from stitchcv.config import settings
from stitchcv.utils.rate_limiter import RateLimiter


class GeminiClient:
    """Wrapper for Gemini Pro API with rate limiting and structured output."""

    def __init__(self):
        self.client = genai.Client(api_key=settings.active_gemini_api_key)
        self.model_name = settings.gemini_model
        self.rate_limiter = RateLimiter(
            max_requests=settings.gemini_requests_per_minute,
            time_window=60.0,
        )

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=30),
        retry=retry_if_exception_type((Exception,)),
    )
    async def generate(
        self,
        prompt: str,
        system_instruction: Optional[str] = None,
        temperature: float = 0.7,
    ) -> str:
        """Generate text from Gemini Pro.

        Args:
            prompt: The user prompt
            system_instruction: Optional system instruction
            temperature: Creativity parameter (0.0 - 1.0)

        Returns:
            Generated text response
        """
        await self.rate_limiter.acquire()

        config = types.GenerateContentConfig(
            temperature=temperature,
        )
        if system_instruction:
            config.system_instruction = system_instruction

        # Run in thread pool since the client call is sync
        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(
            None,
            lambda: self.client.models.generate_content(
                model=self.model_name,
                contents=prompt,
                config=config,
            ),
        )

        return response.text

    async def generate_json(
        self,
        prompt: str,
        system_instruction: Optional[str] = None,
        temperature: float = 0.3,
    ) -> dict[str, Any]:
        """Generate and parse JSON from Gemini Pro.

        Args:
            prompt: The user prompt (should request JSON output)
            system_instruction: Optional system instruction
            temperature: Lower for more deterministic JSON

        Returns:
            Parsed JSON dictionary
        """
        # Add JSON instruction to prompt
        json_prompt = f"""{prompt}

IMPORTANT: Respond with valid JSON only. No markdown code blocks, no explanation.
"""

        response = await self.generate(
            json_prompt,
            system_instruction=system_instruction,
            temperature=temperature,
        )

        # Clean response (remove markdown if present)
        text = response.strip()
        if text.startswith("```json"):
            text = text[7:]
        if text.startswith("```"):
            text = text[3:]
        if text.endswith("```"):
            text = text[:-3]

        return json.loads(text.strip())

    async def generate_cover_letter(
        self,
        resume: dict[str, Any],
        jd_analysis: dict[str, Any],
        company: str,
        role: str,
    ) -> str:
        """Generate a personalized cover letter.

        Args:
            resume: The tailored resume
            jd_analysis: Job description analysis
            company: Company name
            role: Job title

        Returns:
            Cover letter text (150-250 words)
        """
        system_instruction = """You are an expert cover letter writer.
Write concise, personalized, professional cover letters.
Avoid generic fluff and clichés. Be specific and genuine."""

        prompt = f"""Write a cover letter for this job application.

CANDIDATE BACKGROUND:
{json.dumps(resume.get("summary", ""), indent=2)}

KEY QUALIFICATIONS:
{json.dumps(resume.get("skills", []), indent=2)}

COMPANY: {company}
ROLE: {role}

JOB REQUIREMENTS:
- Key Skills: {", ".join(jd_analysis.get("must_have_keywords", []))}
- Experience: {jd_analysis.get("required_experience_years", "not specified")}

REQUIREMENTS:
1. Length: 150-250 words
2. Professional but personable tone
3. Specific to this company and role
4. Highlight 2-3 relevant qualifications
5. Show genuine interest in the company
6. Strong opening and closing

Return only the cover letter text, no additional formatting."""

        return await self.generate(prompt, system_instruction, temperature=0.7)

    async def parse_resume_to_json(self, resume_text: str) -> dict[str, Any]:
        """Parse raw resume text into the standard JSON structure used by the system.

        Args:
            resume_text: Raw text extracted from PDF or DOCX resume.

        Returns:
            Structured JSON dictionary of the resume.
        """
        system_instruction = """You are an expert resume parser algorithm.
Your task is to convert raw unstructured resume text into a specific strict JSON structure.
Extract all relevant information correctly into the designated fields. Do not hallucinate or invent any information."""

        prompt = f"""Convert the following resume text into a structured JSON object.

RESUME TEXT:
{resume_text}

Extract into this exact JSON structure (leave arrays or strings empty if not found):
{{
    "summary": "Professional summary paragraph",
    "skills": ["skill 1", "skill 2"],
    "experience": [
        {{
            "company": "Company Name",
            "title": "Job Title",
            "location": "Location",
            "date": "Date Range",
            "description": ["bullet point 1", "bullet point 2"]
        }}
    ],
    "education": [
        {{
            "institution": "School Name",
            "degree": "Degree",
            "date": "Date Range"
        }}
    ],
    "projects": [
        {{
            "name": "Project Name",
            "description": "Description"
        }}
    ]
}}"""

        return await self.generate_json(prompt, system_instruction, temperature=0.1)
