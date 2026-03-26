from __future__ import annotations
"""Agents package - AI agents for job application pipeline."""

from stitchcv.agents.base_agent import BaseAgent
from stitchcv.agents.job_discovery import JobDiscoveryAgent
from stitchcv.agents.jd_analyzer import JDAnalyzerAgent
from stitchcv.agents.resume_tailor import ResumeTailorAgent
from stitchcv.agents.cover_letter import CoverLetterAgent
from stitchcv.agents.application import ApplicationAgent
from stitchcv.agents.logging_memory import LoggingMemoryAgent

__all__ = [
    "BaseAgent",
    "JobDiscoveryAgent",
    "JDAnalyzerAgent",
    "ResumeTailorAgent",
    "CoverLetterAgent",
    "ApplicationAgent",
    "LoggingMemoryAgent",
]
