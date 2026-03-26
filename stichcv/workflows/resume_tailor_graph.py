from typing import Dict, Any, List, TypedDict
import base64
import json
import re
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_groq import ChatGroq
from langchain_openai import ChatOpenAI
from langgraph.graph import StateGraph, END

from stichcv.config import settings
from stichcv.models.vector_db import get_vector_store

# Define the State for the workflow
class ResumeTailorState(TypedDict):
    job_description: str
    master_resume_id: str
    master_resume_json: Dict[str, Any]
    jd_analysis: Dict[str, Any]
    retrieved_content: str
    tailored_resume: str
    input_scores: Dict[str, Any]
    output_scores: Dict[str, Any]

def _get_fallback_llm(temperature: float = 0.1, max_retries: int = 1):
    """Returns a Gemini LLM configured with Groq and OpenRouter fallbacks if keys are available."""
    gemini = ChatGoogleGenerativeAI(
        model=settings.gemini_model,
        google_api_key=settings.active_gemini_api_key,
        temperature=temperature,
        max_retries=max_retries
    )
    
    fallbacks = []
    
    if settings.groq_api_key:
        groq = ChatGroq(
            model="llama-3.3-70b-versatile",
            api_key=settings.groq_api_key,
            temperature=temperature,
            max_retries=max_retries
        )
        fallbacks.append(groq)
        
    if settings.openrouter_api_key:
        openrouter = ChatOpenAI(
            model="anthropic/claude-3-haiku",
            api_key=settings.openrouter_api_key,
            base_url="https://openrouter.ai/api/v1",
            temperature=temperature,
            max_retries=max_retries
        )
        fallbacks.append(openrouter)
        
    if fallbacks:
        return gemini.with_fallbacks(fallbacks)
    
    return gemini

async def analyze_jd(state: ResumeTailorState):
    """Analyze the Job Description to extract key requirements."""
    llm = _get_fallback_llm(temperature=0.1, max_retries=1)
    
    prompt = f"""Analyze the following job description and extract the key requirements.
Return JSON with the following structure:
{{
    "company": "Company Name",
    "title": "Job Title",
    "must_have_keywords": ["keyword1", "keyword2"],
    "required_experience": "Brief summary of required experience"
}}

Job Description:
{state['job_description']}
"""
    # Force json output
    system_msg = SystemMessage(content="You are an expert HR analyst. Always return valid JSON only. Do not wrap in markdown code blocks.")
    human_msg = HumanMessage(content=prompt)
    
    response = await llm.ainvoke([system_msg, human_msg])
    content = response.content.strip()
    if content.startswith("```json"):
        content = content[7:-3].strip()
    elif content.startswith("```"):
        content = content[3:-3].strip()
        
    try:
        jd_analysis = json.loads(content)
    except json.JSONDecodeError:
        jd_analysis = {"company": "Unknown", "title": "Unknown", "must_have_keywords": [], "required_experience": ""}
        
    return {"jd_analysis": jd_analysis}

async def retrieve_experiences(state: ResumeTailorState):
    """Retrieve relevant resume experiences from PGVector based on JD."""
    vectorstore = get_vector_store()
    
    # We use the extracted keywords as the search query
    keywords = state.get("jd_analysis", {}).get("must_have_keywords", [])
    query = " ".join(keywords) if keywords else state['job_description'][:200]
    
    # Search the vector DB for this specific master resume
    filters = {"resume_id": state['master_resume_id']}
    
    try:
        results = await vectorstore.asimilarity_search(query, k=10, filter=filters)
        
        # Format the retrieved content into a string context
        context_parts = []
        for doc in results:
            context_parts.append(f"--- {doc.metadata.get('type', 'item').upper()} ---\\n{doc.page_content}")
            
        retrieved_content = "\\n\\n".join(context_parts)
    except Exception as e:
        print(f"Vector search failed: {e}. Ensure DB is running and vectorstore is initialized.")
        retrieved_content = ""
        
    return {"retrieved_content": retrieved_content}

