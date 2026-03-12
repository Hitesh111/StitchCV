from __future__ import annotations
"""Agents package - AI agents for job application pipeline."""

from hireflow.agents.base_agent import BaseAgent
from hireflow.agents.job_discovery import JobDiscoveryAgent
from hireflow.agents.jd_analyzer import JDAnalyzerAgent
from hireflow.agents.resume_tailor import ResumeTailorAgent
from hireflow.agents.cover_letter import CoverLetterAgent
from hireflow.agents.application import ApplicationAgent
from hireflow.agents.logging_memory import LoggingMemoryAgent

__all__ = [
    "BaseAgent",
    "JobDiscoveryAgent",
    "JDAnalyzerAgent",
    "ResumeTailorAgent",
    "CoverLetterAgent",
    "ApplicationAgent",
    "LoggingMemoryAgent",
]
