from __future__ import annotations

"""Text-native resume PDF generation utilities."""

import io
import re
from typing import Any

from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib.utils import simpleSplit
from reportlab.pdfgen import canvas


PAGE_WIDTH, PAGE_HEIGHT = letter
LEFT_MARGIN = 0.58 * inch
RIGHT_MARGIN = 0.58 * inch
TOP_MARGIN = 0.52 * inch
BOTTOM_MARGIN = 0.52 * inch
CONTENT_WIDTH = PAGE_WIDTH - LEFT_MARGIN - RIGHT_MARGIN
DATE_GAP = 12


def _clean(value: Any) -> str:
    return str(value).strip() if value else ""


def _normalize_inline_markdown(text: str) -> str:
    """Flatten lightweight markdown markers for PDF output."""
    value = _clean(text)
    if not value:
        return ""
    value = re.sub(r"\*\*(.*?)\*\*", r"\1", value)
    value = re.sub(r"\*(.*?)\*", r"\1", value)
    return value


def _draw_two_column_line(
    pdf: canvas.Canvas,
    y: float,
    left_text: str,
    right_text: str,
    *,
    left_font: str,
    left_size: float,
    right_font: str,
    right_size: float,
    leading: float,
) -> float:
    """Draw a wrapped left column with a right-aligned date/value."""
    normalized_left = _normalize_inline_markdown(left_text)
    normalized_right = _normalize_inline_markdown(right_text)

    right_width = (
        pdf.stringWidth(normalized_right, right_font, right_size) if normalized_right else 0
    )
    available_left_width = CONTENT_WIDTH - (right_width + DATE_GAP if right_width else 0)
    left_lines = simpleSplit(normalized_left, left_font, left_size, max(available_left_width, 80))
    if not left_lines:
        left_lines = [""]

    pdf.setFont(left_font, left_size)
    for index, line in enumerate(left_lines):
        pdf.drawString(LEFT_MARGIN, y, line)
        if index == 0 and normalized_right:
            pdf.setFont(right_font, right_size)
            pdf.drawString(PAGE_WIDTH - RIGHT_MARGIN - right_width, y, normalized_right)
            pdf.setFont(left_font, left_size)
        y -= leading

    return y


def generate_resume_pdf_bytes(data: dict[str, Any]) -> bytes:
    """Render structured resume JSON into a text-native PDF."""
    buffer = io.BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=letter)
    pdf.setTitle(f"{_clean(data.get('personal_info', {}).get('name')) or 'tailored_resume'}")

    y = PAGE_HEIGHT - TOP_MARGIN

    def ensure_space(height_needed: float) -> None:
        nonlocal y
        if y - height_needed < BOTTOM_MARGIN:
            pdf.showPage()
            y = PAGE_HEIGHT - TOP_MARGIN

    def draw_text_block(
        text: str,
        *,
        font: str = "Helvetica",
        font_size: int = 11,
        leading: float = 14,
        indent: float = 0,
    ) -> None:
        nonlocal y
        if not text:
            return
        normalized = _normalize_inline_markdown(text)
        lines = simpleSplit(normalized, font, font_size, CONTENT_WIDTH - indent)
        ensure_space(len(lines) * leading + 2)
        pdf.setFont(font, font_size)
        for line in lines:
            pdf.drawString(LEFT_MARGIN + indent, y, line)
            y -= leading

    def draw_section_heading(title: str) -> None:
        nonlocal y
        ensure_space(22)
        pdf.setFont("Helvetica-Bold", 11.5)
        pdf.drawString(LEFT_MARGIN, y, title.upper())
        y -= 5
        pdf.setLineWidth(0.6)
        pdf.line(LEFT_MARGIN, y, PAGE_WIDTH - RIGHT_MARGIN, y)
        y -= 12

    personal_info = data.get("personal_info", {}) or {}
    summary = _normalize_inline_markdown(data.get("summary"))
    skills = data.get("skills", []) or []
    experience = data.get("experience", []) or []
    education = data.get("education", []) or []
    projects = data.get("projects", []) or []

    # Header
    name = _clean(personal_info.get("name")) or "Candidate Name"
    pdf.setFont("Helvetica-Bold", 23)
    pdf.drawString(LEFT_MARGIN, y, name)
    y -= 18

    contact_items = [
        _clean(personal_info.get("email")),
        _clean(personal_info.get("phone")),
        _clean(personal_info.get("location")),
        *[_clean(link).replace("https://", "").replace("http://", "") for link in personal_info.get("links", []) or [] if _clean(link)],
    ]
    contact_line = " • ".join(item for item in contact_items if item)
    if contact_line:
        draw_text_block(contact_line, font="Helvetica", font_size=10.5, leading=12)
    y -= 2
    pdf.setLineWidth(0.7)
    pdf.line(LEFT_MARGIN, y, PAGE_WIDTH - RIGHT_MARGIN, y)
    y -= 15

    if summary:
        draw_section_heading("Summary")
        draw_text_block(summary, font_size=11, leading=14)
        y -= 6

    if skills:
        draw_section_heading("Skills")
        draw_text_block(" • ".join(_normalize_inline_markdown(skill) for skill in skills if _clean(skill)), font_size=10.8, leading=14)
        y -= 6

    if experience:
        draw_section_heading("Experience")
        for exp in experience:
            title = _normalize_inline_markdown(exp.get("title"))
            company = _normalize_inline_markdown(exp.get("company"))
            date = _normalize_inline_markdown(exp.get("date"))
            location = _normalize_inline_markdown(exp.get("location"))
            bullets = exp.get("description", []) or []

            ensure_space(32)
            label = company
            if company and title:
                label += ", "
            label += title
            y = _draw_two_column_line(
                pdf,
                y,
                label,
                date,
                left_font="Helvetica-Bold" if not company else "Helvetica",
                left_size=11.3,
                right_font="Helvetica",
                right_size=10.3,
                leading=13,
            )

            if location:
                draw_text_block(location, font_size=10.2, leading=12)

            for bullet in bullets:
                bullet_text = _normalize_inline_markdown(bullet)
                if not bullet_text:
                    continue
                ensure_space(18)
                draw_text_block(f"• {bullet_text}", font_size=10.6, leading=13.2, indent=0)
            y -= 6

    if projects:
        draw_section_heading("Projects")
        for proj in projects:
            ensure_space(24)
            name = _normalize_inline_markdown(proj.get("name"))
            date = _normalize_inline_markdown(proj.get("date"))
            y = _draw_two_column_line(
                pdf,
                y,
                name,
                date,
                left_font="Helvetica-Bold",
                left_size=11.2,
                right_font="Helvetica",
                right_size=10.3,
                leading=13,
            )
            draw_text_block(_normalize_inline_markdown(proj.get("description")), font_size=10.6, leading=13.2)
            y -= 6

    if education:
        draw_section_heading("Education")
        for edu in education:
            ensure_space(24)
            institution = _normalize_inline_markdown(edu.get("institution"))
            degree = _normalize_inline_markdown(edu.get("degree"))
            date = _normalize_inline_markdown(edu.get("date"))
            y = _draw_two_column_line(
                pdf,
                y,
                institution,
                date,
                left_font="Helvetica-Bold",
                left_size=11.2,
                right_font="Helvetica",
                right_size=10.3,
                leading=13,
            )
            draw_text_block(degree, font_size=10.6, leading=13.2)
            y -= 6

    pdf.save()
    return buffer.getvalue()