async def draft_resume(state: ResumeTailorState):
    """Draft the final tailored resume JSON using the retrieved experiences."""
    llm = _get_fallback_llm(temperature=0.2, max_retries=1)
    
    # Extract values BEFORE building f-string to avoid {{}} TypeError bug
    master_resume_data = state.get('master_resume_json', {})
    master_resume_str = json.dumps(master_resume_data, indent=2)
    retrieved_content = state.get('retrieved_content', 'No specific context retrieved.')
    jd_analysis_str = json.dumps(state['jd_analysis'], indent=2)

    json_schema_example = '''{
  "personal_info": {
    "name": "Jane Doe",
    "email": "jane@example.com",
    "phone": "555-555-5555",
    "links": ["github.com/jane", "linkedin.com/in/jane"]
  },
  "summary": "Tailored professional summary highlighting key JD skills...",
  "skills": ["Skill 1", "Skill 2"],
  "experience": [
    {
      "company": "Company A",
      "title": "Role",
      "date": "Jan 2020 - Present",
      "location": "City, ST",
      "description": [
        "Tailored bullet point 1",
        "Tailored bullet point 2"
      ]
    }
  ],
  "education": [
    {
      "institution": "University X",
      "degree": "B.S. Computer Science",
      "date": "2015 - 2019"
    }
  ],
  "projects": []
}'''

    prompt = f"""You are an expert resume writer. Create a tailored resume that strongly matches the Job Description.

JOB DESCRIPTION ANALYSIS:
{jd_analysis_str}

CANDIDATE'S RETRIEVED HIGH-PRIORITY CONTEXT:
{retrieved_content}

CANDIDATE'S ORIGINAL RESUME DATA (USE THIS AS THE BASE STRUCTURAL FOUNDATION):
{master_resume_str}

Create a tailored resume that strongly matches the Job Description.
Return ONLY valid JSON with this exact structure (no markdown blocks or other text):
{json_schema_example}

CRITICAL INSTRUCTIONS TO PREVENT DATA LOSS:
1. You MUST preserve ALL sections from the ORIGINAL RESUME. Do NOT delete any jobs from "experience", any entries from "education", or any entries from "projects".
2. You must keep the original company names, job titles, project names, and dates EXACTLY as they appear in the ORIGINAL RESUME DATA.
3. Your job is to TAILOR the 'summary', the 'skills' list, and the 'description' bullet points within the experiences/projects to better match the Job Description Analysis and the High-Priority Context.
4. For personal_info (name, email, phone, links), copy the values EXACTLY from the ORIGINAL RESUME. Do NOT use placeholders. If missing, use empty strings/lists.
"""
    system_msg = SystemMessage(content="You are an expert resume algorithm. Always output valid JSON. Do not wrap in markdown code blocks.")
    human_msg = HumanMessage(content=prompt)
    
    response = await llm.ainvoke([system_msg, human_msg])
    content = response.content.strip()
    if content.startswith("```json"):
        content = content[7:-3].strip()
    elif content.startswith("```"):
        content = content[3:-3].strip()
        
    try:
        # Validate that it is parseable JSON before saving
        json.loads(content)
        tailored = content
    except json.JSONDecodeError:
        tailored = json.dumps({"error": "Failed to generate valid JSON."})
        
    return {"tailored_resume": tailored}

STOPWORDS = {
    "the", "and", "for", "with", "from", "that", "this", "your", "into", "will", "have", "has",
    "are", "our", "you", "job", "role", "team", "years", "year", "plus", "more", "than", "not",
    "all", "but", "can", "its", "their", "them", "about", "build", "building", "using", "used",
    "strong", "excellent", "good", "best", "work", "working", "experience", "services", "service",
    "software", "engineering", "engineer", "developer", "develop", "applications", "application",
    "large", "scale", "system", "systems", "backend", "senior", "sde", "ability", "skills",
    "written", "verbal", "communication", "passion", "problems", "complex", "general",
}


def _normalize_text(value: Any) -> str:
    return str(value or "").lower()


def _tokenize(text: str) -> set[str]:
    return {
        token for token in re.findall(r"[a-z0-9][a-z0-9\+\#\./-]{1,}", _normalize_text(text))
        if token not in STOPWORDS
    }


def _extract_keyword_phrases(job_description: str, jd_analysis: dict[str, Any]) -> list[str]:
    phrases: list[str] = []
    seen = set()

    for key in ("must_have_keywords", "key_skills"):
        for item in jd_analysis.get(key, []) or []:
            phrase = str(item).strip().lower()
            if phrase and phrase not in seen:
                seen.add(phrase)
                phrases.append(phrase)

    skill_patterns = [
        r"\bnode\.?js\b",
        r"\bmongodb\b",
        r"\bgoogle cloud\b",
        r"\bgcp\b",
        r"\baws\b",
        r"\bci/cd\b",
        r"\bredis\b",
        r"\brabbitmq\b",
        r"\bmicroservices?\b",
        r"\bdistributed systems?\b",
        r"\bdesign patterns?\b",
        r"\bperformance monitoring\b",
        r"\bkubernetes\b",
        r"\bdocker\b",
        r"\btypescript\b",
        r"\bjavascript\b",
    ]
    jd_lower = _normalize_text(job_description)
    for pattern in skill_patterns:
        match = re.search(pattern, jd_lower)
        if match:
            phrase = match.group(0).strip().lower()
            if phrase not in seen:
                seen.add(phrase)
                phrases.append(phrase)

    return phrases


