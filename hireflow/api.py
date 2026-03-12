from __future__ import annotations

"""FastAPI REST API for HireFlow."""

import asyncio
from typing import Any, Optional

import structlog
from fastapi import FastAPI, HTTPException, Depends, UploadFile, File, Form, Query
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from hireflow.models import (
    init_db,
    get_session,
    Job,
    JobStatus,
    Application,
    ApplicationStatus,
    ApplicationLog,
    ResumeVersion,
)
from hireflow.agents import (
    JobDiscoveryAgent,
    JDAnalyzerAgent,
    ResumeTailorAgent,
    CoverLetterAgent,
    ApplicationAgent,
    LoggingMemoryAgent,
)
from hireflow.scrapers import LinkedInScraper

logger = structlog.get_logger()

# --- Pydantic schemas for API ---


class DiscoverRequest(BaseModel):
    source: str = "linkedin"
    query: str
    location: Optional[str] = None
    max_jobs: int = 20


class AnalyzeRequest(BaseModel):
    limit: int = 10


class PrepareRequest(BaseModel):
    min_score: float = 0.5
    limit: int = 5


class ApplyRequest(BaseModel):
    application_id: str
    skip_review: bool = False


class ApproveRequest(BaseModel):
    application_id: str


class TailorResumeRequest(BaseModel):
    master_resume: dict
    job_description: str


class JobResponse(BaseModel):
    id: str
    company: str
    role: str
    location: Optional[str] = None
    source: str
    apply_link: Optional[str] = None
    status: str
    match_score: Optional[float] = None
    seniority_level: Optional[str] = None
    key_skills: Optional[list] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    job_description: Optional[str] = None

    class Config:
        from_attributes = True


class ApplicationResponse(BaseModel):
    id: str
    job_id: str
    status: str
    cover_letter: Optional[str] = None
    match_score: Optional[float] = None
    created_at: Optional[str] = None
    company: Optional[str] = None
    role: Optional[str] = None

    class Config:
        from_attributes = True


class StatsResponse(BaseModel):
    jobs: dict
    applications: dict
    recent: dict


class MessageResponse(BaseModel):
    message: str
    count: Optional[int] = None


# --- App setup ---

