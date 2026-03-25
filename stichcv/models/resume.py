from __future__ import annotations
"""Resume version model for storing tailored resumes."""

from datetime import datetime
from typing import TYPE_CHECKING
from uuid import uuid4

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.dialects.sqlite import JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from stichcv.models.database import Base

if TYPE_CHECKING:
    from stichcv.models.application import Application


class ResumeVersion(Base):
    """Stores a tailored version of the resume."""

    __tablename__ = "resume_versions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    application_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("applications.id"), index=True
    )

    # The tailored resume content
    content: Mapped[dict] = mapped_column(JSON)

    # Metadata
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    # Relationship
    application: Mapped["Application"] = relationship(
        "Application", back_populates="resume_versions"
    )

    def __repr__(self) -> str:
        return f"<ResumeVersion {self.id[:8]}>"
