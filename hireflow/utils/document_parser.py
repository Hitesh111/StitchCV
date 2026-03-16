import io
import re
from functools import lru_cache
from urllib.parse import parse_qs, urlparse

import aiohttp
from bs4 import BeautifulSoup
import fitz
import numpy as np
from pypdf import PdfReader
from docx import Document
from PIL import Image
from rapidocr_onnxruntime import RapidOCR

from hireflow.services.browser_service import browser_service


@lru_cache(maxsize=1)
def get_ocr_engine() -> RapidOCR:
    """Lazily initialize the OCR engine."""
    return RapidOCR()

def extract_text_from_pdf(file_bytes: bytes) -> str:
    """Extract text from a PDF file."""
    try:
        reader = PdfReader(io.BytesIO(file_bytes))
        text = []
        for page in reader.pages:
            page_text = page.extract_text()
            if page_text:
                text.append(page_text)
        extracted = "\n".join(text).strip()
        if not extracted:
            extracted = extract_text_from_image_pdf(file_bytes)
        if not extracted:
            raise ValueError(
                "No extractable text was found in this PDF, even after OCR. If this is a HireFlow-generated PDF, use the JSON export instead."
            )
        return extracted
    except Exception as e:
        raise ValueError(f"Failed to parse PDF: {str(e)}")

def extract_text_from_docx(file_bytes: bytes) -> str:
    """Extract text from a DOCX file."""
    try:
        doc = Document(io.BytesIO(file_bytes))
        text = [paragraph.text for paragraph in doc.paragraphs if paragraph.text]
        return "\n".join(text)
    except Exception as e:
        raise ValueError(f"Failed to parse DOCX: {str(e)}")


def _clean_text(text: str) -> str:
    """Normalize extracted text for downstream LLM use."""
    lines = [line.strip() for line in text.splitlines()]
    return "\n".join(line for line in lines if line)


def extract_job_description_from_html(html: str) -> str:
    """Extract the most likely job description block from raw HTML."""
    soup = BeautifulSoup(html, "lxml")

    for tag in soup(["script", "style", "noscript", "svg", "form", "button", "footer", "nav"]):
        tag.decompose()

    selector_candidates = [
        "[data-testid*='job-description']",
        "[class*='job-description']",
        "[id*='job-description']",
        "[class*='description']",
        "[id*='description']",
        "article",
        "main",
    ]

    text_candidates: list[str] = []
    seen = set()

    for selector in selector_candidates:
        for node in soup.select(selector):
            text = _clean_text(node.get_text("\n", strip=True))
            if len(text) >= 400 and text not in seen:
                seen.add(text)
                text_candidates.append(text)

    body = soup.body or soup
    body_text = _clean_text(body.get_text("\n", strip=True))
    if len(body_text) >= 400 and body_text not in seen:
        text_candidates.append(body_text)

    if not text_candidates:
        return ""

    # Prefer the longest candidate, which is usually the full JD block.
    return max(text_candidates, key=len)


def _extract_linkedin_job_id(parsed_url) -> str:
    """Pull a LinkedIn job ID from currentJobId or /jobs/view/<id>/ URLs."""
    current_job_id = parse_qs(parsed_url.query).get("currentJobId", [""])[0].strip()
    if current_job_id:
        return current_job_id

    match = re.search(r"/jobs/view/(\d+)", parsed_url.path)
    if match:
        return match.group(1)

    return ""


def extract_text_from_image_pdf(file_bytes: bytes) -> str:
    """OCR fallback for image-only PDFs."""
    document = fitz.open(stream=file_bytes, filetype="pdf")
    ocr_engine = get_ocr_engine()
    page_texts = []

    for page in document:
        pix = page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
        image = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
        result, _ = ocr_engine(np.array(image))
        if not result:
            continue

        lines = []
        for item in result:
            if len(item) < 2:
                continue
            text_block = item[1]
            if isinstance(text_block, (list, tuple)) and text_block:
                line_text = str(text_block[0]).strip()
            else:
                line_text = str(text_block).strip()
            if line_text:
                lines.append(line_text)

        if lines:
            page_texts.append("\n".join(lines))

    return "\n\n".join(page_texts).strip()


async def extract_job_description_from_url(url: str) -> str:
    """Fetch and extract a job description from a public job posting URL."""
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise ValueError("Enter a valid http(s) job URL")

    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
        )
    }

    hostname = parsed.netloc.lower()

    if "linkedin.com" in hostname:
        job_id = _extract_linkedin_job_id(parsed)
        linkedin_job_url = url

        if job_id:
            guest_url = f"https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/{job_id}"
            timeout = aiohttp.ClientTimeout(total=20)
            async with aiohttp.ClientSession(timeout=timeout, headers=headers) as session:
                try:
                    async with session.get(guest_url, allow_redirects=True) as response:
                        response.raise_for_status()
                        guest_html = await response.text()
                        extracted = extract_job_description_from_html(guest_html)
                        if extracted:
                            return extracted
                except Exception:
                    pass

            linkedin_job_url = f"https://www.linkedin.com/jobs/view/{job_id}/"

        from hireflow.scrapers.linkedin_scraper import LinkedInScraper

        details = await LinkedInScraper().get_job_details(linkedin_job_url)
        if details and details.get("job_description", "").strip():
            return details["job_description"].strip()

        raise ValueError(
            "Could not read a job description from that LinkedIn page. Open the job in LinkedIn first and make sure you are logged in."
        )

    html = ""
    try:
        timeout = aiohttp.ClientTimeout(total=20)
        async with aiohttp.ClientSession(timeout=timeout, headers=headers) as session:
            async with session.get(url, allow_redirects=True) as response:
                response.raise_for_status()
                html = await response.text()
    except Exception:
        html = ""

    if html:
        extracted = extract_job_description_from_html(html)
        if extracted:
            return extracted

    async with browser_service.new_page() as page:
        await page.goto(url, wait_until="domcontentloaded")
        await browser_service.wait_for_navigation(page)
        rendered_html = await page.content()

    extracted = extract_job_description_from_html(rendered_html)
    if extracted:
        return extracted

    raise ValueError("Could not extract a job description from that URL")
