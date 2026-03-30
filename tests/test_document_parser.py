import pytest

from stitchcv.utils.document_parser import extract_job_description_from_html
from stitchcv.utils.document_parser import extract_job_description_from_url


def test_extract_job_description_from_html_prefers_description_blocks():
    html = """
    <html>
      <body>
        <nav>Ignore navigation</nav>
        <main>
          <section class="job-description">
            <h2>About the role</h2>
            <p>We are looking for a backend engineer to build distributed systems.</p>
            <p>You will work with Python, FastAPI, PostgreSQL, Docker, and cloud infrastructure.</p>
            <p>Responsibilities include owning APIs, improving reliability, collaborating with product, and shipping features.</p>
            <p>Requirements include 4+ years of experience, strong SQL skills, and excellent communication.</p>
            <p>This is a remote-friendly role with strong growth potential and ownership.</p>
          </section>
        </main>
      </body>
    </html>
    """

    extracted = extract_job_description_from_html(html)

    assert "backend engineer" in extracted
    assert "Python, FastAPI, PostgreSQL" in extracted
    assert "Ignore navigation" not in extracted


from unittest.mock import patch

@pytest.mark.asyncio
async def test_extract_job_description_from_url_rejects_linkedin_listing_pages():
    with patch('stitchcv.scrapers.linkedin_scraper.LinkedInScraper.get_job_details') as mock_scrape:
        mock_scrape.return_value = {}  # Mock empty details
        with pytest.raises(ValueError, match="Could not read a job description"):
            await extract_job_description_from_url(
                "https://www.linkedin.com/jobs/collections/recommended/"
            )
