from __future__ import annotations
"""Application model for tracking job applications."""

import enum
from datetime import datetime
from typing import TYPE_CHECKING, Optional
from uuid import uuid4

from sqlalchemy import DateTime, Enum, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from stitchcv.models.database import Base

if TYPE_CHECKING:
    from stitchcv.models.job import Job
    from stitchcv.models.resume import ResumeVersion
    from stitchcv.models.user import User


class ApplicationStatus(enum.Enum):
    """Status of a job application."""

    PENDING_REVIEW = "pending_review"
    APPROVED = "approved"
    SUBMITTED = "submitted"
    FAILED = "failed"
    WITHDRAWN = "withdrawn"


class Application(Base):
    """Represents a job application."""

    __tablename__ = "applications"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    job_id: Mapped[str] = mapped_column(String(36), ForeignKey("jobs.id"), index=True)

    # Generated content
    tailored_resume_path: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    cover_letter: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Status tracking
    status: Mapped[ApplicationStatus] = mapped_column(
        Enum(ApplicationStatus), default=ApplicationStatus.PENDING_REVIEW, index=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    applied_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    # Notes and responses
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    response: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relationships
    user_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("users.id"), index=True, nullable=True)
    user: Mapped[Optional["User"]] = relationship("User", back_populates="applications")

    job: Mapped["Job"] = relationship("Job", back_populates="applications")
    resume_versions: Mapped[list["ResumeVersion"]] = relationship(
        "ResumeVersion", back_populates="application", cascade="all, delete-orphan"
    )
    logs: Mapped[list["ApplicationLog"]] = relationship(
        "ApplicationLog", back_populates="application", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Application {self.id[:8]} - {self.status.value}>"


class ApplicationLog(Base):
    """Log entries for application events."""

    __tablename__ = "application_logs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    application_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("applications.id"), index=True
    )

    event_type: Mapped[str] = mapped_column(String(50))  # created, submitted, failed, etc.
    message: Mapped[str] = mapped_column(Text)
    timestamp: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    # Relationship
    application: Mapped["Application"] = relationship("Application", back_populates="logs")

    def __repr__(self) -> str:
        return f"<ApplicationLog {self.event_type} at {self.timestamp}>"
