from __future__ import annotations
"""Scrapers package - job site scrapers."""

from hireflow.scrapers.base_scraper import BaseScraper
from hireflow.scrapers.linkedin_scraper import LinkedInScraper

__all__ = ["BaseScraper", "LinkedInScraper"]
