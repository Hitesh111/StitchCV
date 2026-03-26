from __future__ import annotations
"""Job model for storing discovered job listings."""

import enum
import hashlib
from datetime import datetime
from typing import TYPE_CHECKING, Optional
from uuid import uuid4

from sqlalchemy import DateTime, Enum, Float, String, Text, func, ForeignKey
from sqlalchemy.dialects.sqlite import JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from stitchcv.models.database import Base

if TYPE_CHECKING:
    from stitchcv.models.user import User



class JobStatus(enum.Enum):
    """Status of a job in the pipeline."""

    NEW = "new"
    ANALYZED = "analyzed"
    MATCHED = "matched"
    APPLIED = "applied"
    REJECTED = "rejected"
    IGNORED = "ignored"


class Job(Base):
    """Represents a discovered job listing."""

    __tablename__ = "jobs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))

    # Core job info
    company: Mapped[str] = mapped_column(String(255), index=True)
    role: Mapped[str] = mapped_column(String(255), index=True)
    location: Mapped[str] = mapped_column(String(255))
    job_description: Mapped[str] = mapped_column(Text)
    apply_link: Mapped[str] = mapped_column(String(2048), unique=True)
    source: Mapped[str] = mapped_column(String(50))  # linkedin, indeed, etc.

    # Deduplication
    content_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)

    # Status tracking
    status: Mapped[JobStatus] = mapped_column(Enum(JobStatus), default=JobStatus.NEW, index=True)
    discovered_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    # Analysis results (populated by JD Analyzer)
    key_skills: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    required_experience: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    seniority_level: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    must_have_keywords: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    nice_to_have_keywords: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    match_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # Relationships
    user_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("users.id"), index=True, nullable=True)
    user: Mapped[Optional["User"]] = relationship("User", back_populates="jobs")

    applications: Mapped[list["Application"]] = relationship(
        "Application", back_populates="job", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Job {self.role} at {self.company}>"

    @staticmethod
    def compute_content_hash(company: str, role: str, job_description: str) -> str:
        """Compute a hash for deduplication."""
        content = f"{company.lower().strip()}|{role.lower().strip()}|{job_description[:500]}"
        return hashlib.sha256(content.encode()).hexdigest()


# Import at bottom to avoid circular imports
from stitchcv.models.application import Application  # noqa: E402, F401
