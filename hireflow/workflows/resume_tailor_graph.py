from typing import Dict, Any, List, TypedDict
import base64
import json
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.graph import StateGraph, END

from hireflow.config import settings
from hireflow.models.vector_db import get_vector_store

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

async def analyze_jd(state: ResumeTailorState):
    """Analyze the Job Description to extract key requirements."""
    llm = ChatGoogleGenerativeAI(
        model="gemini-1.5-flash",
        google_api_key=settings.active_gemini_api_key,
        temperature=0.1,
        max_retries=1
    )
    
    prompt = f"""Analyze the following job description and extract the key requirements.
Return JSON with the following structure:
{{
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
        jd_analysis = {"title": "Unknown", "must_have_keywords": [], "required_experience": ""}
        
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
    llm = ChatGoogleGenerativeAI(
        model="gemini-1.5-flash",
        google_api_key=settings.active_gemini_api_key,
        temperature=0.2,
        max_retries=1
    )
    
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

CANDIDATE'S RETRIEVED RELEVANT EXPERIENCE & SKILLS:
{retrieved_content}

CANDIDATE'S ORIGINAL RESUME DATA (FOR PERSONAL INFO, DATES, AND FULL CONTEXT):
{master_resume_str}

Create a tailored resume that strongly matches the Job Description.
Return ONLY valid JSON with this exact structure (no markdown blocks or other text):
{json_schema_example}

Do not invent new experiences not found in the retrieved data, but you may rephrase them to better match the JD keywords.

CRITICAL: For personal_info (name, email, phone, links), you MUST copy the values EXACTLY as they appear in the ORIGINAL RESUME DATA above. Do NOT use any placeholder values from the JSON schema example. If the original resume does not contain a value, use an empty string or empty list.
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

async def score_resumes(state: ResumeTailorState):
    """Score both the original and tailored resume against the JD."""
    llm = ChatGoogleGenerativeAI(
        model="gemini-1.5-flash",
        google_api_key=settings.active_gemini_api_key,
        temperature=0.0,
        max_retries=1
    )

    jd_analysis_str = json.dumps(state['jd_analysis'], indent=2)
    original_resume_str = json.dumps(state.get('master_resume_json', {}), indent=2)
    tailored_resume_str = state.get('tailored_resume', '{}')

    score_schema = '''{
  "input_scores": {
    "jd_match": 55,
    "skills_coverage": 60,
    "experience_relevance": 58,
    "ats_formatting": 65
  },
  "output_scores": {
    "jd_match": 88,
    "skills_coverage": 92,
    "experience_relevance": 85,
    "ats_formatting": 95
  }
}'''

    prompt = f"""You are an expert ATS (Applicant Tracking System) and resume analyst.

JOB DESCRIPTION REQUIREMENTS:
{jd_analysis_str}

Full Job Description: {state['job_description'][:1000]}

ORIGINAL RESUME (input):
{original_resume_str}

TAILORED RESUME (output):
{tailored_resume_str}

Score BOTH resumes against the Job Description on a scale of 0-100 for each metric:

- jd_match: What % of the JD's required keywords and responsibilities does this resume address?
- skills_coverage: What % of explicitly required skills listed in the JD are present in this resume?
- experience_relevance: How directly relevant is the overall work experience to this specific role? (0-100)
- ats_formatting: How clean and ATS-parseable is the resume? (structured sections, no tables/graphics = higher score)

The output resume is specifically tailored so its scores should generally be higher.
Return ONLY valid JSON matching this exact structure:
{score_schema}

All scores must be integers between 0 and 100. Be realistic and objective.
"""

    system_msg = SystemMessage(content="You are an ATS scoring engine. Always return valid JSON only. No markdown code blocks.")
    human_msg = HumanMessage(content=prompt)

    response = await llm.ainvoke([system_msg, human_msg])
    content = response.content.strip()
    if content.startswith("```json"):
        content = content[7:-3].strip()
    elif content.startswith("```"):
        content = content[3:-3].strip()

    try:
        scores = json.loads(content)
        return {
            "input_scores": scores.get("input_scores", {}),
            "output_scores": scores.get("output_scores", {})
        }
    except json.JSONDecodeError:
        default = {"jd_match": 0, "skills_coverage": 0, "experience_relevance": 0, "ats_formatting": 0}
        return {"input_scores": default, "output_scores": default}

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
    yield "event: log\ndata: Starting resume tailoring workflow...\n\n"
    
    # Cache the tailored resume from draft_resume node so score_resumes can use it
    cached_tailored = ""

    # We will use astream instead of ainvoke
    # astream yields the state after each node completes
    async for output in app.astream(inputs):
        # output is a dict like {"analyze_jd": {"jd_analysis": ...}}
        for node_name, state_update in output.items():
            if node_name == "analyze_jd":
                yield "event: log\ndata: Analyzed job description successfully.\n\n"
            elif node_name == "retrieve_experiences":
                yield "event: log\ndata: Retrieved relevant experiences from Vector DB.\n\n"
            elif node_name == "draft_resume":
                yield "event: log\ndata: Finalizing tailored resume rendering...\n\n"
                # Cache locally — score_resumes state_update won't include tailored_resume
                cached_tailored = state_update.get("tailored_resume", "")
            elif node_name == "score_resumes":
                yield "event: log\ndata: Scoring resumes against job description...\n\n"
                input_scores = state_update.get("input_scores", {})
                output_scores = state_update.get("output_scores", {})
                payload = {
                    "formatted_resume": cached_tailored,
                    "input_scores": input_scores,
                    "output_scores": output_scores
                }
                # Use base64 encoding so SSE newlines never corrupt the JSON payload
                encoded = base64.b64encode(json.dumps(payload).encode()).decode()
                yield f"event: result\ndata: {encoded}\n\n"

async def parse_resume_to_json(resume_text: str) -> Dict[str, Any]:
    """Parse raw resume text into the standard JSON structure using Langchain."""
    llm = ChatGoogleGenerativeAI(
        model=settings.gemini_model,
        google_api_key=settings.active_gemini_api_key,
        temperature=0.1
    )
    
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
