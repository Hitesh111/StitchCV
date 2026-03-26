from __future__ import annotations

"""FastAPI REST API for StitchCV."""

import asyncio
import base64
import json
from typing import Any, Optional

import structlog
from fastapi import FastAPI, HTTPException, Depends, UploadFile, File, Form, Query, Request
from fastapi.responses import JSONResponse, StreamingResponse, Response, RedirectResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from stitchcv.models import (
    init_db,
    get_session,
    Job,
    JobStatus,
    Application,
    ApplicationStatus,
    ApplicationLog,
    ResumeVersion,
    User,
    Transaction,
    Coupon,
)
from stitchcv.auth import (
    SESSION_COOKIE_NAME,
    OAUTH_STATE_COOKIE_NAME,
    build_google_oauth_url,
    build_linkedin_oauth_url,
    complete_google_oauth,
    complete_linkedin_oauth,
    create_db_session,
    delete_session_by_token,
    find_user_by_email,
    get_current_user_optional,
    hash_password,
    sanitize_next_path,
    verify_password,
    require_current_user,
)
from stitchcv.agents import (
    JobDiscoveryAgent,
    JDAnalyzerAgent,
    ResumeTailorAgent,
    CoverLetterAgent,
    ApplicationAgent,
    LoggingMemoryAgent,
)
from stitchcv.config import settings
from stitchcv.scrapers import LinkedInScraper

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


class AuthUserResponse(BaseModel):
    id: str
    email: str
    full_name: str
    avatar_url: Optional[str] = None
    credits: int = 3


class SignupRequest(BaseModel):
    email: str
    full_name: str = Field(min_length=2, max_length=255)
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    email: str
    password: str = Field(min_length=8, max_length=128)


def _serialize_user(user: User) -> AuthUserResponse:
    return AuthUserResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        avatar_url=user.avatar_url,
        credits=user.credits,
    )


def _set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=token,
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=14 * 24 * 60 * 60,
        path="/",
    )


def _normalize_email(email: str) -> str:
    normalized = email.lower().strip()
    if "@" not in normalized or "." not in normalized.split("@")[-1]:
        raise HTTPException(400, "Enter a valid email address")
    return normalized


# --- App setup ---

