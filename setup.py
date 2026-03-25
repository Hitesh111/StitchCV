"""Setup file for editable installation."""

from setuptools import setup, find_packages

setup(
    name="stichcv",
    version="0.1.0",
    packages=find_packages(),
    python_requires=">=3.9",
    install_requires=[
        "google-genai>=1.0.0",
        "playwright>=1.48.0",
        "sqlalchemy[asyncio]>=2.0.0",
        "aiosqlite>=0.20.0",
        "pydantic>=2.0.0",
        "pydantic-settings>=2.0.0",
        "python-dotenv>=1.0.0",
        "aiohttp>=3.9.0",
        "tenacity>=8.2.0",
        "structlog>=24.0.0",
        "beautifulsoup4>=4.12.0",
        "lxml>=5.0.0",
        "fastapi>=0.110.0",
        "uvicorn[standard]>=0.27.0",
    ],
    extras_require={
        "dev": [
            "pytest>=8.0.0",
            "pytest-asyncio>=0.24.0",
            "pytest-cov>=4.1.0",
            "ruff>=0.5.0",
        ],
    },
    entry_points={
        "console_scripts": [
            "stichcv=stichcv.main:main",
        ],
    },
)
