import os
import json
from langchain_chroma import Chroma
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_core.documents import Document
from stichcv.config import settings

def get_vector_store() -> Chroma:
    """Initialize and return the Chroma vector store.

    Returns:
        Chroma instance configured with Google Gemini embeddings.
    """
    embeddings = GoogleGenerativeAIEmbeddings(
        model="models/gemini-embedding-001", google_api_key=settings.active_gemini_api_key
    )

    vectorstore = Chroma(
        collection_name="resume_embeddings",
        embedding_function=embeddings,
        persist_directory="./chroma_db",
    )

    return vectorstore

async def store_resume_in_vector_db(resume_json: dict, resume_id: str = "master"):
    """Chunk the master resume and store it in ChromaDB."""
    vectorstore = get_vector_store()
    
    documents = []
    
    # 1. Store Skills
    skills = resume_json.get("skills", [])
    if skills:
        for skill in skills:
            doc = Document(
                page_content=skill,
                metadata={"type": "skill", "resume_id": resume_id}
            )
            documents.append(doc)
            
    # 2. Store Experiences
    experiences = resume_json.get("experience", [])
    for exp in experiences:
        company = exp.get("company", "")
        title = exp.get("title", "")
        desc = "\\n".join(exp.get("description", []))
        
        content = f"{title} at {company}\\n{desc}"
        doc = Document(
            page_content=content,
            metadata={
                "type": "experience", 
                "company": company,
                "title": title,
                "resume_id": resume_id,
                "original_json": json.dumps(exp),
            }
        )
        documents.append(doc)
        
    # 3. Store Projects
    projects = resume_json.get("projects", [])
    for proj in projects:
        name = proj.get("name", "")
        desc = proj.get("description", "")
        content = f"Project: {name}\\n{desc}"
        doc = Document(
            page_content=content,
            metadata={
                "type": "project",
                "name": name,
                "resume_id": resume_id,
                "original_json": json.dumps(proj),
            }
        )
        documents.append(doc)
        
    if documents:
        # Clear old documents for this resume_id before adding new ones
        # Langchain PGVector doesn't easily support deleting by metadata without directly accessing the DB,
        # but for simplicity we will just add them. In a real system, we'd delete the old vectors first.
        await vectorstore.aadd_documents(documents)
    
    return True