app = FastAPI(
    title="StitchCV API",
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


@app.get("/api/auth/me", response_model=AuthUserResponse)
async def get_me(request: Request):
    """Return current signed-in user."""
    user = await get_current_user_optional(request)
    if not user:
        raise HTTPException(401, "Not authenticated")
    return _serialize_user(user)


@app.post("/api/auth/signup", response_model=AuthUserResponse)
async def signup(payload: SignupRequest, response: Response):
    """Create a local account and start a session."""
    email = _normalize_email(payload.email)
    existing = await find_user_by_email(email)
    if existing:
        raise HTTPException(400, "An account with this email already exists")

    async with get_session() as session:
        user = User(
            email=email,
            full_name=payload.full_name.strip(),
            password_hash=hash_password(payload.password),
        )
        session.add(user)
        await session.flush()

    token, _ = await create_db_session(user)
    _set_session_cookie(response, token)
    return _serialize_user(user)


@app.post("/api/auth/login", response_model=AuthUserResponse)
async def login(payload: LoginRequest, response: Response):
    """Authenticate with email and password."""
    user = await find_user_by_email(_normalize_email(payload.email))
    if not user or not user.password_hash or not verify_password(payload.password, user.password_hash):
        raise HTTPException(401, "Invalid email or password")

    token, _ = await create_db_session(user)
    _set_session_cookie(response, token)
    return _serialize_user(user)


@app.post("/api/auth/logout", response_model=MessageResponse)
async def logout(request: Request, response: Response):
    """Destroy current session."""
    await delete_session_by_token(request.cookies.get(SESSION_COOKIE_NAME))
    response.delete_cookie(SESSION_COOKIE_NAME, path="/")
    return MessageResponse(message="Signed out")


@app.get("/api/auth/oauth/google/start")
async def google_oauth_start(request: Request, next: Optional[str] = Query("/")):
    """Start Google OAuth."""
    if not settings.google_client_id or not settings.google_client_secret:
        raise HTTPException(400, "Google OAuth is not configured")
    state = f"{sanitize_next_path(next)}|{build_google_oauth_url.__name__}"
    nonce = base64.urlsafe_b64encode(json.dumps({"state": state}).encode()).decode()
    oauth_state = f"{sanitize_next_path(next)}|google|{nonce}"
    redirect = RedirectResponse(build_google_oauth_url(request, oauth_state), status_code=302)
    redirect.set_cookie(
        OAUTH_STATE_COOKIE_NAME,
        oauth_state,
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=600,
        path="/",
    )
    return redirect


@app.get("/api/auth/oauth/linkedin/start")
async def linkedin_oauth_start(request: Request, next: Optional[str] = Query("/")):
    """Start LinkedIn OAuth."""
    if not settings.linkedin_client_id or not settings.linkedin_client_secret:
        raise HTTPException(400, "LinkedIn OAuth is not configured")
    oauth_state = f"{sanitize_next_path(next)}|linkedin|{base64.urlsafe_b64encode(json.dumps({'n': next}).encode()).decode()}"
    redirect = RedirectResponse(build_linkedin_oauth_url(request, oauth_state), status_code=302)
    redirect.set_cookie(
        OAUTH_STATE_COOKIE_NAME,
        oauth_state,
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=600,
        path="/",
    )
    return redirect


@app.get("/api/auth/oauth/google/callback")
async def google_oauth_callback(
    request: Request,
    code: Optional[str] = Query(None),
    state: Optional[str] = Query(None),
    error: Optional[str] = Query(None),
):
    """Finish Google OAuth."""
    return await _oauth_callback_common(
        request=request,
        provider="google",
        code=code,
        state=state,
        error=error,
    )


@app.get("/api/auth/oauth/linkedin/callback")
async def linkedin_oauth_callback(
    request: Request,
    code: Optional[str] = Query(None),
    state: Optional[str] = Query(None),
    error: Optional[str] = Query(None),
):
    """Finish LinkedIn OAuth."""
    return await _oauth_callback_common(
        request=request,
        provider="linkedin",
        code=code,
        state=state,
        error=error,
    )


async def _oauth_callback_common(
    *,
    request: Request,
    provider: str,
    code: Optional[str],
    state: Optional[str],
    error: Optional[str],
) -> RedirectResponse:
    cookie_state = request.cookies.get(OAUTH_STATE_COOKIE_NAME)
    next_path = "/"
    if cookie_state:
        next_path = sanitize_next_path(cookie_state.split("|", 1)[0])
    target_base = "google" if provider == "google" else "linkedin"
    if error:
        return RedirectResponse(
            f"{settings.frontend_base_url}/login?error={error}",
            status_code=302,
        )
    if not code or not state or not cookie_state or state != cookie_state or f"|{target_base}|" not in state:
        return RedirectResponse(
            f"{settings.frontend_base_url}/login?error=oauth_state_mismatch",
            status_code=302,
        )

    user = await (complete_google_oauth(request, code) if provider == "google" else complete_linkedin_oauth(request, code))
    token, _ = await create_db_session(user)
    redirect = RedirectResponse(f"{settings.frontend_base_url}{next_path}", status_code=302)
    _set_session_cookie(redirect, token)
    redirect.delete_cookie(OAUTH_STATE_COOKIE_NAME, path="/")
    return redirect


# --- Billing ---

class CreateOrderRequest(BaseModel):
    package_id: str
    coupon_code: Optional[str] = None

class VerifyPaymentRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str

@app.get("/api/billing/config")
async def get_billing_config(current_user: User = Depends(require_current_user)):
    return {"razorpay_key_id": settings.razorpay_key_id}

@app.post("/api/billing/create-order")
async def create_billing_order(req: CreateOrderRequest, current_user: User = Depends(require_current_user)):
    from stitchcv.services.billing_service import get_razorpay_client
    from sqlalchemy import select
    
    packages = {
        "starter": {"price": 49, "credits": 5},
        "pro": {"price": 99, "credits": 12},
        "elite": {"price": 199, "credits": 30}
    }
    
    if req.package_id not in packages:
        raise HTTPException(400, "Invalid package selected")
        
    amount_inr = packages[req.package_id]["price"]
    credits_to_award = packages[req.package_id]["credits"]

    async with get_session() as session:
        if req.coupon_code:
            result = await session.execute(select(Coupon).where(Coupon.code == req.coupon_code.upper(), Coupon.is_active == True))
            coupon = result.scalar_one_or_none()
            if not coupon:
                raise HTTPException(404, "Invalid or expired coupon")
            if coupon.max_uses and coupon.current_uses >= coupon.max_uses:
                raise HTTPException(400, "Coupon usage limit reached")
                
            discount = int(amount_inr * (coupon.discount_percentage / 100))
            amount_inr -= discount
            
        amount_paise = amount_inr * 100
        
        client = get_razorpay_client()
        if not client:
            raise HTTPException(500, "Payment gateway not configured")
            
        order_data = {
            "amount": amount_paise,
            "currency": "INR",
            "receipt": f"rcpt_{current_user.id[:8]}",
            "notes": {"user_id": current_user.id, "package": req.package_id}
        }
        
        try:
            order = client.order.create(data=order_data)
        except Exception as e:
            logger.error(f"Razorpay order creation failed: {e}")
            raise HTTPException(500, "Failed to initialize payment")
            
        transaction = Transaction(
            user_id=current_user.id,
            razorpay_order_id=order["id"],
            amount_paise=amount_paise,
            credits_awarded=credits_to_award
        )
        session.add(transaction)
        await session.flush()
        
        if req.coupon_code:
            coupon.current_uses += 1
            
        await session.commit()
        return {"order_id": order["id"], "amount": amount_paise, "currency": "INR"}

@app.post("/api/billing/verify-payment")
async def verify_payment(req: VerifyPaymentRequest, current_user: User = Depends(require_current_user)):
    from stitchcv.services.billing_service import verify_razorpay_signature
    from sqlalchemy import select
    
    is_valid = verify_razorpay_signature(req.razorpay_order_id, req.razorpay_payment_id, req.razorpay_signature)
    
    if not is_valid:
        raise HTTPException(400, "Invalid payment signature")
        
    async with get_session() as session:
        result = await session.execute(select(Transaction).where(Transaction.razorpay_order_id == req.razorpay_order_id))
        transaction = result.scalar_one_or_none()
        
        if not transaction:
            raise HTTPException(404, "Transaction not found")
        if transaction.status == "success":
            return {"status": "success", "credits_awarded": 0}
            
        transaction.status = "success"
        transaction.razorpay_payment_id = req.razorpay_payment_id
        
        result = await session.execute(select(User).where(User.id == current_user.id))
        db_user = result.scalar_one()
        db_user.credits += transaction.credits_awarded
        
        await session.commit()
        return {"status": "success", "credits_awarded": transaction.credits_awarded}


# --- Jobs ---


@app.get("/api/jobs", response_model=list[JobResponse])
async def list_jobs(
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    min_score: Optional[float] = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(require_current_user),
):
    """List all jobs with optional filters."""
    from sqlalchemy import select, desc

    async with get_session() as session:
        stmt = select(Job).where((Job.user_id == current_user.id) | (Job.user_id.is_(None))).order_by(desc(Job.created_at))

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
async def get_job(job_id: str, current_user: User = Depends(require_current_user)):
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
async def discover_jobs(req: DiscoverRequest, current_user: User = Depends(require_current_user)):
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
async def analyze_jobs(req: AnalyzeRequest, current_user: User = Depends(require_current_user)):
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
async def prepare_applications(
    req: PrepareRequest, current_user: User = Depends(require_current_user)
):
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
async def submit_application(req: ApplyRequest, current_user: User = Depends(require_current_user)):
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
async def approve_application(
    application_id: str, current_user: User = Depends(require_current_user)
):
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
    job_description_url: Optional[str] = Form(None),
    current_user: User = Depends(require_current_user),
):
    """Tailor a provided resume for a given job description with support for files."""
    if current_user.credits < 1:
        raise HTTPException(403, "Insufficient credits. Please purchase more credits to continue tailoring resumes.")
        
    try:
        from stitchcv.workflows.resume_tailor_graph import (
            run_resume_tailor_graph,
            parse_resume_to_json,
        )
        from stitchcv.utils.document_parser import (
            extract_text_from_pdf,
            extract_text_from_docx,
            extract_job_description_from_url,
        )
        # 1. Process Job Description
        jd_content = ""
        jd_from_url = False
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
        elif job_description_url:
            jd_from_url = True
            jd_content = await extract_job_description_from_url(job_description_url.strip())

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

        from stitchcv.models.vector_db import store_resume_in_vector_db
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

        async def stream_tailor_response():
            if jd_from_url:
                payload = base64.b64encode(
                    json.dumps({"job_description": jd_content}).encode()
                ).decode()
                yield f"event: jd_preview\ndata: {payload}\n\n"

            final_resume_dict = None
            company_name = "Target Company"
            job_role = "Tailored Role"
            async for chunk in run_resume_tailor_graph(jd_content, resume_id, master_resume_json):
                if chunk.startswith("event: result\ndata: "):
                    try:
                        encoded = chunk[len("event: result\ndata: "):].strip()
                        payload_str = base64.b64decode(encoded).decode('utf-8')
                        payload = json.loads(payload_str)
                        final_resume_dict = json.loads(payload.get("formatted_resume", "{}"))
                        company_name = payload.get("company", "Target Company")
                        job_role = payload.get("title", "Tailored Role")
                    except Exception:
                        pass
                yield chunk

            # Database updates (Credits, Job, Application, ResumeVersion)
            from sqlalchemy import select
            import uuid
            async with get_session() as session:
                # 1. Deduct credits
                result = await session.execute(select(User).where(User.id == current_user.id))
                db_user = result.scalar_one()
                db_user.credits = max(0, db_user.credits - 1)
                
                # 2. Save tailored resume context
                if final_resume_dict:
                    try:
                        # Create Job entry for tracing
                        new_job = Job(
                            id=str(uuid.uuid4()),
                            company=company_name,
                            role=job_role,
                            location="Remote",
                            job_description=jd_content[:5000],
                            apply_link=f"manual-{uuid.uuid4()}",
                            source="manual",
                            content_hash=Job.compute_content_hash("Custom", "Custom", jd_content[:200] + str(uuid.uuid4())),
                            user_id=current_user.id
                        )
                        session.add(new_job)

                        # Create Application entry
                        new_app = Application(
                            id=str(uuid.uuid4()),
                            job_id=new_job.id,
                            user_id=current_user.id,
                            status=ApplicationStatus.APPROVED
                        )
                        session.add(new_app)
                        
                        # Create ResumeVersion entry
                        new_resume = ResumeVersion(
                            id=str(uuid.uuid4()),
                            application_id=new_app.id,
                            content=final_resume_dict
                        )
                        session.add(new_resume)
                    except Exception as e:
                        logger.error(f"Failed to save customized resume to DB: {e}")

                await session.commit()

        return StreamingResponse(stream_tailor_response(), media_type="text/event-stream")
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        logger.error(f"Manual resume tailoring failed: {e}")
        raise HTTPException(500, f"Tailoring failed: {str(e)}")





