from typing import Dict, Any, List, TypedDict
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.graph import StateGraph, END
import json

from hireflow.config import settings
from hireflow.models.vector_db import get_vector_store

# Define the State for the workflow
class ResumeTailorState(TypedDict):
    job_description: str
    master_resume_id: str
    jd_analysis: Dict[str, Any]
    retrieved_content: str
    tailored_resume: Dict[str, Any]

async def analyze_jd(state: ResumeTailorState):
    """Analyze the Job Description to extract key requirements."""
    llm = ChatGoogleGenerativeAI(
        model=settings.gemini_model,
        google_api_key=settings.gemini_api_key,
        temperature=0.1
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
        model=settings.gemini_model,
        google_api_key=settings.gemini_api_key,
        temperature=0.2
    )
    
    prompt = f"""You are an expert resume writer. Create a tailored resume that strongly matches the Job Description.
    
JOB DESCRIPTION ANALYSIS:
{json.dumps(state['jd_analysis'], indent=2)}

CANDIDATE'S RETRIEVED RELEVANT EXPERIENCE & SKILLS:
{state.get('retrieved_content', 'No specific context retrieved, use general knowledge if applicable or leave blank.')}

Create a structured JSON resume that highlights the candidate's matching skills and experiences from the retrieved context. Do not invent new experiences not found in the retrieved data, but you may rephrase them to better match the JD keywords.

Return EXACTLY this JSON structure:
{{
    "summary": "Professional summary paragraph tailored to the JD",
    "skills": ["relevant skill 1", "relevant skill 2"],
    "experience": [
        {{
            "company": "Company Name",
            "title": "Job Title",
            "location": "Location",
            "date": "Date Range",
            "description": ["tailored bullet point 1", "tailored bullet point 2"]
        }}
    ],
    "education": [
        {{
            "institution": "School Name",
            "degree": "Degree",
            "date": "Date"
        }}
    ]
}}
"""
    system_msg = SystemMessage(content="You are an expert resume algorithm. Always return valid JSON only. Do not wrap in markdown code blocks.")
    human_msg = HumanMessage(content=prompt)
    
    response = await llm.ainvoke([system_msg, human_msg])
    content = response.content.strip()
    if content.startswith("```json"):
        content = content[7:-3].strip()
    elif content.startswith("```"):
        content = content[3:-3].strip()
        
    try:
        tailored = json.loads(content)
    except json.JSONDecodeError:
        tailored = {}
        
    return {"tailored_resume": tailored}

# Build the Graph
workflow = StateGraph(ResumeTailorState)

# Add nodes
workflow.add_node("analyze_jd", analyze_jd)
workflow.add_node("retrieve_experiences", retrieve_experiences)
workflow.add_node("draft_resume", draft_resume)

# Set edges
workflow.set_entry_point("analyze_jd")
workflow.add_edge("analyze_jd", "retrieve_experiences")
workflow.add_edge("retrieve_experiences", "draft_resume")
workflow.add_edge("draft_resume", END)

# Compile
app = workflow.compile()

import json

async def run_resume_tailor_graph(job_description: str, master_resume_id: str):
    """Execute the LangGraph workflow and yield Server-Sent Events."""
    inputs = {
        "job_description": job_description,
        "master_resume_id": master_resume_id
    }
    
    # Send initial event
    yield f"event: log\ndata: Starting resume tailoring workflow...\n\n"
    
    # We will use astream instead of ainvoke
    # astream yields the state after each node completes
    async for output in app.astream(inputs):
        # output is a dict like {"analyze_jd": {"jd_analysis": ...}}
        for node_name, state_update in output.items():
            if node_name == "analyze_jd":
                yield f"event: log\ndata: Analyzed job description successfully.\n\n"
            elif node_name == "retrieve_experiences":
                yield f"event: log\ndata: Retrieved relevant experiences from Vector DB.\n\n"
            elif node_name == "draft_resume":
                yield f"event: log\ndata: Finalizing tailored resume rendering...\n\n"
                tailored = state_update.get("tailored_resume", {})
                escaped_json = json.dumps(tailored)
                # Ensure no newlines break the SSE data format
                escaped_json = escaped_json.replace("\n", "\\n")
                yield f"event: result\ndata: {escaped_json}\n\n"

async def parse_resume_to_json(resume_text: str) -> Dict[str, Any]:
    """Parse raw resume text into the standard JSON structure using Langchain."""
    llm = ChatGoogleGenerativeAI(
        model=settings.gemini_model,
        google_api_key=settings.gemini_api_key,
        temperature=0.1
    )
    
    prompt = f"""Convert the following resume text into a structured JSON object.

RESUME TEXT:
{resume_text}

Extract into this exact JSON structure (leave arrays or strings empty if not found):
{{
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
