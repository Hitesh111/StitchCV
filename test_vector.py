import asyncio
import uuid
import json
from hireflow.models.vector_db import store_resume_in_vector_db, get_vector_store
from hireflow.workflows.resume_tailor_graph import retrieve_experiences

async def test():
    resume_id = str(uuid.uuid4())
    dummy_resume = {
        "skills": ["Python", "FastAPI"],
        "experience": [{"company": "Test Co", "title": "Developer", "description": ["Built things"]}]
    }
    
    print("Storing resume...")
    try:
        await store_resume_in_vector_db(dummy_resume, resume_id)
        print("Stored successfully.")
    except Exception as e:
        print("Error storing:", e)
        return

    print("Retrieving...")
    state = {
        "jd_analysis": {"must_have_keywords": ["python"]},
        "master_resume_id": resume_id
    }
    try:
        result = await retrieve_experiences(state)
        print("Retrieved:", result)
    except Exception as e:
        print("Error retrieving:", e)

if __name__ == "__main__":
    asyncio.run(test())