def _resume_text(resume: dict[str, Any]) -> str:
    parts: list[str] = []
    parts.append(_normalize_text(resume.get("summary", "")))
    parts.extend(_normalize_text(skill) for skill in resume.get("skills", []) or [])

    for section in ("experience", "projects", "education"):
        for item in resume.get(section, []) or []:
            for key, value in item.items():
                if isinstance(value, list):
                    parts.extend(_normalize_text(v) for v in value)
                else:
                    parts.append(_normalize_text(value))

    return "\n".join(part for part in parts if part)


def _extract_years(text: str) -> int:
    values = [int(value) for value in re.findall(r"(\d+)\s*\+?\s*(?:years?|yrs?)", text.lower())]
    return max(values) if values else 0


def _score_jd_match(resume: dict[str, Any], job_description: str, jd_analysis: dict[str, Any]) -> int:
    phrases = _extract_keyword_phrases(job_description, jd_analysis)
    if not phrases:
        return 0

    resume_blob = _resume_text(resume)
    matched = sum(1 for phrase in phrases if phrase in resume_blob)
    return round((matched / len(phrases)) * 100)


def _score_skills_coverage(resume: dict[str, Any], job_description: str, jd_analysis: dict[str, Any]) -> int:
    required = _extract_keyword_phrases(job_description, jd_analysis)
    if not required:
        return 0

    resume_skills = {_normalize_text(skill) for skill in resume.get("skills", []) or []}
    resume_blob = _resume_text(resume)
    covered = 0
    for phrase in required:
        phrase_tokens = _tokenize(phrase)
        if phrase in resume_skills or phrase in resume_blob:
            covered += 1
        elif phrase_tokens and phrase_tokens.issubset(_tokenize(resume_blob)):
            covered += 1

    return round((covered / len(required)) * 100)


def _score_experience_relevance(resume: dict[str, Any], job_description: str, jd_analysis: dict[str, Any]) -> int:
    resume_blob = _resume_text(resume)
    keyword_score = _score_jd_match(resume, job_description, jd_analysis)

    jd_years = _extract_years(job_description)
    resume_years = _extract_years(resume_blob)
    if jd_years <= 0:
        years_score = 70
    elif resume_years >= jd_years:
        years_score = 100
    else:
        years_score = max(0, round((resume_years / jd_years) * 100))

    title_keywords = {"engineer", "developer", "backend", "software", "senior", "lead", "architect"}
    titles = " ".join(_normalize_text(exp.get("title", "")) for exp in resume.get("experience", []) or [])
    title_overlap = len(_tokenize(titles) & title_keywords)
    title_score = min(100, 40 + title_overlap * 15) if titles else 20

    return round(keyword_score * 0.45 + years_score * 0.35 + title_score * 0.20)


def _score_ats_formatting(resume: dict[str, Any]) -> int:
    score = 0

    personal_info = resume.get("personal_info", {}) or {}
    if personal_info.get("name"):
        score += 10
    if personal_info.get("email"):
        score += 10
    if personal_info.get("phone"):
        score += 10
    if resume.get("summary"):
        score += 10
    if resume.get("skills"):
        score += 15
    if resume.get("experience"):
        score += 20
    if resume.get("education"):
        score += 10

    experiences = resume.get("experience", []) or []
    bullets = sum(len(exp.get("description", []) or []) for exp in experiences)
    if bullets >= 4:
        score += 10

    structured_entries = 0
    for exp in experiences:
        if exp.get("title") and exp.get("company") and exp.get("date"):
            structured_entries += 1
    if experiences:
        score += round((structured_entries / len(experiences)) * 15)

    return min(100, score)


def _compute_resume_scores(resume: dict[str, Any], job_description: str, jd_analysis: dict[str, Any]) -> dict[str, int]:
    return {
        "jd_match": _score_jd_match(resume, job_description, jd_analysis),
        "skills_coverage": _score_skills_coverage(resume, job_description, jd_analysis),
        "experience_relevance": _score_experience_relevance(resume, job_description, jd_analysis),
        "ats_formatting": _score_ats_formatting(resume),
    }


async def score_resumes(state: ResumeTailorState):
    """Score both the original and tailored resume deterministically against the JD."""
    original_resume = state.get("master_resume_json", {}) or {}
    try:
        tailored_resume = json.loads(state.get("tailored_resume", "{}"))
    except json.JSONDecodeError:
        tailored_resume = {}

    jd_analysis = state.get("jd_analysis", {}) or {}
    job_description = state.get("job_description", "")

    return {
        "input_scores": _compute_resume_scores(original_resume, job_description, jd_analysis),
        "output_scores": _compute_resume_scores(tailored_resume, job_description, jd_analysis),
    }