# --- Applications ---

class UpdateApplicationRequest(BaseModel):
    company: Optional[str] = None
    role: Optional[str] = None
    status: Optional[str] = None

@app.put("/api/applications/{id}")
async def update_application(id: str, req: UpdateApplicationRequest, current_user: User = Depends(require_current_user)):
    from sqlalchemy import select
    async with get_session() as session:
        result = await session.execute(
            select(Application, Job)
            .join(Job, Application.job_id == Job.id)
            .where(Application.id == id, Application.user_id == current_user.id)
        )
        row = result.first()
        if not row:
            raise HTTPException(404, "Application not found")
            
        app_obj, job_obj = row
        
        if req.status:
            try:
                app_obj.status = ApplicationStatus(req.status)
            except ValueError:
                raise HTTPException(400, "Invalid status")
                
        if req.company:
            job_obj.company = req.company
            
        if req.role:
            job_obj.role = req.role
            
        await session.commit()
        return {"success": True}

@app.delete("/api/applications/{id}")
async def delete_application(id: str, current_user: User = Depends(require_current_user)):
    from sqlalchemy import select
    async with get_session() as session:
        result = await session.execute(select(Application).where(Application.id == id, Application.user_id == current_user.id))
        app_obj = result.scalar_one_or_none()
        if not app_obj:
            raise HTTPException(404, "Application not found")
            
        # Optional: delete the associated Job if it's the only application for it
        job_id = app_obj.job_id
        await session.delete(app_obj)
        
        # Check if job is still used
        job_apps = await session.execute(select(Application).where(Application.job_id == job_id))
        if len(job_apps.all()) == 0:
            job_to_del = await session.execute(select(Job).where(Job.id == job_id))
            job_obj = job_to_del.scalar_one_or_none()
            if job_obj:
                await session.delete(job_obj)
                
        await session.commit()
        return {"success": True}


