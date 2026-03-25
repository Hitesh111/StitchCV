from __future__ import annotations
"""Agents package - AI agents for job application pipeline."""

from stichcv.agents.base_agent import BaseAgent
from stichcv.agents.job_discovery import JobDiscoveryAgent
from stichcv.agents.jd_analyzer import JDAnalyzerAgent
from stichcv.agents.resume_tailor import ResumeTailorAgent
from stichcv.agents.cover_letter import CoverLetterAgent
from stichcv.agents.application import ApplicationAgent
from stichcv.agents.logging_memory import LoggingMemoryAgent

__all__ = [
    "BaseAgent",
    "JobDiscoveryAgent",
    "JDAnalyzerAgent",
    "ResumeTailorAgent",
    "CoverLetterAgent",
    "ApplicationAgent",
    "LoggingMemoryAgent",
]
