from __future__ import annotations
"""Browser automation service using Playwright."""

import asyncio
from pathlib import Path
from typing import Optional
from contextlib import asynccontextmanager

from playwright.async_api import async_playwright, Browser, BrowserContext, Page

from stitchcv.config import settings


class BrowserService:
    """Manages Playwright browser for automation tasks."""

    def __init__(self):
        self._playwright = None
        self._browser: Optional[Browser] = None
        self._context: Optional[BrowserContext] = None
        self.screenshots_dir = Path("screenshots")
        self.screenshots_dir.mkdir(exist_ok=True)

    async def start(self) -> None:
        """Start the browser."""
        self._playwright = await async_playwright().start()
        self._browser = await self._playwright.chromium.launch(
            headless=settings.headless,
            slow_mo=settings.slow_mo,
        )
        self._context = await self._browser.new_context(
            viewport={"width": 1280, "height": 800},
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        )

    async def stop(self) -> None:
        """Stop the browser and cleanup."""
        if self._context:
            await self._context.close()
        if self._browser:
            await self._browser.close()
        if self._playwright:
            await self._playwright.stop()

    @asynccontextmanager
    async def new_page(self):
        """Create a new page context."""
        if not self._browser:
            await self.start()

        page = await self._context.new_page()
        page.set_default_timeout(settings.browser_timeout)

        try:
            yield page
        finally:
            await page.close()

    async def screenshot_on_error(self, page: Page, name: str) -> str:
        """Take a screenshot for debugging."""
        path = self.screenshots_dir / f"{name}.png"
        await page.screenshot(path=str(path))
        return str(path)

    async def human_like_delay(self, min_ms: int = 500, max_ms: int = 1500) -> None:
        """Add a random delay to simulate human behavior."""
        import random

        delay = random.randint(min_ms, max_ms) / 1000
        await asyncio.sleep(delay)

    async def safe_click(
        self,
        page: Page,
        selector: str,
        fallback_selectors: Optional[list[str]] = None,
        timeout: int = 5000,
    ) -> bool:
        """Click an element with fallback selectors.

        Args:
            page: Playwright page
            selector: Primary CSS selector
            fallback_selectors: Alternative selectors to try
            timeout: Timeout in milliseconds

        Returns:
            True if click succeeded, False otherwise
        """
        selectors = [selector] + (fallback_selectors or [])

        for sel in selectors:
            try:
                await page.wait_for_selector(sel, timeout=timeout)
                await page.click(sel)
                await self.human_like_delay()
                return True
            except Exception:
                continue

        return False

    async def safe_fill(
        self,
        page: Page,
        selector: str,
        value: str,
        fallback_selectors: Optional[list[str]] = None,
        timeout: int = 5000,
    ) -> bool:
        """Fill a form field with fallback selectors.

        Args:
            page: Playwright page
            selector: Primary CSS selector
            value: Value to fill
            fallback_selectors: Alternative selectors to try
            timeout: Timeout in milliseconds

        Returns:
            True if fill succeeded, False otherwise
        """
        selectors = [selector] + (fallback_selectors or [])

        for sel in selectors:
            try:
                await page.wait_for_selector(sel, timeout=timeout)
                await page.fill(sel, value)
                await self.human_like_delay(200, 500)
                return True
            except Exception:
                continue

        return False

    async def safe_upload(
        self,
        page: Page,
        selector: str,
        file_path: str,
        timeout: int = 5000,
    ) -> bool:
        """Upload a file to an input element.

        Args:
            page: Playwright page
            selector: File input selector
            file_path: Path to file to upload
            timeout: Timeout in milliseconds

        Returns:
            True if upload succeeded, False otherwise
        """
        try:
            await page.wait_for_selector(selector, timeout=timeout)
            await page.set_input_files(selector, file_path)
            await self.human_like_delay()
            return True
        except Exception:
            return False

    async def wait_for_navigation(self, page: Page, timeout: int = 10000) -> bool:
        """Wait for page navigation to complete."""
        try:
            await page.wait_for_load_state("networkidle", timeout=timeout)
            return True
        except Exception:
            return False

    async def get_page_text(self, page: Page) -> str:
        """Extract all text content from the page."""
        return await page.inner_text("body")

    async def is_logged_in(self, page: Page, indicator_selector: str) -> bool:
        """Check if logged into a site by looking for an indicator element."""
        try:
            await page.wait_for_selector(indicator_selector, timeout=3000)
            return True
        except Exception:
            return False


# Singleton instance
browser_service = BrowserService()