# Build the Graph
workflow = StateGraph(ResumeTailorState)

# Add nodes
workflow.add_node("analyze_jd", analyze_jd)
workflow.add_node("retrieve_experiences", retrieve_experiences)
workflow.add_node("draft_resume", draft_resume)
workflow.add_node("score_resumes", score_resumes)

# Set edges
workflow.set_entry_point("analyze_jd")
workflow.add_edge("analyze_jd", "retrieve_experiences")
workflow.add_edge("retrieve_experiences", "draft_resume")
workflow.add_edge("draft_resume", "score_resumes")
workflow.add_edge("score_resumes", END)

# Compile
app = workflow.compile()


async def run_resume_tailor_graph(job_description: str, master_resume_id: str, master_resume_json: Dict[str, Any]):
    """Execute the LangGraph workflow and yield Server-Sent Events."""
    inputs = {
        "job_description": job_description,
        "master_resume_id": master_resume_id,
        "master_resume_json": master_resume_json
    }
    
    # Send initial event
    yield "event: log\ndata: 🚀 Reading your resume and the job description...\n\n"
    
    # Cache the tailored resume from draft_resume node so score_resumes can use it
    cached_tailored = ""
    cached_jd_analysis = {}

    # We will use astream instead of ainvoke
    # astream yields the state after each node completes
    async for output in app.astream(inputs):
        # output is a dict like {"analyze_jd": {"jd_analysis": ...}}
        for node_name, state_update in output.items():
            if node_name == "analyze_jd":
                cached_jd_analysis = state_update.get("jd_analysis", {})
                yield "event: log\ndata: 🔍 Mapped the key skills and requirements from the job posting.\n\n"
            elif node_name == "retrieve_experiences":
                yield "event: log\ndata: ✨ Found your most relevant experiences for this role.\n\n"
            elif node_name == "draft_resume":
                yield "event: log\ndata: ✍️ Writing your tailored resume — almost there!\n\n"
                # Cache locally — score_resumes state_update won't include tailored_resume
                cached_tailored = state_update.get("tailored_resume", "")
            elif node_name == "score_resumes":
                yield "event: log\ndata: 📊 Calculating your ATS match score — done!\n\n"
                input_scores = state_update.get("input_scores", {})
                output_scores = state_update.get("output_scores", {})
                
                # Fetch metadata from JD analysis if missing
                payload = {
                    "formatted_resume": cached_tailored,
                    "input_scores": input_scores,
                    "output_scores": output_scores,
                    "company": cached_jd_analysis.get("company", "Target Company"),
                    "title": cached_jd_analysis.get("title", "Tailored Role")
                }
                # Use base64 encoding so SSE newlines never corrupt the JSON payload
                encoded = base64.b64encode(json.dumps(payload).encode()).decode()
                yield f"event: result\ndata: {encoded}\n\n"

async def parse_resume_to_json(resume_text: str) -> Dict[str, Any]:
    """Parse raw resume text into the standard JSON structure using Langchain."""
    llm = _get_fallback_llm(temperature=0.1)
    
    prompt = f"""Convert the following resume text into a structured JSON object.

RESUME TEXT:
{resume_text}

Extract into this exact JSON structure (leave arrays or strings empty if not found):
{{
    "personal_info": {{
        "name": "Candidate's full name",
        "email": "email address",
        "phone": "phone number",
        "links": ["linkedin URL", "github URL", "portfolio URL"]
    }},
    "summary": "Professional summary paragraph",
    "skills": ["skill 1", "skill 2"],
    "experience": [
        {{
            "company": "Company Name",
            "title": "Job Title",
            "location": "Location",
            "date": "Date Range",
            "description": ["bullet point 1", "bullet point 2"]
        }}
    ],
    "education": [
        {{
            "institution": "School Name",
            "degree": "Degree",
            "date": "Date Range"
        }}
    ],
    "projects": [
        {{
            "name": "Project Name",
            "description": "Description"
        }}
    ]
}}"""
    system_msg = SystemMessage(content="You are an expert resume parser algorithm. Always return valid JSON only. Do not wrap in markdown code blocks.")
    human_msg = HumanMessage(content=prompt)
    
    response = await llm.ainvoke([system_msg, human_msg])
    content = response.content.strip()
    if content.startswith("```json"):
        content = content[7:-3].strip()
    elif content.startswith("```"):
        content = content[3:-3].strip()
        
    try:
        parsed = json.loads(content)
    except json.JSONDecodeError:
        parsed = {}
        
    return parsed
