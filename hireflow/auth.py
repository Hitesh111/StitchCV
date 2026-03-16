from __future__ import annotations
"""Authentication helpers and OAuth integrations."""

import base64
import hashlib
import os
from datetime import datetime, timedelta
from typing import Any

import bcrypt
import httpx
from fastapi import HTTPException, Request
from sqlalchemy import delete, select
from sqlalchemy.orm import selectinload

from hireflow.config import settings
from hireflow.models import OAuthAccount, User, UserSession, get_session

SESSION_COOKIE_NAME = "hireflow_session"
OAUTH_STATE_COOKIE_NAME = "hireflow_oauth_state"
SESSION_DAYS = 14


def _utcnow() -> datetime:
    return datetime.utcnow()


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))


def generate_session_token() -> str:
    return base64.urlsafe_b64encode(os.urandom(32)).decode("utf-8").rstrip("=")


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def make_oauth_state(provider: str) -> str:
    random_part = base64.urlsafe_b64encode(os.urandom(18)).decode("utf-8").rstrip("=")
    return f"{provider}:{random_part}"


def get_app_base_url(request: Request) -> str:
    explicit = settings.app_base_url.rstrip("/")
    if explicit:
        return explicit
    return f"{request.url.scheme}://{request.headers.get('host', '127.0.0.1:8000')}"


def get_frontend_base_url() -> str:
    return settings.frontend_base_url.rstrip("/")


async def create_db_session(user: User) -> tuple[str, datetime]:
    token = generate_session_token()
    expires_at = _utcnow() + timedelta(days=SESSION_DAYS)
    async with get_session() as session:
        session.add(
            UserSession(
                user_id=user.id,
                session_token_hash=hash_token(token),
                expires_at=expires_at,
            )
        )
    return token, expires_at


async def get_current_user_optional(request: Request) -> User | None:
    session_token = request.cookies.get(SESSION_COOKIE_NAME)
    if not session_token:
        return None

    async with get_session() as session:
        stmt = (
            select(UserSession)
            .options(selectinload(UserSession.user))
            .where(UserSession.session_token_hash == hash_token(session_token))
        )
        result = await session.execute(stmt)
        db_session = result.scalar_one_or_none()
        if not db_session:
            return None
        if db_session.expires_at < _utcnow():
            await session.execute(delete(UserSession).where(UserSession.id == db_session.id))
            return None
        return db_session.user


async def require_current_user(request: Request) -> User:
    user = await get_current_user_optional(request)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    return user


async def delete_session_by_token(token: str | None) -> None:
    if not token:
        return
    async with get_session() as session:
        await session.execute(
            delete(UserSession).where(UserSession.session_token_hash == hash_token(token))
        )


async def find_user_by_email(email: str) -> User | None:
    async with get_session() as session:
        result = await session.execute(select(User).where(User.email == email.lower().strip()))
        return result.scalar_one_or_none()


async def get_or_create_oauth_user(
    *,
    provider: str,
    provider_user_id: str,
    email: str,
    full_name: str,
    avatar_url: str | None = None,
) -> User:
    normalized_email = email.lower().strip()
    async with get_session() as session:
        stmt = (
            select(OAuthAccount)
            .options(selectinload(OAuthAccount.user))
            .where(
                OAuthAccount.provider == provider,
                OAuthAccount.provider_user_id == provider_user_id,
            )
        )
        result = await session.execute(stmt)
        account = result.scalar_one_or_none()
        if account:
            if avatar_url and account.user.avatar_url != avatar_url:
                account.user.avatar_url = avatar_url
            return account.user

        result = await session.execute(select(User).where(User.email == normalized_email))
        user = result.scalar_one_or_none()
        if not user:
            user = User(email=normalized_email, full_name=full_name, avatar_url=avatar_url)
            session.add(user)
            await session.flush()
        elif full_name and not user.full_name:
            user.full_name = full_name

        session.add(
            OAuthAccount(
                user_id=user.id,
                provider=provider,
                provider_user_id=provider_user_id,
                email=normalized_email,
            )
        )
        return user


def build_google_oauth_url(request: Request, state: str) -> str:
    base_url = get_app_base_url(request)
    redirect_uri = f"{base_url}/api/auth/oauth/google/callback"
    params = {
        "client_id": settings.google_client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "offline",
        "prompt": "select_account",
        "state": state,
    }
    return f"https://accounts.google.com/o/oauth2/v2/auth?{httpx.QueryParams(params)}"


async def complete_google_oauth(request: Request, code: str) -> User:
    base_url = get_app_base_url(request)
    redirect_uri = f"{base_url}/api/auth/oauth/google/callback"
    async with httpx.AsyncClient(timeout=20.0) as client:
        token_response = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "code": code,
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "redirect_uri": redirect_uri,
                "grant_type": "authorization_code",
            },
        )
        token_response.raise_for_status()
        access_token = token_response.json()["access_token"]
        profile_response = await client.get(
            "https://openidconnect.googleapis.com/v1/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        profile_response.raise_for_status()
        profile = profile_response.json()

    email = profile.get("email")
    if not email:
        raise HTTPException(400, "Google account did not provide an email")
    return await get_or_create_oauth_user(
        provider="google",
        provider_user_id=profile["sub"],
        email=email,
        full_name=profile.get("name") or email.split("@")[0],
        avatar_url=profile.get("picture"),
    )


def build_linkedin_oauth_url(request: Request, state: str) -> str:
    base_url = get_app_base_url(request)
    redirect_uri = f"{base_url}/api/auth/oauth/linkedin/callback"
    params = {
        "response_type": "code",
        "client_id": settings.linkedin_client_id,
        "redirect_uri": redirect_uri,
        "state": state,
        "scope": "openid profile email",
    }
    return f"https://www.linkedin.com/oauth/v2/authorization?{httpx.QueryParams(params)}"


async def complete_linkedin_oauth(request: Request, code: str) -> User:
    base_url = get_app_base_url(request)
    redirect_uri = f"{base_url}/api/auth/oauth/linkedin/callback"
    async with httpx.AsyncClient(timeout=20.0) as client:
        token_response = await client.post(
            "https://www.linkedin.com/oauth/v2/accessToken",
            data={
                "grant_type": "authorization_code",
                "code": code,
                "client_id": settings.linkedin_client_id,
                "client_secret": settings.linkedin_client_secret,
                "redirect_uri": redirect_uri,
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        token_response.raise_for_status()
        access_token = token_response.json()["access_token"]
        profile_response = await client.get(
            "https://api.linkedin.com/v2/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        profile_response.raise_for_status()
        profile = profile_response.json()

    email = profile.get("email")
    if not email:
        raise HTTPException(400, "LinkedIn account did not provide an email")
    return await get_or_create_oauth_user(
        provider="linkedin",
        provider_user_id=profile["sub"],
        email=email,
        full_name=profile.get("name") or email.split("@")[0],
        avatar_url=profile.get("picture"),
    )


def sanitize_next_path(next_path: str | None) -> str:
    if not next_path or not next_path.startswith("/"):
        return "/"
    return next_path