@app.get("/api/applications", response_model=list[ApplicationResponse])
async def list_applications(
    status: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    current_user: User = Depends(require_current_user),
):
    """List all applications."""
    from sqlalchemy import select, desc

    async with get_session() as session:
        stmt = (
            select(Application, Job)
            .join(Job, Application.job_id == Job.id)
            .where(Application.user_id == current_user.id)
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


@app.get("/api/applications/{id}/resume")
async def get_application_resume(id: str, current_user: User = Depends(require_current_user)):
    """Fetch the JSON payload of the tailored resume for a specific application."""
    from sqlalchemy import select
    
    async with get_session() as session:
        result = await session.execute(select(Application).where(Application.id == id, Application.user_id == current_user.id))
        application = result.scalar_one_or_none()
        if not application:
            raise HTTPException(404, "Application not found")
            
        res_ver_result = await session.execute(
            select(ResumeVersion)
            .where(ResumeVersion.application_id == id)
            .order_by(ResumeVersion.created_at.desc())
        )
        resume_version = res_ver_result.scalars().first()
        if not resume_version:
            raise HTTPException(404, "Resume not found for this application")
            
        return resume_version.content


@app.get("/api/pending", response_model=list[dict])
async def pending_reviews(current_user: User = Depends(require_current_user)):
    """Get applications pending human review."""
    return await logging_agent.get_pending_reviews()


# --- Stats ---


@app.get("/api/stats", response_model=StatsResponse)
async def get_stats(current_user: User = Depends(require_current_user)):
    """Get pipeline statistics."""
    stats = await logging_agent.execute()
    return stats
