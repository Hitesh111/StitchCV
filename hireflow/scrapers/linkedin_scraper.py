from __future__ import annotations
"""LinkedIn job scraper."""

from typing import Any, Optional
import urllib.parse

from hireflow.scrapers.base_scraper import BaseScraper
from hireflow.services.browser_service import browser_service


class LinkedInScraper(BaseScraper):
    """Scraper for LinkedIn Jobs.

    Note: LinkedIn has strict anti-scraping measures. This scraper uses
    browser automation and requires the user to be logged in.
    """

    def __init__(self):
        super().__init__("LinkedIn")
        self.base_url = "https://www.linkedin.com/jobs/search/"
        self.login_indicator = ".global-nav__me-photo"

    async def search_jobs(
        self,
        query: str,
        location: Optional[str] = None,
        max_results: int = 20,
    ) -> list[dict[str, Any]]:
        """Search for jobs on LinkedIn.

        Args:
            query: Job title or keywords
            location: Location filter
            max_results: Maximum jobs to return

        Returns:
            List of job dictionaries
        """
        await self._wait_for_rate_limit()
        jobs = []

        async with browser_service.new_page() as page:
            # Build search URL
            params = {"keywords": query}
            if location:
                params["location"] = location

            url = f"{self.base_url}?{urllib.parse.urlencode(params)}"
            self.logger.info(f"Searching LinkedIn: {url}")

            await page.goto(url)
            await browser_service.wait_for_navigation(page)

            # Check if logged in
            if not await browser_service.is_logged_in(page, self.login_indicator):
                self.logger.warning("Not logged into LinkedIn. Please log in manually.")
                # Wait for user to log in
                print("\n⚠️  Please log into LinkedIn in the browser window...")
                await page.wait_for_selector(self.login_indicator, timeout=120000)
                self.logger.info("Login detected, continuing...")

            # Wait for job cards to load
            job_card_selector = ".job-card-container"
            try:
                await page.wait_for_selector(job_card_selector, timeout=10000)
            except Exception:
                self.logger.warning("No job cards found")
                return jobs

            # Extract job cards
            cards = await page.query_selector_all(job_card_selector)
            self.logger.info(f"Found {len(cards)} job cards")

            for i, card in enumerate(cards[:max_results]):
                try:
                    job = await self._extract_job_card(card, page)
                    if job:
                        jobs.append(job)
                except Exception as e:
                    self.logger.debug(f"Failed to extract job card {i}: {e}")

                await browser_service.human_like_delay(300, 600)

        self.logger.info(f"Extracted {len(jobs)} jobs from LinkedIn")
        return jobs

    async def _extract_job_card(
        self,
        card: Any,
        page: Any,
    ) -> Optional[dict[str, Any]]:
        """Extract job info from a job card element.

        Args:
            card: Playwright element handle
            page: Playwright page

        Returns:
            Job dictionary or None
        """
        try:
            # Extract basic info from card
            title_el = await card.query_selector(".job-card-list__title")
            company_el = await card.query_selector(".job-card-container__company-name")
            location_el = await card.query_selector(".job-card-container__metadata-item")
            link_el = await card.query_selector("a.job-card-container__link")

            if not all([title_el, company_el, link_el]):
                return None

            role = await title_el.inner_text()
            company = await company_el.inner_text()
            location = await location_el.inner_text() if location_el else "Unknown"
            href = await link_el.get_attribute("href")

            # Construct full URL
            if href and href.startswith("/"):
                apply_link = f"https://www.linkedin.com{href}"
            else:
                apply_link = href or ""

            # Click to load full description
            await card.click()
            await browser_service.human_like_delay(500, 1000)

            # Extract job description
            desc_selector = ".jobs-description-content__text"
            try:
                await page.wait_for_selector(desc_selector, timeout=5000)
                desc_el = await page.query_selector(desc_selector)
                job_description = await desc_el.inner_text() if desc_el else ""
            except Exception:
                job_description = ""

            return {
                "company": company.strip(),
                "role": role.strip(),
                "location": location.strip(),
                "job_description": job_description.strip(),
                "apply_link": apply_link,
            }

        except Exception as e:
            self.logger.debug(f"Error extracting job card: {e}")
            return None

    async def get_job_details(self, job_url: str) -> Optional[dict[str, Any]]:
        """Get full details for a LinkedIn job.

        Args:
            job_url: LinkedIn job URL

        Returns:
            Job dictionary or None
        """
        await self._wait_for_rate_limit()

        async with browser_service.new_page() as page:
            await page.goto(job_url)
            await browser_service.wait_for_navigation(page)

            try:
                # Wait for content to load
                await page.wait_for_selector(".jobs-unified-top-card", timeout=10000)

                title_el = await page.query_selector(".jobs-unified-top-card__job-title")
                company_el = await page.query_selector(".jobs-unified-top-card__company-name")
                location_el = await page.query_selector(".jobs-unified-top-card__bullet")
                desc_el = await page.query_selector(".jobs-description-content__text")

                role = await title_el.inner_text() if title_el else "Unknown"
                company = await company_el.inner_text() if company_el else "Unknown"
                location = await location_el.inner_text() if location_el else "Unknown"
                job_description = await desc_el.inner_text() if desc_el else ""

                return {
                    "company": company.strip(),
                    "role": role.strip(),
                    "location": location.strip(),
                    "job_description": job_description.strip(),
                    "apply_link": job_url,
                }

            except Exception as e:
                self.logger.error(f"Failed to get job details: {e}")
                return None