app = FastAPI(
    title="HireFlow API",
    description="Agentic AI Job Application System",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Agents (initialized on startup)
discovery_agent: Optional[JobDiscoveryAgent] = None
analyzer_agent: Optional[JDAnalyzerAgent] = None
tailor_agent: Optional[ResumeTailorAgent] = None
cover_letter_agent: Optional[CoverLetterAgent] = None
application_agent: Optional[ApplicationAgent] = None
logging_agent: Optional[LoggingMemoryAgent] = None


@app.on_event("startup")
async def startup():
    """Initialize database and agents."""
    global discovery_agent, analyzer_agent, tailor_agent
    global cover_letter_agent, application_agent, logging_agent

    await init_db()
    logger.info("Database initialized")

    discovery_agent = JobDiscoveryAgent()
    discovery_agent.register_scraper("linkedin", LinkedInScraper())

    analyzer_agent = JDAnalyzerAgent()
    tailor_agent = ResumeTailorAgent()
    cover_letter_agent = CoverLetterAgent()
    application_agent = ApplicationAgent()
    logging_agent = LoggingMemoryAgent()

    # Try loading user data (non-fatal if missing)
    try:
        tailor_agent.load_master_resume()
    except FileNotFoundError:
        logger.warning("Master resume not found - configure data/master_resume.json")

    try:
        application_agent.load_profile()
    except FileNotFoundError:
        logger.warning("Profile not found - configure data/profile.json")


# --- API routes ---


@app.get("/api/health")
async def health():
    """Health check."""
    return {"status": "ok", "version": "0.1.0"}


# --- Jobs ---


@app.get("/api/jobs", response_model=list[JobResponse])
async def list_jobs(
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    min_score: Optional[float] = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
):
    """List all jobs with optional filters."""
    from sqlalchemy import select, desc

    async with get_session() as session:
        stmt = select(Job).order_by(desc(Job.created_at))

        if status:
            try:
                job_status = JobStatus(status)
                stmt = stmt.where(Job.status == job_status)
            except ValueError:
                raise HTTPException(400, f"Invalid status: {status}")

        if search:
            stmt = stmt.where((Job.role.ilike(f"%{search}%")) | (Job.company.ilike(f"%{search}%")))

        if min_score is not None:
            stmt = stmt.where(Job.match_score >= min_score)

        stmt = stmt.offset(offset).limit(limit)
        result = await session.execute(stmt)
        jobs = result.scalars().all()

        return [
            JobResponse(
                id=j.id,
                company=j.company,
                role=j.role,
                location=j.location,
                source=j.source,
                apply_link=j.apply_link,
                status=j.status.value if j.status else "new",
                match_score=j.match_score,
                seniority_level=j.seniority_level,
                key_skills=j.key_skills,
                created_at=str(j.created_at) if j.created_at else None,
                updated_at=str(j.updated_at) if j.updated_at else None,
                job_description=j.job_description[:500] if j.job_description else None,
            )
            for j in jobs
        ]


@app.get("/api/jobs/{job_id}", response_model=JobResponse)
async def get_job(job_id: str):
    """Get a single job with full details."""
    from sqlalchemy import select

    async with get_session() as session:
        result = await session.execute(select(Job).where(Job.id == job_id))
        job = result.scalar_one_or_none()
        if not job:
            raise HTTPException(404, "Job not found")

        return JobResponse(
            id=job.id,
            company=job.company,
            role=job.role,
            location=job.location,
            source=job.source,
            apply_link=job.apply_link,
            status=job.status.value if job.status else "new",
            match_score=job.match_score,
            seniority_level=job.seniority_level,
            key_skills=job.key_skills,
            created_at=str(job.created_at) if job.created_at else None,
            updated_at=str(job.updated_at) if job.updated_at else None,
            job_description=job.job_description,
        )


# --- Actions ---


@app.post("/api/discover", response_model=MessageResponse)
async def discover_jobs(req: DiscoverRequest):
    """Trigger job discovery."""
    try:
        jobs = await discovery_agent.execute(
            source=req.source,
            query=req.query,
            location=req.location,
            max_jobs=req.max_jobs,
        )
        return MessageResponse(
            message=f"Discovered {len(jobs)} new jobs",
            count=len(jobs),
        )
    except Exception as e:
        raise HTTPException(500, f"Discovery failed: {str(e)}")


@app.post("/api/analyze", response_model=MessageResponse)
async def analyze_jobs(req: AnalyzeRequest):
    """Analyze pending jobs using AI."""
    jobs = await discovery_agent.get_pending_jobs(req.limit)

    analyzed = 0
    for job in jobs:
        try:
            await analyzer_agent.execute(job)
            analyzed += 1
        except Exception as e:
            logger.error(f"Failed to analyze job {job.id}: {e}")

    return MessageResponse(
        message=f"Analyzed {analyzed} of {len(jobs)} jobs",
        count=analyzed,
    )


@app.post("/api/prepare", response_model=MessageResponse)
async def prepare_applications(req: PrepareRequest):
    """Prepare applications (resume + cover letter) for matched jobs."""
    jobs = await logging_agent.search_jobs(
        status=JobStatus.MATCHED,
        min_score=req.min_score,
        limit=req.limit,
    )

    prepared = 0
    for job in jobs:
        try:
            tailored = await tailor_agent.execute(job)
            await cover_letter_agent.execute(job, tailored)
            prepared += 1
        except Exception as e:
            logger.error(f"Failed to prepare application for {job.id}: {e}")

    return MessageResponse(
        message=f"Prepared {prepared} of {len(jobs)} applications",
        count=prepared,
    )


@app.post("/api/apply", response_model=MessageResponse)
async def submit_application(req: ApplyRequest):
    """Submit a prepared application."""
    from sqlalchemy import select

    async with get_session() as session:
        result = await session.execute(
            select(Application, Job).join(Job).where(Application.id == req.application_id)
        )
        row = result.one_or_none()
        if not row:
            raise HTTPException(404, "Application not found")

        application, job = row

    success = await application_agent.execute(
        job=job,
        application=application,
        skip_review=req.skip_review,
    )

    if success:
        return MessageResponse(message="Application submitted successfully")
    else:
        raise HTTPException(500, "Application submission failed")


@app.post("/api/approve/{application_id}", response_model=MessageResponse)
async def approve_application(application_id: str):
    """Approve an application for submission."""
    success = await application_agent.approve_application(application_id)
    if success:
        return MessageResponse(message="Application approved")
    else:
        raise HTTPException(404, "Application not found or already approved")


@app.post("/api/tailor_resume")
async def tailor_resume_manual(
    master_resume_file: Optional[UploadFile] = File(None),
    master_resume_text: Optional[str] = Form(None),
    job_description_file: Optional[UploadFile] = File(None),
    job_description_text: Optional[str] = Form(None),
):
    """Tailor a provided resume for a given job description with support for files."""
    try:
        from hireflow.workflows.resume_tailor_graph import (
            run_resume_tailor_graph,
            parse_resume_to_json,
        )
        from hireflow.utils.document_parser import extract_text_from_pdf, extract_text_from_docx
        import json

        # 1. Process Job Description
        jd_content = ""
        if job_description_file:
            content = await job_description_file.read()
            filename = job_description_file.filename.lower()
            if filename.endswith(".pdf"):
                jd_content = extract_text_from_pdf(content)
            elif filename.endswith(".docx"):
                jd_content = extract_text_from_docx(content)
            else:
                jd_content = content.decode("utf-8")
        elif job_description_text:
            jd_content = job_description_text

        if not jd_content.strip():
            raise HTTPException(400, "Job description is empty")

        # 2. Process Master Resume
        master_resume_json = None
        if master_resume_file:
            content = await master_resume_file.read()
            filename = master_resume_file.filename.lower()
            if filename.endswith(".json"):
                master_resume_json = json.loads(content.decode("utf-8"))
            else:
                # PDF or DOCX -> extract text
                if filename.endswith(".pdf"):
                    resume_text = extract_text_from_pdf(content)
                elif filename.endswith(".docx"):
                    resume_text = extract_text_from_docx(content)
                else:
                    resume_text = content.decode("utf-8")
                # AI parse to JSON
                master_resume_json = await parse_resume_to_json(resume_text)

        elif master_resume_text:
            try:
                # Try parsing as JSON first
                master_resume_json = json.loads(master_resume_text)
            except json.JSONDecodeError:
                # Not JSON, let AI parse it
                master_resume_json = await parse_resume_to_json(master_resume_text)

        if not master_resume_json:
            raise HTTPException(400, "Master resume could not be processed")

        from hireflow.models.vector_db import store_resume_in_vector_db
        import uuid

        # 3. Store Master Resume in PostgreSQL via pgvector
        resume_id = str(uuid.uuid4())
        try:
            await store_resume_in_vector_db(master_resume_json, resume_id)
        except Exception as db_err:
            logger.warning(
                f"Failed to store vector data. Is PostgreSQL running with pgvector? Error: {db_err}"
            )
            # Proceeding anyway just to not crash completely, though retrieval will fail in graph.
            # You can decide to raise HTTPException here: raise HTTPException(500, "Database error")

        # 4. Execute LangGraph Workflow as a Server-Sent Events stream
        # Since run_resume_tailor_graph is now an async generator yielding string chunks

        return StreamingResponse(
            run_resume_tailor_graph(jd_content, resume_id), media_type="text/event-stream"
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Manual resume tailoring failed: {e}")
        raise HTTPException(500, f"Tailoring failed: {str(e)}")


# --- Applications ---


@app.get("/api/applications", response_model=list[ApplicationResponse])
async def list_applications(
    status: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
):
    """List all applications."""
    from sqlalchemy import select, desc

    async with get_session() as session:
        stmt = (
            select(Application, Job)
            .join(Job, Application.job_id == Job.id)
            .order_by(desc(Application.created_at))
        )

        if status:
            try:
                app_status = ApplicationStatus(status)
                stmt = stmt.where(Application.status == app_status)
            except ValueError:
                raise HTTPException(400, f"Invalid status: {status}")

        stmt = stmt.limit(limit)
        result = await session.execute(stmt)
        rows = result.all()

        return [
            ApplicationResponse(
                id=app.id,
                job_id=app.job_id,
                status=app.status.value if app.status else "draft",
                cover_letter=app.cover_letter[:200] if app.cover_letter else None,
                match_score=job.match_score,
                created_at=str(app.created_at) if app.created_at else None,
                company=job.company,
                role=job.role,
            )
            for app, job in rows
        ]


@app.get("/api/pending", response_model=list[dict])
async def pending_reviews():
    """Get applications pending human review."""
    return await logging_agent.get_pending_reviews()


# --- Stats ---


@app.get("/api/stats", response_model=StatsResponse)
async def get_stats():
    """Get pipeline statistics."""
    stats = await logging_agent.execute()
    return stats
